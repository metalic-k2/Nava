import { ArrowRight } from 'lucide-react';
import floodImg from '../assets/images/sar_flood_comparison_1794658469002.jpg';
import glacierImg from '../assets/images/sar_glacier_calving_1794658468598.jpg';
import orbitImg from '../assets/images/sar_satellite_orbit_1794658471183.jpg';
import type { PageId } from '../types/sar';

interface AboutPageProps {
  onNavigate: (page: PageId) => void;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-frost-line pb-6">
        <p className="font-mono text-xs text-ice-blue">
          NASA Space Apps Challenge 2026 · Mission Guide
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-crystal-white sm:text-4xl">
          How Radar Reads a Changing Planet
        </h1>
        <p className="mt-2 max-w-2xl text-base text-frost-mist">
          Visual enough for anyone to grasp in seconds—rigorous enough for Earth-science research.
        </p>
      </div>

      {/* Visual Story Cards: Why SAR + What It Sees */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <article className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
          <div className="relative aspect-video w-full bg-crevasse">
            <img
              src={orbitImg}
              alt="Radar satellite sending microwave pulses through mountain clouds"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <p className="font-mono text-[11px] text-ice-blue">01. All-Weather Vision</p>
              <h2 className="font-display text-base font-semibold text-crystal-white">
                Sees Through Clouds &amp; Night
              </h2>
            </div>
          </div>
          <p className="px-4 py-3.5 text-xs leading-relaxed text-frost-mist">
            Regular cameras go blind during cyclones and polar winter. SAR emits 5.4 GHz microwave pulses that pierce storm clouds unimpeded.
          </p>
        </article>

        <article className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
          <div className="relative aspect-video w-full bg-crevasse">
            <img
              src={glacierImg}
              alt="Antarctic glacier edge meeting dark ocean water"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <p className="font-mono text-[11px] text-ice-blue">02. Cryosphere &amp; Water</p>
              <h2 className="font-display text-base font-semibold text-crystal-white">
                Glaciers &amp; Meltwater Contrast
              </h2>
            </div>
          </div>
          <p className="px-4 py-3.5 text-xs leading-relaxed text-frost-mist">
            Fractured glacial ice scatters radar brightly (-6 dB), while calm open seawater reflects beams away and turns jet black (-21 dB).
          </p>
        </article>

        <article className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
          <div className="relative aspect-video w-full bg-crevasse">
            <img
              src={floodImg}
              alt="Radar flood comparison showing dark water and bright vegetation edges"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <p className="font-mono text-[11px] text-ice-blue">03. Flood &amp; Canopy Physics</p>
              <h2 className="font-display text-base font-semibold text-crystal-white">
                Before vs. After Log-Ratio
              </h2>
            </div>
          </div>
          <p className="px-4 py-3.5 text-xs leading-relaxed text-frost-mist">
            Dividing after/before intensity in decibels removes speckle noise and pinpoints new floodwater (&lt; -4.5 dB) or cleared forest.
          </p>
        </article>
      </div>

      {/* Scientific Calibration Strip */}
      <section className="mt-8 rounded-lg border border-frost-line bg-arctic-teal p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-ice-blue">For Researchers</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-crystal-white">
              Calibration &amp; Polarization Equations
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div className="rounded border border-frost-line bg-glacial-abyss p-4">
            <p className="font-mono text-xs text-ice-blue">Gamma-Nought (γ⁰)</p>
            <p className="mt-1 font-mono text-sm font-semibold text-crystal-white">
              dB = 10 · log₁₀(σ⁰)
            </p>
            <p className="mt-2 text-xs leading-relaxed text-frost-mist">
              Terrain-corrected decibel normalization allows fair comparisons across ascending and descending satellite passes.
            </p>
          </div>

          <div className="rounded border border-frost-line bg-glacial-abyss p-4">
            <p className="font-mono text-xs text-ice-blue">Dual-Pol (VV &amp; VH)</p>
            <p className="mt-1 font-mono text-sm font-semibold text-crystal-white">
              VV Surface · VH Volume
            </p>
            <p className="mt-2 text-xs leading-relaxed text-frost-mist">
              VV captures water specular drops and urban double-bounce; VH measures multi-bounce depolarization inside canopies.
            </p>
          </div>

          <div className="rounded border border-frost-line bg-glacial-abyss p-4">
            <p className="font-mono text-xs text-ice-blue">Log-Ratio Change</p>
            <p className="mt-1 font-mono text-sm font-semibold text-crystal-white">
              Δσ⁰ = 10 · log₁₀(I_post / I_pre)
            </p>
            <p className="mt-2 text-xs leading-relaxed text-frost-mist">
              Suppresses multiplicative speckle so flooded basins and deforestation corridors isolate cleanly.
            </p>
          </div>
        </div>
      </section>

      {/* Architecture & Open Data Citations */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <section className="rounded-lg border border-frost-line bg-arctic-teal p-6 lg:col-span-6">
          <p className="font-mono text-xs text-ice-blue">Architecture</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-crystal-white">
            Platform Stack
          </h2>
          <dl className="mt-4 divide-y divide-frost-line text-xs">
            <div className="flex justify-between py-2.5">
              <dt className="text-frost-mist">Interface &amp; 3D Globe</dt>
              <dd className="font-mono text-crystal-white">React 19 · Tailwind · Three.js</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-frost-mist">Interactive Maps</dt>
              <dd className="font-mono text-crystal-white">Leaflet · Esri · NASA GIBS WMTS</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-frost-mist">Geographic Context</dt>
              <dd className="font-mono text-crystal-white">Google Maps Grounding (Gemini)</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-frost-mist">Live Satellite APIs &amp; Storage</dt>
              <dd className="font-mono text-crystal-white">Express · NASA CMR · STAC · Firestore</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col justify-between rounded-lg border border-frost-line bg-arctic-teal p-6 lg:col-span-6">
          <div>
            <p className="font-mono text-xs text-ice-blue">Open Science Sources</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-crystal-white">
              Satellite Catalogs &amp; Credits
            </h2>
            <ul className="mt-4 space-y-2 text-xs text-frost-mist">
              <li>• NASA Earthdata CMR — OPERA DSWx-S1 &amp; Sentinel-1 discovery</li>
              <li>• NASA GIBS — Global Imagery Browse Services WMTS tiles</li>
              <li>• Copernicus Sentinel-1 / Microsoft Planetary Computer STAC</li>
              <li>• NASA JPL ARIA &amp; NISAR Mission SAR educational benchmarks</li>
            </ul>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="inline-flex items-center gap-2 rounded-md bg-crystal-white px-4 py-2 text-xs font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue"
            >
              <span>Open Explore Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
