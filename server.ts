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

  // Real-time Cryosphere, Glacier Melt Rate & Ice Extent Aggregator
  // Combines NOAA/NSIDC Sea Ice Index (1979-present), Open-Meteo Cryosphere Glacier Stations, and NASA CMR ICESat-2
  const GLACIAL_BENCHMARK_STATIONS = [
    {
      id: 'pine-island',
      siteId: 'pine-island-glacier',
      name: 'Pine Island Glacier',
      region: 'West Antarctica',
      lat: -75.15,
      lng: -100.8,
      publishedIceThicknessM: 520,
      publishedMassTrendGtYr: -58.0,
    },
    {
      id: 'jakobshavn',
      siteId: 'jakobshavn-isbrae',
      name: 'Jakobshavn Isbrae',
      region: 'West Greenland',
      lat: 69.17,
      lng: -49.85,
      publishedIceThicknessM: 840,
      publishedMassTrendGtYr: -26.4,
    },
    {
      id: 'vatnajokull',
      siteId: null as string | null,
      name: 'Vatnajokull Ice Cap',
      region: 'Southeast Iceland',
      lat: 64.42,
      lng: -16.78,
      publishedIceThicknessM: 420,
      publishedMassTrendGtYr: -9.5,
    },
    {
      id: 'columbia',
      siteId: null as string | null,
      name: 'Columbia Glacier',
      region: 'Alaska, USA',
      lat: 61.12,
      lng: -147.06,
      publishedIceThicknessM: 310,
      publishedMassTrendGtYr: -6.8,
    },
  ];

  let glacialCache: { expiresAt: number; payload: unknown } | null = null;

  app.get('/api/climate/glacial-metrics', async (req, res) => {
    const force = req.query.force === '1' || req.query.force === 'true';
    if (!force && glacialCache && Date.now() < glacialCache.expiresAt) {
      return res.json(glacialCache.payload);
    }

    const lats = GLACIAL_BENCHMARK_STATIONS.map((s) => s.lat).join(',');
    const lngs = GLACIAL_BENCHMARK_STATIONS.map((s) => s.lng).join(',');

    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,snowfall,snow_depth,rain&hourly=temperature_2m,snow_depth,snowfall,freezing_level_height,shortwave_radiation&past_days=2&forecast_days=2&timezone=UTC`;
    const arcticUrl = 'https://global-warming.org/api/arctic-api';
    const atl06Url =
      'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ATL06&page_size=4&sort_key=-start_date';
    const atl15Url =
      'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ATL15&page_size=2&sort_key=-start_date';

    const headers = {
      Accept: 'application/json',
      'User-Agent': 'DancingWithTheSARs-SpaceApps2026/1.0',
    };

    const cmrHeaders: Record<string, string> = { ...headers };
    if (process.env.EARTHDATA_TOKEN) {
      cmrHeaders.Authorization = `Bearer ${process.env.EARTHDATA_TOKEN}`;
    }

    const [omRes, arcticRes, atl06Res, atl15Res] = await Promise.allSettled([
      fetch(openMeteoUrl, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(arcticUrl, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(atl06Url, { headers: cmrHeaders, signal: AbortSignal.timeout(8000) }),
      fetch(atl15Url, { headers: cmrHeaders, signal: AbortSignal.timeout(8000) }),
    ]);

    // 1. Parse NSIDC/NOAA Global Sea Ice Extent
    let seaIceSummary: {
      title: string;
      units: string;
      basePeriod: string;
      decadalTrendMkm2: number;
      annualMeanMkm2: number;
      latestPeriod: string;
      latestExtentMkm2: number;
      latestBaselineMkm2: number;
      latestAnomalyMkm2: number;
    } | null = null;
    let seaIceRecentMonths: Array<{
      period: string;
      label: string;
      extentMkm2: number;
      baselineMkm2: number;
      anomalyMkm2: number;
    }> = [];
    let seaIceAnnualTrend: Array<{
      year: string;
      meanExtentMkm2: number;
      meanAnomalyMkm2: number;
    }> = [];

    if (arcticRes.status === 'fulfilled' && arcticRes.value.ok) {
      try {
        const raw = (await arcticRes.value.json()) as {
          arcticData?: {
            description?: {
              title?: string;
              basePeriod?: string;
              units?: string;
              annualMean?: number;
              decadalTrend?: number;
            };
            data?: Record<
              string,
              { value?: number; anom?: number; monthlyMean?: number }
            >;
          };
        };

        const desc = raw?.arcticData?.description;
        const dataMap = raw?.arcticData?.data ?? {};
        const validKeys = Object.keys(dataMap)
          .filter((k) => {
            const v = dataMap[k]?.value;
            return typeof v === 'number' && v > -900;
          })
          .sort();

        if (validKeys.length > 0) {
          const lastKey = validKeys[validKeys.length - 1];
          const lastEntry = dataMap[lastKey];
          const formatPeriod = (k: string) =>
            k.length === 6 ? `${k.slice(0, 4)}-${k.slice(4, 6)}` : k;

          seaIceSummary = {
            title: desc?.title ?? 'Global Sea Ice Extent (1979-Present)',
            units: desc?.units ?? 'million square km',
            basePeriod: desc?.basePeriod ?? '1991-2020',
            decadalTrendMkm2: Number(desc?.decadalTrend ?? -0.6),
            annualMeanMkm2: Number(desc?.annualMean ?? 22.76),
            latestPeriod: formatPeriod(lastKey),
            latestExtentMkm2: Number(lastEntry.value ?? 0),
            latestBaselineMkm2: Number(lastEntry.monthlyMean ?? 0),
            latestAnomalyMkm2: Number(lastEntry.anom ?? 0),
          };

          seaIceRecentMonths = validKeys.slice(-24).map((k) => {
            const d = dataMap[k];
            const yr = k.slice(2, 4);
            const mo = k.slice(4, 6);
            return {
              period: formatPeriod(k),
              label: `${mo}/${yr}`,
              extentMkm2: Number((d.value ?? 0).toFixed(2)),
              baselineMkm2: Number((d.monthlyMean ?? 0).toFixed(2)),
              anomalyMkm2: Number((d.anom ?? 0).toFixed(2)),
            };
          });

          const byYear = new Map<string, { ext: number[]; anom: number[] }>();
          for (const k of validKeys) {
            const yr = k.slice(0, 4);
            const bucket = byYear.get(yr) ?? { ext: [], anom: [] };
            if (typeof dataMap[k].value === 'number') bucket.ext.push(dataMap[k].value!);
            if (typeof dataMap[k].anom === 'number') bucket.anom.push(dataMap[k].anom!);
            byYear.set(yr, bucket);
          }

          seaIceAnnualTrend = Array.from(byYear.entries())
            .filter(([, b]) => b.ext.length >= 6)
            .map(([year, b]) => ({
              year,
              meanExtentMkm2: Number(
                (b.ext.reduce((a, c) => a + c, 0) / b.ext.length).toFixed(2)
              ),
              meanAnomalyMkm2: Number(
                (b.anom.reduce((a, c) => a + c, 0) / b.anom.length).toFixed(2)
              ),
            }));
        }
      } catch {
        // Ignore parse failure and leave null
      }
    }

    // 2. Parse Open-Meteo Live Cryosphere Glacier Station Telemetry
    // Positive-Degree-Day (PDD) glacier ablation coefficient: 7.0 mm w.e. / °C / day (Hock, 2003)
    const DDF_ICE_MM_PER_C_DAY = 7.0;

    type OpenMeteoLocationPayload = {
      elevation?: number;
      current?: {
        time?: string;
        temperature_2m?: number;
        snowfall?: number;
        snow_depth?: number;
        rain?: number;
      };
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        snow_depth?: number[];
        snowfall?: number[];
        freezing_level_height?: number[];
        shortwave_radiation?: number[];
      };
    };

    const glaciers: Array<{
      id: string;
      siteId: string | null;
      name: string;
      region: string;
      lat: number;
      lng: number;
      elevationM: number;
      observedAt: string;
      currentTempC: number;
      currentSnowDepthM: number;
      publishedIceThicknessM: number;
      publishedMassTrendGtYr: number;
      freezingLevelM: number;
      currentMeltRateMmDay: number;
      snowDepth24hDeltaCm: number;
      hourlySeries: Array<{
        time: string;
        label: string;
        tempC: number;
        snowDepthM: number;
        meltRateMmDay: number;
        freezingLevelM: number;
      }>;
    }> = [];

    if (omRes.status === 'fulfilled' && omRes.value.ok) {
      try {
        const omRaw = (await omRes.value.json()) as
          | OpenMeteoLocationPayload[]
          | OpenMeteoLocationPayload;
        const list = Array.isArray(omRaw) ? omRaw : [omRaw];

        GLACIAL_BENCHMARK_STATIONS.forEach((station, idx) => {
          const item = list[idx];
          if (!item?.current) return;

          const currentTempC = Number(item.current.temperature_2m ?? 0);
          const currentSnowDepthM = Number(item.current.snow_depth ?? 0);
          const times = item.hourly?.time ?? [];
          const temps = item.hourly?.temperature_2m ?? [];
          const depths = item.hourly?.snow_depth ?? [];
          const freezings = item.hourly?.freezing_level_height ?? [];

          // Find current hour index to compute freezing level & 24h depth change
          const nowIsoPrefix = String(item.current.time ?? '').slice(0, 13);
          const currentIdxRaw = times.findIndex((t) => t.startsWith(nowIsoPrefix));
          const currentIdx = currentIdxRaw >= 0 ? currentIdxRaw : Math.max(0, Math.floor(times.length / 2));

          const freezingLevelM = Math.round(Number(freezings[currentIdx] ?? 0));
          const prev24Depth =
            currentIdx >= 24 && typeof depths[currentIdx - 24] === 'number'
              ? depths[currentIdx - 24]
              : currentSnowDepthM;
          const snowDepth24hDeltaCm = Number(
            ((currentSnowDepthM - prev24Depth) * 100).toFixed(1)
          );

          const currentMeltRateMmDay = Number(
            (Math.max(0, currentTempC) * DDF_ICE_MM_PER_C_DAY).toFixed(1)
          );

          // Sample every 3 hours across the 96-hour window (48h observed + 48h forecast)
          const hourlySeries: Array<{
            time: string;
            label: string;
            tempC: number;
            snowDepthM: number;
            meltRateMmDay: number;
            freezingLevelM: number;
          }> = [];

          for (let i = 0; i < times.length; i += 3) {
            const t = times[i];
            const temp = Number(temps[i] ?? 0);
            const depth = Number(depths[i] ?? 0);
            const fz = Math.round(Number(freezings[i] ?? 0));
            const melt = Number((Math.max(0, temp) * DDF_ICE_MM_PER_C_DAY).toFixed(1));
            hourlySeries.push({
              time: t,
              label: `${t.slice(5, 10)} ${t.slice(11, 16)}`,
              tempC: Number(temp.toFixed(1)),
              snowDepthM: Number(depth.toFixed(2)),
              meltRateMmDay: melt,
              freezingLevelM: fz,
            });
          }

          glaciers.push({
            id: station.id,
            siteId: station.siteId,
            name: station.name,
            region: station.region,
            lat: station.lat,
            lng: station.lng,
            elevationM: Math.round(Number(item.elevation ?? 0)),
            observedAt: String(item.current.time ?? new Date().toISOString()),
            currentTempC: Number(currentTempC.toFixed(1)),
            currentSnowDepthM: Number(currentSnowDepthM.toFixed(2)),
            publishedIceThicknessM: station.publishedIceThicknessM,
            publishedMassTrendGtYr: station.publishedMassTrendGtYr,
            freezingLevelM,
            currentMeltRateMmDay,
            snowDepth24hDeltaCm,
            hourlySeries,
          });
        });
      } catch {
        // Ignore parse error
      }
    }

    // 3. Parse NASA CMR ICESat-2 Granules (ATL06 Land Ice Height + ATL15 Gridded Ice Height Change)
    const icesatPasses: Array<{
      shortName: string;
      title: string;
      datasetId: string;
      timeStart: string;
      timeEnd: string;
      dataCenter: string;
    }> = [];

    const extractGranules = async (
      result: PromiseSettledResult<Response>,
      shortName: string
    ) => {
      if (result.status !== 'fulfilled' || !result.value.ok) return;
      try {
        const json = (await result.value.json()) as {
          feed?: { entry?: Array<Record<string, unknown>> };
        };
        const entries = Array.isArray(json?.feed?.entry) ? json.feed.entry : [];
        for (const e of entries) {
          icesatPasses.push({
            shortName,
            title: String(e.producer_granule_id ?? e.title ?? shortName),
            datasetId: String(e.dataset_id ?? `NASA ICESat-2 ${shortName}`),
            timeStart: String(e.time_start ?? ''),
            timeEnd: String(e.time_end ?? ''),
            dataCenter: String(e.data_center ?? 'NSIDC_CPRD'),
          });
        }
      } catch {
        // Ignore parse error
      }
    };

    await Promise.all([
      extractGranules(atl06Res, 'ATL06'),
      extractGranules(atl15Res, 'ATL15'),
    ]);

    if (!seaIceSummary && glaciers.length === 0 && icesatPasses.length === 0) {
      return res.status(503).json({
        error: 'Unable to fetch upstream cryosphere datasets right now.',
      });
    }

    const payload = {
      fetchedAt: new Date().toISOString(),
      seaIceSummary,
      seaIceRecentMonths,
      seaIceAnnualTrend,
      glaciers,
      icesatPasses,
      sources: [
        {
          name: 'NOAA / NSIDC Sea Ice Index',
          detail: 'Monthly global sea ice extent & 1991-2020 baseline anomaly (1979-present)',
          url: 'https://nsidc.org/data/seaice_index',
        },
        {
          name: 'NASA Earthdata CMR (ICESat-2 ATL06 & ATL15)',
          detail: 'Laser altimetry land-ice surface height & gridded thickness change granules',
          url: 'https://cmr.earthdata.nasa.gov',
        },
        {
          name: 'Open-Meteo Cryosphere Reanalysis & Forecast',
          detail: 'Live 15-min surface temperature, snow/firn depth & Hock (2003) PDD melt flux',
          url: 'https://open-meteo.com',
        },
      ],
    };

    glacialCache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      payload,
    };

    return res.json(payload);
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
