import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ComparisonMode,
  PolarizationMode,
  SarAcquisitionPair,
  SarObservationSite,
} from '../types/sar';

interface SarRasterCanvasProps {
  site: SarObservationSite;
  acquisition: SarAcquisitionPair;
  polarization: PolarizationMode;
  comparisonMode: ComparisonMode;
  splitPercent: number;
  onSplitChange: (val: number) => void;
  overlayOpacity: number;
}

interface ProbeReading {
  x: number;
  y: number;
  beforeDb: number;
  afterDb: number;
  deltaDb: number;
  scatteringClass: string;
}

const GRID_W = 384;
const GRID_H = 240;

function hashNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hashNoise(ix, iy, seed);
  const b = hashNoise(ix + 1, iy, seed);
  const c = hashNoise(ix, iy + 1, seed);
  const d = hashNoise(ix + 1, iy + 1, seed);

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x: number, y: number, seed: number): number {
  let val = 0;
  let amp = 0.5;
  let freq = 64;
  for (let i = 0; i < 4; i++) {
    val += amp * smoothNoise(x, y, freq, seed + i * 19);
    freq *= 0.5;
    amp *= 0.5;
  }
  return val;
}

function dbToNorm(db: number): number {
  return Math.max(0, Math.min(1, (db + 26) / 26));
}

