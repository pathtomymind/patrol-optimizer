import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { date, points } = req.body;
  const key = `route:${date}`;

  const existing = await redis.get<{ version: number }>(key);
  const newVersion = existing ? existing.version + 1 : 1;

  const data = {
    date,
    version: newVersion,
    createdAt: Date.now(),
    points,
  };

  try {
    await redis.set(key, data);
    res.status(200).json(data);
  } catch (err) {
    console.error('Redis 저장 오류:', err);
    res.status(500).json({ error: String(err) });
  }
}