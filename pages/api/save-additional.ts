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
      await redis.set(key, { date, points, updatedAt: Date.now() });
    }
    res.status(200).json({ ok: true, count: points?.length ?? 0 });
  } catch (err) {
    console.error('추가지점 저장 오류:', err);
    res.status(500).json({ error: String(err) });
  }
}