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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',  /* model: 'claude-haiku-4-5-20251001', */  /* model: 'claude-opus-4-5', */
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
    });

    const data = await response.json();
    console.log('Claude 응답:', JSON.stringify(data, null, 2));

    const text = data.content?.[0]?.text || '';

    // JSON 배열 부분만 추출
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('JSON 배열을 찾을 수 없음:', text);
      return res.status(500).json({ message: 'AI 응답에서 지점정보를 찾을 수 없습니다.' });
    }

    const points = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ points });

  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ message: 'AI 추출 중 오류가 발생했습니다.' });
  }
}