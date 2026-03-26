'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type RoutePoint = {
  order: number;
  address: string;
  destination: string | null;
  complaint: string;
  lat: number;
  lng: number;
  placeName: string | null;
  source: string | null;
  originalId?: number | null;
  photoDescription?: string | null;
  photoUrl?: string | null;
  manager?: string | null;
};

type PointStatus = {
  status: string;
  memo: string;
  updatedAt: number;
};

const DONE_STATUSES = ['민원처리완료', '기처리', '확인불가'];
const ZOOM_THRESHOLD = 14;
const PULSE_THRESHOLD = 14; // 롱프레스 깜박임과 동일한 레벨 // 이 줌 이상부터 펄스 + 클릭 팝업 활성화 (휠 약 2번)

// ★ 펄스 애니메이션 CSS (전역 style 태그로 삽입)
const PULSE_STYLE = `
@keyframes marker-pulse {
  0%   { transform: scale(1);   opacity: 0.8; }
  70%  { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(2.2); opacity: 0; }
}
.pulse-ring {
  position: absolute;
  top: 50%; left: 50%;
  width: 28px; height: 28px;
  margin-left: -14px; margin-top: -14px;
  border-radius: 50%;
  animation: marker-pulse 1.8s ease-out infinite;
  pointer-events: none;
}
`;

