import type { ProvenanceTier } from '../types/sar';

export interface LiveCmrGranule {
  id: string;
  title: string;
  timeStart: string;
  timeEnd: string;
  datasetId: string;
  boxes: string[];
  browseLink: string | null;
  dataLink: string | null;
  provenanceTier: ProvenanceTier;
}

export interface LiveStacScene {
  id: string;
  datetime: string;
  platform: string;
  orbitState: string;
  polarizations: string[];
  bbox: number[];
  geometry: unknown;
  renderedPreviewUrl: string | null;
  vvTileUrl: string;
  vhTileUrl: string;
  provenanceTier: ProvenanceTier;
}

export interface GeocodeResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number];
}

export interface EndpointProbe {
  name: string;
  status: 'green' | 'yellow' | 'red';
  label: string;
  latencyMs: number | null;
  httpStatus: number | null;
}

export interface SatelliteEndpointsStatus {
  checkedAt: string;
  cmr: EndpointProbe;
  stac: EndpointProbe;
}

export async function checkSatelliteEndpointsStatus(): Promise<SatelliteEndpointsStatus> {
  const res = await fetch('/api/satellites/status');
  if (!res.ok) {
    throw new Error(`Status probe returned HTTP ${res.status}`);
  }
  return (await res.json()) as SatelliteEndpointsStatus;
}

export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const data = (await res.json()) as { results?: GeocodeResult[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Geocoding failed (${res.status})`);
  }
  return Array.isArray(data.results) ? data.results : [];
}

export async function queryNasaCmrGranules(
  bbox: [number, number, number, number],
  pageSize = 6
): Promise<{ items: LiveCmrGranule[]; source: string }> {
  const url = new URL('/api/satellites/cmr', window.location.origin);
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('pageSize', String(pageSize));
  const res = await fetch(url.toString());
  const data = (await res.json()) as {
    items?: LiveCmrGranule[];
    source?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `NASA CMR query failed (${res.status})`);
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    source: data.source || 'NASA Earthdata CMR',
  };
}

export async function querySentinel1Stac(
  bbox: [number, number, number, number],
  limit = 6
): Promise<{ items: LiveStacScene[]; source: string }> {
  const res = await fetch('/api/satellites/stac', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bbox, limit }),
  });
  const data = (await res.json()) as {
    items?: LiveStacScene[];
    source?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Planetary Computer STAC failed (${res.status})`);
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    source: data.source || 'Planetary Computer STAC',
  };
}

export interface MapsGroundedPlace {
  title: string;
  uri: string;
  snippet: string | null;
}

export interface MapsGroundingResponse {
  summary: string;
  places: MapsGroundedPlace[];
  coordinates: { lat: number; lng: number };
  model: string;
}

export async function fetchMapsGroundingContext(params: {
  lat: number;
  lng: number;
  placeName: string;
  hazardFocus?: string;
}): Promise<MapsGroundingResponse> {
  const res = await fetch('/api/maps/grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as Partial<MapsGroundingResponse> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Maps grounding returned HTTP ${res.status}`);
  }
  return {
    summary: data.summary ?? '',
    places: Array.isArray(data.places) ? data.places : [],
    coordinates: data.coordinates ?? { lat: params.lat, lng: params.lng },
    model: data.model ?? 'gemini-4-hydrogen',
  };
}

export interface SeaIceSummary {
  title: string;
  units: string;
  basePeriod: string;
  decadalTrendMkm2: number;
  annualMeanMkm2: number;
  latestPeriod: string;
  latestExtentMkm2: number;
  latestBaselineMkm2: number;
  latestAnomalyMkm2: number;
}

export interface SeaIceMonthPoint {
  period: string;
  label: string;
  extentMkm2: number;
  baselineMkm2: number;
  anomalyMkm2: number;
}

export interface SeaIceAnnualPoint {
  year: string;
  meanExtentMkm2: number;
  meanAnomalyMkm2: number;
}

export interface LiveGlacierHourlyPoint {
  time: string;
  label: string;
  tempC: number;
  snowDepthM: number;
  meltRateMmDay: number;
  freezingLevelM: number;
}

export interface LiveGlacierStation {
  id: string;
  siteId: string | null;
  name: string;
  region: string;
  lat: number;
  lng: number;
  elevationM: number;
  observedAt: string;
  currentTempC: number;
  currentSnowDepthM: number;
  publishedIceThicknessM: number;
  publishedMassTrendGtYr: number;
  freezingLevelM: number;
  currentMeltRateMmDay: number;
  snowDepth24hDeltaCm: number;
  hourlySeries: LiveGlacierHourlyPoint[];
}

export interface IcesatGranuleSummary {
  shortName: string;
  title: string;
  datasetId: string;
  timeStart: string;
  timeEnd: string;
  dataCenter: string;
}

export interface ClimateSourceAttribution {
  name: string;
  detail: string;
  url: string;
}

export interface GlacialClimateMetricsResponse {
  fetchedAt: string;
  seaIceSummary: SeaIceSummary | null;
  seaIceRecentMonths: SeaIceMonthPoint[];
  seaIceAnnualTrend: SeaIceAnnualPoint[];
  glaciers: LiveGlacierStation[];
  icesatPasses: IcesatGranuleSummary[];
  sources: ClimateSourceAttribution[];
}

export async function fetchGlacialClimateMetrics(
  forceRefresh = false
): Promise<GlacialClimateMetricsResponse> {
  const endpoint = forceRefresh
    ? '/api/climate/glacial-metrics?force=1'
    : '/api/climate/glacial-metrics';
  const res = await fetch(endpoint);
  const data = (await res.json()) as Partial<GlacialClimateMetricsResponse> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Climate endpoint returned HTTP ${res.status}`);
  }
  return {
    fetchedAt: data.fetchedAt ?? new Date().toISOString(),
    seaIceSummary: data.seaIceSummary ?? null,
    seaIceRecentMonths: Array.isArray(data.seaIceRecentMonths)
      ? data.seaIceRecentMonths
      : [],
    seaIceAnnualTrend: Array.isArray(data.seaIceAnnualTrend)
      ? data.seaIceAnnualTrend
      : [],
    glaciers: Array.isArray(data.glaciers) ? data.glaciers : [],
    icesatPasses: Array.isArray(data.icesatPasses) ? data.icesatPasses : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

