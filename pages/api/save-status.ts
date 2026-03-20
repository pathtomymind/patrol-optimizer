import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { date, address, complaint, originalId, status, memo, destination } = req.body;

  // date는 필수, address 또는 destination 중 하나는 있어야 함
  if (!date) return res.status(400).json({ message: '필수 파라미터 누락 (date)' });
  const addrPart = (address?.trim() || destination?.trim() || '');
  if (!addrPart) return res.status(400).json({ message: '필수 파라미터 누락 (address/destination)' });

  // 키: status:날짜:주소(없으면destination):민원내용:originalId(없으면 'none')
  const key = `status:${date}:${addrPart}:${complaint ?? ''}:${originalId ?? 'none'}`;

  await redis.set(key, JSON.stringify({
    status: status || '',
    memo: memo || '',
    updatedAt: Date.now(),
  }));

  return res.status(200).json({ ok: true });
}