import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

function parseBbox(raw: unknown): [number, number, number, number] | null {
  let parts: number[] = [];
  if (typeof raw === 'string') {
    parts = raw.split(',').map((s) => Number(s.trim()));
  } else if (Array.isArray(raw) && raw.length === 4) {
    parts = raw.map((v) => Number(v));
  }
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  if (west >= east || south >= north) return null;
  return [west, south, east, north];
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'dancing-with-the-sars',
      timestamp: new Date().toISOString(),
    });
  });

  // Real-time upstream connectivity check for NASA Earthdata CMR and Planetary Computer STAC
  app.get('/api/satellites/status', async (_req, res) => {
    async function probe(
      name: string,
      url: string,
      extraHeaders: Record<string, string> = {}
    ): Promise<{
      name: string;
      status: 'green' | 'yellow' | 'red';
      label: string;
      latencyMs: number | null;
      httpStatus: number | null;
    }> {
      const started = performance.now();
      try {
        const upstream = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'DancingWithTheSARs-SpaceApps2026/1.0',
            ...extraHeaders,
          },
          signal: AbortSignal.timeout(6000),
        });
        const latencyMs = Math.round(performance.now() - started);

        if (upstream.ok) {
          if (latencyMs >= 2500) {
            return {
              name,
              status: 'yellow',
              label: 'Slow Response',
              latencyMs,
              httpStatus: upstream.status,
            };
          }
          return {
            name,
            status: 'green',
            label: 'Connected',
            latencyMs,
            httpStatus: upstream.status,
          };
        }

        if (upstream.status === 429 || upstream.status === 503) {
          return {
            name,
            status: 'yellow',
            label: `Degraded (HTTP ${upstream.status})`,
            latencyMs,
            httpStatus: upstream.status,
          };
        }

        return {
          name,
          status: 'red',
          label: `Error (HTTP ${upstream.status})`,
          latencyMs,
          httpStatus: upstream.status,
        };
      } catch {
        const latencyMs = Math.round(performance.now() - started);
        return {
          name,
          status: 'red',
          label: 'Unreachable',
          latencyMs,
          httpStatus: null,
        };
      }
    }

    const cmrHeaders: Record<string, string> = {};
    if (process.env.EARTHDATA_TOKEN) {
      cmrHeaders.Authorization = `Bearer ${process.env.EARTHDATA_TOKEN}`;
    }

    const [cmr, stac] = await Promise.all([
      probe(
        'NASA Earthdata CMR',
        'https://cmr.earthdata.nasa.gov/search/collections.json?page_size=1',
        cmrHeaders
      ),
      probe(
        'Planetary Computer STAC',
        'https://planetarycomputer.microsoft.com/api/stac/v1'
      ),
    ]);

    res.json({
      checkedAt: new Date().toISOString(),
      cmr,
      stac,
    });
  });

  // NASA Common Metadata Repository (CMR) Public Granule Search
  app.get('/api/satellites/cmr', async (req, res) => {
    try {
      const bbox = parseBbox(req.query.bbox);
      if (!bbox) {
        return res.status(400).json({
          error: 'Invalid bbox parameter. Expected west,south,east,north.',
          items: [],
        });
      }

      const collectionParam =
        typeof req.query.collection === 'string' && req.query.collection.trim()
          ? req.query.collection.trim()
          : 'C2949811996-POCLOUD'; // OPERA_L3_DSWX-S1_V1

      const rawLimit = Number(req.query.pageSize ?? 8);
      const pageSize = Number.isFinite(rawLimit)
        ? Math.min(20, Math.max(1, Math.floor(rawLimit)))
        : 8;

      const url = new URL('https://cmr.earthdata.nasa.gov/search/granules.json');
      url.searchParams.set('collection_concept_id', collectionParam);
      url.searchParams.set('bounding_box', bbox.join(','));
      url.searchParams.set('page_size', String(pageSize));
      url.searchParams.set('sort_key', '-start_date');

      if (typeof req.query.temporal === 'string' && req.query.temporal.trim()) {
        url.searchParams.set('temporal', req.query.temporal.trim());
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'DancingWithTheSARs-SpaceApps2026/1.0',
      };
      if (process.env.EARTHDATA_TOKEN) {
        headers.Authorization = `Bearer ${process.env.EARTHDATA_TOKEN}`;
      }

      const upstream = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!upstream.ok) {
        return res.status(502).json({
          error: `NASA CMR returned HTTP ${upstream.status}`,
          items: [],
        });
      }

      const payload = (await upstream.json()) as {
        feed?: { entry?: Array<Record<string, unknown>> };
      };

      const entries = Array.isArray(payload?.feed?.entry) ? payload.feed.entry : [];
      const items = entries.map((entry) => {
        const links = Array.isArray(entry.links)
          ? (entry.links as Array<{ rel?: string; href?: string }>)
          : [];
        const browseLink =
          links.find((l) => typeof l.rel === 'string' && l.rel.includes('browse'))
            ?.href ?? null;
        const dataLink =
          links.find((l) => typeof l.rel === 'string' && l.rel.includes('data#'))
            ?.href ?? null;

        return {
          id: String(entry.id ?? ''),
          title: String(entry.title ?? 'NASA CMR Granule'),
          timeStart: String(entry.time_start ?? ''),
          timeEnd: String(entry.time_end ?? ''),
          datasetId: String(entry.dataset_id ?? collectionParam),
          boxes: Array.isArray(entry.boxes) ? entry.boxes : [],
          browseLink,
          dataLink,
          provenanceTier: 'Live Satellite Data',
        };
      });

      return res.json({
        source: 'NASA Earthdata CMR',
        collection: collectionParam,
        count: items.length,
        items,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'NASA CMR request failed';
      return res.status(503).json({
        error: `Unable to reach NASA CMR: ${msg}`,
        items: [],
      });
    }
  });

  // Microsoft Planetary Computer Public STAC Search (sentinel-1-rtc)
  app.post('/api/satellites/stac', async (req, res) => {
    try {
      const bbox = parseBbox(req.body?.bbox);
      if (!bbox) {
        return res.status(400).json({
          error: 'Invalid bbox body field. Expected [west, south, east, north].',
          items: [],
        });
      }

      const rawLimit = Number(req.body?.limit ?? 6);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(12, Math.max(1, Math.floor(rawLimit)))
        : 6;

      const bodyPayload: Record<string, unknown> = {
        collections: ['sentinel-1-rtc'],
        bbox,
        limit,
      };
      if (typeof req.body?.datetime === 'string' && req.body.datetime.trim()) {
        bodyPayload.datetime = req.body.datetime.trim();
      }

      const upstream = await fetch(
        'https://planetarycomputer.microsoft.com/api/stac/v1/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'DancingWithTheSARs-SpaceApps2026/1.0',
          },
          body: JSON.stringify(bodyPayload),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!upstream.ok) {
        return res.status(502).json({
          error: `Planetary Computer STAC returned HTTP ${upstream.status}`,
          items: [],
        });
      }

      const data = (await upstream.json()) as {
        features?: Array<{
          id?: string;
          bbox?: number[];
          geometry?: unknown;
          properties?: Record<string, unknown>;
          assets?: Record<string, { href?: string }>;
        }>;
      };

      const features = Array.isArray(data?.features) ? data.features : [];
      const items = features.map((f) => {
        const id = String(f.id ?? '');
        const props = f.properties ?? {};
        const encodedId = encodeURIComponent(id);

        return {
          id,
          datetime: String(props.datetime ?? ''),
          platform: String(props.platform ?? 'Sentinel-1'),
          orbitState: String(props['sat:orbit_state'] ?? 'unknown'),
          polarizations: Array.isArray(props['sar:polarizations'])
            ? (props['sar:polarizations'] as string[])
            : ['VV', 'VH'],
          bbox: Array.isArray(f.bbox) ? f.bbox : bbox,
          geometry: f.geometry ?? null,
          renderedPreviewUrl: f.assets?.rendered_preview?.href ?? null,
          vvTileUrl: `https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-1-rtc&item=${encodedId}&assets=vv&rescale=-25,0`,
          vhTileUrl: `https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-1-rtc&item=${encodedId}&assets=vh&rescale=-30,-5`,
          provenanceTier: 'Live Satellite Data',
        };
      });

      return res.json({
        source: 'Microsoft Planetary Computer STAC (sentinel-1-rtc)',
        count: items.length,
        items,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'STAC query failed';
      return res.status(503).json({
        error: `Unable to reach Planetary Computer STAC: ${msg}`,
        items: [],
      });
    }
  });

  // OpenStreetMap Nominatim Geocoding Proxy
  app.get('/api/geocode', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q.length < 2 || q.length > 100) {
        return res.status(400).json({
          error: 'Search query must be between 2 and 100 characters.',
          results: [],
        });
      }

      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '5');

      const upstream = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DancingWithTheSARs-SpaceApps2026/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) {
        return res.status(502).json({
          error: `Geocoding service returned HTTP ${upstream.status}`,
          results: [],
        });
      }

      const rawList = (await upstream.json()) as Array<{
        place_id?: number;
        display_name?: string;
        lat?: string;
        lon?: string;
        boundingbox?: string[];
      }>;

      const results = (Array.isArray(rawList) ? rawList : [])
        .map((item) => {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            id: String(item.place_id ?? `${lat},${lng}`),
            label: String(item.display_name ?? q),
            lat,
            lng,
            bbox: [
              Number((lng - 0.5).toFixed(4)),
              Number((lat - 0.5).toFixed(4)),
              Number((lng + 0.5).toFixed(4)),
              Number((lat + 0.5).toFixed(4)),
            ] as [number, number, number, number],
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return res.json({ results });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Geocoding failed';
      return res.status(503).json({
        error: `Geocoding unavailable: ${msg}`,
        results: [],
      });
    }
  });

  // Server-side Google Maps Grounding via Gemini (gemini-4-hydrogen + googleMaps tool)
  app.post('/api/maps/grounding', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error:
          'Google Maps Grounding requires a configured GEMINI_API_KEY secret on the server.',
        places: [],
      });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        error: 'Valid latitude and longitude coordinates are required.',
        places: [],
      });
    }

    const placeName =
      typeof req.body?.placeName === 'string' && req.body.placeName.trim()
        ? req.body.placeName.trim().slice(0, 120)
        : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    const hazardFocus =
      typeof req.body?.hazardFocus === 'string' && req.body.hazardFocus.trim()
        ? req.body.hazardFocus.trim().slice(0, 80)
        : 'Earth surface observation';

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = [
        `Provide a brief, plain-language geographic overview of ${placeName} near coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) for someone viewing radar satellite imagery (${hazardFocus}).`,
        'Mention key nearby rivers, glaciers, coastlines, towns, or research stations in 3 short bullet points.',
        'Keep it concise, accurate, and easy to understand.',
      ].join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });

      const rawChunks =
        (response.candidates?.[0]?.groundingMetadata?.groundingChunks as Array<{
          maps?: {
            uri?: string;
            title?: string;
            placeId?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{
                authorAttribution?: { displayName?: string };
                text?: string;
                googleMapsUri?: string;
              }>;
            };
          };
        }>) ?? [];

      const seenUris = new Set<string>();
      const places: Array<{
        title: string;
        uri: string;
        snippet: string | null;
      }> = [];

      for (const chunk of rawChunks) {
        const maps = chunk?.maps;
        if (!maps?.uri) continue;
        if (!seenUris.has(maps.uri)) {
          seenUris.add(maps.uri);
          const firstSnippet =
            maps.placeAnswerSources?.reviewSnippets?.find((s) => s.text)?.text ?? null;
          places.push({
            title: maps.title || 'Google Maps Location',
            uri: maps.uri,
            snippet: firstSnippet,
          });
        }
        const snippets = maps.placeAnswerSources?.reviewSnippets ?? [];
        for (const sn of snippets) {
          if (sn.googleMapsUri && !seenUris.has(sn.googleMapsUri)) {
            seenUris.add(sn.googleMapsUri);
            places.push({
              title: sn.authorAttribution?.displayName
                ? `${maps.title || 'Place'} (${sn.authorAttribution.displayName})`
                : maps.title || 'Google Maps Reference',
              uri: sn.googleMapsUri,
              snippet: sn.text ?? null,
            });
          }
        }
      }

      return res.json({
        summary: (response.text ?? '').trim(),
        places,
        coordinates: { lat, lng },
        model: 'gemini-4-hydrogen',
      });
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Google Maps Grounding failed';
      try {
        const parsed = JSON.parse(msg) as { error?: { message?: string; status?: string } };
        if (parsed?.error?.message) {
          msg = parsed.error.status === 'RESOURCE_EXHAUSTED'
            ? 'Gemini API quota exceeded or rate-limited. Please verify your project billing/rate limits.'
            : parsed.error.message.split('\n')[0];
        }
      } catch {
        // Use raw message if not JSON
      }
      return res.status(502).json({
        error: `Google Maps Grounding unavailable: ${msg}`,
        places: [],
      });
    }
  });

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (isProd) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dancing with the SARs server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
