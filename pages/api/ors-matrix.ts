import type { NextApiRequest, NextApiResponse } from 'next';

// ORS Matrix API - 모든 지점 쌍의 도로 거리를 한 번에 계산
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ORS_API_KEY not set' });

  const { locations } = req.body as {
    locations: { lat: number; lng: number }[];
  };

  if (!locations || locations.length < 2) {
    return res.status(400).json({ error: 'locations must have at least 2 points' });
  }

  try {
    const coordinates = locations.map(l => [l.lng, l.lat]); // ORS는 [lng, lat] 순서

    const orsRes = await fetch(
      'https://api.openrouteservice.org/v2/matrix/driving-car',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          locations: coordinates,
          metrics: ['distance'], // 거리만 (duration도 가능하지만 거리로 충분)
          resolve_locations: false,
        }),
      }
    );

    if (!orsRes.ok) {
      const errText = await orsRes.text();
      console.error('[ORS Matrix] 실패:', orsRes.status, errText.slice(0, 200));
      return res.status(200).json({ ok: false, error: `ORS ${orsRes.status}` });
    }

    const data = await orsRes.json();
    // data.distances: N×N 행렬 (미터 단위)
    const matrix: number[][] = data.distances;

    console.log(`[ORS Matrix] 완료: ${locations.length}×${locations.length} 행렬`);
    return res.status(200).json({ ok: true, matrix });
  } catch (e) {
    console.error('[ORS Matrix] 오류:', e);
    return res.status(200).json({ ok: false, error: 'fetch failed' });
  }
}