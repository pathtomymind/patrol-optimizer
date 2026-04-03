import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const redis = Redis.fromEnv();

const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CF_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CF_R2_BUCKET_NAME!;
const RETENTION_DAYS = 30;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Vercel Cron은 GET으로 호출됨. 보안을 위해 Authorization 헤더 검증.
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffMs = cutoff.getTime();
  const cutoffStr = cutoff.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const result = {
    redis: { deleted: 0, keys: [] as string[] },
    r2: { deleted: 0, files: [] as string[] },
  };

  // ── 1. Redis 정리 ─────────────────────────────────────────────
  // route:YYYY-MM-DD 키 — 날짜 파싱으로 30일 이전 삭제
  const routeKeys: string[] = await redis.keys('route:*');
  for (const key of routeKeys) {
    const dateStr = key.replace('route:', ''); // 'YYYY-MM-DD'
    if (dateStr < cutoffStr) {
      await redis.del(key);
      result.redis.keys.push(key);
      result.redis.deleted++;
    }
  }

  // status:YYYY-MM-DD:* 키
  const statusKeys: string[] = await redis.keys('status:*');
  for (const key of statusKeys) {
    const parts = key.split(':');
    const dateStr = parts[1]; // 'YYYY-MM-DD'
    if (dateStr && dateStr < cutoffStr) {
      await redis.del(key);
      result.redis.keys.push(key);
      result.redis.deleted++;
    }
  }

  // ors-cache:YYYY-MM-DD:* 키
  const orsCacheKeys: string[] = await redis.keys('ors-cache:*');
  for (const key of orsCacheKeys) {
    const parts = key.split(':');
    const dateStr = parts[1]; // 'YYYY-MM-DD'
    if (dateStr && dateStr < cutoffStr) {
      await redis.del(key);
      result.redis.keys.push(key);
      result.redis.deleted++;
    }
  }

  // ors-road-cache:YYYY-MM-DD:* 키
  const orsRoadCacheKeys: string[] = await redis.keys('ors-road-cache:*');
  for (const key of orsRoadCacheKeys) {
    const parts = key.split(':');
    const dateStr = parts[1];
    if (dateStr && dateStr < cutoffStr) {
      await redis.del(key);
      result.redis.keys.push(key);
      result.redis.deleted++;
    }
  }

  // route-version:YYYY-MM-DD 키
  const versionKeys: string[] = await redis.keys('route-version:*');
  for (const key of versionKeys) {
    const dateStr = key.replace('route-version:', '');
    if (dateStr < cutoffStr) {
      await redis.del(key);
      result.redis.keys.push(key);
      result.redis.deleted++;
    }
  }

  // ── 2. Cloudflare R2 정리 ──────────────────────────────────────
  // 파일명: point-{타임스탬프ms}-{순번}.jpg / direct-{타임스탬프ms}.jpg
  // 타임스탬프가 30일 이전이면 삭제
  let continuationToken: string | undefined;

  do {
    const listResp = await R2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'photos/',
      ContinuationToken: continuationToken,
    }));

    const toDelete = (listResp.Contents ?? []).filter(obj => {
      const filename = obj.Key?.split('/').pop() ?? '';
      // point-1774966983207-12.jpg 또는 direct-1774967210251.jpg
      const match = filename.match(/^(?:point|direct)-(\d+)/);
      if (!match) return false;
      const uploadMs = parseInt(match[1], 10);
      return uploadMs < cutoffMs;
    });

    if (toDelete.length > 0) {
      await R2.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: toDelete.map(obj => ({ Key: obj.Key! })),
          Quiet: true,
        },
      }));
      toDelete.forEach(obj => {
        result.r2.files.push(obj.Key!);
        result.r2.deleted++;
      });
    }

    continuationToken = listResp.NextContinuationToken;
  } while (continuationToken);

  console.log(`[cleanup] Redis ${result.redis.deleted}개, R2 ${result.r2.deleted}개 삭제 완료`);
  return res.status(200).json(result);
}