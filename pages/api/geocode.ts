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
      // 주소 컨텍스트 활용 전략:
      // - 지번 주소(동+번지)일 때만 주소를 앞에 붙여 정확도 향상
      //   예: '경기도 의정부시 의정부동 371 의정부1동 주민센터'
      // - 도로명 주소(로/길 포함)는 붙이면 장소검색이 안 되므로 제외
      //   예: '의정부 해태프라자' (도로명 주소 컨텍스트 제외)
      const isJibunAddress = address && !/로\d*번?길?|대로\d*번?길?/.test(address) && /동\s*\d|읍\s*\d|면\s*\d/.test(address);

      let searchQuery: string;
      if (isJibunAddress) {
        // 지번 주소: 주소 전체를 앞에 붙여 검색
        searchQuery = encodeURIComponent(`${normalizeAddress(address)} ${destination}`);
      } else if (address) {
        // 도로명 주소: 주소 좌표로 역지오코딩해서 동 이름 얻기
        const addrCoordForDong = await getAddressCoord(address, CLIENT_ID!, CLIENT_SECRET!);
        const dongName = addrCoordForDong
          ? await getDongFromCoord(addrCoordForDong.lat, addrCoordForDong.lng, CLIENT_ID!, CLIENT_SECRET!)
          : null;
        if (dongName) {
          // 동 이름 + 목적지명으로 정밀 검색 (예: '민락동 GS25')
          searchQuery = encodeURIComponent(`${dongName} ${destination}`);
          console.log(`역지오코딩 동 이름: ${dongName} → 검색어: ${dongName} ${destination}`);
        } else {
          searchQuery = encodeURIComponent(`의정부 ${destination}`);
        }
      } else {
        searchQuery = encodeURIComponent(`의정부 ${destination}`);
      }
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

// 좌표 → 동 이름 변환 함수 (역지오코딩)
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
    console.log('역지오코딩 응답:', JSON.stringify(data));
    // 법정동 이름 추출 (예: '민락동', '의정부동')
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