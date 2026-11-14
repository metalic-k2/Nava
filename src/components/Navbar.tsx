import { Bookmark, Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { PageId } from '../types/sar';

interface NavbarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  bookmarkCount: number;
  onOpenBookmarks: () => void;
}

const NAV_ITEMS: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'explore', label: 'Explore' },
  { id: 'visualizer', label: 'Visualizer' },
  { id: 'change-detection', label: 'Change Lab' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'how-to-use', label: 'How to Use' },
  { id: 'about', label: 'About' },
];

export function Navbar({
  activePage,
  onNavigate,
  bookmarkCount,
  onOpenBookmarks,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelectPage = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-frost-line bg-glacial-abyss/95">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleSelectPage('home')}
          className="text-left font-display text-base font-bold tracking-tight text-crystal-white transition-colors hover:text-ice-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice-blue whitespace-nowrap shrink-0"
        >
          Dancing with the SARs
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-5"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice-blue ${
                  isActive
                    ? 'text-ice-blue'
                    : 'text-frost-mist hover:text-crystal-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-ice-blue"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary action + mobile toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {activePage === 'home' ? (
            <button
              type="button"
              onClick={() => handleSelectPage('explore')}
              className="hidden sm:inline-flex items-center justify-center rounded-md bg-crystal-white px-4 py-2 text-xs font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice-blue whitespace-nowrap shrink-0"
            >
              Explore Earth
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenBookmarks}
              className="hidden sm:inline-flex items-center gap-2 rounded-md border border-frost-line bg-crevasse px-3.5 py-2 text-xs font-medium text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice-blue whitespace-nowrap shrink-0"
            >
              <Bookmark className="h-3.5 w-3.5 text-ice-blue" aria-hidden="true" />
              <span className="tabular-nums">Saved ({bookmarkCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-frost-line bg-arctic-teal text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="border-t border-frost-line bg-arctic-teal px-4 py-3 lg:hidden">
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPage(item.id)}
                  className={`flex min-h-[44px] items-center justify-between rounded-md px-3 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-crevasse text-ice-blue'
                      : 'text-frost-mist hover:bg-crevasse/60 hover:text-crystal-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="font-mono text-xs text-ice-blue">Active</span>
                  )}
                </button>
              );
            })}
            <div className="mt-2 border-t border-frost-line pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenBookmarks();
                }}
                className="flex min-h-[44px] w-full items-center gap-2 rounded-md border border-frost-line bg-crevasse px-3 text-sm font-medium text-crystal-white"
              >
                <Bookmark className="h-4 w-4 text-ice-blue" aria-hidden="true" />
                <span className="tabular-nums">Saved Observations ({bookmarkCount})</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
