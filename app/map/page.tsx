'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdditionalPointModal, { type InsertOption } from '@/app/components/AdditionalPointModal';

type RoutePoint = {
  order: number;
  address: string;
  destination: string | null;
  complaint: string;
  lat: number;
  lng: number;
  placeName: string | null;
  source: string | null;
  coordMessage?: string | null;
  originalId?: number | null;
  photoDescription?: string | null;
  photoUrl?: string | null;
  manager?: string | null;
};

type AdditionalPoint = {
  id: number;
  address: string;
  destination: string;
  complaint: string;
  manager: string;
  photoUrl: string;
  lat?: number | null;
  lng?: number | null;
  placeName?: string | null;
  source?: string | null;
  coordMessage?: string | null;
  isAdditional: true;
  insertAfterOrder?: number | string | null; // ★ "add_${id}" 형식으로 추가지점 참조 가능
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
  const [is3D, setIs3D] = useState(false);
  const [showMapHelpModal, setShowMapHelpModal] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkRestoreRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkPolylineRef = useRef<any>(null);
  const blinkArrowsRef = useRef<any[]>([]);
  const blinkOriginalPolylineRef = useRef<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // ★ 추가 지점 (localStorage에서 로드)
  const [additionalPoints, setAdditionalPoints] = useState<AdditionalPoint[]>([]);
  const additionalPointsRef = useRef<AdditionalPoint[]>([]);
  const additionalMarkersRef = useRef<naver.maps.Marker[]>([]);
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [selectedAdditional, setSelectedAdditional] = useState<AdditionalPoint | null>(null);
  // ★ 지도뷰 추가지점 입력 팝업
  const [showMapAddModal, setShowMapAddModal] = useState(false);
  const [mapAddForm, setMapAddForm] = useState<{ address: string; destination: string; complaint: string; manager: string; insertAfterOrder: number | null }>({ address: '', destination: '', complaint: '', manager: '', insertAfterOrder: null });
  const [mapAddCoordStatus, setMapAddCoordStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [mapAddCoord, setMapAddCoord] = useState<{ lat: number|null; lng: number|null; placeName: string|null; source: string|null; coordMessage: string|null }>({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });
  const [mapAddSaving, setMapAddSaving] = useState(false);

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
    // additionalPoints Redis API로 로드 (localStorage는 기기간 공유 안 됨)
    const loadAdditionalPoints = async () => {
      try {
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
        const res = await fetch(`/api/get-additional?date=${today}`);
        if (res.ok) {
          const data = await res.json();
          if (data.points?.length > 0) {
            setAdditionalPoints(data.points);
            additionalPointsRef.current = data.points;
            console.log('[additional] Redis에서 추가지점 로드:', data.points.length, '개');
          }
        }
      } catch (e) {
        // Redis 실패 시 localStorage fallback
        try {
          const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
          if (draft.additionalPoints?.length > 0) {
            setAdditionalPoints(draft.additionalPoints);
            additionalPointsRef.current = draft.additionalPoints;
            console.log('[additional] localStorage fallback:', draft.additionalPoints.length, '개');
          }
        } catch {}
      }
    };
    loadAdditionalPoints();
  }, []);
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
      heading: 0,
      rotateControl: false,
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

  // 5-3. additionalPoints 변경 시 마커 재렌더링
  useEffect(() => {
    if (!naverMapRef.current) return;
    drawAdditionalMarkers(additionalPoints);
  }, [additionalPoints, routeDrawn]);

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

  // 7. 위성/일반 지도 토글
  const toggle3D = () => {
    const map = naverMapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    const naver = (window as any).naver;
    (map as any).setMapTypeId(next ? naver.maps.MapTypeId.HYBRID : naver.maps.MapTypeId.NORMAL);
  };

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
          content: makeMarkerContent(point, color, showPulse, zoom),
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

    // 추가지점 마커 가시성 업데이트
    updateAdditionalMarkersVisibility(zoom);

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

  const getLineColor = (fromPoint: RoutePoint, toPoint: RoutePoint) => {
    // toPoint가 fixed(종점)이면 fromPoint 완료 여부로 결정
    if (toPoint.source === 'fixed') {
      const fromSt = statusesRef.current[statusKey(fromPoint)];
      return fromSt && DONE_STATUSES.includes(fromSt.status) ? '#1565c0' : '#FF6B35';
    }
    // fromPoint가 fixed(기점)이면 toPoint 완료 여부로 결정 (일반 로직과 동일)
    const toSt = statusesRef.current[statusKey(toPoint)];
    return toSt && DONE_STATUSES.includes(toSt.status) ? '#1565c0' : '#FF6B35';
  };

  // ★ 추가지점 경로선 색상 결정 (추가지점 완료 + toPoint 완료 모두 체크)
  const getAdditionalLineColor = (point: AdditionalPoint, isFromSegment: boolean, toPoint?: RoutePoint) => {
    const addrPart = point.address?.trim() || point.destination?.trim() || '';
    const key = `${addrPart}:${(point.complaint || '').trim()}:none`;
    const addSt = statusesRef.current[key];
    const addDone = addSt && DONE_STATUSES.includes(addSt.status);
    if (isFromSegment) {
      // fromPoint → A1 구간: A1 완료 여부
      return addDone ? '#1565c0' : '#FF6B35';
    } else {
      // A1 → toPoint 구간: A1 완료 + toPoint 완료 모두 되어야 파란색
      if (!addDone) return '#FF6B35';
      if (toPoint) {
        const toSt = statusesRef.current[statusKey(toPoint)];
        return toSt && DONE_STATUSES.includes(toSt.status) ? '#1565c0' : '#FF6B35';
      }
      return '#FF6B35';
    }
  };

  // ★ 추가 지점 마름모 마커 콘텐츠 생성
  // ★ 추가지점 마커 애니메이션 CSS 삽입
  useEffect(() => {
    if (document.getElementById('additional-marker-style')) return;
    const style = document.createElement('style');
    style.id = 'additional-marker-style';
    style.textContent = `
      @keyframes additional-pulse {
        0%   { transform: scale(1) rotate(0deg);   opacity: 0.9; }
        50%  { transform: scale(1.15) rotate(5deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg);   opacity: 0.9; }
      }
      .additional-marker-anim {
        animation: additional-pulse 2s ease-in-out infinite;
        display: block;
      }
    `;
    document.head.appendChild(style);
  }, []);
  const additionalMarkerUrlsRef = useRef<Record<string, string>>({});

  const getAdditionalMarkerUrl = (label: string, isDone: boolean): string => {
    const cacheKey = `${label}_${isDone}`;
    if (additionalMarkerUrlsRef.current[cacheKey]) {
      return additionalMarkerUrlsRef.current[cacheKey];
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return '';
    const size = 48;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = isDone ? '#7b1fa2' : '#f97316';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.font = `bold 11px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + 1);
      const url = canvas.toDataURL('image/png');
      additionalMarkerUrlsRef.current[cacheKey] = url;
      return url;
    } catch (e) {
      console.error('[additional] Canvas 마커 생성 실패:', e);
      return '';
    }
  };

  // ★ 추가 지점 마커 전체 그리기 + insertAfterOrder 경로선 연결
  const drawAdditionalMarkers = (points: AdditionalPoint[]) => {
    if (!naverMapRef.current) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;
    const showMarkers = currentZoomRef.current >= ZOOM_THRESHOLD;

    additionalMarkersRef.current.forEach(m => m.setMap(null));
    additionalMarkersRef.current = [];

    points.forEach((point, idx) => {
      if (!point.lat || !point.lng) return;

      const addrPart = point.address?.trim() || point.destination?.trim() || '';
      const key = `${addrPart}:${(point.complaint || '').trim()}:none`;
      const st = statusesRef.current[key];
      const isDone = !!(st && DONE_STATUSES.includes(st.status));
      const label = `A${idx + 1}`;
      const dataUrl = getAdditionalMarkerUrl(label, isDone);
      const name = (point.destination || point.address).slice(0, 10);

      // ★ content HTML + 애니메이션 — icon.url은 CSS 애니메이션 불가
      const marker = new naver.maps.Marker({
        map: showMarkers ? map : null,
        position: new naver.maps.LatLng(point.lat, point.lng),
        icon: {
          content: `<div style="position:relative;width:48px;height:56px;cursor:pointer;">
            <div style="position:absolute;bottom:50px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <img src="${dataUrl}" width="48" height="48" style="position:absolute;top:0;left:0;display:block;" class="additional-marker-anim" />
          </div>`,
          anchor: new naver.maps.Point(24, 24),
        },
        zIndex: 10,
      });

      naver.maps.Event.addListener(marker, 'click', () => {
        if (currentZoomRef.current >= PULSE_THRESHOLD) {
          setSelectedAdditional(point);
          setShowInsertModal(true);
        }
      });

      const startLongPress = () => {
        longPressTimerRef.current = setTimeout(() => {
          blinkAdditionalSegment(point);
        }, 700);
      };
      const cancelLongPress = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      };
      naver.maps.Event.addListener(marker, 'mousedown', startLongPress);
      naver.maps.Event.addListener(marker, 'mouseup', cancelLongPress);
      naver.maps.Event.addListener(marker, 'touchstart', startLongPress);
      naver.maps.Event.addListener(marker, 'touchend', cancelLongPress);

      additionalMarkersRef.current.push(marker);
    });

    drawAdditionalPolylines(points);
  };

  // ★ fromPoint → 추가지점 구간 blink (14번 롱프레스용)
  const blinkFromPointToAdditional = (fromPoint: RoutePoint, addPoint: AdditionalPoint) => {
    if (!naverMapRef.current || !addPoint.lat || !addPoint.lng) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;

    const cleanupBlink = () => {
      if (blinkIntervalRef.current) { clearInterval(blinkIntervalRef.current); blinkIntervalRef.current = null; }
      if (blinkRestoreRef.current) { clearTimeout(blinkRestoreRef.current); blinkRestoreRef.current = null; }
      if (blinkPolylineRef.current) { blinkPolylineRef.current.setMap(null); blinkPolylineRef.current = null; }
      blinkArrowsRef.current.forEach(a => {
        a.setMap(null);
        const i = arrowMarkersRef.current.indexOf(a);
        if (i !== -1) arrowMarkersRef.current.splice(i, 1);
      });
      blinkArrowsRef.current = [];
    };
    cleanupBlink();

    // 도로 모드: additionalPolylinesRef에서 fromPoint→A1 구간 경로 추출
    let coords: { lat: number; lng: number }[] = [];
    if (lineModeRef.current === 'road' && additionalPolylinesRef.current.length > 0) {
      // additionalPolylinesRef[0]이 fromPoint→A1, [1]이 A1→toPoint (순서 기반)
      const firstPl = additionalPolylinesRef.current[0];
      try {
        const path = (firstPl as any).getPath();
        if (path && path.getLength) {
          for (let i = 0; i < path.getLength(); i++) {
            const pt = path.getAt(i);
            coords.push({ lat: pt.lat(), lng: pt.lng() });
          }
        }
      } catch {}
    }
    // 직선 모드 또는 도로 경로 추출 실패 시 직선
    if (coords.length < 2) {
      coords = [
        { lat: fromPoint.lat, lng: fromPoint.lng },
        { lat: addPoint.lat!, lng: addPoint.lng! },
      ];
    }

    blinkPolylineRef.current = new naver.maps.Polyline({
      map,
      path: coords.map(c => new naver.maps.LatLng(c.lat, c.lng)),
      strokeColor: '#1b5e20',
      strokeWeight: 8,
      strokeOpacity: 1,
      zIndex: 100,
    });

    const countBefore = arrowMarkersRef.current.length;
    placeArrows(coords, null, map, naver);
    blinkArrowsRef.current = arrowMarkersRef.current.slice(countBefore);

    let visible = true;
    blinkIntervalRef.current = setInterval(() => {
      visible = !visible;
      if (blinkPolylineRef.current) blinkPolylineRef.current.setOptions({ strokeOpacity: visible ? 1 : 0 });
      blinkArrowsRef.current.forEach(a => a.setMap(visible ? map : null));
    }, 300);

    blinkRestoreRef.current = setTimeout(() => { cleanupBlink(); }, 5000);
  };

  // ★ 추가지점 경로선 초록 깜박임 (A1 롱프레스용) — A1→10번 구간만
  const blinkAdditionalSegment = (point: AdditionalPoint) => {
    if (!naverMapRef.current || !point.lat || !point.lng || point.insertAfterOrder == null) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;
    const routePoints = routeRef.current?.points ?? [];

    const toPoint = routePoints.find(p => p.order === (typeof point.insertAfterOrder === 'number' ? point.insertAfterOrder + 1 : -1));
    if (!toPoint) return;

    const cleanupBlink = () => {
      if (blinkIntervalRef.current) { clearInterval(blinkIntervalRef.current); blinkIntervalRef.current = null; }
      if (blinkRestoreRef.current) { clearTimeout(blinkRestoreRef.current); blinkRestoreRef.current = null; }
      if (blinkPolylineRef.current) { blinkPolylineRef.current.setMap(null); blinkPolylineRef.current = null; }
      blinkArrowsRef.current.forEach(a => {
        a.setMap(null);
        const i = arrowMarkersRef.current.indexOf(a);
        if (i !== -1) arrowMarkersRef.current.splice(i, 1);
      });
      blinkArrowsRef.current = [];
    };
    cleanupBlink();

    // 도로 모드: additionalPolylinesRef[1]이 A1→toPoint 구간 경로
    let coords: { lat: number; lng: number }[] = [];
    if (lineModeRef.current === 'road' && additionalPolylinesRef.current.length > 1) {
      const secondPl = additionalPolylinesRef.current[1];
      try {
        const path = (secondPl as any).getPath();
        if (path && path.getLength) {
          for (let i = 0; i < path.getLength(); i++) {
            const pt = path.getAt(i);
            coords.push({ lat: pt.lat(), lng: pt.lng() });
          }
        }
      } catch {}
    }
    // 직선 모드 또는 경로 추출 실패
    if (coords.length < 2) {
      coords = [
        { lat: point.lat!, lng: point.lng! },
        { lat: toPoint.lat, lng: toPoint.lng },
      ];
    }

    blinkPolylineRef.current = new naver.maps.Polyline({
      map,
      path: coords.map(c => new naver.maps.LatLng(c.lat, c.lng)),
      strokeColor: '#1b5e20',
      strokeWeight: 8,
      strokeOpacity: 1,
      zIndex: 100,
    });

    const countBefore = arrowMarkersRef.current.length;
    placeArrows(coords, null, map, naver);
    blinkArrowsRef.current = arrowMarkersRef.current.slice(countBefore);

    let visible = true;
    blinkIntervalRef.current = setInterval(() => {
      visible = !visible;
      if (blinkPolylineRef.current) blinkPolylineRef.current.setOptions({ strokeOpacity: visible ? 1 : 0 });
      blinkArrowsRef.current.forEach(a => a.setMap(visible ? map : null));
    }, 300);

    blinkRestoreRef.current = setTimeout(() => { cleanupBlink(); }, 5000);
  };

  // ★ 추가지점 경로선 연결 (insertAfterOrder 기반)
  // hiddenPolylinesRef: 추가지점 삽입으로 숨겨진 기존 경로선 인덱스 추적
  const hiddenPolylinesRef = useRef<number[]>([]);
  const additionalPolylinesRef = useRef<naver.maps.Polyline[]>([]);
  const additionalArrowMarkersRef = useRef<naver.maps.Marker[]>([]); // ★ 추가지점 화살표 별도 추적

  const drawAdditionalPolylines = (points: AdditionalPoint[]) => {
    if (!naverMapRef.current || !routeRef.current) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;
    const routePoints = routeRef.current.points;

    console.log('[additional] drawAdditionalPolylines 호출 - 추가지점:', points.length, '/ polylinesRef:', polylinesRef.current.length);

    // 기존 추가지점 경로선 + 화살표 정리
    additionalPolylinesRef.current.forEach(p => p.setMap(null));
    additionalPolylinesRef.current = [];
    additionalArrowMarkersRef.current.forEach(a => {
      a.setMap(null);
      const i = arrowMarkersRef.current.indexOf(a);
      if (i !== -1) arrowMarkersRef.current.splice(i, 1);
    });
    additionalArrowMarkersRef.current = [];

    // 이전에 숨겼던 기존 경로선 복원
    hiddenPolylinesRef.current.forEach(idx => {
      const pl = polylinesRef.current[idx];
      if (pl) pl.setMap(map);
    });
    hiddenPolylinesRef.current = [];

    const isRoadMode = lineModeRef.current === 'road';

    // ★ "add_X"를 insertAfterOrder로 사용하는 추가지점들의 prevAdd id 집합
    // → prevAdd는 자신의 →toPoint 구간선을 그리면 안 됨 (뒤에 오는 추가지점이 대신 연결)
    const prevAddIds = new Set<number>();
    points.forEach(p => {
      if (typeof p.insertAfterOrder === 'string' && p.insertAfterOrder.startsWith('add_')) {
        prevAddIds.add(parseInt(p.insertAfterOrder.replace('add_', '')));
      }
    });

    // ★ 앞 지점이 route point인 추가지점부터 처리 후, add_X 참조 추가지점 처리
    const sortedPoints = [...points].sort((a, b) => {
      const aIsAfterAdd = typeof a.insertAfterOrder === 'string';
      const bIsAfterAdd = typeof b.insertAfterOrder === 'string';
      if (aIsAfterAdd && !bIsAfterAdd) return 1;
      if (!aIsAfterAdd && bIsAfterAdd) return -1;
      return 0;
    });

    sortedPoints.forEach(point => {
      if (!point.lat || !point.lng || point.insertAfterOrder == null) return;

      const isAfterAdditional = typeof point.insertAfterOrder === 'string' && (point.insertAfterOrder as string).startsWith('add_');

      let fromLat: number;
      let fromLng: number;
      let toPoint: RoutePoint | undefined;

      if (isAfterAdditional) {
        // ★ 앞 지점이 추가지점인 경우 — "add_${id}" 파싱
        const prevAddId = parseInt((point.insertAfterOrder as string).replace('add_', ''));
        const prevAdd = points.find(p => p.id === prevAddId);
        if (!prevAdd?.lat || !prevAdd?.lng) return;
        fromLat = prevAdd.lat!;
        fromLng = prevAdd.lng!;
        // toPoint: prevAdd의 insertAfterOrder 기준으로 다음 route point 찾기
        if (typeof prevAdd.insertAfterOrder === 'number') {
          toPoint = routePoints.find(p => p.order === (prevAdd.insertAfterOrder as number) + 1);
          // ★ prevAdd(A2)의 기존 route 경로선(A2→15) 숨기기
          const prevAddFromIdx = routePoints.findIndex(p => p.order === (prevAdd.insertAfterOrder as number));
          if (prevAddFromIdx >= 0 && prevAddFromIdx < polylinesRef.current.length) {
            const existingPl = polylinesRef.current[prevAddFromIdx];
            if (existingPl) {
              existingPl.setMap(null);
              if (!hiddenPolylinesRef.current.includes(prevAddFromIdx)) {
                hiddenPolylinesRef.current.push(prevAddFromIdx);
              }
            }
          }
        } else if (typeof prevAdd.insertAfterOrder === 'string') {
          const prevPrevId = parseInt((prevAdd.insertAfterOrder as string).replace('add_', ''));
          const prevPrevAdd = points.find(p => p.id === prevPrevId);
          if (prevPrevAdd && typeof prevPrevAdd.insertAfterOrder === 'number') {
            toPoint = routePoints.find(p => p.order === (prevPrevAdd.insertAfterOrder as number) + 1);
          }
        }
      } else {
        // ★ 앞 지점이 일반 route point인 경우 (기존 로직)
        const fromOrder = point.insertAfterOrder as number;
        const toOrder = fromOrder + 1;
        const fromIdx = routePoints.findIndex(p => p.order === fromOrder);
        if (fromIdx >= 0 && fromIdx < polylinesRef.current.length) {
          const existingPl = polylinesRef.current[fromIdx];
          if (existingPl) {
            existingPl.setMap(null);
            if (!hiddenPolylinesRef.current.includes(fromIdx)) {
              hiddenPolylinesRef.current.push(fromIdx);
            }
          }
        }
        const fromPoint = routePoints.find(p => p.order === fromOrder);
        if (!fromPoint) return;
        fromLat = fromPoint.lat;
        fromLng = fromPoint.lng;
        toPoint = routePoints.find(p => p.order === toOrder);
      }

      const addLat = point.lat!;
      const addLng = point.lng!;

      if (isRoadMode) {
        const drawRoadSegments = async () => {
          const segPairs = [];
          segPairs.push({ fromLng, fromLat, toLng: addLng, toLat: addLat });
          // ★ 이 추가지점이 다른 추가지점의 앞 지점으로 쓰이면 →toPoint 구간 생략
          if (toPoint && !prevAddIds.has(point.id)) segPairs.push({ fromLng: addLng, fromLat: addLat, toLng: toPoint.lng, toLat: toPoint.lat });

          try {
            const res = await fetch('/api/ors-route', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: routeRef.current?.date ?? '',
                version: `additional_${point.id}`,
                segments: segPairs,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.results?.length) {
                data.results.forEach((r: { ok: boolean; coords?: { lat: number; lng: number }[] }, i: number) => {
                  const fallback = i === 0
                    ? [{ lat: fromLat, lng: fromLng }, { lat: addLat, lng: addLng }]
                    : (toPoint ? [{ lat: addLat, lng: addLng }, { lat: toPoint.lat, lng: toPoint.lng }] : []);
                  const coords = (r.ok && r.coords && r.coords.length > 1) ? r.coords : fallback;
                  if (coords.length < 2) return;
                  const segColor = i === 0
                    ? getAdditionalLineColor(point, true)
                    : getAdditionalLineColor(point, false, toPoint);
                  const pl = new naver.maps.Polyline({
                    map,
                    path: coords.map((c: { lat: number; lng: number }) => new naver.maps.LatLng(c.lat, c.lng)),
                    strokeColor: segColor, strokeWeight: 6, strokeOpacity: 1, zIndex: 8,
                  });
                  additionalPolylinesRef.current.push(pl);
                  const beforeCount = arrowMarkersRef.current.length;
                  placeArrows(coords, null, map, naver);
                  additionalArrowMarkersRef.current.push(...arrowMarkersRef.current.slice(beforeCount));
                });
                return;
              }
            }
          } catch {}
          drawStraightAdditionalLines();
        };

        const drawStraightAdditionalLines = () => {
          const coords1 = [{ lat: fromLat, lng: fromLng }, { lat: addLat, lng: addLng }];
          const line1 = new naver.maps.Polyline({ map, path: coords1.map(c => new naver.maps.LatLng(c.lat, c.lng)), strokeColor: getAdditionalLineColor(point, true), strokeWeight: 6, strokeOpacity: 1, zIndex: 8 });
          additionalPolylinesRef.current.push(line1);
          const b1 = arrowMarkersRef.current.length;
          placeArrows(coords1, null, map, naver);
          additionalArrowMarkersRef.current.push(...arrowMarkersRef.current.slice(b1));
          // ★ 이 추가지점이 다른 추가지점의 앞 지점으로 쓰이면 →toPoint 구간선 생략
          if (toPoint && !prevAddIds.has(point.id)) {
            const coords2 = [{ lat: addLat, lng: addLng }, { lat: toPoint.lat, lng: toPoint.lng }];
            const line2 = new naver.maps.Polyline({ map, path: coords2.map(c => new naver.maps.LatLng(c.lat, c.lng)), strokeColor: getAdditionalLineColor(point, false, toPoint), strokeWeight: 6, strokeOpacity: 1, zIndex: 8 });
            additionalPolylinesRef.current.push(line2);
            const b2 = arrowMarkersRef.current.length;
            placeArrows(coords2, null, map, naver);
            additionalArrowMarkersRef.current.push(...arrowMarkersRef.current.slice(b2));
          }
        };

        drawRoadSegments();

      } else {
        // 직선 모드
        const coords1 = [{ lat: fromLat, lng: fromLng }, { lat: addLat, lng: addLng }];
        const line1 = new naver.maps.Polyline({ map, path: coords1.map(c => new naver.maps.LatLng(c.lat, c.lng)), strokeColor: getAdditionalLineColor(point, true), strokeWeight: 6, strokeOpacity: 1, zIndex: 8 });
        additionalPolylinesRef.current.push(line1);
        const b1 = arrowMarkersRef.current.length;
        placeArrows(coords1, null, map, naver);
        additionalArrowMarkersRef.current.push(...arrowMarkersRef.current.slice(b1));
        // ★ 이 추가지점이 다른 추가지점의 앞 지점으로 쓰이면 →toPoint 구간선 생략
        if (toPoint && !prevAddIds.has(point.id)) {
          const coords2 = [{ lat: addLat, lng: addLng }, { lat: toPoint.lat, lng: toPoint.lng }];
          const line2 = new naver.maps.Polyline({ map, path: coords2.map(c => new naver.maps.LatLng(c.lat, c.lng)), strokeColor: getAdditionalLineColor(point, false, toPoint), strokeWeight: 6, strokeOpacity: 1, zIndex: 8 });
          additionalPolylinesRef.current.push(line2);
          const b2 = arrowMarkersRef.current.length;
          placeArrows(coords2, null, map, naver);
          additionalArrowMarkersRef.current.push(...arrowMarkersRef.current.slice(b2));
        }
      }
    });
  };

  // ★ 추가 지점 마커 줌 가시성 업데이트
  const updateAdditionalMarkersVisibility = (zoom: number) => {
    const showMarkers = zoom >= ZOOM_THRESHOLD;
    additionalMarkersRef.current.forEach(m => {
      m.setMap(showMarkers ? naverMapRef.current : null);
    });
    additionalPolylinesRef.current.forEach(p => {
      p.setMap(showMarkers ? naverMapRef.current : null);
    });
    // ★ 추가지점 화살표도 줌에 따라 가시성 업데이트
    additionalArrowMarkersRef.current.forEach(a => {
      a.setMap(showMarkers ? naverMapRef.current : null);
    });
  };

  // ★ 마커 콘텐츠 - showPulse: JS 인라인 애니메이션으로 펄스 구현
  const makeMarkerContent = (point: RoutePoint, color: string, showPulse = false, zoom = 14) => {
    const label = point.source === 'fixed' ? '🏛' : String(point.order);
    const isFixed = point.source === 'fixed';
    const isDone = color === '#1565c0';
    // 완료(파란색) 마커는 펄스 없음
    const activePulse = showPulse && !isDone && !isFixed;
    const pulseColor = 'rgba(255,107,53,0.75)';
    const pulseId = `pulse-${point.order}-${point.lat}`.replace(/\./g, '_');
    // 줌 레벨에 따라 펄스 최대 배율 동적 조정
    // 줌 14 → scale 3.5, 줌 16 → scale 2.0, 줌 18 → scale 1.5
    const maxScale = Math.max(1.5, 3.5 - (zoom - 14) * 0.5);
    const pulseDiv = activePulse ? `
      <div data-pulse="${pulseId}-0" data-delay="0" data-maxscale="${maxScale}" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:1.5px solid ${pulseColor};background:rgba(255,107,53,0.1);pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-1" data-delay="333" data-maxscale="${maxScale}" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:1.5px solid ${pulseColor};background:rgba(255,107,53,0.1);pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-2" data-delay="666" data-maxscale="${maxScale}" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:1.5px solid ${pulseColor};background:rgba(255,107,53,0.1);pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-3" data-delay="1000" data-maxscale="${maxScale}" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:1.5px solid ${pulseColor};background:rgba(255,107,53,0.1);pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-4" data-delay="1333" data-maxscale="${maxScale}" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:1.5px solid ${pulseColor};background:rgba(255,107,53,0.1);pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>
      <div data-pulse="${pulseId}-5" data-delay="1666" data-maxscale="${maxScale}" style="position:absolute;top:50%;left:50%;width:28px;height:28px;margin-left:-14px;margin-top:-14px;border-radius:50%;border:1.5px solid ${pulseColor};background:rgba(255,107,53,0.1);pointer-events:none;will-change:transform,opacity;transform-origin:center center;"></div>` : '';
    const cursorStyle = (activePulse && !isFixed) ? 'cursor:pointer;' : 'cursor:default;';
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
      const duration = 2000;
      const delay = parseInt(div.dataset.delay || '0', 10);
      const maxScale = parseFloat(div.dataset.maxscale || '3.5');
      const step = (ts: number) => {
        const progress = ((ts - delay) % duration + duration) % duration / duration;
        let scale: number, opacity: number;
        if (progress < 0.1) {
          scale = 1;
          opacity = progress / 0.1;
        } else if (progress < 0.8) {
          const p = (progress - 0.1) / 0.7;
          scale = 1 + p * (maxScale - 1);
          opacity = 1 - p;
        } else {
          scale = maxScale; opacity = 0;
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
    const totalDist = coordPairs.reduce((sum, _, i) => {
      if (i === 0) return sum;
      return sum + latLngDistanceM(coordPairs[i-1].lat, coordPairs[i-1].lng, coordPairs[i].lat, coordPairs[i].lng);
    }, 0);
    const MARKER_CLEARANCE = 20; // 마커 위치 근처 20m 이내 화살표 제외
    let accumulated = 0;
    let distFromStart = 0;
    for (let i = 0; i < coordPairs.length - 1; i++) {
      const from = coordPairs[i];
      const to = coordPairs[i + 1];
      const segDist = latLngDistanceM(from.lat, from.lng, to.lat, to.lng);
      const segBearing = bearing ?? calcBearing(from, to);
      let d = (accumulated === 0 ? intervalM / 2 : intervalM - (accumulated % intervalM));
      while (d <= segDist) {
        const absPos = distFromStart + d;
        // 시작점 또는 끝점으로부터 MARKER_CLEARANCE 이내면 건너뜀
        if (absPos > MARKER_CLEARANCE && absPos < totalDist - MARKER_CLEARANCE) {
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
        }
        d += intervalM;
      }
      distFromStart += segDist;
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
    // 직선 모드 완료 후 추가지점 경로선 재적용
    setTimeout(() => drawAdditionalPolylines(additionalPointsRef.current), 0);
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

    // ★ 도로 경로 렌더 완료 후 추가지점 경로선 재적용 헬퍼
    const applyAdditionalAfterRoad = () => {
      const pts = additionalPointsRef.current;
      console.log('[additional] applyAdditionalAfterRoad 호출 - 추가지점 수:', pts.length, '/ polylinesRef 수:', polylinesRef.current.length);
      // 기존 추가지점 경로선 완전 정리
      additionalPolylinesRef.current.forEach(p => p.setMap(null));
      additionalPolylinesRef.current = [];
      hiddenPolylinesRef.current = [];
      if (pts.length > 0) {
        // setTimeout 0으로 현재 렌더링 사이클 완료 후 실행 보장
        setTimeout(() => {
          drawAdditionalPolylines(pts);
        }, 0);
      }
    };

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
      // 렌더 완료 후 추가지점 경로선 재적용
      applyAdditionalAfterRoad();
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
      applyAdditionalAfterRoad();
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
    additionalArrowMarkersRef.current = []; // ★ 추가지점 화살표 추적도 리셋

    // 추가지점 경로선도 초기화 (기존 숨김 복원 후 재그리기)
    additionalPolylinesRef.current.forEach(p => p.setMap(null));
    additionalPolylinesRef.current = [];
    hiddenPolylinesRef.current = [];

    const points = route.points;
    if (lineModeRef.current === 'road') {
      // 도로 모드: renderResults 콜백에서 applyAdditionalAfterRoad 호출됨
      drawRoadLines(points, map, naver);
    } else {
      // 직선 모드: drawStraightLines 완료 후 drawAdditionalPolylines 호출됨
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
          content: makeMarkerContent(point, color, showPulse, currentZoomRef.current),
          anchor: new naver.maps.Point(14, 14),
        },
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

  // ★ 추가지점 경로선 색상만 업데이트 (재생성/화살표 변경 없이)
  const updateAdditionalPolylineColors = () => {
    if (!routeRef.current || additionalPointsRef.current.length === 0) return;
    const routePoints = routeRef.current.points;
    let plIdx = 0;

    additionalPointsRef.current.forEach(point => {
      if (!point.lat || !point.lng || point.insertAfterOrder == null) return;

      if (typeof point.insertAfterOrder !== 'number') return;
      const fromOrder = point.insertAfterOrder;
      const toOrder = fromOrder + 1;
      const fromPoint = routePoints.find(p => p.order === fromOrder);
      const toPoint = routePoints.find(p => p.order === toOrder);

      // fromPoint → A1 구간
      if (fromPoint && additionalPolylinesRef.current[plIdx]) {
        additionalPolylinesRef.current[plIdx].setOptions({
          strokeColor: getAdditionalLineColor(point, true),
        });
        plIdx++;
      }
      // A1 → toPoint 구간
      if (toPoint && additionalPolylinesRef.current[plIdx]) {
        additionalPolylinesRef.current[plIdx].setOptions({
          strokeColor: getAdditionalLineColor(point, false, toPoint),
        });
        plIdx++;
      }
    });
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
        content: makeMarkerContent(point, color, showPulse, currentZoomRef.current),
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

    // ★ 추가지점 경로선 색상만 업데이트 (재생성 없이)
    updateAdditionalPolylineColors();
  };

  // ★ 특정 구간 폴리라인 초록 깜박임 (롱프레스)
  // markerIdx: markersRef 배열 인덱스 (= route.points 인덱스)
  const blinkSegment = (markerIdx: number) => {
    if (!route || polylinesRef.current.length === 0) return;
    const naver = (window as any).naver;
    const map = naverMapRef.current;

    const segIdx = markerIdx;

    // ★ 이 구간(segIdx → segIdx+1)에 추가지점이 삽입되어 있는지 order 기반으로 확인
    const fromPointOrder = routeRef.current?.points[segIdx]?.order;
    const additionalInSegment = fromPointOrder != null
      ? additionalPointsRef.current.find(p => p.insertAfterOrder === fromPointOrder)
      : undefined;

    if (additionalInSegment && hiddenPolylinesRef.current.includes(segIdx)) {
      // 이 구간에 A1이 삽입됨 → 14번→A1 방향을 blink
      blinkFromPointToAdditional(routeRef.current!.points[segIdx], additionalInSegment);
      return;
    }

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
        <div style="background:#e8edf2; padding:6px 28px 12px; margin-bottom:20px; font-size:11px; color:#555;">
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
              content: `
                <div style="animation:my-bounce 1.2s ease-in-out infinite;display:inline-block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                  <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f6fb.svg" width="40" height="40" style="display:block;" />
                </div>
                <style>
                  @keyframes my-bounce {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-4px); }
                  }
                </style>
              `,
              anchor: new naver.maps.Point(20, 36),
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



  // ★ 추가지점 삽입 위치 저장
  const handleInsertAfterSave = (insertAfterOrder: number | string | null) => {
    if (!selectedAdditional) return;
    const updated = additionalPoints.map(p =>
      p.id === selectedAdditional.id ? { ...p, insertAfterOrder } : p
    );
    setAdditionalPoints(updated);
    additionalPointsRef.current = updated;
    // localStorage + Redis 동기화
    try {
      const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
      draft.additionalPoints = updated;
      draft.lastModified = Date.now();
      localStorage.setItem('draft-route', JSON.stringify(draft));
    } catch {}
    const today = routeRef.current?.date ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updated }) }).catch(() => {});
    setShowInsertModal(false);
    // 경로선 즉시 재적용
    drawAdditionalMarkers(updated);
  };

  // ★ 추가지점 삭제
  const handleAdditionalDelete = async (id: number) => {
    if (!window.confirm('이 추가 지점을 삭제하시겠습니까?')) return;
    const point = additionalPoints.find(p => p.id === id);
    if (point?.photoUrl && point.photoUrl.startsWith('https://')) {
      try { await fetch('/api/delete-blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: point.photoUrl }) }); } catch {}
    }
    const updated = additionalPoints.filter(p => p.id !== id);
    setAdditionalPoints(updated);
    additionalPointsRef.current = updated;
    // localStorage + Redis 동기화
    try {
      const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
      draft.additionalPoints = updated;
      draft.lastModified = Date.now();
      localStorage.setItem('draft-route', JSON.stringify(draft));
    } catch {}
    const today = routeRef.current?.date ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updated }) }).catch(() => {});
    setShowInsertModal(false);
    drawAdditionalMarkers(updated);
  };

  // ★ 지도뷰 추가지점 좌표 확인
  const handleMapAddCoordCheck = async () => {
    if (!mapAddForm.address && !mapAddForm.destination) return;
    setMapAddCoordStatus('loading');
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: mapAddForm.address, destination: mapAddForm.destination }),
      });
      if (res.ok) {
        const data = await res.json();
        setMapAddCoord({ lat: data.lat, lng: data.lng, placeName: data.placeName || null, source: data.source || null, coordMessage: data.coordMessage || null });
        setMapAddCoordStatus('success');
      } else {
        setMapAddCoordStatus('error');
      }
    } catch {
      setMapAddCoordStatus('error');
    }
  };

  // ★ 지도뷰 추가지점 저장
  const handleMapAddSave = async () => {
    if (mapAddCoordStatus !== 'success') return;
    setMapAddSaving(true);
    const newPoint: AdditionalPoint = {
      id: Date.now(),
      address: mapAddForm.address,
      destination: mapAddForm.destination,
      complaint: mapAddForm.complaint,
      manager: mapAddForm.manager,
      photoUrl: '',
      lat: mapAddCoord.lat,
      lng: mapAddCoord.lng,
      placeName: mapAddCoord.placeName,
      source: mapAddCoord.source,
      coordMessage: mapAddCoord.coordMessage,
      isAdditional: true,
      insertAfterOrder: mapAddForm.insertAfterOrder ?? null,
    };
    const updated = [...additionalPointsRef.current, newPoint];
    setAdditionalPoints(updated);
    additionalPointsRef.current = updated;
    // localStorage + Redis 동기화
    try {
      const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
      draft.additionalPoints = updated;
      draft.lastModified = Date.now();
      localStorage.setItem('draft-route', JSON.stringify(draft));
    } catch {}
    const today = routeRef.current?.date ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    await fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updated }) }).catch(() => {});
    drawAdditionalMarkers(updated);
    setMapAddSaving(false);
    setShowMapAddModal(false);
    setMapAddForm({ address: '', destination: '', complaint: '', manager: '', insertAfterOrder: null });
    setMapAddCoordStatus('idle');
    setMapAddCoord({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });
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
            ← 메인화면
          </button>
          <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px', flex: 1 }}>최적 경로 지도</div>
          <button
            onClick={() => setShowMapHelpModal(true)}
            title="지도뷰 도움말"
            style={{
              width: '24px', height: '24px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: 'white', fontSize: '12px', fontWeight: 'bold',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>?</button>
        </div>
        {route && (
          <div style={{ color: 'rgba(150,200,255,0.85)', fontSize: '11px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
            <span>{route.date} · 버전{route.version} · {route.points.filter(p => p.source !== 'fixed').length}개 지점</span>
            {additionalPoints.filter(p => p.lat && p.lng).length > 0 && (
              <span style={{ background: '#f97316', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>
                +{additionalPoints.filter(p => p.lat && p.lng).length} 추가
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden', justifyContent: 'flex-end' }}>
          {/* 2D/3D 토글 */}
          <button
            onClick={toggle3D}
            style={{
              padding: '4px 9px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '6px',
              background: is3D ? 'rgba(100,220,180,0.35)' : 'rgba(255,255,255,0.08)',
              color: is3D ? '#a0ffd8' : 'rgba(255,255,255,0.5)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
            {is3D ? '일반' : '위성'}
          </button>
          <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>
            <button
              onClick={() => setLineMode('straight')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                border: 'none',
                whiteSpace: 'nowrap',
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
                whiteSpace: 'nowrap',
                background: lineMode === 'road' ? 'rgba(100,180,255,0.4)' : 'rgba(255,255,255,0.08)',
                color: lineMode === 'road' ? 'white' : 'rgba(255,255,255,0.5)',
              }}>도로</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B35', border: '1px solid white', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', whiteSpace: 'nowrap' }}>미완료</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1565c0', border: '1px solid white', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', whiteSpace: 'nowrap' }}>완료</span>
            </div>
            {/* ★ 추가지점 버튼 */}
            <button
              onClick={() => setShowMapAddModal(true)}
              style={{
                background: 'rgba(249,115,22,0.85)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'white', fontSize: '10px', fontWeight: 'bold',
                padding: '3px 7px', borderRadius: '6px',
                cursor: 'pointer', whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
              +추가지점
            </button>
            {/* 보고서 버튼 */}
            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || !route}
              style={{
                background: isGeneratingReport ? 'rgba(100,100,100,0.5)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: isGeneratingReport ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)',
                fontSize: '10px', fontWeight: 'bold',
                padding: '3px 7px', borderRadius: '6px',
                cursor: isGeneratingReport ? 'default' : 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              {isGeneratingReport ? '⏳생성중' : '보고서'}
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

      {/* ★ 지도뷰 추가지점 입력 팝업 — page.tsx와 동일한 구조 */}
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
            fontSize: '22px',
            transition: 'background 0.2s',
          }}>
          🛻
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
                  { label: '플레이스명', value: (selectedPoint.source === 'place_nearest' || selectedPoint.source === 'place_single') ? (selectedPoint.placeName || '') : '' },
                  { label: '좌표메시지', value: selectedPoint.coordMessage || '' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ color: '#90caf9', fontSize: '11px', width: '60px', flexShrink: 0, paddingTop: '2px' }}>{label}</span>
                    <span style={{ color: label === '좌표메시지' && selectedPoint.coordMessage?.includes('⚠️') ? '#ffb74d' : 'white', fontSize: '11px', flex: 1 }}>{value}</span>
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



      {showMapAddModal && (() => {
        const addIdx = additionalPointsRef.current.length;
        const label = `A${addIdx + 1}`;
        const emptyPoint = {
          id: 0, address: '', destination: '', complaint: '', manager: '', photoUrl: '',
          lat: null, lng: null, placeName: null, source: null, coordMessage: null,
          isAdditional: true as const, insertAfterOrder: null,
        };
        const insertOptions = [
          { value: null, label: '선택 안 함 (지도에만 표시)' },
          ...(route?.points
            .filter(p => p.source !== 'fixed' || p.order === 0)
            .map(p => ({ value: p.order, label: p.order === 0 ? '출발지(시청) 다음' : `${p.order}번 (${p.destination || p.address}) 다음` })) ?? []),
          ...additionalPoints
            .filter(ap => ap.lat && ap.lng)
            .map((ap, i) => ({ value: `add_${ap.id}`, label: `A${i + 1} 다음` })),
        ];
        return (
          <AdditionalPointModal
            key="map-add-new"
            label={label}
            point={emptyPoint}
            insertOptions={insertOptions}
            isNew={true}
            onClose={() => setShowMapAddModal(false)}
            onSave={async (data) => {
              const newPoint = {
                id: Date.now(),
                address: data.address,
                destination: data.destination,
                complaint: data.complaint,
                manager: data.manager,
                photoUrl: data.photoUrl || '',
                lat: data.lat,
                lng: data.lng,
                placeName: data.placeName,
                source: data.source,
                coordMessage: data.coordMessage,
                isAdditional: true as const,
                insertAfterOrder: data.insertAfterOrder,
              };
              const updated = [...additionalPointsRef.current, newPoint];
              setAdditionalPoints(updated);
              additionalPointsRef.current = updated;
              try {
                const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
                draft.additionalPoints = updated;
                draft.lastModified = Date.now();
                localStorage.setItem('draft-route', JSON.stringify(draft));
              } catch {}
              const today = routeRef.current?.date ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
              await fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updated }) }).catch(() => {});
              drawAdditionalMarkers(updated);
              setShowMapAddModal(false);
            }}
            onPhotoUpload={async (file) => {
              const reader = new FileReader();
              const base64 = await new Promise<string>(res => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(file); });
              const uploadRes = await fetch('/api/upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData: base64, filename: `additional-map-${Date.now()}.jpg` }) });
              if (uploadRes.ok) { const { url } = await uploadRes.json(); return url as string; }
              return null;
            }}
          />
        );
      })()}

      {showInsertModal && selectedAdditional && (() => {
        const addrPart = selectedAdditional.address?.trim() || selectedAdditional.destination?.trim() || '';
        const apKey = `${addrPart}:${(selectedAdditional.complaint || '').trim()}:none`;
        const apSt = statuses[apKey];
        const addIdx = additionalPoints.findIndex(p => p.id === selectedAdditional.id);
        const label = `A${addIdx + 1}`;

        const insertOptions: { value: number | string | null; label: string }[] = [
          { value: null, label: '연결 안 함' },
        ];
        if (route) {
          route.points.forEach(p => {
            if (p.source === 'fixed' && p.order === 0) {
              insertOptions.push({ value: p.order, label: '출발지 다음' });
            } else if (p.source !== 'fixed') {
              insertOptions.push({ value: p.order, label: `${p.order}번 다음` });
            }
          });
        }
        additionalPoints.forEach((ap, i) => {
          if (ap.id !== selectedAdditional.id && ap.lat && ap.lng) {
            insertOptions.push({ value: `add_${ap.id}`, label: `A${i + 1} 다음` });
          }
        });

        return (
          <AdditionalPointModal
            key={selectedAdditional.id}
            label={label}
            point={selectedAdditional}
            apSt={apSt}
            insertOptions={insertOptions}
            onClose={() => setShowInsertModal(false)}
            onSave={async (data) => {
              const updated = additionalPoints.map(p =>
                p.id === selectedAdditional.id
                  ? { ...p,
                      address: data.address, destination: data.destination,
                      complaint: data.complaint, manager: data.manager,
                      photoUrl: data.photoUrl || p.photoUrl,
                      lat: data.lat ?? p.lat, lng: data.lng ?? p.lng,
                      placeName: data.placeName ?? p.placeName,
                      source: data.source ?? p.source,
                      coordMessage: data.coordMessage ?? p.coordMessage,
                      insertAfterOrder: data.insertAfterOrder,
                    }
                  : p
              );
              setAdditionalPoints(updated);
              additionalPointsRef.current = updated;
              try {
                const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
                draft.additionalPoints = updated;
                draft.lastModified = Date.now();
                localStorage.setItem('draft-route', JSON.stringify(draft));
              } catch {}
              const today = routeRef.current?.date ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
              fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updated }) }).catch(() => {});
              if (data.status !== undefined) {
                await fetch('/api/save-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: route?.date ?? today, address: data.address, destination: data.destination, complaint: data.complaint?.trim() ?? '', originalId: null, status: data.status, memo: data.memo }) });
                statusesRef.current = { ...statusesRef.current, [apKey]: { status: data.status, memo: data.memo, updatedAt: Date.now() } };
                setStatuses(prev => ({ ...prev, [apKey]: { status: data.status, memo: data.memo, updatedAt: Date.now() } }));
              }
              setShowInsertModal(false);
              drawAdditionalMarkers(updated);
            }}
            onDelete={() => handleAdditionalDelete(selectedAdditional.id)}
            onPhotoUpload={async (file) => {
              const reader = new FileReader();
              const base64 = await new Promise<string>(res => { reader.onload = () => res(reader.result as string); reader.readAsDataURL(file); });
              const uploadRes = await fetch('/api/upload-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData: base64, filename: `additional-map-${Date.now()}.jpg` }) });
              if (uploadRes.ok) { const { url } = await uploadRes.json(); return url as string; }
              return null;
            }}
          />
        );
      })()}

      {/* 지도뷰 도움말 팝업 */}
      {showMapHelpModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowMapHelpModal(false)}>
          <div
            style={{ background: '#1a3a6e', border: '1px solid rgba(100,180,255,0.3)', borderRadius: '12px', margin: '0 12px', maxHeight: '85vh', width: '100%', maxWidth: '480px', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>🗺️ 지도뷰 사용 도움말</span>
              <button onClick={() => setShowMapHelpModal(false)} style={{ color: 'white', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            {/* 내용 */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ① 마커 색상 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>① 지점 마커 색상</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    { dot: '#FF6B35', text: '주황색 원형 — 아직 작업하지 않은 지점 (미완료)' },
                    { dot: '#1565c0', text: '파란색 원형 — 작업이 완료된 지점' },
                    { dot: '#f57f17', text: '노란색 원형 — 출발지 및 복귀지점 (의정부시청)' },
                    { dot: '#f97316', text: '주황색 마름모 — 추가 지점 (미완료)' },
                    { dot: '#7b1fa2', text: '보라색 마름모 — 추가 지점 (완료)' },
                  ].map(({ dot, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dot, flexShrink: 0, border: '1px solid white' }} />
                      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ② 마커 클릭 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>② 지점 마커 클릭 — 상세 팝업</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.7' }}>
                  마커를 탭하면 상세 정보 팝업이 열립니다. 팝업에서 <strong style={{ color: 'white' }}>작업상태</strong>(민원처리완료 / 기처리 / 확인불가)를 선택하고 <strong style={{ color: 'white' }}>작업메모</strong>를 입력할 수 있습니다. 작업상태를 입력하면 <strong style={{ color: 'white' }}>마커 색상이 즉시 파란색으로 변경</strong>됩니다. 팝업 하단의 <strong style={{ color: 'white' }}>티맵 / 네이버지도</strong> 버튼으로 해당 지점 내비게이션을 바로 실행할 수 있습니다.
                </p>
                <p style={{ color: '#ffb74d', fontSize: '11px', marginTop: '4px' }}>⚠️ 마커 클릭은 지도를 일정 수준 이상 확대한 상태에서만 활성화됩니다.</p>
              </div>

              {/* ③ 롱프레스 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>③ 지점 마커 롱프레스 — 구간 경로 확인</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.7' }}>
                  마커를 <strong style={{ color: 'white' }}>길게 누르면</strong> 해당 지점에서 다음 지점까지의 경로 구간이 <strong style={{ color: '#a5d6a7' }}>초록색으로 약 5초간 깜박입니다</strong>. 다음에 이동할 구간을 빠르게 확인할 때 유용합니다.
                </p>
              </div>

              {/* ④ 위성 버튼 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>④ 위성 버튼</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.7' }}>
                  <strong style={{ color: 'white' }}>[위성]</strong> 버튼을 누르면 일반 지도에서 위성 사진 지도로 전환됩니다. 다시 누르면 <strong style={{ color: 'white' }}>[일반]</strong>으로 돌아오는 <strong style={{ color: 'white' }}>토글 버튼</strong>입니다. 위성 지도에서는 건물과 도로 실제 모습을 확인할 수 있어 현장 파악에 유용합니다.
                </p>
              </div>

              {/* ⑤ 직선/도로 버튼 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>⑤ 직선 / 도로 버튼</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.7' }}>
                  경로 표시 방식을 선택합니다.<br />
                  · <strong style={{ color: 'white' }}>직선</strong> — 지점 간 직선으로 경로를 표시합니다. 빠르게 로드됩니다.<br />
                  · <strong style={{ color: 'white' }}>도로</strong> — <strong style={{ color: 'white' }}>ORS(OpenRouteService)</strong>로부터 실제 도로 정보를 수신하여 도로를 따라 경로를 표시합니다. 수신에 수 초가 소요될 수 있습니다.
                </p>
              </div>

              {/* ⑥ 보고서 버튼 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>⑥ 보고서 버튼</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.7' }}>
                  <strong style={{ color: 'white' }}>[보고서]</strong> 버튼을 누르면 오늘의 순회 단속 결과를 <strong style={{ color: 'white' }}>PDF 파일로 자동 생성</strong>합니다. 민원번호, 주소, 민원내용, 담당자, 작업상태, 현장사진이 포함된 표 형식으로 저장됩니다.
                </p>
              </div>

              {/* ⑦ 내 위치 */}
              <div>
                <p style={{ color: '#90caf9', fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>⑦ 내 위치 확인</p>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.7' }}>
                  화면 우측 하단의 <strong style={{ color: 'white' }}>🔵 위치 버튼</strong>을 누르면 현재 내 GPS 위치가 <strong style={{ color: 'white' }}>🛻 트럭 아이콘</strong>으로 지도에 표시됩니다. 파란 원은 <strong style={{ color: 'white' }}>GPS 정확도 범위</strong>를 나타내며, 원이 클수록 오차가 큽니다. 위치는 <strong style={{ color: 'white' }}>실시간으로 자동 업데이트</strong>되며, 버튼을 다시 누르면 추적이 중지됩니다.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

