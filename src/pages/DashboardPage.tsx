import { ArrowUpRight, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ProvenanceLabel } from '../components/ProvenanceLabel';
import {
  POLARIZATION_SCATTERING_REFERENCE,
  TELEMETRY_TIMESERIES,
} from '../data/sarBenchmarks';
import {
  fetchGlacialClimateMetrics,
  type GlacialClimateMetricsResponse,
} from '../lib/satelliteApi';
import type {
  HazardCategory,
  PageId,
  ProvenanceTier,
  SarObservationSite,
} from '../types/sar';

interface DashboardPageProps {
  sites: SarObservationSite[];
  onOpenInPage: (siteId: string, page: PageId) => void;
}

export function DashboardPage({ sites, onOpenInPage }: DashboardPageProps) {
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [hazardFilter, setHazardFilter] = useState<'all' | HazardCategory>('all');
  const [provenanceFilter, setProvenanceFilter] = useState<'all' | ProvenanceTier>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'area' | 'title'>('area');

  // Real-time glacial melt & ice thickness visualizer state
  const [climateData, setClimateData] =
    useState<GlacialClimateMetricsResponse | null>(null);
  const [climateLoading, setClimateLoading] = useState(true);
  const [climateError, setClimateError] = useState<string | null>(null);
  const [selectedGlacierId, setSelectedGlacierId] = useState<string>('pine-island');
  const [seaIceView, setSeaIceView] = useState<'recent' | 'decadal'>('recent');

  const loadClimateData = useCallback(async (force = false) => {
    setClimateLoading(true);
    setClimateError(null);
    try {
      const payload = await fetchGlacialClimateMetrics(force);
      setClimateData(payload);
      if (payload.glaciers.length > 0) {
        setSelectedGlacierId((prev) =>
          payload.glaciers.some((g) => g.id === prev)
            ? prev
            : payload.glaciers[0].id
        );
      }
    } catch (err) {
      setClimateError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch live climate telemetry.'
      );
    } finally {
      setClimateLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClimateData(false);
  }, [loadClimateData]);

  const activeGlacier = useMemo(() => {
    if (!climateData?.glaciers.length) return null;
    return (
      climateData.glaciers.find((g) => g.id === selectedGlacierId) ??
      climateData.glaciers[0]
    );
  }, [climateData, selectedGlacierId]);

  const latestAtl06 = useMemo(
    () => climateData?.icesatPasses.find((p) => p.shortName === 'ATL06') ?? null,
    [climateData]
  );

  const latestAtl15 = useMemo(
    () => climateData?.icesatPasses.find((p) => p.shortName === 'ATL15') ?? null,
    [climateData]
  );

  const regions = useMemo(
    () => Array.from(new Set(sites.map((s) => s.region))),
    [sites]
  );

  const filteredSites = useMemo(() => {
    const base = sites.filter((s) => {
      const okRegion = regionFilter === 'all' || s.region === regionFilter;
      const okHazard = hazardFilter === 'all' || s.hazardCategory === hazardFilter;
      const okProv =
        provenanceFilter === 'all' || s.provenanceTier === provenanceFilter;
      return okRegion && okHazard && okProv;
    });

    return [...base].sort((a, b) =>
      sortField === 'area'
        ? b.affectedAreaKm2 - a.affectedAreaKm2
        : a.title.localeCompare(b.title)
    );
  }, [sites, regionFilter, hazardFilter, provenanceFilter, sortField]);

  const filteredTimeSeries = useMemo(() => {
    const allowedIds = new Set(filteredSites.map((s) => s.id));
    return TELEMETRY_TIMESERIES.filter((pt) => allowedIds.has(pt.siteId)).sort(
      (a, b) => a.date.localeCompare(b.date)
    );
  }, [filteredSites]);

  const kpis = useMemo(() => {
    const totalArea = filteredSites.reduce((sum, s) => sum + s.affectedAreaKm2, 0);
    const totalPasses = filteredTimeSeries.reduce((sum, p) => sum + p.passCount, 0);
    const avgVv =
      filteredTimeSeries.length > 0
        ? filteredTimeSeries.reduce((sum, p) => sum + p.vvBackscatterDb, 0) /
          filteredTimeSeries.length
        : 0;
    return {
      aoiCount: filteredSites.length,
      totalArea,
      totalPasses,
      avgVv,
    };
  }, [filteredSites, filteredTimeSeries]);

  const handleRefresh = () => {
    setErrorMessage(null);
    setIsLoading(true);
    void loadClimateData(true);
    window.setTimeout(() => {
      setIsLoading(false);
    }, 320);
  };

  const resetFilters = () => {
    setRegionFilter('all');
    setHazardFilter('all');
    setProvenanceFilter('all');
    setErrorMessage(null);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Real-Time Glacial Melt & Ice Thickness Visualizer */}
      <section className="mb-10 rounded-lg border border-frost-line bg-arctic-teal p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-frost-line pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <ProvenanceLabel tier="Live Satellite Data" compact />
              {climateData?.fetchedAt && (
                <span className="font-mono text-xs text-frost-mist tabular-nums">
                  Updated {climateData.fetchedAt.slice(0, 16).replace('T', ' ')} UTC
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-crystal-white">
              Real-Time Glacial Melt &amp; Ice Thickness Visualizer
            </h1>
            <p className="mt-1 text-sm text-frost-mist">
              Live sea-ice extent (NOAA/NSIDC), NASA ICESat-2 laser ice-height passes, and real-time glacier melt &amp; snow-depth telemetry.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadClimateData(true)}
            disabled={climateLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-crystal-white px-3.5 py-2 text-xs font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${climateLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh Live Data</span>
          </button>
        </div>

        {climateError && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-rose-500/40 bg-glacial-abyss px-4 py-3 text-xs text-rose-300">
            <span>{climateError}</span>
            <button
              type="button"
              onClick={() => void loadClimateData(true)}
              className="rounded border border-rose-500/40 px-2.5 py-1 font-medium text-rose-200 hover:bg-rose-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {climateLoading && !climateData ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-24 animate-pulse rounded border border-frost-line bg-glacial-abyss"
                />
              ))}
            </div>
            <div className="h-[300px] animate-pulse rounded border border-frost-line bg-glacial-abyss" />
          </div>
        ) : climateData ? (
          <>
            {/* Glacier Selector Tabs */}
            {climateData.glaciers.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {climateData.glaciers.map((glacier) => {
                    const selected = activeGlacier?.id === glacier.id;
                    return (
                      <button
                        key={glacier.id}
                        type="button"
                        onClick={() => setSelectedGlacierId(glacier.id)}
                        className={`rounded-md px-3 py-2 text-left transition-colors ${
                          selected
                            ? 'bg-crystal-white text-glacial-abyss'
                            : 'border border-frost-line bg-glacial-abyss text-frost-mist hover:border-ice-blue/60 hover:text-crystal-white'
                        }`}
                      >
                        <p className="text-xs font-semibold">{glacier.name}</p>
                        <p
                          className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                            selected ? 'text-arctic-teal' : 'text-ice-blue'
                          }`}
                        >
                          {glacier.currentTempC.toFixed(1)} °C · {glacier.currentSnowDepthM.toFixed(2)} m
                        </p>
                      </button>
                    );
                  })}
                </div>

                {activeGlacier?.siteId && (
                  <button
                    type="button"
                    onClick={() => onOpenInPage(activeGlacier.siteId!, 'visualizer')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ice-blue/40 bg-glacial-abyss px-3 py-2 text-xs font-medium text-ice-blue transition-colors hover:bg-crevasse"
                  >
                    <span>Open {activeGlacier.name} in SAR Visualizer</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {/* Live Glacial KPI Strip */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-frost-line bg-glacial-abyss p-4">
                <p className="text-xs text-frost-mist">Surface Melt Rate (PDD Model)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
                  {activeGlacier ? activeGlacier.currentMeltRateMmDay.toFixed(1) : '—'}{' '}
                  <span className="text-xs font-normal text-frost-mist">mm w.e./d</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-ice-blue tabular-nums">
                  {activeGlacier
                    ? `${activeGlacier.currentTempC.toFixed(1)} °C · Freeze ${activeGlacier.freezingLevelM.toLocaleString()} m`
                    : 'Awaiting telemetry'}
                </p>
              </div>

              <div className="rounded-lg border border-frost-line bg-glacial-abyss p-4">
                <p className="text-xs text-frost-mist">Ice Thickness &amp; Live Snow/Firn</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-ice-blue tabular-nums">
                  {activeGlacier ? activeGlacier.publishedIceThicknessM : '—'}{' '}
                  <span className="text-xs font-normal text-frost-mist">
                    m mean · {activeGlacier ? `${activeGlacier.currentSnowDepthM.toFixed(2)} m` : '—'} firn
                  </span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-frost-mist tabular-nums">
                  {activeGlacier
                    ? `24h firn Δ ${activeGlacier.snowDepth24hDeltaCm >= 0 ? '+' : ''}${activeGlacier.snowDepth24hDeltaCm.toFixed(1)} cm · ${activeGlacier.publishedMassTrendGtYr} Gt/yr`
                    : '—'}
                </p>
              </div>

              <div className="rounded-lg border border-frost-line bg-glacial-abyss p-4">
                <p className="text-xs text-frost-mist">Global Sea Ice Extent (NSIDC)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
                  {climateData.seaIceSummary
                    ? climateData.seaIceSummary.latestExtentMkm2.toFixed(2)
                    : '—'}{' '}
                  <span className="text-xs font-normal text-frost-mist">M km²</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-amber-300 tabular-nums">
                  {climateData.seaIceSummary
                    ? `${climateData.seaIceSummary.latestPeriod} · Anom ${climateData.seaIceSummary.latestAnomalyMkm2 >= 0 ? '+' : ''}${climateData.seaIceSummary.latestAnomalyMkm2.toFixed(2)} M km²`
                    : 'Unavailable'}
                </p>
              </div>

              <div className="rounded-lg border border-frost-line bg-glacial-abyss p-4">
                <p className="text-xs text-frost-mist">NASA ICESat-2 Height / Thickness</p>
                <p className="mt-1.5 font-mono text-xl font-semibold text-crystal-white tabular-nums">
                  {latestAtl06 ? latestAtl06.timeStart.slice(0, 10) : '—'}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] text-ice-blue">
                  {latestAtl15
                    ? `ATL15 Δh updated ${latestAtl15.timeEnd.slice(0, 10)}`
                    : latestAtl06?.datasetId ?? 'NASA CMR NSIDC_CPRD'}
                </p>
              </div>
            </div>

            {/* Live Charts Grid */}
            <div className="mt-5 grid gap-5 lg:grid-cols-12">
              {/* Selected Glacier 96h Live Snow Depth, Melt Rate & Temp */}
              <div className="rounded-lg border border-frost-line bg-glacial-abyss p-4 lg:col-span-7">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-semibold text-crystal-white">
                      {activeGlacier
                        ? `${activeGlacier.name}: Live Snow/Firn Depth & Melt Flux`
                        : 'Live Glacier Curve'}
                    </h2>
                    <p className="text-xs text-frost-mist">
                      Observed &amp; forecast 96-hour snow depth (m), surface temp (°C), and PDD melt rate (mm/day)
                    </p>
                  </div>
                  {activeGlacier && (
                    <span className="font-mono text-[11px] text-ice-blue tabular-nums">
                      {activeGlacier.lat.toFixed(2)}°, {activeGlacier.lng.toFixed(2)}° · {activeGlacier.elevationM} m
                    </span>
                  )}
                </div>

                <div className="h-[270px] w-full">
                  {activeGlacier && activeGlacier.hourlySeries.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={activeGlacier.hourlySeries}>
                        <CartesianGrid stroke="#15414F" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          stroke="#9AC0CD"
                          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                          minTickGap={24}
                        />
                        <YAxis
                          yAxisId="depth"
                          stroke="#A5E4F7"
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          unit=" m"
                        />
                        <YAxis
                          yAxisId="temp"
                          orientation="right"
                          stroke="#F2FAFC"
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                          unit="°C"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#031015',
                            borderColor: '#15414F',
                            fontFamily: 'JetBrains Mono',
                            fontSize: '12px',
                            color: '#F2FAFC',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area
                          yAxisId="depth"
                          type="monotone"
                          dataKey="snowDepthM"
                          name="Snow/Firn Depth (m)"
                          stroke="#7AD4EC"
                          fill="#7AD4EC"
                          fillOpacity={0.18}
                          strokeWidth={2}
                        />
                        <Bar
                          yAxisId="temp"
                          dataKey="meltRateMmDay"
                          name="Melt Rate (mm/day)"
                          fill="#F59E0B"
                          fillOpacity={0.65}
                          barSize={10}
                        />
                        <Line
                          yAxisId="temp"
                          type="monotone"
                          dataKey="tempC"
                          name="2m Temp (°C)"
                          stroke="#F2FAFC"
                          strokeWidth={1.75}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center border border-dashed border-frost-line text-xs text-frost-mist">
                      Glacier station feed unavailable.
                    </div>
                  )}
                </div>
              </div>

              {/* NOAA / NSIDC Sea Ice Extent Trajectory */}
              <div className="rounded-lg border border-frost-line bg-glacial-abyss p-4 lg:col-span-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-semibold text-crystal-white">
                      Global Sea Ice Extent (NOAA / NSIDC)
                    </h2>
                    <p className="text-xs text-frost-mist">
                      {climateData.seaIceSummary
                        ? `Trend: ${climateData.seaIceSummary.decadalTrendMkm2} M km²/decade vs ${climateData.seaIceSummary.basePeriod}`
                        : 'Monthly global sea ice extent'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 rounded border border-frost-line bg-arctic-teal p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSeaIceView('recent')}
                      className={`rounded px-2 py-1 font-medium transition-colors ${
                        seaIceView === 'recent'
                          ? 'bg-crystal-white text-glacial-abyss'
                          : 'text-frost-mist hover:text-crystal-white'
                      }`}
                    >
                      24 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeaIceView('decadal')}
                      className={`rounded px-2 py-1 font-medium transition-colors ${
                        seaIceView === 'decadal'
                          ? 'bg-crystal-white text-glacial-abyss'
                          : 'text-frost-mist hover:text-crystal-white'
                      }`}
                    >
                      1979–2026
                    </button>
                  </div>
                </div>

                <div className="h-[270px] w-full">
                  {seaIceView === 'recent' && climateData.seaIceRecentMonths.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={climateData.seaIceRecentMonths}>
                        <CartesianGrid stroke="#15414F" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          stroke="#9AC0CD"
                          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                          minTickGap={16}
                        />
                        <YAxis
                          stroke="#A5E4F7"
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#031015',
                            borderColor: '#15414F',
                            fontFamily: 'JetBrains Mono',
                            fontSize: '12px',
                            color: '#F2FAFC',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area
                          type="monotone"
                          dataKey="extentMkm2"
                          name="Observed Extent (M km²)"
                          stroke="#A5E4F7"
                          fill="#A5E4F7"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="baselineMkm2"
                          name="1991–2020 Mean"
                          stroke="#9AC0CD"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : seaIceView === 'decadal' && climateData.seaIceAnnualTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={climateData.seaIceAnnualTrend}>
                        <CartesianGrid stroke="#15414F" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="year"
                          stroke="#9AC0CD"
                          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                          minTickGap={22}
                        />
                        <YAxis
                          stroke="#A5E4F7"
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#031015',
                            borderColor: '#15414F',
                            fontFamily: 'JetBrains Mono',
                            fontSize: '12px',
                            color: '#F2FAFC',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Area
                          type="monotone"
                          dataKey="meanExtentMkm2"
                          name="Annual Mean Extent (M km²)"
                          stroke="#7AD4EC"
                          fill="#7AD4EC"
                          fillOpacity={0.22}
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center border border-dashed border-frost-line text-xs text-frost-mist">
                      Sea ice dataset temporarily unavailable.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Source Attribution & Latest NASA ICESat-2 Pass Log */}
            <div className="mt-5 grid gap-4 border-t border-frost-line pt-4 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ice-blue">
                  Live NASA ICESat-2 CMR Laser Altimetry Granules
                </p>
                <div className="mt-2 space-y-1.5">
                  {climateData.icesatPasses.slice(0, 3).map((pass) => (
                    <div
                      key={`${pass.shortName}-${pass.title}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-frost-line bg-glacial-abyss px-3 py-1.5 text-xs"
                    >
                      <span className="truncate font-mono text-crystal-white">
                        {pass.shortName} · {pass.title}
                      </span>
                      <span className="font-mono text-[11px] text-frost-mist tabular-nums">
                        {pass.timeStart.slice(0, 10)} · {pass.dataCenter}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ice-blue">
                  Verified Dataset Provenance
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {climateData.sources.map((src) => (
                    <a
                      key={src.name}
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded border border-frost-line bg-glacial-abyss p-2.5 transition-colors hover:border-ice-blue/60"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-crystal-white group-hover:text-ice-blue">
                          {src.name}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-frost-mist" aria-hidden="true" />
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-frost-mist">
                        {src.detail}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-frost-line pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-crystal-white">
            SAR Study Site Telemetry
          </h2>
          <p className="mt-1 text-sm text-frost-mist">
            Compare radar strength (dB), flooded or cleared footprints (km²), and satellite pass counts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProvenanceLabel tier="Archived Satellite Data" />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-frost-line bg-arctic-teal px-3 py-1.5 text-xs font-medium text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 grid gap-4 rounded-lg border border-frost-line bg-arctic-teal p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="dash-region" className="block text-xs font-medium text-crystal-white">
            Region
          </label>
          <select
            id="dash-region"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="mt-1.5 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 text-xs text-crystal-white focus:border-ice-blue focus:outline-none"
          >
            <option value="all">All Regions ({regions.length})</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dash-hazard" className="block text-xs font-medium text-crystal-white">
            Surface Change
          </label>
          <select
            id="dash-hazard"
            value={hazardFilter}
            onChange={(e) => setHazardFilter(e.target.value as 'all' | HazardCategory)}
            className="mt-1.5 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 text-xs text-crystal-white focus:border-ice-blue focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="cryosphere">Glaciers &amp; Ice</option>
            <option value="flood">Flood Inundation</option>
            <option value="deforestation">Forest Canopy Loss</option>
            <option value="deformation">Crustal Deformation</option>
          </select>
        </div>

        <div>
          <label htmlFor="dash-prov" className="block text-xs font-medium text-crystal-white">
            Data Provenance
          </label>
          <select
            id="dash-prov"
            value={provenanceFilter}
            onChange={(e) =>
              setProvenanceFilter(e.target.value as 'all' | ProvenanceTier)
            }
            className="mt-1.5 h-9 w-full rounded border border-frost-line bg-glacial-abyss px-2.5 text-xs text-crystal-white focus:border-ice-blue focus:outline-none"
          >
            <option value="all">All Tiers</option>
            <option value="Archived Satellite Data">Archived Satellite Data</option>
            <option value="Sample/Demo Data">Sample/Demo Data</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded border border-frost-line bg-glacial-abyss px-3 text-xs font-medium text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-rose-500/40 bg-arctic-teal px-4 py-3 text-xs text-rose-300">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded border border-rose-500/40 px-2.5 py-1 font-medium text-rose-200 hover:bg-rose-500/10"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-24 animate-pulse rounded-lg border border-frost-line bg-arctic-teal"
            />
          ))}
        </div>
      ) : filteredSites.length === 0 ? (
        /* Empty State */
        <div className="rounded-lg border border-dashed border-frost-line bg-arctic-teal p-12 text-center">
          <p className="font-display text-base font-semibold text-crystal-white">
            No observation telemetry matches these filters
          </p>
          <p className="mt-1.5 text-xs text-frost-mist">
            Reset filters to view all glaciers, floodplains, and forests.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-md bg-crystal-white px-4 py-2 text-xs font-semibold text-glacial-abyss hover:bg-ice-blue"
          >
            Show All Observations
          </button>
        </div>
      ) : (
        <>
          {/* KPI Telemetry Strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
              <p className="text-xs text-frost-mist">Study Sites</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
                {kpis.aoiCount}
              </p>
            </div>
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
              <p className="text-xs text-frost-mist">Changed Footprint</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-ice-blue tabular-nums">
                {kpis.totalArea.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-frost-mist">km²</span>
              </p>
            </div>
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
              <p className="text-xs text-frost-mist">Mean VV Echo</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
                {filteredTimeSeries.length > 0 ? kpis.avgVv.toFixed(1) : '—'}{' '}
                <span className="text-xs font-normal text-frost-mist">dB</span>
              </p>
            </div>
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
              <p className="text-xs text-frost-mist">Satellite Passes</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
                {kpis.totalPasses}
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* Timeline Chart */}
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-5 lg:col-span-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-crystal-white">
                    Radar Echo &amp; Surface Water Over Time
                  </h2>
                  <p className="text-xs text-frost-mist">
                    Lower dB lines show smooth water expanding as bars rise
                  </p>
                </div>
                <ProvenanceLabel tier="Archived Satellite Data" compact />
              </div>

              <div className="h-[300px] w-full">
                {filteredTimeSeries.length === 0 ? (
                  <div className="flex h-full items-center justify-center border border-dashed border-frost-line text-xs text-frost-mist">
                    No longitudinal time-series points recorded for this selection.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={filteredTimeSeries}>
                      <CartesianGrid stroke="#15414F" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        stroke="#9AC0CD"
                        tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      />
                      <YAxis
                        yAxisId="db"
                        stroke="#A5E4F7"
                        domain={[-28, 0]}
                        tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        unit=" dB"
                      />
                      <YAxis
                        yAxisId="km"
                        orientation="right"
                        stroke="#F59E0B"
                        tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#031015',
                          borderColor: '#15414F',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '12px',
                          color: '#F2FAFC',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line
                        yAxisId="db"
                        type="monotone"
                        dataKey="vvBackscatterDb"
                        name="VV Return (dB)"
                        stroke="#A5E4F7"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="db"
                        type="monotone"
                        dataKey="vhBackscatterDb"
                        name="VH Return (dB)"
                        stroke="#F2FAFC"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Bar
                        yAxisId="km"
                        dataKey="surfaceWaterIndexKm2"
                        name="Water Extent (km²)"
                        fill="#F59E0B"
                        fillOpacity={0.35}
                        barSize={18}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Regional Affected Area Bar Chart */}
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-5 lg:col-span-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-crystal-white">
                    Affected Area by Location
                  </h2>
                  <p className="text-xs text-frost-mist">
                    Documented impact footprint (km²)
                  </p>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredSites.map((s) => ({
                      name: s.country.split(' ')[0],
                      areaKm2: s.affectedAreaKm2,
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 20 }}
                  >
                    <CartesianGrid stroke="#15414F" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      stroke="#9AC0CD"
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={86}
                      stroke="#F2FAFC"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#031015',
                        borderColor: '#15414F',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                        color: '#F2FAFC',
                      }}
                    />
                    <Bar
                      dataKey="areaKm2"
                      name="Affected Area (km²)"
                      fill="#7AD4EC"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Polarization Scattering Reference Chart */}
            <div className="rounded-lg border border-frost-line bg-arctic-teal p-5 lg:col-span-12">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-crystal-white">
                    How Different Surfaces Reflect Radar (C-Band Reference)
                  </h2>
                  <p className="text-xs text-frost-mist">
                    Calm water absorbs/deflects radar (-21 dB), while flooded crops and buildings bounce strongly (-2 dB)
                  </p>
                </div>
                <ProvenanceLabel tier="Processed Observations" compact />
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={POLARIZATION_SCATTERING_REFERENCE}>
                    <CartesianGrid stroke="#15414F" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="surface"
                      stroke="#9AC0CD"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#9AC0CD"
                      domain={[-30, 0]}
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      unit=" dB"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#031015',
                        borderColor: '#15414F',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                        color: '#F2FAFC',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="vvDb" name="VV Backscatter (dB)" fill="#A5E4F7" />
                    <Bar dataKey="vhDb" name="VH Backscatter (dB)" fill="#1F7A8C" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Location-Based Observation Table */}
          <div className="mt-6 overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-frost-line px-5 py-3.5">
              <h2 className="font-display text-base font-semibold text-crystal-white">
                All Study Sites
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-frost-mist">Sort by:</span>
                <button
                  type="button"
                  onClick={() => setSortField('area')}
                  className={`rounded px-2.5 py-1 font-medium ${
                    sortField === 'area'
                      ? 'bg-crystal-white text-glacial-abyss'
                      : 'border border-frost-line text-frost-mist'
                  }`}
                >
                  Area
                </button>
                <button
                  type="button"
                  onClick={() => setSortField('title')}
                  className={`rounded px-2.5 py-1 font-medium ${
                    sortField === 'title'
                      ? 'bg-crystal-white text-glacial-abyss'
                      : 'border border-frost-line text-frost-mist'
                  }`}
                >
                  Name
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-frost-line bg-glacial-abyss text-frost-mist">
                  <tr>
                    <th className="px-4 py-3 font-medium">Observation Site</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">Sensor</th>
                    <th className="px-4 py-3 text-right font-medium">Area (km²)</th>
                    <th className="px-4 py-3 font-medium">Provenance</th>
                    <th className="px-4 py-3 text-right font-medium">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-frost-line">
                  {filteredSites.map((site) => (
                    <tr key={site.id} className="hover:bg-crevasse/60">
                      <td className="px-4 py-3 font-medium text-crystal-white">
                        {site.title}
                      </td>
                      <td className="px-4 py-3 text-frost-mist">
                        {site.country}
                      </td>
                      <td className="px-4 py-3 font-mono text-frost-mist">
                        {site.sensor}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-crystal-white tabular-nums">
                        {site.affectedAreaKm2.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <ProvenanceLabel tier={site.provenanceTier} compact />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenInPage(site.id, 'explore')}
                            className="inline-flex items-center gap-1 rounded border border-frost-line px-2 py-1 text-crystal-white hover:border-ice-blue/60 hover:text-ice-blue"
                          >
                            Map <ArrowUpRight className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenInPage(site.id, 'visualizer')}
                            className="inline-flex items-center gap-1 rounded border border-ice-blue/35 bg-ice-blue/10 px-2 py-1 text-ice-blue hover:bg-ice-blue/20"
                          >
                            Visualizer <ArrowUpRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
