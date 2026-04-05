import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });

  const key = `additional-points:${date}`;

  try {
    const data = await redis.get<{ date: string; points: any[]; updatedAt: number }>(key);
    if (!data) return res.status(200).json({ points: [] });
    res.status(200).json({ points: data.points ?? [] });
  } catch (err) {
    console.error('추가지점 조회 오류:', err);
    res.status(500).json({ error: String(err) });
  }
}