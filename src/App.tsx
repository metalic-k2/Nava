import type { User } from 'firebase/auth';
import { Suspense, lazy, useEffect, useState } from 'react';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { SAR_OBSERVATION_SITES } from './data/sarBenchmarks';
import {
  deleteUserBookmark,
  saveUserBookmark,
  signInWithGoogle,
  signOutUser,
  subscribeAuth,
  subscribeUserBookmarks,
} from './lib/firebase';
import { HomePage } from './pages/HomePage';
import type { BookmarkItem, PageId, SarObservationSite } from './types/sar';

const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((m) => ({ default: m.ExplorePage }))
);
const VisualizerPage = lazy(() =>
  import('./pages/VisualizerPage').then((m) => ({ default: m.VisualizerPage }))
);
const ChangeDetectionPage = lazy(() =>
  import('./pages/ChangeDetectionPage').then((m) => ({
    default: m.ChangeDetectionPage,
  }))
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const HowToUsePage = lazy(() =>
  import('./pages/HowToUsePage').then((m) => ({ default: m.HowToUsePage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);

const BOOKMARKS_STORAGE_KEY = 'dancing_with_sars_bookmarks_v1';

function loadLocalBookmarks(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BookmarkItem[];
  } catch {
    // Ignore storage read errors
  }
  return [];
}

function PageLoader() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-crevasse" />
        <div className="h-96 w-full animate-pulse rounded-lg border border-frost-line bg-arctic-teal" />
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    SAR_OBSERVATION_SITES[0].id
  );
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [localBookmarks, setLocalBookmarks] = useState<BookmarkItem[]>(loadLocalBookmarks);
  const [cloudBookmarks, setCloudBookmarks] = useState<BookmarkItem[]>([]);

  useEffect(() => {
    const unsub = subscribeAuth((nextUser) => {
      setUser(nextUser);
      setSyncError(null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudBookmarks([]);
      return;
    }
    const unsub = subscribeUserBookmarks(
      user.uid,
      (items) => {
        setCloudBookmarks(items);
        setSyncError(null);
      },
      (msg) => setSyncError(msg)
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(localBookmarks));
    } catch {
      // Ignore storage write errors
    }
  }, [localBookmarks]);

  const activeBookmarks = user ? cloudBookmarks : localBookmarks;

  const handleSelectSiteAndNavigate = (siteId: string, page: PageId) => {
    setSelectedSiteId(siteId);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignIn = async () => {
    setAuthBusy(true);
    setSyncError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : 'Unable to sign in with Google.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOutUser();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveBookmark = async (site: SarObservationSite, note: string) => {
    if (user) {
      try {
        await saveUserBookmark(user, {
          siteId: site.id,
          title: site.title,
          region: site.country,
          lat: site.lat,
          lng: site.lng,
          hazardCategory: site.hazardCategory,
          note,
        });
        setSyncError(null);
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : 'Unable to save bookmark to Firestore.'
        );
      }
      return;
    }

    setLocalBookmarks((prev) => {
      const existing = prev.find((b) => b.siteId === site.id);
      if (existing) {
        return prev.map((b) =>
          b.siteId === site.id
            ? { ...b, note: note.trim() || b.note }
            : b
        );
      }
      const next: BookmarkItem = {
        id: `${site.id}-${Date.now()}`,
        siteId: site.id,
        title: site.title,
        region: site.country,
        lat: site.lat,
        lng: site.lng,
        hazardCategory: site.hazardCategory,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      return [next, ...prev];
    });
  };

  const handleRemoveBookmark = async (id: string) => {
    if (user) {
      try {
        await deleteUserBookmark(user.uid, id);
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : 'Unable to delete bookmark.'
        );
      }
      return;
    }
    setLocalBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="min-h-screen bg-glacial-abyss text-crystal-white">
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        bookmarkCount={activeBookmarks.length}
        onOpenBookmarks={() => setBookmarksOpen(true)}
      />

      <main>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {activePage === 'home' && (
              <HomePage
                sites={SAR_OBSERVATION_SITES}
                onNavigate={setActivePage}
                onSelectSiteAndNavigate={handleSelectSiteAndNavigate}
              />
            )}

            {activePage === 'explore' && (
              <ExplorePage
                sites={SAR_OBSERVATION_SITES}
                selectedSiteId={selectedSiteId}
                onSelectSite={setSelectedSiteId}
                onOpenInPage={handleSelectSiteAndNavigate}
                onSaveBookmark={handleSaveBookmark}
                bookmarkedSiteIds={activeBookmarks.map((b) => b.siteId)}
              />
            )}

            {activePage === 'visualizer' && (
              <VisualizerPage
                sites={SAR_OBSERVATION_SITES}
                selectedSiteId={selectedSiteId}
                onSelectSite={setSelectedSiteId}
              />
            )}

            {activePage === 'change-detection' && (
              <ChangeDetectionPage selectedSiteId={selectedSiteId} />
            )}

            {activePage === 'dashboard' && (
              <DashboardPage
                sites={SAR_OBSERVATION_SITES}
                onOpenInPage={handleSelectSiteAndNavigate}
              />
            )}

            {activePage === 'how-to-use' && (
              <HowToUsePage onNavigate={setActivePage} />
            )}

            {activePage === 'about' && <AboutPage onNavigate={setActivePage} />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer onNavigate={setActivePage} />

      <BookmarksDrawer
        isOpen={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        bookmarks={activeBookmarks}
        onRemoveBookmark={handleRemoveBookmark}
        onOpenSite={handleSelectSiteAndNavigate}
        user={user}
        authBusy={authBusy}
        syncError={syncError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
