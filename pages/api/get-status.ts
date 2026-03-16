import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const { date } = req.query;
  if (!date || typeof date !== 'string') return res.status(400).json({ message: 'date 파라미터 필요' });

  // 해당 날짜의 모든 status 키 조회
  const keys = await redis.keys(`status:${date}:*`);
  if (keys.length === 0) return res.status(200).json({ statuses: {} });

  const values = await Promise.all(keys.map((k) => redis.get(k)));

  const statuses: Record<string, { status: string; memo: string; updatedAt: number }> = {};
  keys.forEach((k, i) => {
    // 키에서 "status:날짜:" 이후 부분을 그대로 클라이언트 키로 사용
    const clientKey = k.replace(`status:${date}:`, '');
    statuses[clientKey] = values[i] as { status: string; memo: string; updatedAt: number };
  });

  return res.status(200).json({ statuses });
}