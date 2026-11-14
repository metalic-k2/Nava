import type { User } from 'firebase/auth';
import { ArrowUpRight, Bookmark, Cloud, LogIn, LogOut, Trash2, X } from 'lucide-react';
import type { BookmarkItem, PageId } from '../types/sar';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkItem[];
  onRemoveBookmark: (id: string) => void;
  onOpenSite: (siteId: string, page: PageId) => void;
  user: User | null;
  authBusy: boolean;
  syncError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function BookmarksDrawer({
  isOpen,
  onClose,
  bookmarks,
  onRemoveBookmark,
  onOpenSite,
  user,
  authBusy,
  syncError,
  onSignIn,
  onSignOut,
}: BookmarksDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Saved SAR Observations"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-frost-line bg-arctic-teal">
        <div className="flex items-center justify-between border-b border-frost-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bookmark className="h-4 w-4 text-ice-blue" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-crystal-white">
              Saved Places
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved observations panel"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-frost-line text-frost-mist transition-colors hover:border-ice-blue/60 hover:text-crystal-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cloud Sync / Google Auth Bar */}
        <div className="border-b border-frost-line bg-glacial-abyss px-5 py-3.5">
          {user ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono text-xs text-emerald-300">
                  <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Cloud Sync On</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-frost-mist">
                  {user.displayName || user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                disabled={authBusy}
                className="inline-flex items-center gap-1.5 rounded border border-frost-line bg-crevasse px-2.5 py-1.5 text-xs font-medium text-crystal-white hover:border-ice-blue/60 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-relaxed text-frost-mist">
                Sign in with Google to save places across devices.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                disabled={authBusy}
                className="inline-flex items-center gap-1.5 rounded bg-crystal-white px-3 py-1.5 text-xs font-semibold text-glacial-abyss hover:bg-ice-blue disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign in</span>
              </button>
            </div>
          )}

          {syncError && (
            <p className="mt-2 font-mono text-[11px] text-rose-300">{syncError}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {bookmarks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-frost-line bg-glacial-abyss p-6 text-center">
              <p className="text-sm font-medium text-crystal-white">
                No saved locations yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-frost-mist">
                Click any marker on the Explore map and press Save to keep it here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {bookmarks.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-frost-line bg-crevasse p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-sm font-semibold text-crystal-white">
                        {item.title}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-frost-mist tabular-nums">
                        {item.region} · {item.lat.toFixed(2)}°, {item.lng.toFixed(2)}°
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(item.id)}
                      aria-label={`Remove ${item.title} from bookmarks`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-frost-line text-frost-mist transition-colors hover:border-rose-500/40 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {item.note && (
                    <p className="mt-2.5 border-t border-frost-line pt-2.5 text-xs leading-relaxed text-frost-mist">
                      {item.note}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSite(item.siteId, 'explore');
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded border border-frost-line bg-arctic-teal px-2.5 py-1.5 text-xs font-medium text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue"
                    >
                      <span>Map</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSite(item.siteId, 'visualizer');
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 rounded border border-ice-blue/35 bg-ice-blue/10 px-2.5 py-1.5 text-xs font-medium text-ice-blue transition-colors hover:bg-ice-blue/20"
                    >
                      <span>Visualizer</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
