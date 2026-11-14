import { Columns2, Layers, Loader2, Radio, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ProvenanceLabel } from '../components/ProvenanceLabel';
import { SarRasterCanvas } from '../components/SarRasterCanvas';
import { querySentinel1Stac, type LiveStacScene } from '../lib/satelliteApi';
import type {
  ComparisonMode,
  PolarizationMode,
  SarObservationSite,
} from '../types/sar';

interface VisualizerPageProps {
  sites: SarObservationSite[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

const POLARIZATION_INFO: Record<
  PolarizationMode,
  { label: string; plainSummary: string; scientificNote: string }
> = {
  VV: {
    label: 'VV · Vertical Bounce',
    plainSummary: 'Shows water as dark mirrors and buildings or flooded stems as bright streaks.',
    scientificNote: 'Co-polarized vertical transmit/receive responds strongly to surface roughness and dihedral corner bounce.',
  },
  VH: {
    label: 'VH · Forest & Volume',
    plainSummary: 'Highlights trees and dense vegetation; drops dark when forest is cleared.',
    scientificNote: 'Cross-polarized backscatter isolates multi-bounce volume depolarization inside canopies.',
  },
  'VV+VH': {
    label: 'VV+VH · False-Color RGB',
    plainSummary: 'Colors open water deep arctic teal and flooded vegetation bright icy white.',
    scientificNote: 'Maps VV to Red, VH to Green, and VV−VH polarization difference to Blue.',
  },
};

export function VisualizerPage({
  sites,
  selectedSiteId,
  onSelectSite,
}: VisualizerPageProps) {
  const activeSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? sites[0],
    [sites, selectedSiteId]
  );

  const [acquisitionIdx, setAcquisitionIdx] = useState(0);
  const [polarization, setPolarization] = useState<PolarizationMode>('VV');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('swipe');
  const [splitPercent, setSplitPercent] = useState(50);
  const [overlayOpacity, setOverlayOpacity] = useState(65);

  const [stacLoading, setStacLoading] = useState(false);
  const [stacError, setStacError] = useState<string | null>(null);
  const [liveScenes, setLiveScenes] = useState<LiveStacScene[]>([]);
  const [liveBeforeIdx, setLiveBeforeIdx] = useState(1);
  const [liveAfterIdx, setLiveAfterIdx] = useState(0);
  const [liveOpacity, setLiveOpacity] = useState(50);

  useEffect(() => {
    setAcquisitionIdx(0);
    setLiveScenes([]);
    setStacError(null);
  }, [activeSite.id]);

  const activePair =
    activeSite.acquisitions[acquisitionIdx] ?? activeSite.acquisitions[0];

  const handleFetchLivePreviews = async () => {
    setStacLoading(true);
    setStacError(null);
    try {
      const res = await querySentinel1Stac(activeSite.bbox, 6);
      const withPreview = res.items.filter((i) => Boolean(i.renderedPreviewUrl));
      setLiveScenes(withPreview);
      setLiveAfterIdx(0);
      setLiveBeforeIdx(withPreview.length > 1 ? 1 : 0);
      if (withPreview.length === 0) {
        setStacError('No Sentinel-1 RTC preview scenes available for this bounding box.');
      }
    } catch (err) {
      setStacError(
        err instanceof Error ? err.message : 'Unable to fetch Sentinel-1 RTC scenes.'
      );
    } finally {
      setStacLoading(false);
    }
  };

  const liveBefore = liveScenes[liveBeforeIdx];
  const liveAfter = liveScenes[liveAfterIdx];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-frost-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-crystal-white">
            SAR Backscatter Visualizer
          </h1>
          <p className="mt-1 text-sm text-frost-mist">
            Swipe before and after radar passes, inspect decibel shifts, or load live Sentinel-1 previews.
          </p>
        </div>
        <ProvenanceLabel tier={activeSite.provenanceTier} />
      </div>

      {/* Top Controls Toolbar */}
      <div className="mb-5 grid gap-4 rounded-lg border border-frost-line bg-arctic-teal p-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <label htmlFor="viz-site" className="block text-xs font-medium text-crystal-white">
            Study Site
          </label>
          <select
            id="viz-site"
            value={activeSite.id}
            onChange={(e) => onSelectSite(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border border-frost-line bg-glacial-abyss px-3 text-sm text-crystal-white focus:border-ice-blue focus:outline-none"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.country})
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-4">
          <label htmlFor="viz-date-pair" className="block text-xs font-medium text-crystal-white">
            Before / After Pass
          </label>
          <select
            id="viz-date-pair"
            value={acquisitionIdx}
            onChange={(e) => setAcquisitionIdx(Number(e.target.value))}
            className="mt-1.5 h-10 w-full rounded-md border border-frost-line bg-glacial-abyss px-3 font-mono text-xs text-crystal-white focus:border-ice-blue focus:outline-none"
          >
            {activeSite.acquisitions.map((pair, idx) => (
              <option key={pair.label} value={idx}>
                {pair.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-4">
          <p className="text-xs font-medium text-crystal-white">View Mode</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-md border border-frost-line bg-glacial-abyss p-1">
            <button
              type="button"
              onClick={() => setComparisonMode('swipe')}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                comparisonMode === 'swipe'
                  ? 'bg-crystal-white text-glacial-abyss'
                  : 'text-frost-mist hover:text-crystal-white'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Swipe</span>
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('opacity')}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                comparisonMode === 'opacity'
                  ? 'bg-crystal-white text-glacial-abyss'
                  : 'text-frost-mist hover:text-crystal-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Blend</span>
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('side-by-side')}
              className={`inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                comparisonMode === 'side-by-side'
                  ? 'bg-crystal-white text-glacial-abyss'
                  : 'text-frost-mist hover:text-crystal-white'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Split</span>
            </button>
          </div>
        </div>

        {/* Polarization & Slider Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-frost-line pt-3 lg:col-span-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-frost-mist">Radar Channel:</span>
            {(['VV', 'VH', 'VV+VH'] as PolarizationMode[]).map((pol) => {
              const active = polarization === pol;
              return (
                <button
                  key={pol}
                  type="button"
                  onClick={() => setPolarization(pol)}
                  className={`rounded px-3 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-crevasse text-crystal-white ring-1 ring-ice-blue'
                      : 'border border-frost-line bg-glacial-abyss text-frost-mist hover:border-ice-blue/50'
                  }`}
                >
                  {pol}
                </button>
              );
            })}
          </div>

          {comparisonMode === 'swipe' && (
            <div className="flex min-w-[240px] flex-1 items-center gap-3 sm:max-w-sm">
              <label
                htmlFor="swipe-range"
                className="font-mono text-xs text-crystal-white whitespace-nowrap tabular-nums"
              >
                Split: {splitPercent}%
              </label>
              <input
                id="swipe-range"
                type="range"
                min={5}
                max={95}
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                className="w-full accent-ice-blue"
              />
            </div>
          )}

          {comparisonMode === 'opacity' && (
            <div className="flex min-w-[240px] flex-1 items-center gap-3 sm:max-w-sm">
              <label
                htmlFor="opacity-range"
                className="font-mono text-xs text-crystal-white whitespace-nowrap tabular-nums"
              >
                After Opacity: {overlayOpacity}%
              </label>
              <input
                id="opacity-range"
                type="range"
                min={0}
                max={100}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-full accent-ice-blue"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas + Physics Explanation Split */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <SarRasterCanvas
            site={activeSite}
            acquisition={activePair}
            polarization={polarization}
            comparisonMode={comparisonMode}
            splitPercent={splitPercent}
            onSplitChange={setSplitPercent}
            overlayOpacity={overlayOpacity}
          />

          {/* Quick-Read Visual Brightness Key */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-frost-line bg-arctic-teal p-3">
              <span className="h-5 w-5 shrink-0 rounded border border-frost-line bg-glacial-abyss" />
              <div className="text-xs">
                <p className="font-medium text-crystal-white">Dark (-28 to -16 dB)</p>
                <p className="text-frost-mist">Calm water or flat ice</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-frost-line bg-arctic-teal p-3">
              <span className="h-5 w-5 shrink-0 rounded border border-frost-line bg-[#2A6070]" />
              <div className="text-xs">
                <p className="font-medium text-crystal-white">Midtone (-15 to -7 dB)</p>
                <p className="text-frost-mist">Forest, crops, or rough soil</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-frost-line bg-arctic-teal p-3">
              <span className="h-5 w-5 shrink-0 rounded border border-ice-blue bg-crystal-white" />
              <div className="text-xs">
                <p className="font-medium text-crystal-white">Bright (-6 to +2 dB)</p>
                <p className="text-frost-mist">Ice ridges, buildings, flooded stems</p>
              </div>
            </div>
          </div>

          <p className="font-mono text-[11px] leading-relaxed text-frost-mist">
            Data Notice ({activeSite.provenanceTier}): {activeSite.provenanceNote}
          </p>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-lg border border-frost-line bg-arctic-teal p-5">
            <p className="font-mono text-xs text-ice-blue">Acquisition Telemetry</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-crystal-white">
              {activeSite.title}
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-frost-line pt-4 text-xs">
              <div>
                <dt className="text-frost-mist">Before Pass</dt>
                <dd className="mt-0.5 font-mono text-crystal-white tabular-nums">
                  {activePair.beforeDate}
                </dd>
              </div>
              <div>
                <dt className="text-frost-mist">After Pass</dt>
                <dd className="mt-0.5 font-mono text-ice-blue tabular-nums">
                  {activePair.afterDate}
                </dd>
              </div>
              <div>
                <dt className="text-frost-mist">Orbit / Look Angle</dt>
                <dd className="mt-0.5 font-mono text-crystal-white tabular-nums">
                  {activePair.orbitDirection} · {activePair.incidenceAngleDeg}°
                </dd>
              </div>
              <div>
                <dt className="text-frost-mist">Mean Δσ⁰ Shift</dt>
                <dd
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    activePair.deltaDb < 0 ? 'text-ice-blue' : 'text-amber-300'
                  }`}
                >
                  {activePair.deltaDb >= 0 ? '+' : ''}
                  {activePair.deltaDb.toFixed(1)} dB
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-frost-line bg-arctic-teal p-5">
            <p className="font-mono text-xs text-ice-blue">Plain-Language &amp; Radar Guide</p>
            <h3 className="mt-1 font-display text-base font-semibold text-crystal-white">
              Why the Echo Changed
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-crystal-white/90">
              {activeSite.physicalMechanism}
            </p>
            <div className="mt-4 border-t border-frost-line pt-4">
              <p className="font-mono text-xs font-medium text-ice-blue">
                {POLARIZATION_INFO[polarization].label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-crystal-white/90">
                {POLARIZATION_INFO[polarization].plainSummary}
              </p>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-frost-mist">
                {POLARIZATION_INFO[polarization].scientificNote}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Live Sentinel-1 RTC Scene Comparison Section */}
      <section className="mt-8 rounded-lg border border-frost-line bg-arctic-teal p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-frost-line pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-lg font-semibold text-crystal-white">
                Real Sentinel-1 RTC Satellite Previews
              </h2>
              <ProvenanceLabel tier="Live Satellite Data" compact />
            </div>
            <p className="mt-1 text-xs text-frost-mist">
              Fetch real C-band radar frames from Microsoft Planetary Computer STAC over {activeSite.title}.
            </p>
          </div>

          <button
            type="button"
            onClick={handleFetchLivePreviews}
            disabled={stacLoading}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 whitespace-nowrap"
          >
            {stacLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5" />
            )}
            <span>Fetch Live Sentinel-1 Previews</span>
          </button>
        </div>

        {stacError && (
          <p className="mt-4 rounded border border-amber-500/30 bg-glacial-abyss px-3 py-2 font-mono text-xs text-amber-300">
            {stacError}
          </p>
        )}

        {liveScenes.length > 0 && liveBefore && liveAfter && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="live-before" className="block text-xs text-frost-mist">
                  Before Acquisition
                </label>
                <select
                  id="live-before"
                  value={liveBeforeIdx}
                  onChange={(e) => setLiveBeforeIdx(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 font-mono text-xs text-crystal-white"
                >
                  {liveScenes.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      {s.datetime.slice(0, 10)} · {s.orbitState}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="live-after" className="block text-xs text-frost-mist">
                  After Acquisition
                </label>
                <select
                  id="live-after"
                  value={liveAfterIdx}
                  onChange={(e) => setLiveAfterIdx(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 font-mono text-xs text-crystal-white"
                >
                  {liveScenes.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      {s.datetime.slice(0, 10)} · {s.orbitState}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="live-blend" className="block text-xs text-frost-mist tabular-nums">
                  Overlay Blend Opacity: {liveOpacity}%
                </label>
                <input
                  id="live-blend"
                  type="range"
                  min={0}
                  max={100}
                  value={liveOpacity}
                  onChange={(e) => setLiveOpacity(Number(e.target.value))}
                  className="mt-3 w-full accent-emerald-400"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="overflow-hidden rounded border border-frost-line bg-glacial-abyss">
                <div className="border-b border-frost-line px-3 py-2 font-mono text-[11px] text-crystal-white">
                  Pre · {liveBefore.datetime.slice(0, 10)} ({liveBefore.orbitState})
                </div>
                <img
                  src={liveBefore.renderedPreviewUrl ?? ''}
                  alt={`Sentinel-1 RTC scene from ${liveBefore.datetime}`}
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full object-contain bg-black"
                />
              </div>

              <div className="overflow-hidden rounded border border-frost-line bg-glacial-abyss">
                <div className="border-b border-frost-line px-3 py-2 font-mono text-[11px] text-ice-blue">
                  Post · {liveAfter.datetime.slice(0, 10)} ({liveAfter.orbitState})
                </div>
                <img
                  src={liveAfter.renderedPreviewUrl ?? ''}
                  alt={`Sentinel-1 RTC scene from ${liveAfter.datetime}`}
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full object-contain bg-black"
                />
              </div>

              <div className="overflow-hidden rounded border border-frost-line bg-glacial-abyss">
                <div className="border-b border-frost-line px-3 py-2 font-mono text-[11px] text-emerald-300 tabular-nums">
                  Opacity Blend ({liveOpacity}%)
                </div>
                <div className="relative aspect-square w-full bg-black">
                  <img
                    src={liveBefore.renderedPreviewUrl ?? ''}
                    alt="Sentinel-1 baseline preview"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <img
                    src={liveAfter.renderedPreviewUrl ?? ''}
                    alt="Sentinel-1 overlay preview"
                    referrerPolicy="no-referrer"
                    style={{ opacity: liveOpacity / 100 }}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
