import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { center, level, markers } = req.body;
  // markers: [{ lng, lat, order, isDone }]

  const CLIENT_ID = process.env.NAVER_CLIENT_ID!;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;

  // 마커 파라미터 조합
  const markerParams = markers.map((m: { lng: number; lat: number; order: number; isDone: boolean }) => {
    const color = m.isDone ? '1565c0' : 'FF6B35';
    return `markers=type:d|size:mid|pos:${m.lng} ${m.lat}|label:${m.order}|color:${color}`;
  }).join('&');

  // 시청 기점 마커
  const baseMarker = `markers=type:d|size:small|pos:127.0338 37.7381|color:f57f17`;

  const url = `https://maps.apigw.ntruss.com/map-static/v2/raster?w=714&h=280&center=${center.lng},${center.lat}&level=${level}&${baseMarker}&${markerParams}`;

  console.log('[static-map] 요청 URL:', url);

  try {
    const imgRes = await fetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': CLIENT_ID,
        'X-NCP-APIGW-API-KEY': CLIENT_SECRET,
      },
    });

    if (!imgRes.ok) {
      const errText = await imgRes.text();
      console.error('[static-map] 오류:', imgRes.status, errText);
      return res.status(imgRes.status).json({ error: errText });
    }

    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    res.status(200).json({ image: `data:${contentType};base64,${base64}` });
  } catch (e) {
    console.error('[static-map] 예외:', e);
    res.status(500).end();
  }
}