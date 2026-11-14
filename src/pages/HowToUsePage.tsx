import {
  Activity,
  ArrowRight,
  Bookmark,
  Compass,
  Globe,
  Layers,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import deforestImg from '../assets/images/sar_deforestation_canopy_1794658470355.jpg';
import floodImg from '../assets/images/sar_flood_comparison_1794658469002.jpg';
import glacierImg from '../assets/images/sar_glacier_calving_1794658468598.jpg';
import orbitImg from '../assets/images/sar_satellite_orbit_1794658471183.jpg';
import type { PageId } from '../types/sar';

interface HowToUsePageProps {
  onNavigate: (page: PageId) => void;
}

interface StepGuideItem {
  step: string;
  page: PageId;
  title: string;
  actionLabel: string;
  summary: string;
  tips: string[];
  icon: typeof Globe;
}

const TOOL_STEPS: StepGuideItem[] = [
  {
    step: 'Step 01',
    page: 'home',
    title: 'Spin the 3D Earth Globe',
    actionLabel: 'Go to Home Globe',
    summary:
      'Start on the Home page to drag and rotate the interactive 3D Earth. Click any glowing marker on the globe to inspect glaciers, floodplains, forests, or fault zones.',
    tips: [
      'Click and drag anywhere on the globe to rotate smoothly.',
      'Select any site card or marker to jump straight to its radar view.',
    ],
    icon: Globe,
  },
  {
    step: 'Step 02',
    page: 'explore',
    title: 'Explore Maps & Query Live Satellites',
    actionLabel: 'Open Explore Map',
    summary:
      'Use the Explore map to search any city, glacier, or river basin worldwide, switch base layers, fetch live Sentinel-1 & NASA CMR passes, and load Google Maps local context.',
    tips: [
      'Type a place name in the search bar to fly the map directly there.',
      'Click "Query Live NASA CMR & Sentinel-1" to fetch real overhead satellite passes.',
      'Press "Load Local Context" to read nearby rivers, towns, or research stations via Google Maps.',
    ],
    icon: Compass,
  },
  {
    step: 'Step 03',
    page: 'visualizer',
    title: 'Compare Before & After in Visualizer',
    actionLabel: 'Open SAR Visualizer',
    summary:
      'Drag the vertical swipe handle across real Before and After satellite radar scenes to spot glacier retreat, rising floodwater, or forest clearing right away.',
    tips: [
      'Switch between Swipe, Opacity Blend, and Side-by-Side modes.',
      'Toggle VV (best for water & ice) vs VH (best for forest density) radar polarizations.',
      'Hover or tap anywhere on the radar canvas to probe brightness in decibels (dB).',
    ],
    icon: SlidersHorizontal,
  },
  {
    step: 'Step 04',
    page: 'change-detection',
    title: 'Isolate Change in the Change Lab',
    actionLabel: 'Open Change Lab',
    summary:
      'Adjust the decibel change threshold slider to highlight where radar brightness shifted sharply between two dates—making hidden floodwater or cleared land stand out clearly.',
    tips: [
      'Lower the threshold slider (e.g., -4.5 dB) to isolate deep floodwater cleanly.',
      'Toggle individual analysis layers to see water polygons, forest loss, or moisture shifts.',
    ],
    icon: Layers,
  },
  {
    step: 'Step 05',
    page: 'dashboard',
    title: 'Check Real-Time Glacial & Radar Metrics',
    actionLabel: 'Open Live Dashboard',
    summary:
      'View live global sea-ice extent from NOAA/NSIDC, real-time melt rates and snow/firn depth across benchmark glaciers, NASA ICESat-2 laser height passes, and site radar charts.',
    tips: [
      'Pick any glacier tab (Pine Island, Jakobshavn, Vatnajokull, Columbia) to plot its live curve.',
      'Click "Refresh Live Data" to pull the newest readings on demand.',
    ],
    icon: Activity,
  },
  {
    step: 'Step 06',
    page: 'explore',
    title: 'Save Bookmarks & Field Notes',
    actionLabel: 'Open Saved Drawer',
    summary:
      'Found an interesting glacier or flood zone? Click Bookmark on Explore to save it with your own notes. Sign in with Google inside the Saved drawer to sync across devices.',
    tips: [
      'Bookmarks save instantly in your browser even without signing in.',
      'Use "Saved" in the top-right bar anytime to revisit bookmarked coordinates in one click.',
    ],
    icon: Bookmark,
  },
];

export function HowToUsePage({ onNavigate }: HowToUsePageProps) {
  const go = (page: PageId) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-frost-line pb-6">
        <p className="font-mono text-xs text-ice-blue">
          Quick Start Walkthrough · Built for Everyone
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-crystal-white sm:text-4xl">
          How to Use Dancing with the SARs
        </h1>
        <p className="mt-2 max-w-2xl text-base text-frost-mist">
          No radar background needed. Follow these simple steps to explore live satellite passes, compare glaciers before and after melt events, and read real-time climate charts.
        </p>
      </div>

      {/* 3-Step Visual Summary Strip */}
      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <div className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
          <div className="relative aspect-video w-full bg-crevasse">
            <img
              src={orbitImg}
              alt="Radar satellite scanning Earth surface from orbit"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/30 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <p className="font-mono text-[11px] text-ice-blue">1. Pick Any Place</p>
              <h2 className="font-display text-base font-semibold text-crystal-white">
                Search or Spin the Globe
              </h2>
            </div>
          </div>
          <p className="px-4 py-3 text-xs leading-relaxed text-frost-mist">
            Choose a featured glacier, flood zone, or search any coordinates on Earth in Explore.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
          <div className="relative aspect-video w-full bg-crevasse">
            <img
              src={glacierImg}
              alt="Glacier calving into polar ocean"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/30 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <p className="font-mono text-[11px] text-ice-blue">2. Slide &amp; Compare</p>
              <h2 className="font-display text-base font-semibold text-crystal-white">
                See Changes Through Clouds
              </h2>
            </div>
          </div>
          <p className="px-4 py-3 text-xs leading-relaxed text-frost-mist">
            Drag the Before / After slider in Visualizer or test radar thresholds in Change Lab.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-frost-line bg-arctic-teal">
          <div className="relative aspect-video w-full bg-crevasse">
            <img
              src={floodImg}
              alt="Radar surface comparison highlighting dark water vs bright land"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/30 to-transparent" />
            <div className="absolute inset-x-4 bottom-3">
              <p className="font-mono text-[11px] text-ice-blue">3. Track Live Numbers</p>
              <h2 className="font-display text-base font-semibold text-crystal-white">
                Monitor Melt &amp; Save Sites
              </h2>
            </div>
          </div>
          <p className="px-4 py-3 text-xs leading-relaxed text-frost-mist">
            Inspect live glacial melt rates and sea-ice extent on Dashboard, then bookmark findings.
          </p>
        </div>
      </section>

      {/* Step-by-Step Tool Walkthrough */}
      <section className="mt-10">
        <div className="mb-5">
          <p className="font-mono text-xs text-ice-blue">Tool-by-Tool Guide</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-crystal-white">
            What Every Section Does
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TOOL_STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.step}
                className="flex flex-col justify-between rounded-lg border border-frost-line bg-arctic-teal p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-ice-blue">{item.step}</span>
                    <Icon className="h-4 w-4 text-ice-blue" aria-hidden="true" />
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold text-crystal-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-frost-mist">
                    {item.summary}
                  </p>
                  <ul className="mt-4 space-y-1.5 border-t border-frost-line pt-3 text-xs text-frost-mist">
                    {item.tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ice-blue" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => go(item.page)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-frost-line bg-glacial-abyss px-3.5 py-2 text-xs font-medium text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 10-Second Radar Decoder */}
      <section className="mt-10 rounded-lg border border-frost-line bg-arctic-teal p-6">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="font-mono text-xs text-ice-blue">10-Second Cheat Sheet</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-crystal-white">
              How to Read Radar Brightness (dB)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-frost-mist">
              Radar satellites don&apos;t take normal color photos—they measure how strongly microwave beams bounce back. Higher (less negative) numbers look bright; lower numbers look dark.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-frost-line bg-glacial-abyss p-3.5">
                <p className="font-mono text-xs text-ice-blue">Dark (-26 to -16 dB)</p>
                <p className="mt-1 font-display text-sm font-semibold text-crystal-white">
                  Calm Water &amp; Melt Pools
                </p>
                <p className="mt-1 text-xs text-frost-mist">
                  Smooth lakes, oceans, and flooded plains act like mirrors and bounce beams away.
                </p>
              </div>

              <div className="rounded border border-frost-line bg-glacial-abyss p-3.5">
                <p className="font-mono text-xs text-ice-blue">Mid Gray (-15 to -9 dB)</p>
                <p className="mt-1 font-display text-sm font-semibold text-crystal-white">
                  Dry Snow, Soil &amp; Grass
                </p>
                <p className="mt-1 text-xs text-frost-mist">
                  Even ground and stable snowpack return a steady medium radar echo.
                </p>
              </div>

              <div className="rounded border border-frost-line bg-glacial-abyss p-3.5">
                <p className="font-mono text-xs text-ice-blue">Bright (-8 to -2 dB)</p>
                <p className="mt-1 font-display text-sm font-semibold text-crystal-white">
                  Jagged Ice &amp; Buildings
                </p>
                <p className="mt-1 text-xs text-frost-mist">
                  Cracked glaciers, forest canopies, and city walls bounce signals straight back.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-frost-line bg-crevasse lg:col-span-5">
            <div className="relative aspect-[16/10] w-full">
              <img
                src={deforestImg}
                alt="Forest canopy vs cleared ground radar contrast example"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-glacial-abyss via-glacial-abyss/25 to-transparent" />
              <div className="absolute inset-x-4 bottom-3">
                <p className="font-mono text-[11px] text-ice-blue">VH Canopy Example</p>
                <p className="text-xs text-crystal-white">
                  Thick trees scatter bright VH radar echoes; cleared soil drops darker immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Lights & Quick Links */}
      <section className="mt-8 flex flex-col justify-between gap-4 rounded-lg border border-frost-line bg-arctic-teal p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ice-blue" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-semibold text-crystal-white">
              Live Connection Lights in the Footer
            </h2>
            <p className="mt-1 text-xs text-frost-mist">
              Look at the bottom bar anytime: Green means NASA Earthdata &amp; Sentinel-1 STAC endpoints are fast and online; Yellow means high latency; Red means an upstream service is temporarily offline.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => go('dashboard')}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-crystal-white px-4 py-2 text-xs font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue whitespace-nowrap"
        >
          <span>Open Live Dashboard</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
