import L from 'leaflet';
import { AlertCircle, CheckSquare, Eye, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import canopyImg from '../assets/images/sar_deforestation_canopy_1794658470355.jpg';
import floodImg from '../assets/images/sar_flood_comparison_1794658469002.jpg';
import { ProvenanceLabel } from '../components/ProvenanceLabel';
import { CHANGE_DETECTION_SCENARIOS } from '../data/sarBenchmarks';

interface ChangeDetectionPageProps {
  selectedSiteId: string;
}

const CHANGE_TYPE_COLOR: Record<string, string> = {
  inundation: '#7AD4EC',
  'canopy-loss': '#F59E0B',
  'moisture-shift': '#A5E4F7',
  'structural-bounce': '#F43F5E',
};

const CHANGE_TYPE_LABEL: Record<string, string> = {
  inundation: 'New Open Floodwater (Δσ⁰ < -4.5 dB)',
  'canopy-loss': 'Forest Canopy Cleared (VH Drop)',
  'moisture-shift': 'Wet Soil / Surface Roughness Shift',
  'structural-bounce': 'Flooded Vegetation Double-Bounce (+Δσ⁰)',
};

export function ChangeDetectionPage({ selectedSiteId }: ChangeDetectionPageProps) {
  const initialScenario =
    CHANGE_DETECTION_SCENARIOS.find((c) => c.siteId === selectedSiteId)?.id ??
    CHANGE_DETECTION_SCENARIOS[0].id;

  const [scenarioId, setScenarioId] = useState<string>(initialScenario);
  const [showBasemap, setShowBasemap] = useState(true);
  const [showChangePolygons, setShowChangePolygons] = useState(true);
  const [showGibsRef, setShowGibsRef] = useState(false);
  const [maskOpacity, setMaskOpacity] = useState(60);
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null);

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const gibsRef = useRef<L.TileLayer | null>(null);
  const polygonGroupRef = useRef<L.LayerGroup | null>(null);

  const scenario = useMemo(
    () =>
      CHANGE_DETECTION_SCENARIOS.find((s) => s.id === scenarioId) ??
      CHANGE_DETECTION_SCENARIOS[0],
    [scenarioId]
  );

  // Sync scenario when selectedSiteId changes from Explore
  useEffect(() => {
    const match = CHANGE_DETECTION_SCENARIOS.find((c) => c.siteId === selectedSiteId);
    if (match) {
      setScenarioId(match.id);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    const el = mapElRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: scenario.center,
      zoom: scenario.zoom,
      minZoom: 3,
      maxZoom: 14,
    });

    const polyGroup = L.layerGroup().addTo(map);
    polygonGroupRef.current = polyGroup;
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
      gibsRef.current = null;
      polygonGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to active scenario center
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(scenario.center, scenario.zoom, { duration: 0.7 });
    setSelectedPolygonId(scenario.polygonRegions[0]?.id ?? null);
  }, [scenario]);

  // Toggle dark basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    if (showBasemap) {
      const layer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ', maxZoom: 16 }
      );
      layer.addTo(map);
      layer.bringToBack();
      baseLayerRef.current = layer;
    }
  }, [showBasemap]);

  // Toggle NASA GIBS OPERA reference layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gibsRef.current) {
      map.removeLayer(gibsRef.current);
      gibsRef.current = null;
    }
    if (showGibsRef) {
      const layer = L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/OPERA_L3_DIST-ALERT-HLS_Color_Index/default/2024-08-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
        { opacity: 0.75, maxZoom: 12, attribution: 'NASA GIBS OPERA DIST-ALERT' }
      );
      layer.addTo(map);
      gibsRef.current = layer;
    }
  }, [showGibsRef]);

  // Render difference mask polygons
  useEffect(() => {
    const group = polygonGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showChangePolygons) return;

    scenario.polygonRegions.forEach((region) => {
      const color = CHANGE_TYPE_COLOR[region.changeType] ?? '#A5E4F7';
      const isFocused = region.id === selectedPolygonId;
      const poly = L.polygon(region.coordinates, {
        color,
        weight: isFocused ? 2.5 : 1.5,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: (maskOpacity / 100) * (isFocused ? 0.65 : 0.42),
      });
      poly.bindTooltip(
        `${region.label} · ${region.areaKm2.toFixed(1)} km² (${region.meanDeltaDb >= 0 ? '+' : ''}${region.meanDeltaDb.toFixed(1)} dB)`
      );
      poly.on('click', () => setSelectedPolygonId(region.id));
      poly.addTo(group);
    });
  }, [scenario, showChangePolygons, maskOpacity, selectedPolygonId]);

  const previewVisual = scenario.hazardCategory === 'flood' ? floodImg : canopyImg;
  const previewCaption =
    scenario.hazardCategory === 'flood'
      ? 'Dark zones mark smooth floodwater reflecting radar away; bright edges show flooded stems.'
      : 'Cleared corridors lose tree-branch radar echo (VH drops > 3.2 dB) even through dense clouds.';

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-frost-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-crystal-white">
            SAR Change Detection Lab
          </h1>
          <p className="mt-1 text-sm text-frost-mist">
            Spot floodwater and forest clearing by comparing radar brightness before and after an event.
          </p>
        </div>
        <ProvenanceLabel tier={scenario.provenanceTier} />
      </div>

      {/* Scenario Switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {CHANGE_DETECTION_SCENARIOS.map((sc) => {
            const active = sc.id === scenario.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenarioId(sc.id)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-crystal-white text-glacial-abyss'
                    : 'border border-frost-line bg-arctic-teal text-crystal-white hover:border-ice-blue/60'
                }`}
              >
                {sc.title}
              </button>
            );
          })}
        </div>

        <p className="font-mono text-xs text-frost-mist tabular-nums">
          Window: {scenario.preDate} → {scenario.postDate} · Cutoff: {scenario.thresholdDb} dB
        </p>
      </div>

      {/* Explicit Data Provenance Integrity Banner */}
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-arctic-teal px-4 py-3 text-xs text-frost-mist">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <span className="font-semibold text-amber-300">
            Provenance Notice ({scenario.provenanceTier} + Sample/Demo Masks):{' '}
          </span>
          <span>{scenario.provenanceExplanation}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Layer Controls + Visual Reference + Metrics */}
        <aside className="space-y-4 lg:col-span-4">
          <div className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
            <div className="relative aspect-video w-full bg-crevasse">
              <img
                src={previewVisual}
                alt={scenario.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/30 to-transparent" />
              <div className="absolute inset-x-3 bottom-2.5">
                <p className="font-mono text-[11px] text-ice-blue">
                  Visual Signature Guide
                </p>
                <p className="text-xs font-medium text-crystal-white">{scenario.subtitle}</p>
              </div>
            </div>
            <p className="px-4 py-3 text-xs leading-relaxed text-frost-mist">
              {previewCaption}
            </p>
          </div>

          <div className="rounded-lg border border-frost-line bg-arctic-teal p-5">
            <h2 className="font-display text-base font-semibold text-crystal-white">
              Map Overlays
            </h2>

            <div className="mt-3 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowBasemap((v) => !v)}
                className="flex w-full items-center justify-between rounded border border-frost-line bg-glacial-abyss px-3 py-2 text-left text-xs text-crystal-white hover:border-ice-blue/50"
              >
                <span className="flex items-center gap-2">
                  {showBasemap ? (
                    <CheckSquare className="h-4 w-4 text-ice-blue" />
                  ) : (
                    <Square className="h-4 w-4 text-frost-mist" />
                  )}
                  Base Terrain Map
                </span>
                <span className="font-mono text-[11px] text-frost-mist">Esri</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChangePolygons((v) => !v)}
                className="flex w-full items-center justify-between rounded border border-frost-line bg-glacial-abyss px-3 py-2 text-left text-xs text-crystal-white hover:border-ice-blue/50"
              >
                <span className="flex items-center gap-2">
                  {showChangePolygons ? (
                    <CheckSquare className="h-4 w-4 text-ice-blue" />
                  ) : (
                    <Square className="h-4 w-4 text-frost-mist" />
                  )}
                  Radar Change Mask
                </span>
                <span className="font-mono text-[11px] text-amber-300">Sample Mask</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGibsRef((v) => !v)}
                className="flex w-full items-center justify-between rounded border border-frost-line bg-glacial-abyss px-3 py-2 text-left text-xs text-crystal-white hover:border-ice-blue/50"
              >
                <span className="flex items-center gap-2">
                  {showGibsRef ? (
                    <CheckSquare className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <Square className="h-4 w-4 text-frost-mist" />
                  )}
                  NASA OPERA Alerts
                </span>
                <span className="font-mono text-[11px] text-emerald-300">Live WMTS</span>
              </button>
            </div>

            <div className="mt-4 border-t border-frost-line pt-3">
              <label
                htmlFor="mask-opacity"
                className="flex items-center justify-between text-xs text-crystal-white tabular-nums"
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-ice-blue" aria-hidden="true" />
                  Mask Opacity
                </span>
                <span className="font-mono">{maskOpacity}%</span>
              </label>
              <input
                id="mask-opacity"
                type="range"
                min={10}
                max={100}
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(Number(e.target.value))}
                className="mt-2 w-full accent-ice-blue"
              />
            </div>
          </div>

          {/* Quantitative Area Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-3.5">
              <p className="text-[11px] text-frost-mist">Changed Area</p>
              <p className="mt-1 font-mono text-base font-semibold text-crystal-white tabular-nums">
                {scenario.detectedAreaKm2.toLocaleString()}{' '}
                <span className="text-[11px] font-normal text-frost-mist">km²</span>
              </p>
            </div>
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-3.5">
              <p className="text-[11px] text-frost-mist">AOI Share</p>
              <p className="mt-1 font-mono text-base font-semibold text-ice-blue tabular-nums">
                {scenario.percentRegionAffected.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-3.5">
              <p className="text-[11px] text-frost-mist">Mean Δσ⁰</p>
              <p className="mt-1 font-mono text-base font-semibold text-ice-blue tabular-nums">
                {scenario.meanDeltaDb.toFixed(1)} dB
              </p>
            </div>
          </div>

          {/* Processing Pipeline Steps */}
          <div className="rounded-lg border border-frost-line bg-arctic-teal p-5">
            <h3 className="font-display text-sm font-semibold text-crystal-white">
              Scientific Pipeline
            </h3>
            <ol className="mt-3 space-y-2 text-xs leading-relaxed text-frost-mist">
              {scenario.methodologySteps.map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="font-mono text-ice-blue tabular-nums">
                    0{i + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* Map + Detected Sub-Zones Table */}
        <div className="flex flex-col gap-5 lg:col-span-8">
          <div className="h-[420px] w-full overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss lg:h-[460px]">
            <div ref={mapElRef} className="h-full w-full" />
          </div>

          <div className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
            <div className="flex items-center justify-between border-b border-frost-line px-4 py-3">
              <h3 className="font-display text-sm font-semibold text-crystal-white">
                Detected Change Zones
              </h3>
              <ProvenanceLabel tier="Sample/Demo Data" compact />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-frost-line bg-glacial-abyss text-frost-mist">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Zone</th>
                    <th className="px-4 py-2.5 font-medium">Classification</th>
                    <th className="px-4 py-2.5 text-right font-medium">Area (km²)</th>
                    <th className="px-4 py-2.5 text-right font-medium">Mean Δσ⁰</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-frost-line">
                  {scenario.polygonRegions.map((reg) => {
                    const active = reg.id === selectedPolygonId;
                    const dotColor = CHANGE_TYPE_COLOR[reg.changeType] ?? '#A5E4F7';
                    return (
                      <tr
                        key={reg.id}
                        onClick={() => setSelectedPolygonId(reg.id)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-crevasse' : 'hover:bg-crevasse/60'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-crystal-white">
                          {reg.label}
                        </td>
                        <td className="px-4 py-3 text-frost-mist">
                          <span
                            className="mr-2 inline-block h-2 w-2 rounded-sm"
                            style={{ backgroundColor: dotColor }}
                            aria-hidden="true"
                          />
                          {CHANGE_TYPE_LABEL[reg.changeType]}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-crystal-white tabular-nums">
                          {reg.areaKm2.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ice-blue tabular-nums">
                          {reg.meanDeltaDb >= 0 ? '+' : ''}
                          {reg.meanDeltaDb.toFixed(1)} dB
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
