import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { markers } = req.body;
  // markers: [{ lng, lat, order, isDone }] - 시청(order=0) 포함 전체 순서대로

  const CLIENT_ID = process.env.NAVER_CLIENT_ID!;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;

  // 의정부 관내 전체가 보이는 고정 중심/줌 레벨
  const centerLng = 127.07;
  const centerLat = 37.745;
  const zoomLevel = 11;

  // 마커 파라미터 - 순번 숫자 포함 (네이버 Static Map v2 공식 형식)
  // type:d = 드롭핀, label은 한 글자만 지원 → 숫자가 두 자리면 잘릴 수 있음
  const markerParams = markers
    .filter((m: { order: number }) => m.order !== 999) // 복귀용 중복 시청 마커 제외
    .map((m: { lng: number; lat: number; order: number; isDone: boolean }) => {
      if (m.order === 0) {
        return `markers=type:d|size:mid|pos:${m.lng} ${m.lat}|label:S|color:f57f17`;
      }
      const color = m.isDone ? '1e88e5' : 'e65100';
      const label = m.order <= 9 ? String(m.order) : 'N';
      return `markers=type:d|size:mid|pos:${m.lng} ${m.lat}|label:${label}|color:${color}`;
    }).join('&');

  // 경로 연결선 - path 파라미터 (좌표는 lng,lat 순서, | 구분)
  // 시청 → 지점1 → ... → 지점N → 시청 복귀
  const pathCoords = markers.map((m: { lng: number; lat: number }) => `${m.lng},${m.lat}`).join('|');
  const pathParam = `path=weight:3|color:0x1a6dd5BF|${pathCoords}`;

  const url = `https://maps.apigw.ntruss.com/map-static/v2/raster?w=714&h=350&center=${centerLng},${centerLat}&level=${zoomLevel}&${pathParam}&${markerParams}`;

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