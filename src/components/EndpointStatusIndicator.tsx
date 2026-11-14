import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  checkSatelliteEndpointsStatus,
  type EndpointProbe,
  type SatelliteEndpointsStatus,
} from '../lib/satelliteApi';

const STATUS_STYLES: Record<
  EndpointProbe['status'],
  { dot: string; text: string }
> = {
  green: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  yellow: { dot: 'bg-amber-400', text: 'text-amber-300' },
  red: { dot: 'bg-rose-500', text: 'text-rose-300' },
};

export function EndpointStatusIndicator() {
  const [statusData, setStatusData] = useState<SatelliteEndpointsStatus | null>(
    null
  );
  const [checking, setChecking] = useState(true);
  const [probeError, setProbeError] = useState<string | null>(null);

  const runProbe = useCallback(async () => {
    setChecking(true);
    setProbeError(null);
    try {
      const data = await checkSatelliteEndpointsStatus();
      setStatusData(data);
    } catch (err) {
      setProbeError(
        err instanceof Error ? err.message : 'Status check failed'
      );
      setStatusData({
        checkedAt: new Date().toISOString(),
        cmr: {
          name: 'NASA Earthdata CMR',
          status: 'red',
          label: 'Probe Failed',
          latencyMs: null,
          httpStatus: null,
        },
        stac: {
          name: 'Planetary Computer STAC',
          status: 'red',
          label: 'Probe Failed',
          latencyMs: null,
          httpStatus: null,
        },
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void runProbe();
    const timer = window.setInterval(() => {
      void runProbe();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [runProbe]);

  const probes: EndpointProbe[] = statusData
    ? [statusData.cmr, statusData.stac]
    : [
        {
          name: 'NASA Earthdata CMR',
          status: 'yellow',
          label: 'Checking...',
          latencyMs: null,
          httpStatus: null,
        },
        {
          name: 'Planetary Computer STAC',
          status: 'yellow',
          label: 'Checking...',
          latencyMs: null,
          httpStatus: null,
        },
      ];

  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-frost-line pt-5"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {probes.map((probe) => {
          const style = STATUS_STYLES[probe.status];
          return (
            <div
              key={probe.name}
              className="flex items-center gap-2 font-mono text-xs tabular-nums"
            >
              <span
                aria-hidden="true"
                className={`inline-block h-2.5 w-2.5 rounded-full ${style.dot}`}
              />
              <span className="text-crystal-white">{probe.name}:</span>
              <span className={`font-medium ${style.text}`}>{probe.label}</span>
              {probe.latencyMs !== null && (
                <span className="text-frost-mist">({probe.latencyMs} ms)</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {probeError && (
          <span className="font-mono text-[11px] text-rose-300">
            {probeError}
          </span>
        )}
        {statusData && (
          <span className="font-mono text-[11px] text-frost-mist tabular-nums">
            Verified {new Date(statusData.checkedAt).toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          onClick={() => void runProbe()}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded border border-frost-line bg-arctic-teal px-2.5 py-1 font-mono text-[11px] text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{checking ? 'Probing...' : 'Recheck'}</span>
        </button>
      </div>
    </div>
  );
}
