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

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  const prompt = `다음 이미지들은 불법 옥외광고물 단속 업무를 위한 민원 접수 표입니다.
이미지에서 단속 지점 정보를 추출해주세요.

각 지점마다 아래 형식의 JSON 배열로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
[
  {
    "address": "도로명 주소 또는 지번 주소",
    "destination": "건물명 또는 목적지명",
    "complaint": "광고물 종류 (예: 현수막, 벽보, 에어라이트 등)"
  }
]`;

  try {
    const contents: object[] = [];

    // 이미지들 추가
    for (const image of images) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      });
    }

    // 프롬프트 추가
    contents.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: contents }],
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱
    const cleanText = text.replace(/```json|```/g, '').trim();
    const points = JSON.parse(cleanText);

    return res.status(200).json({ points });
  } catch (error) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ message: 'AI 추출 중 오류가 발생했습니다.' });
  }
}