export default function MapPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const naverMapRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const polylinesRef = useRef<naver.maps.Polyline[]>([]);
  const arrowMarkersRef = useRef<naver.maps.Marker[]>([]);
  const polygonsRef = useRef<naver.maps.Polygon[]>([]);
  const labelsRef = useRef<naver.maps.Marker[]>([]);
  const currentZoomRef = useRef<number>(13);

  const [route, setRoute] = useState<{ date: string; version: number; points: RoutePoint[] } | null>(null);
  const routeRef = useRef<{ date: string; version: number; points: RoutePoint[] } | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PointStatus>>({});
  const statusesRef = useRef<Record<string, PointStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [routeDrawn, setRouteDrawn] = useState(false);
  const [lineMode, setLineMode] = useState<'straight' | 'road'>('straight');
  const lineModeRef = useRef<'straight' | 'road'>('straight');
  const [osrmError, setOsrmError] = useState(false);
  const [roadLoading, setRoadLoading] = useState(false);
  const [newRouteAvailable, setNewRouteAvailable] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkRestoreRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkPolylineRef = useRef<any>(null);
  const blinkArrowsRef = useRef<any[]>([]);
  const blinkOriginalPolylineRef = useRef<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // ★ 내 위치 추적
  const [isTracking, setIsTracking] = useState(false);
  const myLocationMarkerRef = useRef<naver.maps.Marker | null>(null);
  const myLocationCircleRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  // ★ 팝업 상태
  const [selectedPoint, setSelectedPoint] = useState<RoutePoint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  // ★ 겹침 목록 팝업 상태
  const [overlappingPoints, setOverlappingPoints] = useState<RoutePoint[]>([]);
  const [showOverlapModal, setShowOverlapModal] = useState(false);

  const statusKey = (point: RoutePoint) => {
    const addrPart = point.address?.trim() || point.destination?.trim() || '';
    const complaintPart = point.complaint?.trim() ?? '';
    return `${addrPart}:${complaintPart}:${point.originalId ?? 'none'}`;
  };

  // ★ 펄스 CSS 삽입
  useEffect(() => {
    if (document.getElementById('pulse-style')) return;
    const style = document.createElement('style');
    style.id = 'pulse-style';
    style.textContent = PULSE_STYLE;
    document.head.appendChild(style);
  }, []);

  // 0. /map 직접 접근 방지 - sessionStorage 플래그 없으면 메인으로 리다이렉트
  useEffect(() => {
    const mapEntryFlag = sessionStorage.getItem('map-entry');
    if (!mapEntryFlag) {
      router.replace('/');
      return;
    }
    // 플래그 소비 (1회용)
    sessionStorage.removeItem('map-entry');
  }, []);

  // 1. 경로 + 상태 로드
  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
        const routeRes = await fetch(`/api/get-route?date=${today}`);
        if (!routeRes.ok) return;
        const routeData = await routeRes.json();
        routeRef.current = routeData;
        setRoute(routeData);

        const statusRes = await fetch(`/api/get-status?date=${routeData.date}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          statusesRef.current = statusData.statuses || {};
          setStatuses(statusData.statuses || {});
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // 1-1. 경로 버전 폴링 (30초마다 새 버전 체크)
  useEffect(() => {
    const checkNewRoute = async () => {
      try {
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
        const res = await fetch(`/api/get-route?date=${today}`);
        if (!res.ok) return;
        const data = await res.json();
        const currentVersion = routeRef.current?.version ?? -1;
        if (data.version > currentVersion) {
          setNewRouteAvailable(true);
        }
      } catch {}
    };
    const timer = setInterval(checkNewRoute, 30000);
    return () => clearInterval(timer);
  }, []);

  // 2. 네이버 지도 SDK 로드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).naver?.maps) {
      setMapReady(true);
      return;
    }
    const script = document.createElement('script');
    const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder`;
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // 3. 지도 초기화
  useEffect(() => {
    if (!mapReady || !mapRef.current || naverMapRef.current) return;
    const map = new (window as any).naver.maps.Map(mapRef.current, {
      center: new (window as any).naver.maps.LatLng(37.7381, 127.0338),
      zoom: 13,
      mapTypeId: (window as any).naver.maps.MapTypeId.NORMAL,
    });
    naverMapRef.current = map;

    loadGeoJson(map);

    (window as any).naver.maps.Event.addListener(map, 'zoom_changed', (zoom: number) => {
      currentZoomRef.current = zoom;
      applyZoomVisibility(zoom);
    });
  }, [mapReady]);

  // 4. 경로 + 지도 모두 준비되면 그리기
  useEffect(() => {
    if (!naverMapRef.current || !route || routeDrawn) return;
    drawRoute();
    setRouteDrawn(true);
  }, [naverMapRef.current, route, mapReady]);

  // 5. 상태 변경시 마커 색상 업데이트
  useEffect(() => {
    if (!routeDrawn) return;
    updateMarkerColors();
  }, [statuses, routeDrawn]);

  // 5-2. 마운트 시 admin 인증 상태 확인
  useEffect(() => {
    const adminAuth = localStorage.getItem('patrol-admin-auth');
    if (adminAuth === 'true') setIsAdmin(true);
  }, []);

  // 5-3. 언마운트 시 위치 감시 정리
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 6. lineMode 변경시 경로선 재그리기 + localStorage 저장
  useEffect(() => {
    localStorage.setItem('patrol-linemode', lineMode);
    if (!routeDrawn) return;
    lineModeRef.current = lineMode;
    redrawLines();
  }, [lineMode]);

  const applyZoomVisibility = (zoom: number) => {
    const showMarkers = zoom >= ZOOM_THRESHOLD;
    const showPulse = zoom >= PULSE_THRESHOLD;
    const showLabels = zoom < ZOOM_THRESHOLD;

    // 마커 표시/숨김 + 펄스 ON/OFF 재렌더링 (routeRef로 클로저 문제 회피)
    const currentRoute = routeRef.current;
    if (currentRoute) {
      currentRoute.points.forEach((point, idx) => {
        const marker = markersRef.current[idx];
        if (!marker) return;
        const color = getMarkerColor(point);
        marker.setIcon({
          content: makeMarkerContent(point, color, showPulse),
          anchor: (window as any).naver.maps.Point ? new (window as any).naver.maps.Point(14, 14) : undefined,
        });
        marker.setMap(showMarkers ? naverMapRef.current : null);
      });
    } else {
      markersRef.current.forEach(marker => {
        marker.setMap(showMarkers ? naverMapRef.current : null);
      });
    }

    labelsRef.current.forEach(label => {
      label.setMap(showLabels ? naverMapRef.current : null);
    });

    // 펄스 활성화 시 DOM 반영 후 애니메이션 시작
    if (showPulse) {
      setTimeout(() => startPulseAnimations(), 300);
    }
  };

  const loadGeoJson = async (map: naver.maps.Map) => {
    try {
      const res = await fetch('/uijeongbu.geojson');
      const geoJson = await res.json();
      const naver = (window as any).naver;

      geoJson.features.forEach((feature: any) => {
        const coords = feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates
          : [feature.geometry.coordinates];

        coords.forEach((polygon: any) => {
          polygon.forEach((ring: any) => {
            const path = ring.map((c: number[]) =>
              new naver.maps.LatLng(c[1], c[0])
            );
            new naver.maps.Polygon({
              map,
              paths: [path],
              fillColor: 'rgba(100,180,255,0.05)',
              fillOpacity: 1,
              strokeColor: 'rgba(100,180,255,0.5)',
              strokeWeight: 1.5,
              strokeOpacity: 1,
            });
          });
        });

        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          const nm: string = feature.properties.adm_nm || '';
          const shortNm = nm.replace('경기도 의정부시 ', '');
          const coords0 = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates[0][0]
            : feature.geometry.coordinates[0];
          let sumLat = 0, sumLng = 0;
          coords0.forEach((c: number[]) => { sumLng += c[0]; sumLat += c[1]; });
          const centerLat = sumLat / coords0.length;
          const centerLng = sumLng / coords0.length;

          const label = new naver.maps.Marker({
            map,
            position: new naver.maps.LatLng(centerLat, centerLng),
            icon: {
              content: `<div style="color:rgba(180,220,255,0.9);font-size:13px;font-weight:bold;white-space:nowrap;text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,0.8);">${shortNm}</div>`,
              anchor: new naver.maps.Point(0, 0),
            },
            zIndex: 1,
          });
          labelsRef.current.push(label);
        }
      });
    } catch (e) {
      console.error('GeoJSON 로드 실패:', e);
    }
  };

  const getMarkerColor = (point: RoutePoint) => {
    if (point.source === 'fixed') return '#f57f17';
    const st = statusesRef.current[statusKey(point)];
    if (st && DONE_STATUSES.includes(st.status)) return '#1565c0';
    return '#FF6B35';
  };

  const getLineColor = (_fromPoint: RoutePoint, toPoint: RoutePoint) => {
    const toSt = statusesRef.current[statusKey(toPoint)];
    return toSt && DONE_STATUSES.includes(toSt.status) ? '#1565c0' : '#FF6B35';
  };

  // ★ 마커 콘텐츠 - showPulse: JS 인라인 애니메이션으로 펄스 구현
  const makeMarkerContent = (point: RoutePoint, color: string, showPulse = false) => {
    const label = point.source === 'fixed' ? '🏛' : String(point.order);
    const isFixed = point.source === 'fixed';
    const pulseColor = color === '#1565c0'
      ? 'rgba(21,101,192,0.6)'
      : color === '#f57f17'
      ? 'rgba(245,127,23,0.6)'
      : 'rgba(255,107,53,0.6)';
    // data-pulse 속성으로 마커 식별 후 외부에서 JS 애니메이션 적용
    const pulseId = `pulse-${point.order}-${point.lat}`.replace(/\./g, '_');
    const pulseDiv = showPulse ? `
      <div data-pulse="${pulseId}-0" data-delay="0" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-1" data-delay="333" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-2" data-delay="666" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-3" data-delay="999" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-4" data-delay="1332" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-5" data-delay="1665" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-6" data-delay="1998" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-7" data-delay="2331" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-8" data-delay="2664" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-9" data-delay="2997" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-10" data-delay="3330" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-11" data-delay="3663" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:2px solid ${pulseColor};background:transparent;pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>` : '';
    const cursorStyle = (showPulse && !isFixed) ? 'cursor:pointer;' : 'cursor:default;';
    return `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;overflow:visible;user-select:none;-webkit-user-select:none;${cursorStyle}">
        ${pulseDiv}
        <div style="
          position:relative;z-index:1;
          width:28px;height:28px;border-radius:50%;
          background:${color};
          border:2px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:${isFixed ? '14px' : '11px'};
          font-weight:bold;color:white;
          box-shadow:0 2px 6px rgba(0,0,0,0.5);
        ">${label}</div>
        <div style="
          position:absolute;z-index:2;
          bottom:32px;left:50%;
          transform:translateX(-50%);
          background:rgba(0,0,0,0.38);
          color:rgba(255,255,255,0.95);font-size:9px;
          padding:2px 5px;border-radius:4px;
          white-space:nowrap;max-width:80px;
          overflow:hidden;text-overflow:ellipsis;
          pointer-events:none;
        ">${point.destination || point.address.slice(0, 10)}</div>
      </div>
    `;
  };

  // ★ mapRef 컨테이너 내부에서 data-pulse 요소 찾아 rAF 애니메이션 적용
  const startPulseAnimations = () => {
    // 네이버 지도 마커는 mapRef.current 내부 div에 렌더링됨
    const container = mapRef.current;
    if (!container) return;
    // 디버그: 전체 document와 container 양쪽 모두 탐색
    const pulseEls1 = document.querySelectorAll('[data-pulse]');
    const pulseEls2 = container.querySelectorAll('[data-pulse]');
    console.log('[pulse] document 탐색:', pulseEls1.length, '/ container 탐색:', pulseEls2.length);
    // 둘 다 합쳐서 처리
    const allPulse = new Set([...Array.from(pulseEls1), ...Array.from(pulseEls2)]);
    allPulse.forEach((el) => {
      const div = el as HTMLElement;
      if (div.dataset.animated) return;
      div.dataset.animated = '1';
      const duration = 4000;          // 동심원 1개의 퍼지는 시간
      const delay = parseInt(div.dataset.delay || '0', 10);
      const step = (ts: number) => {
        // delay만큼 위상 이동 → 3개가 순서대로 퍼짐
        const progress = ((ts - delay) % duration + duration) % duration / duration;
        let scale: number, opacity: number;
        if (progress < 0.15) {
          // 빠르게 나타남
          scale = 1 + (progress / 0.15) * 0.2;
          opacity = (progress / 0.15) * 0.7;
        } else if (progress < 0.75) {
          // 천천히 퍼지면서 사라짐
          const p = (progress - 0.15) / 0.60;
          scale = 1.2 + p * 0.8;
          opacity = 0.7 * (1 - p);
        } else {
          scale = 2.0; opacity = 0;
        }
        if (div.isConnected) {
          div.style.transform = `scale(${scale.toFixed(3)})`;
          div.style.opacity = opacity.toFixed(3);
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  };

  const calcBearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180) / Math.PI;
  };

  const makeArrowIcon = (bearing: number) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="-5 -5 10 10">
      <polygon points="0,-4 3,2 0,0 -3,2" fill="white" opacity="0.9" transform="rotate(${bearing})"/>
    </svg>`;
    return {
      content: svg,
      anchor: new (window as any).naver.maps.Point(5, 5),
    };
  };

  const latLngDistanceM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const placeArrows = (
    coordPairs: { lat: number; lng: number }[],
    bearing: number | null,
    map: any,
    naver: any,
    intervalM = 80
  ) => {
    if (coordPairs.length < 2) return;
    let accumulated = 0;
    for (let i = 0; i < coordPairs.length - 1; i++) {
      const from = coordPairs[i];
      const to = coordPairs[i + 1];
      const segDist = latLngDistanceM(from.lat, from.lng, to.lat, to.lng);
      const segBearing = bearing ?? calcBearing(from, to);
      let d = (accumulated === 0 ? intervalM / 2 : intervalM - (accumulated % intervalM));
      while (d <= segDist) {
        const t = d / segDist;
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        const arrow = new naver.maps.Marker({
          map,
          position: new naver.maps.LatLng(lat, lng),
          icon: makeArrowIcon(segBearing),
          zIndex: 5,
          clickable: false,
        });
        arrowMarkersRef.current.push(arrow);
        d += intervalM;
      }
      accumulated = (accumulated + segDist) % intervalM;
    }
  };

  const drawStraightLines = (points: RoutePoint[], map: any, naver: any) => {
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const color = getLineColor(from, to);
      const polyline = new naver.maps.Polyline({
        map,
        path: [
          new naver.maps.LatLng(from.lat, from.lng),
          new naver.maps.LatLng(to.lat, to.lng),
        ],
        strokeColor: color,
        strokeWeight: 6,
        strokeOpacity: 1,
      });
      polylinesRef.current.push(polyline);
      const bearing = calcBearing(from, to);
      placeArrows(
        [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }],
        bearing,
        map,
        naver
      );
    }
  };

  const drawRoadLines = async (points: RoutePoint[], map: any, naver: any) => {
    const TIMEOUT = 8000;
    const fetchWithTimeout = (url: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    };

    const segments = points.slice(0, -1).map((from, i) => ({
      from, to: points[i + 1], color: getLineColor(from, points[i + 1]),
    }));

    // 공통 렌더링 함수
    const renderResults = (results: { coords: { lat: number; lng: number }[]; color: string }[]) => {
      results.forEach(({ coords, color }) => {
        const path = coords.map((c: { lat: number; lng: number }) => new naver.maps.LatLng(c.lat, c.lng));
        const polyline = new naver.maps.Polyline({
          map, path, strokeColor: color, strokeWeight: 6, strokeOpacity: 1,
        });
        polylinesRef.current.push(polyline);
        placeArrows(coords, null, map, naver);
      });
    };

    // 직선 fallback 렌더링
    const renderStraight = () => {
      segments.forEach(({ from, to, color }) => {
        const polyline = new naver.maps.Polyline({
          map,
          path: [new naver.maps.LatLng(from.lat, from.lng), new naver.maps.LatLng(to.lat, to.lng)],
          strokeColor: color, strokeWeight: 6, strokeOpacity: 1,
        });
        polylinesRef.current.push(polyline);
      });
    };

    // ① ORS 시도 (주 서비스 - 안정적)
    setRoadLoading(true);
    try {
      console.log('[road] ORS 요청 시작...');
      const orsRes = await fetch('/api/ors-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: routeRef.current?.date ?? '',
          version: routeRef.current?.version ?? 0,
          segments: segments.map(({ from, to }) => ({
            fromLng: from.lng, fromLat: from.lat, toLng: to.lng, toLat: to.lat,
          })),
        }),
      });
      console.log('[road] ORS 응답 상태:', orsRes.status);
      if (!orsRes.ok) throw new Error(`ORS HTTP ${orsRes.status}`);
      const orsData = await orsRes.json();
      if (orsData.fromCache) setRoadLoading(false); // 캐시 히트면 즉시 숨김
      console.log('[road] ORS 결과 수:', orsData.results?.length, '/ 성공:', orsData.results?.filter((r: {ok: boolean}) => r.ok).length, orsData.fromCache ? '(캐시)' : '(신규)');
      if (orsData.results?.length) {
        const results = orsData.results.map((r: { ok: boolean; coords?: { lat: number; lng: number }[] }, i: number) => ({
          coords: r.ok && r.coords ? r.coords : [
            { lat: segments[i].from.lat, lng: segments[i].from.lng },
            { lat: segments[i].to.lat, lng: segments[i].to.lng },
          ],
          color: segments[i].color,
        }));
        setOsrmError(false);
        setRoadLoading(false);
        renderResults(results);
        return;
      }
    } catch (e) {
      console.warn('[road] ORS 실패:', e);
    }

    // ② ORS 실패 → OSRM 폴백
    try {
      console.log('[road] OSRM 폴백 시도...');
      const probeCount = Math.min(3, segments.length);
      const probes = await Promise.all(
        segments.slice(0, probeCount).map(({ from, to }) =>
          fetchWithTimeout(
            `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
          ).then(r => { console.log('[road] OSRM probe:', r.status); return r.ok; }).catch(() => false)
        )
      );
      if (probes.every(ok => ok)) {
        const results = await Promise.all(
          segments.map(async ({ from, to, color }) => {
            try {
              const res = await fetchWithTimeout(
                `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
              );
              if (!res.ok) throw new Error();
              const data = await res.json();
              if (data.routes?.[0]?.geometry?.coordinates) {
                return { coords: data.routes[0].geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] })), color };
              }
            } catch {}
            return { coords: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }], color };
          })
        );
        setOsrmError(false);
        renderResults(results);
        return;
      }
    } catch (e) {
      console.warn('[road] OSRM 폴백 실패:', e);
    }

    // ③ 둘 다 실패 → 직선 + 에러 배너
    console.error('[road] ORS·OSRM 모두 실패 → 직선 표시');
    setRoadLoading(false);
    setOsrmError(true);
    renderStraight();
  };

  const redrawLines = () => {
    if (!route || !naverMapRef.current) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;

    // 진행 중인 blink 정리
    if (blinkIntervalRef.current) { clearInterval(blinkIntervalRef.current); blinkIntervalRef.current = null; }
    if (blinkRestoreRef.current) { clearTimeout(blinkRestoreRef.current); blinkRestoreRef.current = null; }
    if (blinkPolylineRef.current) { blinkPolylineRef.current.setMap(null); blinkPolylineRef.current = null; }
    blinkArrowsRef.current = [];
    blinkOriginalPolylineRef.current = null;

    polylinesRef.current.forEach(p => p.setMap(null));
    arrowMarkersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current = [];
    arrowMarkersRef.current = [];

    const points = route.points;
    if (lineModeRef.current === 'road') {
      drawRoadLines(points, map, naver);
    } else {
      drawStraightLines(points, map, naver);
    }
  };

  const drawRoute = () => {
    if (!route || !naverMapRef.current) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;

    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current.forEach(p => p.setMap(null));
    arrowMarkersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];
    arrowMarkersRef.current = [];

    const points = route.points;
    // 저장된 lineMode로 시작 (직선/도로 기억)
    if (lineModeRef.current === 'road') {
      drawRoadLines(points, map, naver);
    } else {
      drawStraightLines(points, map, naver);
    }

    const showMarkers = currentZoomRef.current >= ZOOM_THRESHOLD;
    const showPulse = currentZoomRef.current >= PULSE_THRESHOLD;

    // ★ 마커 생성 + 클릭 이벤트 연결
    points.forEach((point, pointArrayIdx) => {
      const color = getMarkerColor(point);
      // 기점(첫 번째 fixed)은 zIndex를 높여서 종점(마지막 fixed) 위에 표시
      const isFirstFixed = point.source === 'fixed' && pointArrayIdx === 0;
      const marker = new naver.maps.Marker({
        map: showMarkers ? map : null,
        position: new naver.maps.LatLng(point.lat, point.lng),
        icon: {
          content: makeMarkerContent(point, color, showPulse),
          anchor: new naver.maps.Point(14, 14),
        },
        zIndex: isFirstFixed ? 20 : 10,
      });

      // ★ 마커 클릭 → 줌 PULSE_THRESHOLD 이상일 때만 팝업 (fixed 제외)
      if (point.source !== 'fixed') {
        naver.maps.Event.addListener(marker, 'click', () => {
          if (currentZoomRef.current >= PULSE_THRESHOLD) {
            // 같은 좌표 지점 탐색 (fixed 제외)
            const currentRoute = routeRef.current;
            const sameCoordPoints = currentRoute
              ? currentRoute.points.filter(
                  p => p.source !== 'fixed' &&
                  Math.abs(p.lat - point.lat) < 0.0001 &&
                  Math.abs(p.lng - point.lng) < 0.0001
                )
              : [point];
            console.log('[overlap] 클릭 지점:', point.order, point.lat, point.lng, '/ 같은좌표:', sameCoordPoints.map(p => p.order));
            if (sameCoordPoints.length > 1) {
              // 겹친 지점이 2개 이상 → 목록 팝업
              setOverlappingPoints(sameCoordPoints);
              setShowOverlapModal(true);
            } else {
              // 단일 지점 → 바로 상세 팝업
              setSelectedPoint(point);
              setShowDetailModal(true);
            }
          }
        });
      }

      // ★ 롱프레스 → 해당 구간 초록 깜박임 (fixed 포함 전체 마커)
      const startLongPress = () => {
        longPressTimerRef.current = setTimeout(() => {
          blinkSegment(pointArrayIdx);
        }, 700);
      };
      const cancelLongPress = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      };
      naver.maps.Event.addListener(marker, 'mousedown', startLongPress);
      naver.maps.Event.addListener(marker, 'mouseup', cancelLongPress);
      naver.maps.Event.addListener(marker, 'touchstart', startLongPress);
      naver.maps.Event.addListener(marker, 'touchend', cancelLongPress);

      markersRef.current.push(marker);
    });

    // 초기 줌이 이미 PULSE_THRESHOLD 이상이면 바로 펄스 시작
    if (showPulse) {
      setTimeout(() => startPulseAnimations(), 300);
    }
  };

  const updateMarkerColors = () => {
    if (!route || !naverMapRef.current) return;
    const naver = (window as any).naver;
    const showMarkers = currentZoomRef.current >= ZOOM_THRESHOLD;
    const showPulse = currentZoomRef.current >= PULSE_THRESHOLD;

    route.points.forEach((point, idx) => {
      const marker = markersRef.current[idx];
      if (!marker) return;
      const color = getMarkerColor(point);
      marker.setIcon({
        content: makeMarkerContent(point, color, showPulse),
        anchor: new naver.maps.Point(14, 14),
      });
      marker.setMap(showMarkers ? naverMapRef.current : null);
    });

    route.points.forEach((point, idx) => {
      if (idx === 0) return;
      const polyline = polylinesRef.current[idx - 1];
      if (!polyline) return;
      const from = route.points[idx - 1];
      const to = point;
      polyline.setOptions({ strokeColor: getLineColor(from, to) });
    });
  };

  // ★ 특정 구간 폴리라인 초록 깜박임 (롱프레스)
  // markerIdx: markersRef 배열 인덱스 (= route.points 인덱스)
  const blinkSegment = (markerIdx: number) => {
    if (!route || polylinesRef.current.length === 0) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;

    const segIdx = markerIdx;
    const polyline = polylinesRef.current[segIdx];
    if (!polyline) return;

    const from = route.points[segIdx];
    const to = route.points[segIdx + 1];
    if (!from || !to) return;
    const originalColor = getLineColor(from, to);

    // 기존 깜박임 완전 정리 (ref로 추적)
    const cleanupBlink = () => {
      if (blinkIntervalRef.current) { clearInterval(blinkIntervalRef.current); blinkIntervalRef.current = null; }
      if (blinkRestoreRef.current) { clearTimeout(blinkRestoreRef.current); blinkRestoreRef.current = null; }
      if (blinkPolylineRef.current) { blinkPolylineRef.current.setMap(null); blinkPolylineRef.current = null; }
      blinkArrowsRef.current.forEach(a => {
        a.setMap(null);
        const idx = arrowMarkersRef.current.indexOf(a);
        if (idx !== -1) arrowMarkersRef.current.splice(idx, 1);
      });
      blinkArrowsRef.current = [];
      // 이전 원래 폴리라인 복원
      if (blinkOriginalPolylineRef.current) {
        const { polyline: prevPl, color: prevColor } = blinkOriginalPolylineRef.current;
        prevPl.setOptions({ strokeColor: prevColor, strokeWeight: 6, strokeOpacity: 1, zIndex: 0 });
        blinkOriginalPolylineRef.current = null;
      }
    };
    cleanupBlink();

    // 초록 깜박임용 임시 폴리라인 별도 생성
    const coords: { lat: number; lng: number }[] = [];
    try {
      const path = (polyline as any).getPath();
      if (path && path.getLength) {
        for (let i = 0; i < path.getLength(); i++) {
          const pt = path.getAt(i);
          coords.push({ lat: pt.lat(), lng: pt.lng() });
        }
      }
    } catch {}
    if (coords.length < 2) {
      coords.push({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
    }

    // 원래 폴리라인 숨기고 ref로 추적
    polyline.setOptions({ strokeOpacity: 0 });
    blinkOriginalPolylineRef.current = { polyline, color: originalColor };

    // 임시 초록 폴리라인 생성 후 ref로 추적
    blinkPolylineRef.current = new naver.maps.Polyline({
      map,
      path: coords.map(c => new naver.maps.LatLng(c.lat, c.lng)),
      strokeColor: '#1b5e20',
      strokeWeight: 8,
      strokeOpacity: 1,
      zIndex: 100,
    });

    // 깜박임 화살표 ref로 추적
    const countBefore = arrowMarkersRef.current.length;
    placeArrows(coords, null, map, naver);
    blinkArrowsRef.current = arrowMarkersRef.current.slice(countBefore);

    let visible = true;
    blinkIntervalRef.current = setInterval(() => {
      visible = !visible;
      if (blinkPolylineRef.current) blinkPolylineRef.current.setOptions({ strokeOpacity: visible ? 1 : 0 });
      blinkArrowsRef.current.forEach(a => a.setMap(visible ? map : null));
    }, 300);

    // 5초 후 원래대로
    blinkRestoreRef.current = setTimeout(() => {
      cleanupBlink();
    }, 5000);
  };

  // ★ PDF 보고서 생성
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  const handleGenerateReport = async () => {
    if (!route || isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      // jsPDF + html2canvas 동적 로드 (script 태그 방식)
      await Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      ]);
      const jsPDF = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
      const html2canvas = (window as any).html2canvas;
      if (!jsPDF || !html2canvas) throw new Error('라이브러리 로드 실패');

      // 보고서 HTML 컨테이너 생성
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed; top: -9999px; left: -9999px;
        width: 794px; background: #ffffff; font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        padding: 0px; box-sizing: border-box;
      `;

      const donePoints = route.points.filter(p => p.source !== 'fixed');
      const totalCount = donePoints.length;
      const doneCount = donePoints.filter(p => {
        const st = statusesRef.current[statusKey(p)];
        return st && ['민원처리완료','기처리','확인불가'].includes(st.status);
      }).length;

      // ── 헤더 ──────────────────────────────────────────────
      container.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a3a6e 0%, #1565c0 100%); padding: 20px 28px; margin-bottom: 6px;">
          <div style="color: white; font-size: 20px; font-weight: bold; margin-bottom: 4px;">불법 옥외광고물 순회 단속 결과</div>
          <div style="color: rgba(200,230,255,0.9); font-size: 12px;">
            단속일자: ${route.date} &nbsp;|&nbsp; 버전: ${route.version} &nbsp;|&nbsp; 총 지점: ${totalCount}개 &nbsp;|&nbsp; 처리완료: ${doneCount}개
          </div>
        </div>
        <div style="background:#e8edf2; padding:6px 28px 16px; margin-bottom:20px; font-size:11px; color:#555;">
          ※ 본 문서는 패트롤 옵티마이저 앱으로 자동 생성된 순회 단속 결과 보고서입니다.
        </div>
      `;

      // ── 표 헤더 ──────────────────────────────────────────
      const cellStyle = (w: string, center = false) =>
        `style="width:${w}; padding:7px 6px; border:1px solid #b0bec5; font-size:11px; vertical-align:middle; ${center ? 'text-align:center;' : ''}"`;

      const tableHtml = `
        <table style="width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:24px;">
          <colgroup>
            <col style="width:5%"/>   <!-- 순회순번 -->
            <col style="width:7%"/>   <!-- 민원번호 -->
            <col style="width:18%"/>  <!-- 주소 -->
            <col style="width:13%"/>  <!-- 민원내용 -->
            <col style="width:8%"/>   <!-- 담당자 -->
            <col style="width:10%"/>  <!-- 작업상태 -->
            <col style="width:13%"/>  <!-- 작업메모 -->
            <col style="width:26%"/>  <!-- 현장사진 -->
          </colgroup>
          <thead>
            <tr style="background:#1a3a6e; color:white;">
              <th style="padding:8px 4px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">순회<br/>순번</th>
              <th style="padding:8px 4px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">민원<br/>번호</th>
              <th style="padding:8px 6px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">주소 (목적지)</th>
              <th style="padding:8px 6px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">민원내용</th>
              <th style="padding:8px 4px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">담당자</th>
              <th style="padding:8px 4px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">작업상태</th>
              <th style="padding:8px 6px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">작업메모</th>
              <th style="padding:8px 6px; border:1px solid #1565c0; font-size:11px; text-align:center; font-weight:bold;">현장사진</th>
            </tr>
          </thead>
          <tbody>
            ${donePoints.map((point, idx) => {
              const st = statusesRef.current[statusKey(point)];
              const isDone = st && ['민원처리완료','기처리','확인불가'].includes(st.status);
              const rowBg = idx % 2 === 0 ? '#ffffff' : '#f5f8fb';
              const statusColor = isDone ? '#2e7d32' : '#e65100';
              const statusText = st?.status || '미완료';
              const addrText = point.address + (point.destination ? `\n(${point.destination})` : '');
              const photoHtml = point.photoUrl
                ? `<img src="${point.photoUrl}" style="max-width:100%; max-height:120px; object-fit:contain; display:block; margin:0 auto;" crossorigin="anonymous" />${point.photoDescription ? `<div style="font-size:9px; color:#666; margin-top:3px; text-align:center;">${point.photoDescription}</div>` : ''}`
                : '<div style="color:#aaa; font-size:10px; text-align:center;">사진 없음</div>';

              return `
                <tr style="background:${rowBg};">
                  <td style="padding:8px 4px; border:1px solid #cfd8dc; font-size:13px; font-weight:bold; text-align:center; color:#1a3a6e;">${point.order}</td>
                  <td style="padding:8px 4px; border:1px solid #cfd8dc; font-size:12px; font-weight:bold; text-align:center;">${point.originalId ? point.originalId + '번' : '-'}</td>
                  <td style="padding:8px 6px; border:1px solid #cfd8dc; font-size:11px; word-break:break-all;">${point.address}${point.destination ? '<br/><span style="color:#1565c0;">(' + point.destination + ')</span>' : ''}</td>
                  <td style="padding:8px 6px; border:1px solid #cfd8dc; font-size:11px;">${point.complaint || '-'}</td>
                  <td style="padding:8px 4px; border:1px solid #cfd8dc; font-size:11px; text-align:center;">${point.manager || '-'}</td>
                  <td style="padding:8px 4px; border:1px solid #cfd8dc; font-size:12px; font-weight:bold; text-align:center; color:${statusColor};">${statusText}</td>
                  <td style="padding:8px 6px; border:1px solid #cfd8dc; font-size:11px;">${st?.memo || '-'}</td>
                  <td style="padding:6px; border:1px solid #cfd8dc; text-align:center; vertical-align:middle;">${photoHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML += tableHtml;
      document.body.appendChild(container);

      // html2canvas → jsPDF
      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;

      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -y, pdfW, imgH);
        y += pdfH;
      }

      pdf.save(`순회보고서_${route.date}_버전${route.version}.pdf`);
    } catch (e) {
      console.error('PDF 생성 오류:', e);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ★ 내 위치 추적 시작/중지 토글
  const toggleTracking = () => {
    const naver = (window as any).naver;
    const map = naverMapRef.current;
    if (!naver || !map) return;

    if (isTracking) {
      // 추적 중지
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.setMap(null);
        myLocationMarkerRef.current = null;
      }
      if (myLocationCircleRef.current) {
        myLocationCircleRef.current.setMap(null);
        myLocationCircleRef.current = null;
      }
      setIsTracking(false);
    } else {
      // 추적 시작
      if (!navigator.geolocation) {
        alert('이 기기는 GPS를 지원하지 않습니다.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const latlng = new naver.maps.LatLng(latitude, longitude);

          // 내 위치 마커 생성
          myLocationMarkerRef.current = new naver.maps.Marker({
            map,
            position: latlng,
            icon: {
              content: `<div style="
                width:16px;height:16px;border-radius:50%;
                background:#1976d2;border:3px solid white;
                box-shadow:0 0 0 2px rgba(25,118,210,0.4);
                position:relative;z-index:1;
              "></div>`,
              anchor: new naver.maps.Point(8, 8),
            },
            zIndex: 200,
          });

          // 정확도 원 생성
          myLocationCircleRef.current = new naver.maps.Circle({
            map,
            center: latlng,
            radius: accuracy,
            fillColor: 'rgba(25,118,210,0.12)',
            fillOpacity: 1,
            strokeColor: 'rgba(25,118,210,0.35)',
            strokeWeight: 1,
          });

          // 버튼 탭 시 내 위치로 화면 이동
          map.setCenter(latlng);

          setIsTracking(true);

          // 이후 위치 변경 감시
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              const { latitude, longitude, accuracy } = pos.coords;
              const latlng = new naver.maps.LatLng(latitude, longitude);
              myLocationMarkerRef.current?.setPosition(latlng);
              myLocationCircleRef.current?.setCenter(latlng);
              myLocationCircleRef.current?.setRadius(accuracy);
            },
            (err) => console.warn('위치 감시 오류:', err),
            { enableHighAccuracy: true, maximumAge: 3000 }
          );
        },
        (err) => {
          console.warn('위치 조회 실패:', err);
          alert('위치 정보를 가져올 수 없습니다. GPS 권한을 확인해주세요.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  // ★ 팝업에서 사용할 완료 상태 정보
  const getSelectedStatus = () => {
    if (!selectedPoint) return { curStatus: '', curMemo: '', isDone: false };
    const st = statuses[statusKey(selectedPoint)];
    const curStatus = st?.status || '';
    const curMemo = st?.memo || '';
    const isDone = DONE_STATUSES.includes(curStatus);
    return { curStatus, curMemo, isDone };
  };



  // 작업상태 저장 (자동저장 - 카드리스트와 동일 방식)
  const handleSaveStatus = async (status: string, memo: string) => {
    if (!selectedPoint || !route) return;
    setSavingStatus(true);
    try {
      await fetch('/api/save-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: route.date,
          address: selectedPoint.address,
          destination: selectedPoint.destination,
          complaint: selectedPoint.complaint?.trim() ?? '',
          originalId: selectedPoint.originalId ?? null,
          status,
          memo,
        }),
      });
      // 로컬 반영
      const key = statusKey(selectedPoint);
      setStatuses(prev => ({
        ...prev,
        [key]: { status, memo, updatedAt: Date.now() },
      }));
      statusesRef.current = {
        ...statusesRef.current,
        [key]: { status, memo, updatedAt: Date.now() },
      };
    } catch {}
    setSavingStatus(false);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0d1b2e', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 헤더 */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1a3a6e 0%, #0d2444 100%)',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(100,180,255,0.3)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              flexShrink: 0,
            }}>
            ← 카드 리스트
          </button>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>순회 경로 지도</div>
        </div>
        {route && (
          <div style={{ color: 'rgba(150,200,255,0.85)', fontSize: '11px', textAlign: 'right' }}>
            {route.date} · 버전{route.version} · {route.points.filter(p => p.source !== 'fixed').length}개 지점
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.25)' }}>
            <button
              onClick={() => setLineMode('straight')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                border: 'none',
                background: lineMode === 'straight' ? 'rgba(100,180,255,0.4)' : 'rgba(255,255,255,0.08)',
                color: lineMode === 'straight' ? 'white' : 'rgba(255,255,255,0.5)',
              }}>직선</button>
            <button
              onClick={() => setLineMode('road')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.25)',
                background: lineMode === 'road' ? 'rgba(100,180,255,0.4)' : 'rgba(255,255,255,0.08)',
                color: lineMode === 'road' ? 'white' : 'rgba(255,255,255,0.5)',
              }}>도로</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF6B35', border: '1px solid white' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>미완료</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#1565c0', border: '1px solid white' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>완료</span>
            </div>
            {/* 보고서 버튼 */}
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || !route}
              style={{
                background: isGeneratingReport ? 'rgba(100,100,100,0.5)' : 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.35)',
                color: 'white', fontSize: '10px', fontWeight: 'bold',
                padding: '3px 8px', borderRadius: '12px',
                cursor: isGeneratingReport ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '3px',
                flexShrink: 0,
              }}>
              {isGeneratingReport ? (
                <>⏳ 생성중</>
              ) : (
                <><svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M6 0H1C0.45 0 0 0.45 0 1V11C0 11.55 0.45 12 1 12H9C9.55 12 10 11.55 10 11V4L6 0ZM8.5 10.5H1.5V1.5H5.5V4.5H8.5V10.5Z"/></svg>보고서</>
              )}
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(150,200,255,0.8)', fontSize: '14px' }}>
          경로 불러오는 중...
        </div>
      )}

      {!isLoading && !route && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(150,200,255,0.8)', fontSize: '14px' }}>
          오늘 생성된 경로가 없습니다.
        </div>
      )}

      {/* 지도 */}
      <div ref={mapRef} style={{ flex: 1, width: '100%' }} />

      {/* 도로 모드 로딩 안내 */}
      {lineMode === 'road' && routeDrawn === false && route && mapReady && !osrmError && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '12px',
          padding: '6px 14px', borderRadius: '20px',
        }}>
          도로 경로 계산 중...
        </div>
      )}

      {/* ORS 도로 경로 로딩 메시지 - 초록색, 화면 중앙 */}
      {roadLoading && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(27,94,32,0.92)',
          color: 'white', fontSize: '13px', fontWeight: 'bold',
          padding: '12px 24px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap', zIndex: 300,
        }}>
          <span style={{ fontSize: '16px' }}>🛣️</span>
          <span>도로 경로를 불러오는 중...</span>
        </div>
      )}

      {/* OSRM 서버 오류 배너 - 하단 표시, 직선 모드 선택시 숨김 */}
      {lineMode === 'road' && osrmError && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(160,30,10,0.92)', color: 'white',
          fontSize: '12px', padding: '7px 14px', borderRadius: '20px',
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
          zIndex: 200,
        }}>
          <span>⚠️</span>
          <span>도로 경로 서버(OSRM·ORS) 모두 응답 없음 — 직선으로 표시합니다</span>
        </div>
      )}

      {/* 새 경로 알림 배너 */}
      {newRouteAvailable && (
        <div
          onClick={() => window.location.reload()}
          style={{
            position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(21,101,192,0.95)', color: 'white',
            fontSize: '12px', fontWeight: 'bold',
            padding: '8px 18px', borderRadius: '20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap', zIndex: 300, cursor: 'pointer',
          }}>
          <span>🔄</span>
          <span>새 경로가 생성되었습니다 — 탭하여 갱신</span>
        </div>
      )}

      {/* ★ 겹침 목록 팝업 */}
      {showOverlapModal && overlappingPoints.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 50, background: 'rgba(0,0,0,0.6)',
          }}
          onClick={() => setShowOverlapModal(false)}>
          <div
            style={{
              background: '#1a3a6e', borderRadius: '12px', padding: '20px',
              width: '88%', maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', margin: 0 }}>
                📍 같은 위치 {overlappingPoints.length}개 지점
              </h2>
              <span style={{ color: 'white', cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setShowOverlapModal(false)}>✕</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {overlappingPoints.map((p) => {
                const st = statuses[statusKey(p)];
                const isDone = st && DONE_STATUSES.includes(st.status);
                return (
                  <div
                    key={p.order}
                    onClick={() => { setShowOverlapModal(false); setSelectedPoint(p); setShowDetailModal(true); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: isDone ? 'rgba(255,255,255,0.12)' : 'rgba(235,100,0,0.45)',
                      borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
                    }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: isDone ? '#1565c0' : '#FF6B35',
                      border: '2px solid white', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 'bold', fontSize: '12px',
                    }}>{p.order}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.destination ? `${p.address} (${p.destination})` : p.address}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '2px' }}>
                        {p.complaint || '-'}
                        {st?.status && <span style={{ color: '#80cbc4', marginLeft: '8px', fontWeight: 'bold' }}>{st.status}</span>}
                      </div>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>›</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ★ 내 위치 추적 버튼 - 우측 하단 */}
      {!showDetailModal && !showOverlapModal && (
        <button
          onClick={toggleTracking}
          title={isTracking ? '위치 추적 중지' : '내 위치 보기'}
          style={{
            position: 'absolute',
            bottom: 52,
            right: 12,
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: isTracking ? '#1976d2' : 'rgba(255,255,255,0.95)',
            border: isTracking ? '2px solid white' : '2px solid rgba(100,150,255,0.4)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 150,
            transition: 'background 0.2s',
          }}>
          {isTracking ? (
            // 추적 중 - 흰색 위치 아이콘
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          ) : (
            // 추적 꺼짐 - 파란색 위치 아이콘
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1976d2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          )}
        </button>
      )}

      {/* 줌 안내 토스트 - 팝업 없을 때만 표시 */}
      {routeDrawn && !showDetailModal && !showOverlapModal && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: 'rgba(200,230,255,0.85)',
          fontSize: '11px', padding: '5px 12px', borderRadius: '20px',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          확대하면 지점 마커 표시 · 더 확대하면 마커 클릭으로 상세정보 확인
        </div>
      )}

      {/* ★ 지점 상세정보 팝업 */}
      {showDetailModal && selectedPoint && (() => {
        const { curStatus, curMemo, isDone } = getSelectedStatus();
        const popupBg = curStatus && DONE_STATUSES.includes(curStatus) ? '#1a3a6e' : '#7a2800';
        return (
          <div
            style={{
              position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 50, background: 'rgba(0,0,0,0.6)',
            }}
            onClick={() => setShowDetailModal(false)}>
            <div
              style={{
                background: popupBg, borderRadius: '12px', padding: '20px',
                width: '88%', maxWidth: '400px', maxHeight: '90vh',
                overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}>

              {/* 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, minWidth: 0 }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'white', color: '#1a3a6e',
                    fontSize: '13px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {selectedPoint.order}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedPoint.destination
                      ? `${selectedPoint.address} (${selectedPoint.destination})`
                      : selectedPoint.address}
                  </span>
                </h2>
                <span
                  style={{ color: 'white', cursor: 'pointer', fontSize: '18px', flexShrink: 0, marginLeft: '8px' }}
                  onClick={() => setShowDetailModal(false)}>✕</span>
              </div>

              {/* 정보 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: '주소', value: selectedPoint.address || '' },
                  { label: '목적지', value: selectedPoint.destination || '' },
                  { label: '좌표확인', value:
                    selectedPoint.source === 'place_single' || selectedPoint.source === 'place_nearest'
                      ? '✅ 목적지로 위치 확인'
                      : selectedPoint.source === 'address'
                      ? '📍 주소로 위치 확인'
                      : '❌ 위치 미확인' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '2px' }}>{label}</span>
                    <span style={{ color: 'white', fontSize: '11px', flex: 1 }}>{value}</span>
                  </div>
                ))}

                {/* 좌표확인 아래 수평선 */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '2px', marginBottom: '2px' }} />

                {[
                  { label: '민원번호', value: selectedPoint.originalId ? `${selectedPoint.originalId}번` : '' },
                  { label: '민원내용', value: selectedPoint.complaint || '' },
                  { label: '담당자', value: selectedPoint.manager || '' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '2px' }}>{label}</span>
                    <span style={{ color: 'white', fontSize: '11px', flex: 1 }}>{value}</span>
                  </div>
                ))}

                {/* 현장사진 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '2px' }}>현장사진</span>
                  <div style={{ flex: 1 }}>
                    {selectedPoint.photoUrl ? (
                      <img src={selectedPoint.photoUrl} alt="현장사진" style={{ width: '100%', borderRadius: '6px' }} />
                    ) : (
                      <div style={{
                        borderRadius: '6px', height: '80px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)',
                      }}>
                        <span style={{ color: '#90caf9', fontSize: '11px' }}>사진 없음</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 사진설명 - 레이블 없이 값만 표시 */}
                {selectedPoint.photoDescription && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ width: '60px', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', flex: 1 }}>{selectedPoint.photoDescription}</span>
                  </div>
                )}

                {/* 작업상태 - 관리자: 자동저장 / 일반: 읽기전용 */}
                <div style={{ marginTop: '4px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                  {isAdmin ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0 }}>작업상태</span>
                        <select
                          value={curStatus}
                          onChange={e => handleSaveStatus(e.target.value, curMemo)}
                          disabled={savingStatus}
                          style={{
                            flex: 1, background: isDone ? 'rgba(255,255,255,0.15)' : 'rgba(235,100,0,0.65)', color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px',
                            padding: '4px 8px', fontSize: '12px', fontWeight: 'bold',
                          }}>
                          <option value="" style={{ background: '#1a3a6e', color: 'white' }}>선택 (미완료)</option>
                          <option value="민원처리완료" style={{ background: '#1a3a6e', color: 'white' }}>민원처리완료</option>
                          <option value="기처리" style={{ background: '#1a3a6e', color: 'white' }}>기처리</option>
                          <option value="확인불가" style={{ background: '#1a3a6e', color: 'white' }}>확인불가</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                        <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '6px' }}>작업메모</span>
                        <textarea
                          rows={2}
                          placeholder="메모 입력..."
                          defaultValue={curMemo}
                          onBlur={(e) => { if (e.target.value !== curMemo) handleSaveStatus(curStatus, e.target.value); }}
                          style={{
                            flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px',
                            padding: '4px 8px', fontSize: '12px', resize: 'none',
                          }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '2px' }}>작업상태</span>
                        <span style={{ color: '#80cbc4', fontSize: '11px', fontWeight: 'bold' }}>{curStatus}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '2px' }}>작업메모</span>
                        <span style={{ color: 'white', fontSize: '11px', flex: 1 }}>{curMemo}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 티맵 / 네이버지도 / 타임마크 버튼 - 맨 아래 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                {/* 타임마크 카메라 버튼 */}
                <button
                  onClick={() => window.location.href = 'timemarkcamera://'}
                  title="타임마크 촬영"
                  style={{
                    background: '#f9d835', width: '48px', flexShrink: 0,
                    borderRadius: '8px', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <svg width="24" height="22" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z" fill="#1a1a1a"/>
                    <circle cx="12" cy="12" r="3.5" fill="#1a1a1a"/>
                  </svg>
                </button>
                <button
                  onClick={() => window.open(`tmap://route?goalname=${encodeURIComponent(selectedPoint.destination || selectedPoint.address)}&goaly=${selectedPoint.lat}&goalx=${selectedPoint.lng}`)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    background: '#0a3d8f', color: 'white',
                    fontSize: '14px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                  }}>티맵</button>
                <button
                  onClick={() => window.open(`nmap://navigation?dlat=${selectedPoint.lat}&dlng=${selectedPoint.lng}&dname=${encodeURIComponent(selectedPoint.destination || selectedPoint.address)}&appname=patrol-optimizer`)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    background: '#1b5e20', color: 'white',
                    fontSize: '14px', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                  }}>네이버지도</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
