import type { NextApiRequest, NextApiResponse } from 'next';

// 주소 전처리 함수
function normalizeAddress(address: string): string {
  if (address.includes('경기도')) return address;
  if (address.includes('경기 ')) return address.replace('경기 ', '경기도 ');
  if (address.includes('의정부')) return '경기도 ' + address;
  return '경기도 의정부시 ' + address;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { destination, address } = req.body;

  const CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  // 1단계: 목적지명으로 네이버 지역검색
  if (destination) {
    try {
      // 주소가 있으면 주소 컨텍스트를 함께 넣어 정확도 향상
      // 예: '경기도 의정부시 의정부동 371 의정부1동 주민센터'
      const searchQuery = address
        ? encodeURIComponent(`${normalizeAddress(address)} ${destination}`)
        : encodeURIComponent(`의정부 ${destination}`);
      const SEARCH_CLIENT_ID = process.env.NAVER_SEARCH_CLIENT_ID;
      const SEARCH_CLIENT_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET;
      
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
      console.log('지역검색 응답:', JSON.stringify(searchData));
      const items = searchData.items || [];

      if (items.length === 1) {
        // 1건: 바로 사용
        const item = items[0];
        return res.status(200).json({
          lat: Number(item.mapy) / 1e7,
          lng: Number(item.mapx) / 1e7,
          placeName: item.title.replace(/<[^>]*>/g, ''),
          source: 'place_single',
        });
      }

      if (items.length > 1) {
        // 여러 건: 주소 좌표와 비교해서 가장 가까운 것 선택, 주소 없으면 첫 번째 사용
        const addrCoord = address ? await getAddressCoord(address, CLIENT_ID!, CLIENT_SECRET!) : null;
        // 주소가 너무 광범위한 경우(동/읍/면 없이 시 단위만 반환) 무시
        const validAddrCoord = addrCoord && address && normalizeAddress(address).split(' ').length >= 4 ? addrCoord : null;
        let bestItem = items[0];
        if (validAddrCoord) {
          let minDist = Infinity;
          for (const item of items) {
            const lat = Number(item.mapy) / 1e7;
            const lng = Number(item.mapx) / 1e7;
            const dist = Math.sqrt(
              Math.pow(lat - validAddrCoord.lat, 2) + Math.pow(lng - validAddrCoord.lng, 2)
            );
            if (dist < minDist) {
              minDist = dist;
              bestItem = item;
            }
          }
        }
        return res.status(200).json({
          lat: Number(bestItem.mapy) / 1e7,
          lng: Number(bestItem.mapx) / 1e7,
          placeName: bestItem.title.replace(/<[^>]*>/g, ''),
          source: 'place_nearest',
        });
      }
    } catch (error) {
      console.error('지역검색 오류:', error);
    }
  }

  // 2단계: 주소로 좌표 검색 (폴백)
  if (address) {
    const addrCoord = await getAddressCoord(address, CLIENT_ID!, CLIENT_SECRET!);
    if (addrCoord) {
      return res.status(200).json({
        ...addrCoord,
        placeName: address,
        source: 'address',
      });
    }
  }

  // 3단계: 목적지명을 주소처럼 geocoding 시도
  if (destination) {
    const destCoord = await getAddressCoord(destination, CLIENT_ID!, CLIENT_SECRET!);
    if (destCoord) {
      return res.status(200).json({
        ...destCoord,
        placeName: destination,
        source: 'address',
      });
    }
  }

  return res.status(404).json({ message: '좌표를 찾을 수 없습니다.' });
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
    console.log('지오코딩 응답:', JSON.stringify(data));  // ← 추가
    const addr = data.addresses?.[0];
    if (addr) {
      return { lat: Number(addr.y), lng: Number(addr.x) };
    }
  } catch (error) {
    console.error('지오코딩 오류:', error);
  }
  return null;
}