function synthesizeBackscatterGrids(
  site: SarObservationSite,
  acquisition: SarAcquisitionPair,
  polarization: PolarizationMode
): {
  beforeDb: Float32Array;
  afterDb: Float32Array;
  beforeImg: ImageData;
  afterImg: ImageData;
} {
  const count = GRID_W * GRID_H;
  const beforeDb = new Float32Array(count);
  const afterDb = new Float32Array(count);
  const beforeImg = new ImageData(GRID_W, GRID_H);
  const afterImg = new ImageData(GRID_W, GRID_H);

  const seedBase = site.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const polOffset = polarization === 'VH' ? -6.2 : polarization === 'VV+VH' ? -2.8 : 0;

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const idx = y * GRID_W + x;
      const nx = x / GRID_W;
      const ny = y / GRID_H;

      const terrain = fbm(x, y, seedBase);
      const fine = fbm(x * 2.1, y * 2.1, seedBase + 101);
      // Multiplicative Rayleigh-like SAR speckle in dB
      const specklePre = (hashNoise(x, y, seedBase + 7) - 0.5) * 3.6;
      const specklePost = (hashNoise(x, y, seedBase + 23) - 0.5) * 3.6;

      let bDb = -10.5 + (terrain - 0.5) * 7.5 + (fine - 0.5) * 3.0 + polOffset;
      let aDb = bDb;

      if (site.terrainProfile === 'river-basin') {
        // Winding river channel + expanding monsoon floodplain
        const meander = 0.5 + 0.16 * Math.sin(nx * 7.5 + 0.6) + 0.08 * Math.cos(nx * 14);
        const distRiver = Math.abs(ny - meander);
        if (distRiver < 0.045) {
          bDb = -21.2 + polOffset * 0.5;
        }
        const floodMask = distRiver < 0.22 + (terrain - 0.5) * 0.18;
        if (floodMask) {
          // Open water specular reflection vs vegetated levee double-bounce
          if (distRiver > 0.18 && fine > 0.62) {
            aDb = -3.4 + (polarization === 'VV' ? 1.2 : -3.5);
          } else {
            aDb = -21.8 + (terrain - 0.5) * 2.5 + polOffset * 0.4;
          }
        }
      } else if (site.terrainProfile === 'tropical-canopy') {
        // Dense rainforest volume scatter vs fishbone clearing roads
        bDb = -7.4 + (terrain - 0.5) * 3.2 + (polarization === 'VH' ? -3.4 : 0);
        const spine = Math.abs(ny - (0.52 + (nx - 0.5) * 0.18));
        const ribPhase = Math.abs(((nx * 9.5) % 1) - 0.5);
        const cleared = (spine < 0.055 || (spine < 0.34 && ribPhase < 0.19)) && terrain > 0.35;
        if (cleared) {
          aDb = bDb - (polarization === 'VH' ? 6.1 : 3.9);
        }
      } else if (site.terrainProfile === 'urban-fault') {
        // Urban corner reflectors + coseismic rupture zone
        const cityGrid =
          Math.sin(nx * 46) > 0.45 && Math.cos(ny * 36) > 0.45 && terrain > 0.42;
        bDb = cityGrid ? -2.2 + polOffset * 0.5 : -10.8 + (terrain - 0.5) * 5.0 + polOffset;
        const faultDist = Math.abs(ny - (0.3 + nx * 0.42));
        if (faultDist < 0.09 && cityGrid) {
          aDb = bDb - 4.8;
        } else if (faultDist < 0.06) {
          aDb = bDb - 2.4;
        }
      } else if (site.terrainProfile === 'glacial-shelf') {
        // Ice shelf firn volume scatter vs calved open polynya water
        const riftLine = 0.64 + 0.08 * Math.sin(nx * 6.0) + (terrain - 0.5) * 0.1;
        bDb = ny > riftLine + 0.1 ? -20.0 + polOffset * 0.3 : -6.6 + (fine - 0.5) * 4.2 + polOffset * 0.6;
        aDb = ny > riftLine - 0.06 ? -20.6 + polOffset * 0.3 : bDb;
      }

      // Apply subtle calibration offset toward documented site acquisition shift
      const ratioBias = (acquisition.meanBackscatterAfterDb - acquisition.meanBackscatterBeforeDb) * 0.08;
      aDb += ratioBias;

      const finalBefore = Math.max(-28, Math.min(2, bDb + specklePre));
      const finalAfter = Math.max(-28, Math.min(2, aDb + specklePost));

      beforeDb[idx] = finalBefore;
      afterDb[idx] = finalAfter;

      const pIdx = idx * 4;

      if (polarization === 'VV+VH') {
        // False-color Dual-Pol RGB: R = VV, G = VH, B = VV-VH contrast
        const bVv = dbToNorm(finalBefore + 2.4);
        const bVh = dbToNorm(finalBefore - 3.6);
        const bRatio = Math.max(0, Math.min(1, (bVv - bVh) * 1.9 + 0.18));

        beforeImg.data[pIdx] = Math.round(bVv * 235);
        beforeImg.data[pIdx + 1] = Math.round(bVh * 245);
        beforeImg.data[pIdx + 2] = Math.round(bRatio * 255);
        beforeImg.data[pIdx + 3] = 255;

        const aVv = dbToNorm(finalAfter + 2.4);
        const aVh = dbToNorm(finalAfter - 3.6);
        const aRatio = Math.max(0, Math.min(1, (aVv - aVh) * 1.9 + 0.18));

        afterImg.data[pIdx] = Math.round(aVv * 235);
        afterImg.data[pIdx + 1] = Math.round(aVh * 245);
        afterImg.data[pIdx + 2] = Math.round(aRatio * 255);
        afterImg.data[pIdx + 3] = 255;
      } else {
        // Calibrated grayscale with subtle cold radar tint
        const bLum = Math.round(dbToNorm(finalBefore) * 245);
        beforeImg.data[pIdx] = Math.round(bLum * 0.92);
        beforeImg.data[pIdx + 1] = Math.round(bLum * 0.98);
        beforeImg.data[pIdx + 2] = Math.min(255, Math.round(bLum * 1.05));
        beforeImg.data[pIdx + 3] = 255;

        const aLum = Math.round(dbToNorm(finalAfter) * 245);
        afterImg.data[pIdx] = Math.round(aLum * 0.92);
        afterImg.data[pIdx + 1] = Math.round(aLum * 0.98);
        afterImg.data[pIdx + 2] = Math.min(255, Math.round(aLum * 1.05));
        afterImg.data[pIdx + 3] = 255;
      }
    }
  }

  return { beforeDb, afterDb, beforeImg, afterImg };
}

