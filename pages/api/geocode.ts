import type { NextApiRequest, NextApiResponse } from 'next';

// 주소 전처리 함수
function normalizeAddress(address: string): string {
  if (address.includes('경기도')) return address;
  if (address.includes('경기 ')) return address.replace('경기 ', '경기도 ');
  if (address.includes('의정부')) return '경기도 ' + address;
  return '경기도 의정부시 ' + address;
}

// 도로명 주소 판별 함수
function isRoadAddress(address: string): boolean {
  return /로\d*번?길?|대로\d*번?길?|길\s*\d/.test(address);
}

// 두 좌표 간 거리 계산 (미터 단위, Haversine 근사)
function calcDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { destination, address } = req.body;

  const CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  const SEARCH_CLIENT_ID = process.env.NAVER_SEARCH_CLIENT_ID;
  const SEARCH_CLIENT_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET;

  // ────────────────────────────────────────────────────────────
  // 케이스 1, 2: 도로명 주소가 있는 경우 → 도로명 지오코딩 확정
  //   - 목적지명 POI 검색 생략
  //   - 목적지명이 있으면 placeName으로 그대로 표시
  // ────────────────────────────────────────────────────────────
  if (address && isRoadAddress(address)) {
    const coord = await getAddressCoord(address, CLIENT_ID!, CLIENT_SECRET!);
    if (coord) {
      return res.status(200).json({
        ...coord,
        placeName: destination || address,
        source: 'road_address',
        coordMessage: '도로명 주소로 좌표 생성',
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // 케이스 3, 4: 지번 주소가 있는 경우
  // ────────────────────────────────────────────────────────────
  if (address && !isRoadAddress(address)) {
    const jibunCoord = await getAddressCoord(address, CLIENT_ID!, CLIENT_SECRET!);

    // 케이스 3: 지번 주소 + 목적지명 있음 → POI 검색 후 100m 필터 + 가장 가까운 것 보정
    if (jibunCoord && destination) {
      try {
        const searchQuery = encodeURIComponent(`의정부 ${destination}`);
        const searchRes = await fetch(
          `https://openapi.naver.com/v1/search/local.json?query=${searchQuery}&display=10`,
          {
            headers: {
              'X-Naver-Client-Id': SEARCH_CLIENT_ID!,
              'X-Naver-Client-Secret': SEARCH_CLIENT_SECRET!,
            },
          }
        );
        const searchData = await searchRes.json();
        const items = searchData.items || [];

        // 100m 이내 필터링
        const nearby = items.filter((item: { mapy: string; mapx: string }) => {
          const lat = Number(item.mapy) / 1e7;
          const lng = Number(item.mapx) / 1e7;
          return calcDistanceMeters(jibunCoord.lat, jibunCoord.lng, lat, lng) <= 100;
        });

        if (nearby.length > 0) {
          // 가장 가까운 것 선택
          let bestItem = nearby[0];
          let minDist = Infinity;
          for (const item of nearby) {
            const lat = Number(item.mapy) / 1e7;
            const lng = Number(item.mapx) / 1e7;
            const dist = calcDistanceMeters(jibunCoord.lat, jibunCoord.lng, lat, lng);
            if (dist < minDist) {
              minDist = dist;
              bestItem = item;
            }
          }
          return res.status(200).json({
            lat: Number(bestItem.mapy) / 1e7,
            lng: Number(bestItem.mapx) / 1e7,
            placeName: bestItem.title.replace(/<[^>]*>/g, ''),
            source: 'place_nearest',
            coordMessage: '목적지명으로 좌표 보정',
          });
        }
      } catch (error) {
        console.error('POI 검색 오류:', error);
      }

      // POI 보정 실패 → 지번 좌표 그대로
      return res.status(200).json({
        ...jibunCoord,
        placeName: destination || address,
        source: 'jibun_address',
        coordMessage: '지번 주소로 좌표 생성',
      });
    }

    // 케이스 4: 지번 주소 + 목적지명 없음
    if (jibunCoord) {
      return res.status(200).json({
        ...jibunCoord,
        placeName: address,
        source: 'jibun_address',
        coordMessage: '지번 주소로 좌표 생성',
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // 케이스 5: 목적지명만 있음 (주소 없음)
  // ────────────────────────────────────────────────────────────
  if (destination && !address) {
    try {
      const searchQuery = encodeURIComponent(`의정부 ${destination}`);
      const searchRes = await fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${searchQuery}&display=5`,
        {
          headers: {
            'X-Naver-Client-Id': SEARCH_CLIENT_ID!,
            'X-Naver-Client-Secret': SEARCH_CLIENT_SECRET!,
          },
        }
      );
      const searchData = await searchRes.json();
      const items = searchData.items || [];

      if (items.length === 1) {
        const item = items[0];
        return res.status(200).json({
          lat: Number(item.mapy) / 1e7,
          lng: Number(item.mapx) / 1e7,
          placeName: item.title.replace(/<[^>]*>/g, ''),
          source: 'place_single',
          coordMessage: '목적지명으로 좌표 생성',
        });
      }

      if (items.length > 1) {
        const item = items[0];
        return res.status(200).json({
          lat: Number(item.mapy) / 1e7,
          lng: Number(item.mapx) / 1e7,
          placeName: item.title.replace(/<[^>]*>/g, ''),
          source: 'place_single',
          coordMessage: '목적지명으로 좌표 생성 (⚠️복수 검색됨, 확인 필요)',
        });
      }
    } catch (error) {
      console.error('목적지명 검색 오류:', error);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 케이스 6: 주소도 목적지명도 없음 (또는 모든 시도 실패)
  // ────────────────────────────────────────────────────────────
  return res.status(404).json({
    message: '좌표를 찾을 수 없습니다.',
    coordMessage: '좌표 없음. (⚠️주소나 목적지명 확인 필요)',
  });
}

// 좌표 → 동 이름 변환 함수 (역지오코딩) - 현재 미사용, 향후 필요시 활용
async function getDongFromCoord(
  lat: number,
  lng: number,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=legalcode&output=json`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
      }
    );
    const data = await res.json();
    const region = data.results?.[0]?.region;
    if (region) {
      const dong = region.area3?.name || region.area2?.name || null;
      return dong || null;
    }
  } catch (error) {
    console.error('역지오코딩 오류:', error);
  }
  return null;
}

// 주소 → 좌표 변환 함수
async function getAddressCoord(
  address: string,
  clientId: string,
  clientSecret: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(normalizeAddress(address));
    const res = await fetch(
      `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${query}`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
        },
      }
    );
    const data = await res.json();
    console.log('지오코딩 응답:', JSON.stringify(data));
    const addr = data.addresses?.[0];
    if (addr) {
      return { lat: Number(addr.y), lng: Number(addr.x) };
    }
  } catch (error) {
    console.error('지오코딩 오류:', error);
  }
  return null;
}