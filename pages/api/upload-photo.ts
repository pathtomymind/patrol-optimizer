import type { NextApiRequest, NextApiResponse } from 'next';
// ── [Cloudflare R2] 2026-04-01 Vercel Blob Advanced Operations 한도 초과로 R2로 전환 ──
// 한 달 후(2026-04-30) Vercel Blob 한도 리셋 시 아래 주석 해제하고 R2 코드 제거 가능
// import { put } from '@vercel/blob';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

// ── Cloudflare R2 클라이언트 ──────────────────────────────
const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CF_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CF_R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.CF_R2_PUBLIC_URL!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageData, filename } = req.body;
  if (!imageData) return res.status(400).json({ message: '이미지 없음' });

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  // ── [Vercel Blob 기존 코드 — 복구 시 아래 주석 해제] ──────
  // const blob = await put(`photos/${filename}`, buffer, {
  //   access: 'public',
  //   contentType: 'image/jpeg',
  // });
  // return res.status(200).json({ url: blob.url });

  // ── [Cloudflare R2 신규 코드] ──────────────────────────────
  await R2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `photos/${filename}`,
    Body: buffer,
    ContentType: 'image/jpeg',
  }));

  const url = `${PUBLIC_URL}/photos/${filename}`;
  return res.status(200).json({ url });
}