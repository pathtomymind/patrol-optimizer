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

    // 버전 이력 저장 (route-history:날짜 → 버전 목록 역순)
    const historyKey = `route-history:${date}`;
    const historyItem = { version: newVersion, createdAt: data.createdAt };
    // lpush로 최신이 앞에 오도록, 최대 20개 유지
    await redis.lpush(historyKey, JSON.stringify(historyItem));
    await redis.ltrim(historyKey, 0, 19);

    res.status(200).json(data);
  } catch (err) {
    console.error('Redis 저장 오류:', err);
    res.status(500).json({ error: String(err) });
  }
}