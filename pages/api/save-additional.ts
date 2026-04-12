import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { date, points } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });

  const key = `additional-points:${date}`;

  try {
    if (!points || points.length === 0) {
      await redis.del(key);
    } else {
      // base64 photoUrl은 Redis 용량 초과 원인 → R2 URL만 저장, base64는 제거
      const sanitizedPoints = points.map((p: any) => ({
        ...p,
        photoUrl: p.photoUrl?.startsWith('http') ? p.photoUrl : '',
      }));
      await redis.set(key, { date, points: sanitizedPoints, updatedAt: Date.now() });
    }
    res.status(200).json({ ok: true, count: points?.length ?? 0 });
  } catch (err) {
    console.error('추가지점 저장 오류:', err);
    res.status(500).json({ error: String(err) });
  }
}