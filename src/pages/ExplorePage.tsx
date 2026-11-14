import L from 'leaflet';
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Check,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Radio,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProvenanceLabel } from '../components/ProvenanceLabel';
import { GIBS_LAYER_OPTIONS } from '../data/sarBenchmarks';
import {
  fetchMapsGroundingContext,
  queryNasaCmrGranules,
  querySentinel1Stac,
  searchLocations,
  type GeocodeResult,
  type LiveCmrGranule,
  type LiveStacScene,
  type MapsGroundingResponse,
} from '../lib/satelliteApi';
import type {
  HazardCategory,
  PageId,
  SarObservationSite,
} from '../types/sar';

interface ExplorePageProps {
  sites: SarObservationSite[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  onOpenInPage: (siteId: string, page: PageId) => void;
  onSaveBookmark: (site: SarObservationSite, note: string) => void;
  bookmarkedSiteIds: string[];
}

type BasemapId = 'esri-dark' | 'esri-imagery' | 'gibs-bluemarble';

const HAZARD_FILTERS: { id: 'all' | HazardCategory; label: string }[] = [
  { id: 'all', label: 'All Sites' },
  { id: 'cryosphere', label: 'Glaciers & Ice' },
  { id: 'flood', label: 'Floods' },
  { id: 'deforestation', label: 'Forests' },
  { id: 'deformation', label: 'Earthquakes' },
];

export function ExplorePage({
  sites,
  selectedSiteId,
  onSelectSite,
  onOpenInPage,
  onSaveBookmark,
  bookmarkedSiteIds,
}: ExplorePageProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const liveSarLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [hazardFilter, setHazardFilter] = useState<'all' | HazardCategory>('all');
  const [basemap, setBasemap] = useState<BasemapId>('esri-dark');
  const [gibsOverlayId, setGibsOverlayId] = useState<string>('none');
  const [gibsDate, setGibsDate] = useState<string>('2024-08-01');
  const [gibsOpacity, setGibsOpacity] = useState<number>(75);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tileNotice, setTileNotice] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // Live Geocoding & Geolocation
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoResults, setGeoResults] = useState<GeocodeResult[]>([]);
  const [customRegion, setCustomRegion] = useState<GeocodeResult | null>(null);

  // Live NASA CMR & Sentinel-1 STAC
  const [satLoading, setSatLoading] = useState(false);
  const [satError, setSatError] = useState<string | null>(null);
  const [cmrGranules, setCmrGranules] = useState<LiveCmrGranule[]>([]);
  const [stacScenes, setStacScenes] = useState<LiveStacScene[]>([]);
  const [activeStacLayerId, setActiveStacLayerId] = useState<string | null>(null);

  // Google Maps Grounding via Gemini
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsData, setMapsData] = useState<MapsGroundingResponse | null>(null);

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sites.filter((s) => {
      const matchesHazard = hazardFilter === 'all' || s.hazardCategory === hazardFilter;
      const matchesQuery =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.sensor.toLowerCase().includes(q);
      return matchesHazard && matchesQuery;
    });
  }, [sites, searchQuery, hazardFilter]);

  const activeSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? sites[0],
    [sites, selectedSiteId]
  );

  // Reset per-location live results when target changes
  useEffect(() => {
    setMapsData(null);
    setMapsError(null);
    setSatError(null);
    setCmrGranules([]);
    setStacScenes([]);
    setActiveStacLayerId(null);
  }, [activeSite.id, customRegion?.id]);

  // Initialize Leaflet map once
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [activeSite.lat, activeSite.lng],
      zoom: 5,
      minZoom: 2,
      maxZoom: 14,
      worldCopyJump: true,
    });

    map.on('mousemove', (ev: L.LeafletMouseEvent) => {
      setCursorCoords({ lat: ev.latlng.lat, lng: ev.latlng.lng });
    });

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      gibsLayerRef.current = null;
      liveSarLayerRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }

    setTileNotice(null);

    let url =
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    let attribution = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
    let maxZoom = 16;

    if (basemap === 'esri-imagery') {
      url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';
      maxZoom = 18;
    } else if (basemap === 'gibs-bluemarble') {
      url =
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';
      attribution = 'NASA GIBS Blue Marble';
      maxZoom = 8;
    }

    let errorCount = 0;
    const layer = L.tileLayer(url, {
      attribution,
      maxZoom,
    });

    layer.on('tileerror', () => {
      errorCount += 1;
      if (errorCount === 3) {
        setTileNotice(
          'External map tiles are temporarily unreachable; study footprints and coordinates remain interactive.'
        );
      }
    });

    layer.addTo(map);
    layer.bringToBack();
    baseLayerRef.current = layer;
  }, [basemap]);

  // Update optional NASA GIBS WMTS overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gibsLayerRef.current) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (gibsOverlayId === 'none') return;
    const spec = GIBS_LAYER_OPTIONS.find((l) => l.id === gibsOverlayId);
    if (!spec) return;

    const timeSegment = spec.isTimeEnabled ? gibsDate : spec.defaultDate;
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${spec.wmtsLayer}/default/${timeSegment}/${spec.tileMatrixSet}/{z}/{y}/{x}.${spec.format}`;

    const overlay = L.tileLayer(url, {
      opacity: gibsOpacity / 100,
      maxZoom: spec.maxZoom,
      attribution: `NASA GIBS · ${spec.name}`,
    });

    overlay.on('tileerror', () => {
      setTileNotice(
        `NASA GIBS layer (${spec.wmtsLayer} · ${timeSegment}) is unavailable for this zoom or date.`
      );
    });

    overlay.addTo(map);
    gibsLayerRef.current = overlay;
  }, [gibsOverlayId, gibsDate, gibsOpacity]);

  useEffect(() => {
    if (gibsLayerRef.current) {
      gibsLayerRef.current.setOpacity(gibsOpacity / 100);
    }
  }, [gibsOpacity]);

  // Toggle live Planetary Computer Sentinel-1 RTC tile overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (liveSarLayerRef.current) {
      map.removeLayer(liveSarLayerRef.current);
      liveSarLayerRef.current = null;
    }

    if (!activeStacLayerId) return;
    const scene = stacScenes.find((s) => s.id === activeStacLayerId);
    if (!scene) return;

    const layer = L.tileLayer(scene.vvTileUrl, {
      opacity: 0.85,
      maxZoom: 14,
      attribution: 'Planetary Computer Sentinel-1 RTC (VV)',
    });
    layer.on('tileerror', () => {
      setTileNotice(
        'Dynamic Sentinel-1 RTC tile rendering returned a transient error; scene metadata remains active.'
      );
    });
    layer.addTo(map);
    liveSarLayerRef.current = layer;
  }, [activeStacLayerId, stacScenes]);

  // Render filtered markers and footprints in Arctic Teal + Icy Blue + Crystalline White
  useEffect(() => {
    const group = markersLayerRef.current;
    const map = mapRef.current;
    if (!group || !map) return;

    group.clearLayers();

    filteredSites.forEach((site) => {
      const isSelected = !customRegion && site.id === activeSite.id;
      const [west, south, east, north] = site.bbox;

      const footprint = L.polygon(
        [
          [south, west],
          [north, west],
          [north, east],
          [south, east],
        ],
        {
          color: isSelected ? '#F2FAFC' : '#7AD4EC',
          weight: isSelected ? 2 : 1,
          opacity: isSelected ? 0.95 : 0.45,
          fillColor: isSelected ? '#A5E4F7' : '#145364',
          fillOpacity: isSelected ? 0.2 : 0.1,
        }
      );

      footprint.on('click', () => {
        setCustomRegion(null);
        onSelectSite(site.id);
      });
      footprint.addTo(group);

      const marker = L.circleMarker([site.lat, site.lng], {
        radius: isSelected ? 9 : 6,
        color: isSelected ? '#F2FAFC' : '#A5E4F7',
        weight: isSelected ? 2.5 : 1.5,
        fillColor: isSelected ? '#A5E4F7' : '#145364',
        fillOpacity: 0.92,
      });

      marker.bindTooltip(`${site.title} (${site.country})`, {
        direction: 'top',
        offset: [0, -8],
      });
      marker.on('click', () => {
        setCustomRegion(null);
        onSelectSite(site.id);
      });
      marker.addTo(group);
    });

    if (customRegion) {
      const [w, s, e, n] = customRegion.bbox;
      L.polygon(
        [
          [s, w],
          [n, w],
          [n, e],
          [s, e],
        ],
        {
          color: '#F2FAFC',
          weight: 2,
          dashArray: '4 4',
          fillColor: '#A5E4F7',
          fillOpacity: 0.14,
        }
      ).addTo(group);
    }
  }, [filteredSites, activeSite.id, customRegion, onSelectSite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (customRegion) {
      map.flyTo([customRegion.lat, customRegion.lng], 8, { duration: 0.8 });
    } else if (activeSite) {
      map.flyTo([activeSite.lat, activeSite.lng], 7, { duration: 0.8 });
    }
  }, [activeSite, customRegion]);

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setGeoLoading(true);
    setGeoError(null);
    try {
      const res = await searchLocations(q);
      setGeoResults(res);
      if (res.length === 0) {
        setGeoError('No matching global coordinates found.');
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Location search failed.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoError('Browser geolocation is unavailable.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const pad = 0.45;
        setCustomRegion({
          id: `geo-${latitude.toFixed(3)}-${longitude.toFixed(3)}`,
          label: `Your Location (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`,
          lat: latitude,
          lng: longitude,
          bbox: [longitude - pad, latitude - pad, longitude + pad, latitude + pad],
        });
        setGeoResults([]);
        setGeoLoading(false);
      },
      () => {
        setGeoError('Location permission denied or unavailable.');
        setGeoLoading(false);
      },
      { timeout: 8000 }
    );
  };

  const handleQueryLiveSatellites = async () => {
    const targetBbox = customRegion ? customRegion.bbox : activeSite.bbox;
    setSatLoading(true);
    setSatError(null);
    setActiveStacLayerId(null);

    const [cmrRes, stacRes] = await Promise.allSettled([
      queryNasaCmrGranules(targetBbox, 6),
      querySentinel1Stac(targetBbox, 6),
    ]);

    const errors: string[] = [];

    if (cmrRes.status === 'fulfilled') {
      setCmrGranules(cmrRes.value.items);
    } else {
      setCmrGranules([]);
      errors.push(
        cmrRes.reason instanceof Error ? cmrRes.reason.message : 'NASA CMR error'
      );
    }

    if (stacRes.status === 'fulfilled') {
      setStacScenes(stacRes.value.items);
    } else {
      setStacScenes([]);
      errors.push(
        stacRes.reason instanceof Error
          ? stacRes.reason.message
          : 'Planetary Computer STAC error'
      );
    }

    if (errors.length > 0) {
      setSatError(errors.join(' · '));
    }
    setSatLoading(false);
  };

  const handleFetchMapsContext = async () => {
    const lat = customRegion ? customRegion.lat : activeSite.lat;
    const lng = customRegion ? customRegion.lng : activeSite.lng;
    const placeName = customRegion ? customRegion.label : `${activeSite.title}, ${activeSite.country}`;
    const hazardFocus = customRegion ? undefined : activeSite.hazardCategory;

    setMapsLoading(true);
    setMapsError(null);
    try {
      const result = await fetchMapsGroundingContext({
        lat,
        lng,
        placeName,
        hazardFocus,
      });
      setMapsData(result);
    } catch (err) {
      setMapsError(
        err instanceof Error ? err.message : 'Unable to fetch Google Maps context.'
      );
    } finally {
      setMapsLoading(false);
    }
  };

  const isBookmarked = bookmarkedSiteIds.includes(activeSite.id);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-frost-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-crystal-white">
            Explore Global Radar Observations
          </h1>
          <p className="mt-1 text-sm text-frost-mist">
            Pick a study glacier, river, or city—or search anywhere to load live NASA &amp; Sentinel-1 passes.
          </p>
        </div>
        <ProvenanceLabel
          tier={
            stacScenes.length > 0 || cmrGranules.length > 0
              ? 'Live Satellite Data'
              : activeSite.provenanceTier
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Control & AOI Search Rail */}
        <aside className="flex flex-col gap-4 rounded-lg border border-frost-line bg-arctic-teal p-4 lg:col-span-4 xl:col-span-3">
          <form onSubmit={handleGlobalSearch}>
            <label htmlFor="explore-search" className="block text-xs font-medium text-crystal-white">
              Search Any Place
            </label>
            <div className="mt-1.5 flex gap-1.5">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-frost-mist"
                  aria-hidden="true"
                />
                <input
                  id="explore-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Glacier, river, or city..."
                  className="h-9 w-full rounded-md border border-frost-line bg-glacial-abyss pr-2 pl-9 text-xs text-crystal-white placeholder:text-frost-mist/60 focus:border-ice-blue focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={geoLoading || searchQuery.trim().length < 2}
                title="Search global coordinates"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-frost-line bg-crevasse px-2.5 text-xs font-medium text-ice-blue hover:border-ice-blue/60 disabled:opacity-50"
              >
                {geoLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={geoLoading}
                title="Use my current location"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-frost-line bg-crevasse px-2.5 text-xs font-medium text-ice-blue hover:border-ice-blue/60 disabled:opacity-50"
              >
                <LocateFixed className="h-3.5 w-3.5" />
              </button>
            </div>
            {geoError && (
              <p className="mt-1.5 text-[11px] text-amber-300">{geoError}</p>
            )}
            {geoResults.length > 0 && (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded border border-frost-line bg-glacial-abyss p-1.5">
                {geoResults.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomRegion(r);
                        setGeoResults([]);
                      }}
                      className="w-full truncate rounded px-2 py-1 text-left text-[11px] text-crystal-white hover:bg-crevasse hover:text-ice-blue"
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {/* Hazard Category Filter */}
          <div>
            <p className="text-xs font-medium text-crystal-white">Surface Focus</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {HAZARD_FILTERS.map((f) => {
                const active = hazardFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setHazardFilter(f.id)}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-crystal-white text-glacial-abyss'
                        : 'border border-frost-line bg-glacial-abyss text-frost-mist hover:border-ice-blue/60 hover:text-crystal-white'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basemap & NASA GIBS Layer Controls */}
          <div className="space-y-3 border-t border-frost-line pt-3">
            <div className="flex items-center gap-2 text-xs font-medium text-crystal-white">
              <Layers className="h-3.5 w-3.5 text-ice-blue" aria-hidden="true" />
              <span>Map &amp; NASA Layers</span>
            </div>

            <div>
              <label htmlFor="basemap-select" className="block text-[11px] text-frost-mist">
                Base Map
              </label>
              <select
                id="basemap-select"
                value={basemap}
                onChange={(e) => setBasemap(e.target.value as BasemapId)}
                className="mt-1 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 text-xs text-crystal-white focus:border-ice-blue focus:outline-none"
              >
                <option value="esri-dark">Esri Dark Gray Canvas</option>
                <option value="esri-imagery">Esri World Satellite Imagery</option>
                <option value="gibs-bluemarble">NASA GIBS Blue Marble</option>
              </select>
            </div>

            <div>
              <label htmlFor="gibs-overlay" className="block text-[11px] text-frost-mist">
                NASA GIBS Overlay
              </label>
              <select
                id="gibs-overlay"
                value={gibsOverlayId}
                onChange={(e) => setGibsOverlayId(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 text-xs text-crystal-white focus:border-ice-blue focus:outline-none"
              >
                <option value="none">None (Footprints Only)</option>
                {GIBS_LAYER_OPTIONS.filter((g) => g.id !== 'blue-marble').map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {gibsOverlayId !== 'none' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="gibs-date" className="block text-[11px] text-frost-mist">
                    Overlay Date
                  </label>
                  <input
                    id="gibs-date"
                    type="date"
                    value={gibsDate}
                    onChange={(e) => setGibsDate(e.target.value)}
                    className="mt-1 h-8 w-full rounded border border-frost-line bg-glacial-abyss px-2 font-mono text-xs text-crystal-white"
                  />
                </div>
                <div>
                  <label htmlFor="gibs-opacity" className="block text-[11px] text-frost-mist tabular-nums">
                    Opacity: {gibsOpacity}%
                  </label>
                  <input
                    id="gibs-opacity"
                    type="range"
                    min={10}
                    max={100}
                    value={gibsOpacity}
                    onChange={(e) => setGibsOpacity(Number(e.target.value))}
                    className="mt-2.5 w-full accent-ice-blue"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Curated AOIs List */}
          <div className="flex-1 border-t border-frost-line pt-3">
            <div className="flex items-center justify-between text-xs text-frost-mist">
              <span>Study Locations</span>
              <span className="font-mono tabular-nums">{filteredSites.length}</span>
            </div>

            {filteredSites.length === 0 ? (
              <div className="mt-3 rounded border border-dashed border-frost-line p-4 text-center">
                <p className="text-xs text-frost-mist">No sites match.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setHazardFilter('all');
                  }}
                  className="mt-2 text-xs font-medium text-ice-blue hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <ul className="mt-2 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                {filteredSites.map((site) => {
                  const selected = !customRegion && site.id === activeSite.id;
                  return (
                    <li key={site.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomRegion(null);
                          onSelectSite(site.id);
                        }}
                        className={`w-full rounded-md border p-3 text-left transition-colors ${
                          selected
                            ? 'border-ice-blue bg-crevasse'
                            : 'border-frost-line bg-glacial-abyss hover:border-ice-blue/40'
                        }`}
                      >
                        <p className="font-display text-xs font-semibold text-crystal-white">
                          {site.title}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-frost-mist tabular-nums">
                          {site.country} · {site.lat.toFixed(2)}°, {site.lng.toFixed(2)}°
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Map Viewport & Selected Observation Panel */}
        <div className="flex flex-col gap-5 lg:col-span-8 xl:col-span-9">
          <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss lg:h-[470px]">
            <div ref={mapContainerRef} className="h-full w-full" />

            <div className="pointer-events-none absolute right-3 bottom-7 z-[400] rounded border border-frost-line bg-glacial-abyss/95 px-2.5 py-1 font-mono text-[11px] text-crystal-white tabular-nums">
              {cursorCoords
                ? `Lat ${cursorCoords.lat.toFixed(4)}° · Lng ${cursorCoords.lng.toFixed(4)}°`
                : `Center ${(customRegion ? customRegion.lat : activeSite.lat).toFixed(2)}°, ${(customRegion ? customRegion.lng : activeSite.lng).toFixed(2)}°`}
            </div>

            {tileNotice && (
              <div className="absolute top-3 right-3 left-14 z-[400] flex items-start gap-2 rounded border border-amber-500/40 bg-arctic-teal/95 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{tileNotice}</span>
              </div>
            )}
          </div>

          {/* Selected Observation Detail Panel */}
          <section
            aria-label="Selected Observation Information"
            className="rounded-lg border border-frost-line bg-arctic-teal p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-frost-line pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-xl font-semibold text-crystal-white">
                    {customRegion ? customRegion.label : activeSite.title}
                  </h2>
                  <ProvenanceLabel tier={activeSite.provenanceTier} />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-frost-mist tabular-nums">
                  <MapPin className="h-3.5 w-3.5 text-ice-blue" aria-hidden="true" />
                  <span>
                    {(customRegion ? customRegion.lat : activeSite.lat).toFixed(2)}°,{' '}
                    {(customRegion ? customRegion.lng : activeSite.lng).toFixed(2)}°
                  </span>
                  {!customRegion && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{activeSite.sensor}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeSite.frequencyBand}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchMapsContext}
                  disabled={mapsLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ice-blue/40 bg-crevasse px-3 py-2 text-xs font-semibold text-crystal-white transition-colors hover:border-ice-blue hover:text-ice-blue disabled:opacity-50 whitespace-nowrap"
                >
                  {mapsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 text-ice-blue" />
                  )}
                  <span>Local Context (Google Maps)</span>
                </button>

                <button
                  type="button"
                  onClick={handleQueryLiveSatellites}
                  disabled={satLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 whitespace-nowrap"
                >
                  {satLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Radio className="h-3.5 w-3.5" />
                  )}
                  <span>Live NASA &amp; Sentinel-1</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenInPage(activeSite.id, 'visualizer')}
                  className="inline-flex items-center gap-1.5 rounded-md bg-crystal-white px-3.5 py-2 text-xs font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue whitespace-nowrap"
                >
                  <span>Visualizer</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {!customRegion && (
              <div className="mt-4 grid gap-6 md:grid-cols-12">
                <div className="space-y-3 md:col-span-8">
                  <p className="text-sm leading-relaxed text-crystal-white/95">
                    {activeSite.summary}
                  </p>
                  <p className="text-xs leading-relaxed text-frost-mist">
                    <strong className="font-semibold text-ice-blue">Why Radar Sees It: </strong>
                    {activeSite.physicalMechanism}
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed text-frost-mist/85">
                    Collection ({activeSite.referenceCollection}): {activeSite.provenanceNote}
                  </p>
                </div>

                <div className="space-y-3 border-t border-frost-line pt-4 md:col-span-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-frost-mist">Affected Footprint</p>
                      <p className="font-mono text-base font-semibold text-crystal-white tabular-nums">
                        {activeSite.affectedAreaKm2.toLocaleString()} km²
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-frost-mist">Pixel Size</p>
                      <p className="font-mono text-base font-semibold text-crystal-white tabular-nums">
                        {activeSite.resolutionMeters} m
                      </p>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="bookmark-note" className="block text-[11px] text-frost-mist">
                      Study Note
                    </label>
                    <input
                      id="bookmark-note"
                      type="text"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add observation note..."
                      className="mt-1 h-8 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 text-xs text-crystal-white placeholder:text-frost-mist/60 focus:border-ice-blue focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSaveBookmark(activeSite, noteDraft);
                      setNoteDraft('');
                    }}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      isBookmarked
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-frost-line bg-crevasse text-crystal-white hover:border-ice-blue/60 hover:text-ice-blue'
                    }`}
                  >
                    {isBookmarked ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Saved to Bookmarks</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3.5 w-3.5 text-ice-blue" />
                        <span>Save Bookmark</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Google Maps Grounded Geographic Context */}
            {(mapsLoading || mapsError || mapsData) && (
              <div className="mt-5 border-t border-frost-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-crystal-white">
                    Google Maps Local Context
                  </h3>
                  <span className="font-mono text-[11px] text-ice-blue">
                    Grounded via Google Maps
                  </span>
                </div>

                {mapsLoading && (
                  <div className="mt-3 flex items-center gap-2 rounded border border-frost-line bg-glacial-abyss px-3 py-3 text-xs text-frost-mist">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-ice-blue" />
                    <span>Fetching terrain &amp; landmark context from Google Maps...</span>
                  </div>
                )}

                {mapsError && (
                  <p className="mt-3 rounded border border-amber-500/30 bg-glacial-abyss px-3 py-2 font-mono text-xs text-amber-300">
                    {mapsError}
                  </p>
                )}

                {mapsData && !mapsLoading && (
                  <div className="mt-3 grid gap-4 md:grid-cols-12">
                    <div className="rounded border border-frost-line bg-glacial-abyss p-3.5 text-xs leading-relaxed text-crystal-white/95 whitespace-pre-line md:col-span-7">
                      {mapsData.summary || 'No summary returned for these coordinates.'}
                    </div>

                    <div className="rounded border border-frost-line bg-glacial-abyss p-3.5 md:col-span-5">
                      <p className="font-mono text-[11px] text-ice-blue">
                        Google Maps Sources ({mapsData.places.length})
                      </p>
                      {mapsData.places.length === 0 ? (
                        <p className="mt-2 text-xs text-frost-mist">
                          No specific Google Maps place links returned for this remote coordinate.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {mapsData.places.map((place) => (
                            <li
                              key={place.uri}
                              className="border-b border-frost-line pb-2 last:border-b-0 last:pb-0"
                            >
                              <a
                                href={place.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-ice-blue hover:text-crystal-white hover:underline"
                              >
                                <span>{place.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                              </a>
                              {place.snippet && (
                                <p className="mt-0.5 text-[11px] text-frost-mist">
                                  {place.snippet}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live NASA CMR & Sentinel-1 STAC Results */}
            {(satLoading || satError || stacScenes.length > 0 || cmrGranules.length > 0) && (
              <div className="mt-5 border-t border-frost-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-crystal-white">
                    Live Satellite Catalog Results
                  </h3>
                  <ProvenanceLabel tier="Live Satellite Data" compact />
                </div>

                {satError && (
                  <p className="mt-2 rounded border border-amber-500/30 bg-glacial-abyss px-3 py-2 font-mono text-xs text-amber-300">
                    {satError}
                  </p>
                )}

                {!satLoading && (stacScenes.length > 0 || cmrGranules.length > 0) && (
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="rounded border border-frost-line bg-glacial-abyss p-3">
                      <p className="font-mono text-xs text-ice-blue">
                        Sentinel-1 RTC (Planetary Computer STAC · {stacScenes.length})
                      </p>
                      {stacScenes.length === 0 ? (
                        <p className="mt-2 text-xs text-frost-mist">
                          No Sentinel-1 RTC scenes found in this bounding box.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {stacScenes.slice(0, 4).map((sc) => {
                            const active = activeStacLayerId === sc.id;
                            return (
                              <li
                                key={sc.id}
                                className="flex items-center justify-between gap-2 border-b border-frost-line pb-2 last:border-b-0 last:pb-0"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-mono text-[11px] text-crystal-white">
                                    {sc.id}
                                  </p>
                                  <p className="font-mono text-[11px] text-frost-mist tabular-nums">
                                    {sc.datetime.slice(0, 10)} · {sc.orbitState} · {sc.polarizations.join('+')}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveStacLayerId(active ? null : sc.id)
                                  }
                                  className={`rounded px-2 py-1 font-mono text-[11px] whitespace-nowrap shrink-0 ${
                                    active
                                      ? 'bg-crystal-white text-glacial-abyss font-semibold'
                                      : 'border border-frost-line text-ice-blue hover:border-ice-blue/60'
                                  }`}
                                >
                                  {active ? 'Hide VV' : 'Show VV'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="rounded border border-frost-line bg-glacial-abyss p-3">
                      <p className="font-mono text-xs text-emerald-300">
                        NASA CMR OPERA DSWx-S1 Granules ({cmrGranules.length})
                      </p>
                      {cmrGranules.length === 0 ? (
                        <p className="mt-2 text-xs text-frost-mist">
                          No OPERA DSWx-S1 granules indexed for this bounding box.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {cmrGranules.slice(0, 4).map((gr) => (
                            <li
                              key={gr.id}
                              className="border-b border-frost-line pb-2 last:border-b-0 last:pb-0"
                            >
                              <p className="truncate font-mono text-[11px] text-crystal-white">
                                {gr.title}
                              </p>
                              <p className="font-mono text-[11px] text-frost-mist tabular-nums">
                                {gr.timeStart.slice(0, 10)} · {gr.id}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
