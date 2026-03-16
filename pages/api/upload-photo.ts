import type { NextApiRequest, NextApiResponse } from 'next';
import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageData, filename } = req.body;
  if (!imageData) return res.status(400).json({ message: '이미지 없음' });

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const blob = await put(`photos/${filename}`, buffer, {
    access: 'public',
    contentType: 'image/jpeg',
  });

  return res.status(200).json({ url: blob.url });
}