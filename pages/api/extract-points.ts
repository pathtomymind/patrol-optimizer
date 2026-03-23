import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { images } = req.body;

  if (!images || images.length === 0) {
    return res.status(400).json({ message: '이미지가 없습니다.' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // ── 진단용 메타 정보 ──────────────────────────────────────
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const imageCount = images.length;
  const totalImageBytes = images.reduce((sum: number, img: string) => sum + img.length, 0);
  const startTime = Date.now();

  console.log(`[extract-points][${requestId}] 시작 | 이미지 수: ${imageCount}장 | 총 크기: ${(totalImageBytes / 1024).toFixed(0)}KB`);

  const imageContents = images.map((image: string) => {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64Data,
      },
    };
  });

  const prompt = `다음 이미지들은 불법 옥외광고물 단속 업무를 위한 민원 접수 표입니다.
이미지에서 단속 지점 정보를 추출해주세요.

목적지명 추출 규칙:
- "옆", "앞", "근처", "뒤", "건너편", "주변", "정문", "후문" 같은 위치 수식어를 제거하고 핵심 상호명만 추출
- "화순식당 옆" → "화순식당"
- "금돼지 부동산 옆" → "금돼지 부동산"
- "고산수자인 정문" → "고산수자인"
- "가금교 삼거리" 처럼 상호명이 없는 경우 → null

각 지점마다 아래 형식의 JSON 배열로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
[
  {
    "address": "도로명 주소 또는 지번 주소",
    "destination": "핵심 상호명 또는 null",
    "complaint": "광고물 종류 (예: 현수막, 벽보, 에어라이트 등)",
    "manager": "담당자 이름 또는 null",
    "photoDescription": "현장사진이 있으면 간판명·건물색·특징물 등 핵심만 15자 이내로, 사진 없으면 null",
    "imageIndex": "이 지점 정보가 몇 번째 이미지에서 추출되었는지 0부터 시작하는 인덱스",
    "photoCrop": "현장사진이나 지도가 있으면 해당 행의 사진/지도 컬럼 전체 영역을 {\"x\": 0~1, \"y\": 0~1, \"w\": 0~1, \"h\": 0~1} 비율로 반환. 사진과 지도가 모두 있으면 두 영역을 모두 포함하는 최소 경계 박스로 반환. 반드시 해당 행의 위아래 경계를 정확히 포함하고, 우측 끝까지 포함되도록 w값을 충분히 크게 잡을 것. 사진/지도 없으면 null"
  }
]`;

  // ── Claude API 호출 (타임아웃 55초) ───────────────────────
  const TIMEOUT_MS = 55000;
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[extract-points][${requestId}] Claude API 호출 시작`);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: [
                ...imageContents,
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      const elapsed = Date.now() - startTime;
      // 타임아웃 vs 네트워크 오류 구분
      if (fetchErr?.name === 'AbortError') {
        console.error(`[extract-points][${requestId}] ⏱️ 타임아웃 (${elapsed}ms) | 이미지 ${imageCount}장 | Claude API 응답 없음`);
        return res.status(504).json({
          message: `AI 응답 시간 초과 (${Math.round(elapsed/1000)}초). 네트워크가 불안정하거나 Claude API가 과부하 상태일 수 있습니다.`,
          errorType: 'TIMEOUT',
          elapsed,
          imageCount,
        });
      }
      console.error(`[extract-points][${requestId}] 🔴 네트워크 오류 (${elapsed}ms) | ${fetchErr?.message || fetchErr}`);
      return res.status(503).json({
        message: '네트워크 오류로 AI 서버에 연결할 수 없습니다.',
        errorType: 'NETWORK_ERROR',
        elapsed,
        imageCount,
      });
    } finally {
      clearTimeout(timeoutTimer);
    }

    const elapsed = Date.now() - startTime;

    // HTTP 상태 코드 로깅
    if (!response.ok) {
      const errBody = await response.text().catch(() => '(본문 없음)');
      console.error(`[extract-points][${requestId}] 🔴 Claude API HTTP ${response.status} (${elapsed}ms) | 이미지 ${imageCount}장 | 응답: ${errBody.slice(0, 300)}`);

      // 429: 과부하/속도제한
      if (response.status === 429) {
        return res.status(429).json({
          message: 'Claude API 요청 한도 초과 (과부하). 잠시 후 다시 시도해주세요.',
          errorType: 'RATE_LIMIT',
          elapsed,
          imageCount,
        });
      }
      // 529: Anthropic 서버 과부하
      if (response.status === 529) {
        return res.status(503).json({
          message: 'Claude API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
          errorType: 'API_OVERLOAD',
          elapsed,
          imageCount,
        });
      }
      return res.status(502).json({
        message: `AI 서버 오류 (HTTP ${response.status})`,
        errorType: 'API_ERROR',
        httpStatus: response.status,
        elapsed,
        imageCount,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // JSON 배열 부분만 추출
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`[extract-points][${requestId}] ⚠️ JSON 파싱 실패 (${elapsed}ms) | 이미지 ${imageCount}장 | 응답 앞부분: ${text.slice(0, 200)}`);
      return res.status(500).json({
        message: 'AI 응답에서 지점정보를 찾을 수 없습니다.',
        errorType: 'PARSE_ERROR',
        elapsed,
        imageCount,
      });
    }

    const points = JSON.parse(jsonMatch[0]);

    console.log(`[extract-points][${requestId}] ✅ 완료 | 소요: ${elapsed}ms | 이미지 ${imageCount}장 → 지점 ${points.length}개 추출`);

    // 이미지 대비 추출 지점 수가 비정상적으로 적으면 경고 로그
    if (points.length < imageCount * 2) {
      console.warn(`[extract-points][${requestId}] ⚠️ 추출 지점 수 적음 | 이미지 ${imageCount}장 → 지점 ${points.length}개 (기대: ${imageCount * 2}개 이상)`);
    }

    return res.status(200).json({ points, elapsed, imageCount });

  } catch (error: any) {
    clearTimeout(timeoutTimer);
    const elapsed = Date.now() - startTime;
    console.error(`[extract-points][${requestId}] 🔴 예외 발생 (${elapsed}ms) | ${error?.message || error}`);
    return res.status(500).json({
      message: 'AI 추출 중 오류가 발생했습니다.',
      errorType: 'UNKNOWN',
      elapsed,
      imageCount,
    });
  }
}