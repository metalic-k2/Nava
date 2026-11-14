import { ArrowRight, Compass, Layers, LineChart, Radar } from 'lucide-react';
import canopyImg from '../assets/images/sar_deforestation_canopy_1794658470355.jpg';
import floodImg from '../assets/images/sar_flood_comparison_1794658469002.jpg';
import glacierImg from '../assets/images/sar_glacier_calving_1794658468598.jpg';
import orbitImg from '../assets/images/sar_satellite_orbit_1794658471183.jpg';
import { EarthHeroCanvas } from '../components/EarthHeroCanvas';
import type { PageId, SarObservationSite } from '../types/sar';

interface HomePageProps {
  sites: SarObservationSite[];
  onNavigate: (page: PageId) => void;
  onSelectSiteAndNavigate: (siteId: string, page: PageId) => void;
}

export function HomePage({
  sites,
  onNavigate,
  onSelectSiteAndNavigate,
}: HomePageProps) {
  return (
    <div className="bg-glacial-abyss text-crystal-white">
      {/* Hero Split Section */}
      <section className="mx-auto max-w-[1440px] px-4 pt-10 pb-12 sm:px-6 lg:px-8 lg:pt-14">
        <div className="grid items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-5">
            <p className="font-mono text-xs tracking-wide text-ice-blue">
              NASA Space Apps Challenge 2026 · Glacial &amp; Earth Radar
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-crystal-white sm:text-5xl">
              See Earth Through Clouds, Storms, and Polar Night
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-frost-mist">
              Radar satellites send microwave pulses that pierce clouds and darkness—revealing melting glaciers, floods, and forest loss in plain sight.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="inline-flex items-center gap-2 rounded-md bg-crystal-white px-5 py-3 text-sm font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice-blue whitespace-nowrap"
              >
                <span>Explore Map</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('visualizer')}
                className="inline-flex items-center gap-2 rounded-md border border-frost-line bg-arctic-teal px-5 py-3 text-sm font-medium text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue whitespace-nowrap"
              >
                <span>Compare Before &amp; After</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <EarthHeroCanvas
              sites={sites}
              onSelectSite={(siteId) => onSelectSiteAndNavigate(siteId, 'explore')}
            />
          </div>
        </div>

        {/* 4-Column Quick Spec Strip */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-frost-line pt-8 lg:grid-cols-4">
          <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
            <p className="text-xs text-frost-mist">Radar Frequency</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
              5.405 <span className="text-xs font-normal text-ice-blue">GHz C-Band</span>
            </p>
          </div>
          <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
            <p className="text-xs text-frost-mist">Weather Visibility</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-ice-blue tabular-nums">
              24/7 <span className="text-xs font-normal text-frost-mist">Cloud-Free</span>
            </p>
          </div>
          <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
            <p className="text-xs text-frost-mist">Study Sites</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
              {sites.length} <span className="text-xs font-normal text-frost-mist">Global AOIs</span>
            </p>
          </div>
          <div className="rounded-lg border border-frost-line bg-arctic-teal p-4">
            <p className="text-xs text-frost-mist">Ground Detail</p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-crystal-white tabular-nums">
              10 <span className="text-xs font-normal text-frost-mist">m / Pixel</span>
            </p>
          </div>
        </div>
      </section>

      {/* Visual Story Showcase: Simple for Everyone, Credible for Researchers */}
      <section className="border-t border-frost-line bg-arctic-teal">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-ice-blue">01. Visual Guide</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold text-crystal-white sm:text-3xl">
                How Radar Reads Earth&apos;s Surface
              </h2>
            </div>
            <p className="max-w-md text-sm text-frost-mist">
              Smooth surfaces look dark; rough ice, cities, and trees glow bright.
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Card 1: Orbital SAR Satellite */}
            <article className="group overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss">
              <div className="relative aspect-video w-full overflow-hidden bg-crevasse">
                <img
                  src={orbitImg}
                  alt="Synthetic Aperture Radar satellite illuminating glacial peaks through clouds"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
                <div className="absolute inset-x-4 bottom-4">
                  <p className="font-mono text-[11px] text-ice-blue">
                    Active Microwave · VV &amp; VH Polarizations
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-crystal-white">
                    Bouncing Pulses Through Clouds
                  </h3>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-xs">
                <p className="text-frost-mist">
                  Unlike cameras, SAR brings its own radar beam—working in storms and polar night.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="font-mono text-ice-blue hover:text-crystal-white hover:underline whitespace-nowrap shrink-0"
                >
                  Physics →
                </button>
              </div>
            </article>

            {/* Card 2: Glaciers & Cryosphere */}
            <article className="group overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss">
              <div className="relative aspect-video w-full overflow-hidden bg-crevasse">
                <img
                  src={glacierImg}
                  alt="Arctic glacier calving front meeting dark polar ocean fjord"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
                <div className="absolute inset-x-4 bottom-4">
                  <p className="font-mono text-[11px] text-ice-blue">
                    Cryosphere · Pine Island &amp; Polar Ice Shelves
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-crystal-white">
                    Tracking Glacier Calving &amp; Melt
                  </h3>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-xs">
                <p className="text-frost-mist">
                  Jagged ice ridges scatter radar brightly; newly opened ocean water turns jet black.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onSelectSiteAndNavigate('pine-island-glacier-2024', 'visualizer')
                  }
                  className="font-mono text-ice-blue hover:text-crystal-white hover:underline whitespace-nowrap shrink-0"
                >
                  Inspect Ice →
                </button>
              </div>
            </article>

            {/* Card 3: Flood Detection */}
            <article className="group overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss">
              <div className="relative aspect-video w-full overflow-hidden bg-crevasse">
                <img
                  src={floodImg}
                  alt="Orbital radar flood visualization showing dark calm water and cyan flooded vegetation"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
                <div className="absolute inset-x-4 bottom-4">
                  <p className="font-mono text-[11px] text-ice-blue">
                    Specular Drop (-22 dB) · NASA OPERA DSWx-S1
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-crystal-white">
                    Spotting Floodwater Under Storm Clouds
                  </h3>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-xs">
                <p className="text-frost-mist">
                  Flat water acts like a mirror and reflects pulses away, making floods easy to map.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onSelectSiteAndNavigate('indus-flood-2022', 'visualizer')
                  }
                  className="font-mono text-ice-blue hover:text-crystal-white hover:underline whitespace-nowrap shrink-0"
                >
                  View Floods →
                </button>
              </div>
            </article>

            {/* Card 4: Forest Canopy Loss */}
            <article className="group overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss">
              <div className="relative aspect-video w-full overflow-hidden bg-crevasse">
                <img
                  src={canopyImg}
                  alt="Aerial view of dense forest next to cleared land along a winding river"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/35 to-transparent" />
                <div className="absolute inset-x-4 bottom-4">
                  <p className="font-mono text-[11px] text-ice-blue">
                    VH Volume Loss · Log-Ratio Δσ⁰
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-crystal-white">
                    Measuring Forest Clearing
                  </h3>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-xs">
                <p className="text-frost-mist">
                  Dense tree branches scramble radar waves; cleared fields drop sharply in VH echo.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('change-detection')}
                  className="font-mono text-ice-blue hover:text-crystal-white hover:underline whitespace-nowrap shrink-0"
                >
                  Change Lab →
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Interactive Tools Strip */}
      <section className="border-t border-frost-line bg-glacial-abyss">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-ice-blue">02. Workspace</p>
              <h2 className="mt-1.5 font-display text-2xl font-semibold text-crystal-white sm:text-3xl">
                Four Visual Tools, Real Data Provenance
              </h2>
            </div>
            <p className="max-w-md text-xs text-frost-mist">
              Live satellite feeds, archived observations, and demo layers are always labeled clearly.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="group flex flex-col justify-between rounded-lg border border-frost-line bg-arctic-teal p-5 text-left transition-colors hover:border-ice-blue/60"
            >
              <div>
                <Compass className="h-5 w-5 text-ice-blue" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-semibold text-crystal-white group-hover:text-ice-blue">
                  Explore Map
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-frost-mist">
                  Search any place, view live Sentinel-1 passes, and read Google Maps local context.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-ice-blue group-hover:text-crystal-white">
                Open Map <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('visualizer')}
              className="group flex flex-col justify-between rounded-lg border border-frost-line bg-arctic-teal p-5 text-left transition-colors hover:border-ice-blue/60"
            >
              <div>
                <Radar className="h-5 w-5 text-ice-blue" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-semibold text-crystal-white group-hover:text-ice-blue">
                  SAR Visualizer
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-frost-mist">
                  Swipe before vs. after radar frames and inspect exact dB values pixel by pixel.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-ice-blue group-hover:text-crystal-white">
                Open Lab <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('change-detection')}
              className="group flex flex-col justify-between rounded-lg border border-frost-line bg-arctic-teal p-5 text-left transition-colors hover:border-ice-blue/60"
            >
              <div>
                <Layers className="h-5 w-5 text-ice-blue" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-semibold text-crystal-white group-hover:text-ice-blue">
                  Change Lab
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-frost-mist">
                  Toggle flood and forest-loss polygons against live NASA GIBS alerts.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-ice-blue group-hover:text-crystal-white">
                Inspect Masks <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="group flex flex-col justify-between rounded-lg border border-frost-line bg-arctic-teal p-5 text-left transition-colors hover:border-ice-blue/60"
            >
              <div>
                <LineChart className="h-5 w-5 text-ice-blue" aria-hidden="true" />
                <h3 className="mt-3 font-display text-base font-semibold text-crystal-white group-hover:text-ice-blue">
                  Data Dashboard
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-frost-mist">
                  Filter multi-month radar charts, affected areas, and VV/VH benchmarks.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-ice-blue group-hover:text-crystal-white">
                View Charts <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
