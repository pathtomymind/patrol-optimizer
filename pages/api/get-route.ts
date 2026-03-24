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

  const data = await redis.get(`route:${date}`);
  if (!data) return res.status(404).json({ error: 'not found' });

  // 버전 이력 함께 반환
  const historyKey = `route-history:${date}`;
  const historyRaw = await redis.lrange(historyKey, 0, 19);
  const history = historyRaw.map((item: any) => {
    try { return typeof item === 'string' ? JSON.parse(item) : item; }
    catch { return null; }
  }).filter(Boolean);

  res.status(200).json({ ...(data as object), history });
}