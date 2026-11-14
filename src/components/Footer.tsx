import type { PageId } from '../types/sar';
import { EndpointStatusIndicator } from './EndpointStatusIndicator';

interface FooterProps {
  onNavigate: (page: PageId) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const go = (page: PageId) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-frost-line bg-glacial-abyss">
      <div className="mx-auto max-w-[1440px] space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-md">
            <p className="font-display text-base font-bold text-crystal-white">
              Dancing with the SARs
            </p>
            <p className="mt-2 text-xs leading-relaxed text-frost-mist">
              NASA Space Apps Challenge 2026 · Visual radar Earth observation powered by NASA Earthdata CMR, GIBS WMTS, Sentinel-1 RTC, and Google Maps Grounding.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-xs sm:grid-cols-3">
            <div>
              <p className="font-semibold text-crystal-white">Explore</p>
              <ul className="mt-3 space-y-2 text-frost-mist">
                <li>
                  <button type="button" onClick={() => go('explore')} className="hover:text-ice-blue">
                    Interactive Map
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => go('visualizer')} className="hover:text-ice-blue">
                    SAR Visualizer
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => go('change-detection')} className="hover:text-ice-blue">
                    Change Lab
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-crystal-white">Science</p>
              <ul className="mt-3 space-y-2 text-frost-mist">
                <li>
                  <button type="button" onClick={() => go('dashboard')} className="hover:text-ice-blue">
                    Data Dashboard
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => go('how-to-use')} className="hover:text-ice-blue">
                    How to Use
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => go('about')} className="hover:text-ice-blue">
                    How SAR Works
                  </button>
                </li>
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="font-semibold text-crystal-white">Data Authorities</p>
              <ul className="mt-3 space-y-2 text-frost-mist">
                <li>NASA Earthdata CMR</li>
                <li>NASA GIBS WMTS</li>
                <li>Copernicus Sentinel-1</li>
              </ul>
            </div>
          </div>
        </div>

        <EndpointStatusIndicator />
      </div>
    </footer>
  );
}
