import type { NextApiRequest, NextApiResponse } from 'next';

// Upstash Redis REST API 헬퍼
const redisGet = async (key: string): Promise<string | null> => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch { return null; }
};

const redisSet = async (key: string, value: string, exSeconds = 86400): Promise<void> => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${exSeconds}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {}
};

type Segment = { fromLng: number; fromLat: number; toLng: number; toLat: number };
type SegmentResult = { ok: boolean; coords?: { lat: number; lng: number }[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ORS_API_KEY not set' });

  const { segments, date, version } = req.body as {
    segments: Segment[];
    date: string;
    version: number;
  };

  // ① Redis 캐시 확인
  const cacheKey = `ors-road-cache:${date}:${version}`;
  const cached = await redisGet(cacheKey);
  if (cached) {
    console.log(`[ORS] 캐시 히트: ${cacheKey}`);
    return res.status(200).json({ results: JSON.parse(cached), fromCache: true });
  }

  console.log(`[ORS] 캐시 미스: ${cacheKey} → 배치 호출`);

  // ② 전체 waypoints를 하나의 요청으로 전송 (호출 1회)
  // 중복 없이 순서대로 좌표 배열 구성
  // segments: [{fromLng,fromLat,toLng,toLat}, ...]
  // → [점0, 점1, 점2, ...점N] 순서
  const coordinates: [number, number][] = [];
  for (let i = 0; i < segments.length; i++) {
    if (i === 0) coordinates.push([segments[i].fromLng, segments[i].fromLat]);
    coordinates.push([segments[i].toLng, segments[i].toLat]);
  }

  let results: SegmentResult[] = segments.map(() => ({ ok: false }));

  try {
    const orsRes = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({ coordinates }),
      }
    );

    if (!orsRes.ok) {
      const errText = await orsRes.text();
      console.error(`[ORS] 배치 호출 실패 ${orsRes.status}:`, errText.slice(0, 300));
      return res.status(200).json({ results, fromCache: false });
    }

    const data = await orsRes.json();
    // 전체 경로의 좌표 배열
    const allCoords: [number, number][] = data.features?.[0]?.geometry?.coordinates;
    if (!allCoords?.length) {
      console.error('[ORS] 배치 응답에 coords 없음');
      return res.status(200).json({ results, fromCache: false });
    }

    // waypoint 인덱스로 구간 분리
    // ORS는 way_points 배열로 각 waypoint가 allCoords의 몇 번째인지 알려줌
    const wayPoints: number[] = data.features?.[0]?.properties?.way_points;
    if (wayPoints?.length === coordinates.length) {
      results = segments.map((_, i) => {
        const startIdx = wayPoints[i];
        const endIdx = wayPoints[i + 1];
        if (startIdx == null || endIdx == null) return { ok: false };
        const segCoords = allCoords.slice(startIdx, endIdx + 1);
        return {
          ok: true,
          coords: segCoords.map(c => ({ lat: c[1], lng: c[0] })),
        };
      });
    } else {
      // way_points 없으면 전체 경로를 첫 구간에만 할당 (fallback)
      console.warn('[ORS] way_points 없음, 전체 경로 단일 폴리라인으로 처리');
      results = segments.map((_, i) => i === 0
        ? { ok: true, coords: allCoords.map(c => ({ lat: c[1], lng: c[0] })) }
        : { ok: false }
      );
    }

    const successCount = results.filter(r => r.ok).length;
    console.log(`[ORS] 배치 완료: ${successCount}/${results.length} 구간`);

    // ③ Redis 캐시 저장
    if (successCount > 0) {
      await redisSet(cacheKey, JSON.stringify(results), 86400);
      console.log(`[ORS] 캐시 저장: ${cacheKey}`);
    }
  } catch (e) {
    console.error('[ORS] 배치 요청 오류:', e);
  }

  return res.status(200).json({ results, fromCache: false });
}