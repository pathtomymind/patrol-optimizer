/* http://localhost:3000/api/blob-cleanup를 브라우저에서 열면 일괄 삭제할 수 있음 */
import { list, del } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { blobs } = await list({ prefix: 'photos/' });
  for (const blob of blobs) {
    await del(blob.url);
  }
  res.status(200).json({ deleted: blobs.length, urls: blobs.map(b => b.url) });
}