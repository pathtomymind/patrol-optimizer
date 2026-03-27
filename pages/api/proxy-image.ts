import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).end();

  const CLIENT_ID = process.env.NAVER_CLIENT_ID!;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;

  // Static Map URL에서 API 키 파라미터 제거하고 헤더로 전달
  const cleanUrl = url.replace(/[&?]X-NCP-APIGW-API-KEY-ID=[^&]*/, '');

  try {
    const imgRes = await fetch(cleanUrl, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': CLIENT_ID,
        'X-NCP-APIGW-API-KEY': CLIENT_SECRET,
      },
    });

    if (!imgRes.ok) {
      console.error('Static Map 오류:', imgRes.status, await imgRes.text());
      return res.status(imgRes.status).end();
    }

    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const buffer = await imgRes.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('proxy-image 오류:', e);
    res.status(500).end();
  }
}