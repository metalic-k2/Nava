export type PageId =
  | 'home'
  | 'explore'
  | 'visualizer'
  | 'change-detection'
  | 'dashboard'
  | 'how-to-use'
  | 'about';

export type ProvenanceTier =
  | 'Live Satellite Data'
  | 'Archived Satellite Data'
  | 'Processed Observations'
  | 'Sample/Demo Data';

export type HazardCategory =
  | 'flood'
  | 'deforestation'
  | 'deformation'
  | 'cryosphere';

export type PolarizationMode = 'VV' | 'VH' | 'VV+VH';

export type ComparisonMode = 'swipe' | 'opacity' | 'side-by-side';

export interface SarAcquisitionPair {
  beforeDate: string;
  afterDate: string;
  orbitDirection: 'Ascending' | 'Descending';
  incidenceAngleDeg: number;
  meanBackscatterBeforeDb: number;
  meanBackscatterAfterDb: number;
  deltaDb: number;
  label: string;
}

export interface SarObservationSite {
  id: string;
  title: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number]; // [west, south, east, north]
  hazardCategory: HazardCategory;
  sensor: string;
  frequencyBand: 'C-band (5.405 GHz)' | 'L-band (1.257 GHz)';
  resolutionMeters: number;
  provenanceTier: ProvenanceTier;
  provenanceNote: string;
  referenceCollection: string;
  summary: string;
  physicalMechanism: string;
  affectedAreaKm2: number;
  acquisitions: SarAcquisitionPair[];
  terrainProfile: 'river-basin' | 'tropical-canopy' | 'urban-fault' | 'glacial-shelf';
}

export interface ChangeDetectionLayerSpec {
  id: string;
  name: string;
  description: string;
  provenanceTier: ProvenanceTier;
  defaultVisible: boolean;
  color: string;
}

export interface ChangeDetectionScenario {
  id: string;
  title: string;
  subtitle: string;
  hazardCategory: HazardCategory;
  siteId: string;
  center: [number, number];
  zoom: number;
  preDate: string;
  postDate: string;
  thresholdDb: number;
  detectedAreaKm2: number;
  percentRegionAffected: number;
  meanDeltaDb: number;
  provenanceTier: ProvenanceTier;
  provenanceExplanation: string;
  methodologySteps: string[];
  polygonRegions: {
    id: string;
    label: string;
    changeType: 'inundation' | 'canopy-loss' | 'moisture-shift' | 'structural-bounce';
    areaKm2: number;
    meanDeltaDb: number;
    provenanceTier: ProvenanceTier;
    coordinates: [number, number][];
  }[];
}

export interface TelemetryTimePoint {
  date: string;
  siteId: string;
  region: string;
  hazardCategory: HazardCategory;
  vvBackscatterDb: number;
  vhBackscatterDb: number;
  surfaceWaterIndexKm2: number;
  coherence: number;
  passCount: number;
  provenanceTier: ProvenanceTier;
}

export interface BookmarkItem {
  id: string;
  siteId: string;
  title: string;
  region: string;
  lat: number;
  lng: number;
  hazardCategory: HazardCategory;
  note: string;
  createdAt: string;
}

export interface GibsLayerOption {
  id: string;
  name: string;
  wmtsLayer: string;
  tileMatrixSet: string;
  format: 'jpg' | 'png';
  maxZoom: number;
  isTimeEnabled: boolean;
  defaultDate: string;
  provenanceTier: ProvenanceTier;
  description: string;
}
