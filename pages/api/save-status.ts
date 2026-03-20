import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { date, address, complaint, originalId, status, memo, destination } = req.body;

  if (!date) return res.status(400).json({ message: '필수 파라미터 누락 (date)' });

  // address가 비어있으면 destination 사용
  const addrPart = (address?.trim() || destination?.trim() || '');
  if (!addrPart) return res.status(400).json({ message: '필수 파라미터 누락 (address/destination)' });

  // complaint null/undefined → 빈 문자열로 통일
  const complaintPart = complaint?.trim() ?? '';

  const key = `status:${date}:${addrPart}:${complaintPart}:${originalId ?? 'none'}`;

  await redis.set(key, JSON.stringify({
    status: status || '',
    memo: memo || '',
    updatedAt: Date.now(),
  }));

  return res.status(200).json({ ok: true });
}