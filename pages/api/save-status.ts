import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { date, address, complaint, originalId, status, memo } = req.body;
  if (!date || !address || !complaint) return res.status(400).json({ message: '필수 파라미터 누락' });

  // 키: status:날짜:주소:민원내용:originalId(없으면 'none')
  const key = `status:${date}:${address}:${complaint}:${originalId ?? 'none'}`;

  await redis.set(key, JSON.stringify({
    status: status || '',
    memo: memo || '',
    updatedAt: Date.now(),
  }));

  return res.status(200).json({ ok: true });
}