import { del } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
  try {
    await del(url);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}