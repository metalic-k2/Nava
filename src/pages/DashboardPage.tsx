import { ArrowUpRight, RefreshCw, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-frost-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-crystal-white">
            SAR Telemetry Dashboard
          </h1>
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