function classifyScattering(afterDb: number, deltaDb: number): string {
  if (afterDb < -17.5) return 'Specular Open Water (Low Return)';
  if (deltaDb > 2.2) return 'Double-Bounce Flooded Structure / Canopy';
  if (deltaDb < -3.0) return 'Volume / Roughness Loss Detected';
  if (afterDb > -5.5) return 'Corner Reflector / Dense Structure';
  return 'Diffuse Surface / Canopy Scattering';
}

export function SarRasterCanvas({
  site,
  acquisition,
  polarization,
  comparisonMode,
  splitPercent,
  onSplitChange,
  overlayOpacity,
}: SarRasterCanvasProps) {
  const primaryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);
  const [probe, setProbe] = useState<ProbeReading | null>(null);

  const grids = useMemo(
    () => synthesizeBackscatterGrids(site, acquisition, polarization),
    [site, acquisition, polarization]
  );

  const offscreenPair = useMemo(() => {
    const before = document.createElement('canvas');
    before.width = GRID_W;
    before.height = GRID_H;
    before.getContext('2d')!.putImageData(grids.beforeImg, 0, 0);

    const after = document.createElement('canvas');
    after.width = GRID_W;
    after.height = GRID_H;
    after.getContext('2d')!.putImageData(grids.afterImg, 0, 0);

    return { before, after };
  }, [grids]);

  // Render composite canvas for swipe / opacity modes without allocating new canvases
  useEffect(() => {
    if (comparisonMode === 'side-by-side') return;
    const canvas = primaryCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID_W, GRID_H);
    ctx.drawImage(offscreenPair.before, 0, 0);

    if (comparisonMode === 'swipe') {
      const splitX = Math.round((splitPercent / 100) * GRID_W);
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, GRID_W - splitX, GRID_H);
      ctx.clip();
      ctx.drawImage(offscreenPair.after, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = overlayOpacity / 100;
      ctx.drawImage(offscreenPair.after, 0, 0);
      ctx.restore();
    }
  }, [offscreenPair, comparisonMode, splitPercent, overlayOpacity]);

  // Render dual canvases for side-by-side mode
  useEffect(() => {
    if (comparisonMode !== 'side-by-side') return;
    const bCanvas = beforeCanvasRef.current;
    const aCanvas = afterCanvasRef.current;
    if (bCanvas) {
      bCanvas.getContext('2d')?.putImageData(grids.beforeImg, 0, 0);
    }
    if (aCanvas) {
      aCanvas.getContext('2d')?.putImageData(grids.afterImg, 0, 0);
    }
  }, [grids, comparisonMode]);

  const updateProbeFromClient = (clientX: number, clientY: number, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const gx = Math.min(GRID_W - 1, Math.floor(rx * GRID_W));
    const gy = Math.min(GRID_H - 1, Math.floor(ry * GRID_H));
    const idx = gy * GRID_W + gx;
    const bVal = grids.beforeDb[idx];
    const aVal = grids.afterDb[idx];
    const dVal = aVal - bVal;

    setProbe({
      x: gx,
      y: gy,
      beforeDb: bVal,
      afterDb: aVal,
      deltaDb: dVal,
      scatteringClass: classifyScattering(aVal, dVal),
    });

    if (draggingRef.current && comparisonMode === 'swipe') {
      onSplitChange(Math.round(rx * 100));
    }
  };

  return (
    <div className="space-y-3">
      {comparisonMode === 'side-by-side' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss">
            <div className="flex items-center justify-between border-b border-frost-line bg-arctic-teal px-3 py-2">
              <span className="font-mono text-xs text-crystal-white">
                Before · {acquisition.beforeDate}
              </span>
              <span className="font-mono text-xs text-frost-mist tabular-nums">
                Mean {acquisition.meanBackscatterBeforeDb.toFixed(1)} dB
              </span>
            </div>
            <canvas
              ref={beforeCanvasRef}
              width={GRID_W}
              height={GRID_H}
              onPointerMove={(e) => updateProbeFromClient(e.clientX, e.clientY, e.currentTarget)}
              onPointerLeave={() => setProbe(null)}
              className="block aspect-[16/10] w-full cursor-crosshair object-cover"
            />
          </div>

          <div className="relative overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss">
            <div className="flex items-center justify-between border-b border-frost-line bg-arctic-teal px-3 py-2">
              <span className="font-mono text-xs text-ice-blue">
                After · {acquisition.afterDate}
              </span>
              <span className="font-mono text-xs text-ice-blue tabular-nums">
                Mean {acquisition.meanBackscatterAfterDb.toFixed(1)} dB
              </span>
            </div>
            <canvas
              ref={afterCanvasRef}
              width={GRID_W}
              height={GRID_H}
              onPointerMove={(e) => updateProbeFromClient(e.clientX, e.clientY, e.currentTarget)}
              onPointerLeave={() => setProbe(null)}
              className="block aspect-[16/10] w-full cursor-crosshair object-cover"
            />
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss select-none">
          <canvas
            ref={primaryCanvasRef}
            width={GRID_W}
            height={GRID_H}
            onPointerDown={(e) => {
              if (comparisonMode === 'swipe') {
                draggingRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }
              updateProbeFromClient(e.clientX, e.clientY, e.currentTarget);
            }}
            onPointerMove={(e) => updateProbeFromClient(e.clientX, e.clientY, e.currentTarget)}
            onPointerUp={(e) => {
              draggingRef.current = false;
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerLeave={() => {
              draggingRef.current = false;
              setProbe(null);
            }}
            className="block aspect-[16/10] w-full cursor-crosshair object-cover touch-none"
          />

          {/* Top corner acquisition labels */}
          <div className="pointer-events-none absolute top-3 left-3 rounded border border-frost-line bg-arctic-teal/95 px-2.5 py-1 font-mono text-xs text-crystal-white tabular-nums">
            Before: {acquisition.beforeDate}
          </div>
          <div className="pointer-events-none absolute top-3 right-3 rounded border border-frost-line bg-arctic-teal/95 px-2.5 py-1 font-mono text-xs text-ice-blue tabular-nums">
            After: {acquisition.afterDate}
          </div>

          {/* Interactive split divider line in Swipe mode */}
          {comparisonMode === 'swipe' && (
            <div
              aria-hidden="true"
              style={{ left: `${splitPercent}%` }}
              className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-crystal-white"
            >
              <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ice-blue bg-glacial-abyss font-mono text-xs font-semibold text-crystal-white">
                ↔
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Backscatter Crosshair Readout & Plain-Language Scale Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-frost-line bg-arctic-teal px-4 py-3">
        {probe ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
            <span className="text-frost-mist">
              Pixel ({probe.x}, {probe.y})
            </span>
            <span className="text-crystal-white">
              Pre: {probe.beforeDb.toFixed(1)} dB
            </span>
            <span className="text-ice-blue">
              Post: {probe.afterDb.toFixed(1)} dB
            </span>
            <span
              className={
                probe.deltaDb < -2
                  ? 'text-ice-blue'
                  : probe.deltaDb > 2
                    ? 'text-amber-300'
                    : 'text-frost-mist'
              }
            >
              Δσ⁰: {probe.deltaDb >= 0 ? '+' : ''}
              {probe.deltaDb.toFixed(1)} dB
            </span>
            <span className="text-crystal-white">{probe.scatteringClass}</span>
          </div>
        ) : (
          <p className="font-mono text-xs text-frost-mist">
            Hover over the image to inspect surface type and radar intensity (dB).
          </p>
        )}

        <div className="flex items-center gap-2 font-mono text-[11px] text-frost-mist tabular-nums">
          <span>Dark = Calm Water (-28 dB)</span>
          <div
            aria-hidden="true"
            className="h-2 w-24 rounded-sm border border-frost-line"
            style={{
              background:
                polarization === 'VV+VH'
                  ? 'linear-gradient(90deg, #031015 0%, #145364 40%, #7ad4ec 72%, #f2fafc 100%)'
                  : 'linear-gradient(90deg, #031015 0%, #587f8c 50%, #f2fafc 100%)',
            }}
          />
          <span>Bright = Ice / Buildings (+2 dB)</span>
        </div>
      </div>
    </div>
  );
}
