'use client';

import { useState, useEffect, useRef } from 'react';

const dummyRoute = {
  version: '2026-03-01 버전1',
  points: [
    { id: 1, address: '녹양동 산104 (가금교 삼거리)', complaint: '분양 현수막' },
    { id: 2, address: '가능동 663-9 (백정밥상)', complaint: '푸르넷 광고 벽보' },
    { id: 3, address: '가능동 663-21 (세븐일레븐 의정부)', complaint: '광고 벽보' },
    { id: 4, address: '태평로 132 (화순식당)', complaint: '에어라이트' },
    { id: 5, address: '산곡동 730 (고산수자인 정문)', complaint: '광고 현수막' },
  ],
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'view' | 'input'>('view');
  const [cardListOpen, setCardListOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [directOpen, setDirectOpen] = useState(false);
  // 직접 입력 지점
  const [directPoints, setDirectPoints] = useState<{
    id: number; address: string; destination: string; complaint: string; manager: string; photoUrl: string;
    lat?: number | null; lng?: number | null; placeName?: string | null; source?: string | null; coordMessage?: string | null; photoDescription?: string | null;
  }[]>([]);

  // 추가 지점 (최적화 경로 완성 후 추가되는 지점)
  const [additionalPoints, setAdditionalPoints] = useState<{
    id: number; address: string; destination: string; complaint: string; manager: string; photoUrl: string;
    lat?: number | null; lng?: number | null; placeName?: string | null; source?: string | null; coordMessage?: string | null;
    isAdditional: true; insertAfterOrder?: number | null;
  }[]>([]);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [showAdditionalModal, setShowAdditionalModal] = useState(false);
  // 추가지점 포함 여부 다이얼로그 (포함/미포함/취소 3버튼)
  const [showAdditionalConfirm, setShowAdditionalConfirm] = useState(false);
  const additionalConfirmResolveRef = useRef<((v: 'include' | 'exclude' | 'cancel') => void) | null>(null);
  const showAdditionalConfirmDialog = (): Promise<'include' | 'exclude' | 'cancel'> => {
    return new Promise((resolve) => {
      additionalConfirmResolveRef.current = resolve;
      setShowAdditionalConfirm(true);
    });
  };
  const [editingAdditionalPoint, setEditingAdditionalPoint] = useState<{
    id: number; address: string; destination: string; complaint: string; manager: string; photoUrl: string;
    lat?: number | null; lng?: number | null; placeName?: string | null; source?: string | null; coordMessage?: string | null;
    isAdditional: true; insertAfterOrder?: number | null;
  } | null>(null);
  const [additionalForm, setAdditionalForm] = useState({ address: '', destination: '', complaint: '', manager: '', photoUrl: '' });
  const [additionalInsertAfter, setAdditionalInsertAfter] = useState<number | null>(null);
  const [additionalCoordStatus, setAdditionalCoordStatus] = useState<'idle' | 'loading' | 'success' | 'fail'>('idle');
  const [additionalCoord, setAdditionalCoord] = useState<{ lat: number | null; lng: number | null; placeName: string | null; source: string | null; coordMessage: string | null }>({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });

  const [showDirectModal, setShowDirectModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<{
    id: number; address: string; destination: string; complaint: string; manager: string; photoUrl: string;
  } | null>(null);
  const [directForm, setDirectForm] = useState({ address: '', destination: '', complaint: '', manager: '', photoUrl: '' });
  const [directCoordStatus, setDirectCoordStatus] = useState<'idle' | 'loading' | 'success' | 'fail'>('idle');
  const [directCoord, setDirectCoord] = useState<{ lat: number | null; lng: number | null; placeName: string | null; source: string | null; coordMessage: string | null }>({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });
  // 지점 상세정보 팝업
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    order: number; originalId?: number | null; address: string; destination: string | null; complaint: string;
    lat: number; lng: number; placeName: string | null; source: string | null; coordMessage?: string | null;
    photoDescription?: string | null; photoUrl?: string | null; manager?: string | null;
  } | null>(null);
  // 완료상태
  const [pointStatuses, setPointStatuses] = useState<Record<string, { status: string; memo: string; updatedAt: number }>>({});
  const [savingStatus, setSavingStatus] = useState(false);

  // 추출지점 수정 모달
  const [showExtractEditModal, setShowExtractEditModal] = useState(false);
  const [extractEditTarget, setExtractEditTarget] = useState<{
    id: number; originalId?: number | null; address: string; destination?: string | null; complaint: string;
    lat?: number | null; lng?: number | null; placeName?: string | null;
    source?: string | null; photoUrl?: string | null; photoDescription?: string | null;
  } | null>(null);
  const [extractEditForm, setExtractEditForm] = useState({
    address: '', destination: '', complaint: '', manager: '', photoUrl: '', originalId: '' as string,
  });
  const [extractEditCoordStatus, setExtractEditCoordStatus] = useState<'idle' | 'loading' | 'success' | 'fail'>('idle');
  const [extractEditCoord, setExtractEditCoord] = useState<{
    lat: number | null; lng: number | null; placeName: string | null; source: string | null; coordMessage: string | null;
  }>({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });

  const handleDirectAdd = () => {
    setEditingPoint(null);
    setDirectForm({ address: '', destination: '', complaint: '', manager: '', photoUrl: '' });
    setDirectCoordStatus('idle');
    setDirectCoord({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });
    setShowDirectModal(true);
  };

  const handleDirectEdit = (point: { id: number; address: string; destination: string; complaint: string; manager: string; photoUrl: string; lat?: number | null; lng?: number | null; placeName?: string | null; source?: string | null; coordMessage?: string | null }) => {
    setEditingPoint(point);
    setDirectForm({ address: point.address, destination: point.destination, complaint: point.complaint, manager: point.manager, photoUrl: point.photoUrl || '' });
    setDirectCoordStatus(point.lat ? 'success' : 'idle');
    setDirectCoord({ lat: point.lat || null, lng: point.lng || null, placeName: point.placeName || null, source: point.source || null, coordMessage: point.coordMessage || null });
    setShowDirectModal(true);
  };

  const handleDirectDelete = async (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    const point = directPoints.find((p) => p.id === id);
    if (point?.photoUrl && point.photoUrl.startsWith('https://')) {
      try { await fetch('/api/delete-blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: point.photoUrl }) }); } catch (e) { console.error('Blob 삭제 오류:', e); }
    }
    const updated = directPoints.filter((p) => p.id !== id);
    setDirectPoints(updated);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    draft.directPoints = updated;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    setDeletingId(null);
  };

  // 추가 지점 핸들러들
  const handleAdditionalAdd = () => {
    setEditingAdditionalPoint(null);
    setAdditionalForm({ address: '', destination: '', complaint: '', manager: '', photoUrl: '' });
    setAdditionalInsertAfter(null);
    setAdditionalCoordStatus('idle');
    setAdditionalCoord({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });
    setShowAdditionalModal(true);
  };

  const handleAdditionalEdit = (point: typeof additionalPoints[0]) => {
    setEditingAdditionalPoint(point);
    setAdditionalForm({ address: point.address, destination: point.destination, complaint: point.complaint, manager: point.manager, photoUrl: point.photoUrl || '' });
    setAdditionalInsertAfter(point.insertAfterOrder ?? null);
    setAdditionalCoordStatus(point.lat ? 'success' : 'idle');
    setAdditionalCoord({ lat: point.lat || null, lng: point.lng || null, placeName: point.placeName || null, source: point.source || null, coordMessage: point.coordMessage || null });
    setShowAdditionalModal(true);
  };

  const handleAdditionalDelete = async (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    const point = additionalPoints.find((p) => p.id === id);
    if (point?.photoUrl && point.photoUrl.startsWith('https://')) {
      try { await fetch('/api/delete-blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: point.photoUrl }) }); } catch (e) { console.error('Blob 삭제 오류:', e); }
    }
    const updated = additionalPoints.filter((p) => p.id !== id);
    setAdditionalPoints(updated);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    draft.additionalPoints = updated;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    // Redis 동기화
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updated }) }).catch(() => {});
    setDeletingId(null);
  };

  const handleAdditionalSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const coordData = additionalCoordStatus === 'success'
      ? { lat: additionalCoord.lat, lng: additionalCoord.lng, placeName: additionalCoord.placeName, source: additionalCoord.source, coordMessage: additionalCoord.coordMessage }
      : { lat: null, lng: null, placeName: null, source: null, coordMessage: null };

    let photoUrl = additionalForm.photoUrl;
    if (photoUrl && photoUrl.startsWith('blob:')) {
      try {
        const res = await fetch(photoUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string));
          reader.readAsDataURL(blob);
        });
        const uploadRes = await fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: base64, filename: `additional-${Date.now()}.jpg` }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoUrl = uploadData.url;
        }
      } catch (e) { console.error('추가지점 사진 업로드 오류:', e); }
    }

    let updatedPoints;
    if (editingAdditionalPoint) {
      updatedPoints = additionalPoints.map((p) =>
        p.id === editingAdditionalPoint.id
          ? { ...p, ...additionalForm, photoUrl, ...coordData, isAdditional: true as const, insertAfterOrder: additionalInsertAfter }
          : p
      );
    } else {
      updatedPoints = [...additionalPoints, {
        id: Date.now(), ...additionalForm, photoUrl, ...coordData,
        isAdditional: true as const, insertAfterOrder: additionalInsertAfter,
      }];
    }
    setAdditionalPoints(updatedPoints);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    draft.additionalPoints = updatedPoints;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    // Redis 동기화
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: updatedPoints }) }).catch(() => {});
    setIsSaving(false);
    setShowAdditionalModal(false);
  };

  const handleAdditionalReset = async () => {
    if (!window.confirm('추가지점 전체를 삭제합니다. 계속하시겠습니까?')) return;
    await Promise.all(
      additionalPoints
        .filter(p => p.photoUrl && p.photoUrl.startsWith('https://'))
        .map(p => fetch('/api/delete-blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.photoUrl }) }).catch(() => {}))
    );
    setAdditionalPoints([]);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    delete draft.additionalPoints;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    // Redis 동기화
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    fetch('/api/save-additional', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today, points: [] }) }).catch(() => {});
  };

  const handleDirectSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const coordData = directCoordStatus === 'success' ? { lat: directCoord.lat, lng: directCoord.lng, placeName: directCoord.placeName, source: directCoord.source, coordMessage: directCoord.coordMessage } : { lat: null, lng: null, placeName: null, source: null, coordMessage: null };

    // 현장사진 Blob 업로드 (로컬 URL인 경우만)
    let photoUrl = directForm.photoUrl;
    if (photoUrl && photoUrl.startsWith('blob:')) {
      try {
        const res = await fetch(photoUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string));
          reader.readAsDataURL(blob);
        });
        const uploadRes = await fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            filename: `direct-${Date.now()}.jpg`,
          }),
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          photoUrl = uploadData.url;
        }
      } catch (e) {
        console.error('직접입력 사진 업로드 오류:', e);
      }
    }

    let updatedPoints;
    if (editingPoint) {
      updatedPoints = directPoints.map((p) =>
        p.id === editingPoint.id ? { ...p, ...directForm, photoUrl, ...coordData } : p
      );
    } else {
      updatedPoints = [...directPoints, { id: Date.now(), ...directForm, photoUrl, ...coordData }];
    }
    setDirectPoints(updatedPoints);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    draft.directPoints = updatedPoints;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    setIsSaving(false);
    setShowDirectModal(false);
  };

  // 관리자 인증
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // 이미지 업로드
  const [uploadedImages, setUploadedImages] = useState<{ id: number; url: string; name: string }[]>([]);
  const [extractedPoints, setExtractedPoints] = useState<{ 
    id: number; originalId?: number | null; address: string; destination?: string | null; complaint: string;
    lat?: number | null; lng?: number | null; placeName?: string | null;
    source?: string | null; coordMessage?: string | null; photoDescription?: string | null; photoUrl?: string | null;
    photoCrop?: { x: number; y: number; w: number; h: number } | null;
  }[]>([]);

  const handleInputTabClick = () => {
    if (isAuthenticated) {
      setActiveTab('input');
    } else {
      setShowAuthModal(true);
    }
  };

  const handleViewTabClick = () => {
    setActiveTab('view');
    loadCurrentRoute();
  };

  useEffect(() => { loadCurrentRoute(); }, []);

  // 완료상태 로드
  const loadStatuses = async (date: string) => {
    try {
      const res = await fetch(`/api/get-status?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setPointStatuses(data.statuses || {});
      }
    } catch {}
  };

  // 완료상태 키 생성 헬퍼
  const statusKey = (point: { address: string; complaint: string; originalId?: number | null; destination?: string | null }) => {
    // address가 비어있으면 destination을 대신 사용
    const addrPart = point.address?.trim() || point.destination?.trim() || '';
    // complaint가 null/undefined이면 빈 문자열로 통일
    const complaintPart = point.complaint?.trim() ?? '';
    return `${addrPart}:${complaintPart}:${point.originalId ?? 'none'}`;
  };

  // 완료상태 저장
  const handleSaveStatus = async (status: string, memo: string) => {
    if (!selectedPoint || !currentRoute) return;
    setSavingStatus(true);
    try {
      await fetch('/api/save-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: currentRoute.date,
          address: selectedPoint.address,
          destination: selectedPoint.destination,
          complaint: selectedPoint.complaint?.trim() ?? '',
          originalId: selectedPoint.originalId ?? null,
          status,
          memo,
        }),
      });
      // 로컬 state 즉시 반영
      setPointStatuses((prev) => ({
        ...prev,
        [statusKey(selectedPoint)]: { status, memo, updatedAt: Date.now() },
      }));
    } catch {}
    setSavingStatus(false);
  };

  const handleAuth = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('patrol-admin-auth', 'true');
        setShowAuthModal(false);
        setPassword('');
        setAuthError('');
        // draft-route 복원 확인
        try {
          const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
          const today = new Date().toLocaleDateString('ko-KR');
          const draftDate = draft.lastModified ? new Date(draft.lastModified).toLocaleDateString('ko-KR') : null;
          const hasData = (draft.extractedPoints?.length > 0) || (draft.directPoints?.length > 0) || (draft.additionalPoints?.length > 0);
          if (hasData && draftDate === today) {
            setPendingDraft(draft);
            setShowDraftRestoreModal(true);
          } else {
            if (draftDate !== today) {
              localStorage.removeItem('draft-route');
              setExtractedPoints([]);
              setDirectPoints([]);
            }
            setActiveTab('input');
          }
        } catch {
          setActiveTab('input');
        }
      } else {
        setAuthError('비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setAuthError('서버 오류가 발생했습니다.');
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
    setPassword('');
    setAuthError('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = Array.from(files).map((file, idx) => ({
      id: Date.now() + idx,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setUploadedImages((prev) => [...prev, ...newImages]);
    e.target.value = '';
  };

  const handleImageDelete = (id: number) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const [isExtracting, setIsExtracting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<{
    date: string; version: number; createdAt: number;
    history?: { version: number; createdAt: number }[];
    points: { order: number; originalId?: number | null; address: string; destination: string | null; complaint: string; lat: number; lng: number; placeName: string | null; source: string | null; coordMessage?: string | null; photoDescription?: string | null; photoUrl?: string | null; manager?: string | null; }[];
  } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [showDraftRestoreModal, setShowDraftRestoreModal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{ extractedPoints: any[]; directPoints: any[]; lastModified: number } | null>(null);
  // 완료상태 폴링 (18초)
  useEffect(() => {
    if (!currentRoute) return;
    loadStatuses(currentRoute.date);
    const timer = setInterval(() => loadStatuses(currentRoute.date), 18000);
    return () => clearInterval(timer);
  }, [currentRoute?.date]);

  // 경로 버전 폴링 (30초마다 새 버전 자동 반영)
  useEffect(() => {
    const checkNewRoute = async () => {
      try {
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
        const res = await fetch(`/api/get-route?date=${today}`);
        if (!res.ok) return;
        const data = await res.json();
        const currentVersion = currentRoute?.version ?? -1;
        if (data.version > currentVersion) {
          setCurrentRoute(data);
          loadStatuses(data.date);
        }
      } catch {}
    };
    const timer = setInterval(checkNewRoute, 30000);
    return () => clearInterval(timer);
  }, [currentRoute?.version]);

  const cropImage = (dataUrl: string, x: number, y: number, w: number, h: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let sw = img.width * w;
        let sh = img.height * h;
        // 크롭 후 최대 1600px 제한 (파일 크기 5MB 이내 유지)
        const MAX_PX = 1600;
        if (sw > MAX_PX || sh > MAX_PX) {
          if (sw > sh) { sh = Math.round(sh * MAX_PX / sw); sw = MAX_PX; }
          else { sw = Math.round(sw * MAX_PX / sh); sh = MAX_PX; }
        }
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, img.width * x, img.height * y, img.width * w, img.height * h, 0, 0, sw, sh);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = dataUrl;
    });
  };

  const handleExtract = async () => {
    if (uploadedImages.length === 0) {
      alert('이미지를 먼저 업로드해주세요.');
      return;
    }

    setIsExtracting(true);
    const startTime = performance.now();
    try {
      // 이미지 압축 함수
      const compressImage = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(blob);
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 1024;
            let w = img.width;
            let h = img.height;
            if (w > maxSize || h > maxSize) {
              if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
              else { w = Math.round(w * maxSize / h); h = maxSize; }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = url;
        });
      };

      // 이미지 압축
      const compressedImages = await Promise.all(
        uploadedImages.map((img) =>
          fetch(img.url).then((r) => r.blob()).then(compressImage)
        )
      );

      // 5장씩 배치 분할
      const BATCH_SIZE = 5;
      const batches: string[][] = [];
      for (let i = 0; i < compressedImages.length; i += BATCH_SIZE) {
        batches.push(compressedImages.slice(i, i + BATCH_SIZE));
      }

      // 배치 1회 호출 함수 (에러 시 상세 정보 반환)
      const fetchBatch = async (batch: string[], batchIdx: number, attempt: number) => {
        const batchStart = performance.now();
        try {
          const r = await fetch('/api/extract-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: batch }),
          });
          const data = await r.json();
          const batchElapsed = Math.round(performance.now() - batchStart);
          if (!r.ok) {
            console.error(`❌ 배치 ${batchIdx + 1} 실패 (시도${attempt}, ${batchElapsed}ms) | HTTP ${r.status} | errorType: ${data.errorType} | ${data.message}`);
            return { points: [], startIdx: batchIdx * BATCH_SIZE, failed: true, errorType: data.errorType, httpStatus: r.status, elapsed: batchElapsed, attempt };
          }
          console.log(`✅ 배치 ${batchIdx + 1} 완료 (시도${attempt}, ${batchElapsed}ms) | ${batch.length}장 → ${data.points?.length ?? 0}개 추출`);
          return { points: data.points || [], startIdx: batchIdx * BATCH_SIZE, failed: false, elapsed: batchElapsed, attempt };
        } catch (e: any) {
          const batchElapsed = Math.round(performance.now() - batchStart);
          console.error(`❌ 배치 ${batchIdx + 1} 예외 (시도${attempt}, ${batchElapsed}ms) | ${e?.message || e}`);
          return { points: [], startIdx: batchIdx * BATCH_SIZE, failed: true, errorType: 'NETWORK_ERROR', elapsed: batchElapsed, attempt };
        }
      };

      // 배치 병렬 호출 + 실패 시 1회 재시도
      const batchResults = await Promise.all(
        batches.map(async (batch, batchIdx) => {
          const result = await fetchBatch(batch, batchIdx, 1);
          if (result.failed) {
            console.warn(`🔄 배치 ${batchIdx + 1} 재시도 중... (errorType: ${result.errorType})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchBatch(batch, batchIdx, 2);
          }
          return result;
        })
      );

      // 실패한 배치 집계 → 사용자에게 경고
      const failedBatches = batchResults.filter(r => r.failed);
      if (failedBatches.length > 0) {
        const failedImageRanges = failedBatches.map(r => {
          const start = batchResults.indexOf(r) * BATCH_SIZE + 1;
          const end = Math.min(start + BATCH_SIZE - 1, compressedImages.length);
          return `${start}~${end}번`;
        }).join(', ');
        const errorTypes = [...new Set(failedBatches.map(r => r.errorType))].join(', ');
        alert(`⚠️ 일부 이미지 추출 실패

실패 범위: ${failedImageRanges} 이미지
원인: ${
          errorTypes === 'TIMEOUT' ? '응답 시간 초과 (네트워크 불안정 또는 AI 서버 과부하)' :
          errorTypes === 'RATE_LIMIT' ? 'AI API 요청 한도 초과' :
          errorTypes === 'API_OVERLOAD' ? 'AI 서버 일시적 과부하' :
          errorTypes === 'NETWORK_ERROR' ? '네트워크 연결 오류' :
          `오류 코드: ${errorTypes}`
        }

추출된 지점만 표시됩니다. 잠시 후 다시 시도해보세요.`);
      }

      // 결과 합치기 (각 지점에 원본 이미지 인덱스 포함)
      const allPoints = batchResults.flatMap(({ points, startIdx }) =>
        points.map((p: { complaintNumber?: number | null; address: string; destination: string; complaint: string; photoDescription?: string | null; photoCrop?: { x: number; y: number; w: number; h: number } | null; imageIndex?: number }) => ({
          ...p,
          imageIdx: startIdx + (p.imageIndex ?? 0),
        }))
      );

      if (allPoints.length > 0) {
        // 각 지점마다 좌표 검색
        // 각 지점마다 좌표 검색
      const pointsWithCoords = await Promise.all(
        allPoints.map(async (p: { complaintNumber?: number | null; address: string; destination: string; complaint: string; manager?: string | null; photoDescription?: string | null; photoCrop?: { x: number; y: number; w: number; h: number } | null; imageIdx: number }, idx: number) => {
          let lat = null;
          let lng = null;
          let placeName = null;
          let source = null;
          let coordMessage = null;
            try {
              const geoRes = await fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination: p.destination, address: p.address }),
              });
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                lat = geoData.lat;
                lng = geoData.lng;
                placeName = geoData.placeName;
                source = geoData.source;
                coordMessage = geoData.coordMessage || null;
              }
            } catch (e) {
              console.error('geocode 오류:', e);
            }

            // 현장사진 크롭 + Blob 업로드
            let photoUrl: string | null = null;
            if (p.photoCrop && uploadedImages[p.imageIdx]) {
              try {
                const crop = p.photoCrop;
                const pad = 0.03;
                const cx = Math.max(0, crop.x - pad);
                const cy = Math.max(0, crop.y - pad);
                const cw = Math.min(1 - cx, crop.w + pad * 2);
                const ch = Math.min(1 - cy, crop.h + pad * 2);
                // 크롭은 원본 이미지 URL에서 직접 수행 (압축본 대신 고해상도 유지)
                const croppedDataUrl = await cropImage(uploadedImages[p.imageIdx].url, cx, cy, cw, ch);
                const uploadRes = await fetch('/api/upload-photo', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageData: croppedDataUrl,
                    filename: `point-${Date.now()}-${idx}.jpg`,
                  }),
                });
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  photoUrl = uploadData.url;
                }
              } catch (e) {
                console.error('사진 크롭/업로드 오류:', e);
              }
            }

            return {
              id: idx + 1,
              originalId: p.complaintNumber ?? null,
              address: p.address,
              destination: p.destination || null,
              complaint: p.complaint,
              manager: p.manager || null,
              photoDescription: p.photoDescription || null,
              photoUrl,
              lat,
              lng,
              placeName,
              source,
              coordMessage,
            };
        })
      );

        const endTime = performance.now();
        console.log(`✅ 총 소요시간: ${((endTime - startTime) / 1000).toFixed(1)}초`);
        console.log(`📍 추출 지점 수: ${pointsWithCoords.length}개`);
        console.log('추출된 지점들:', JSON.stringify(pointsWithCoords, null, 2));
        setExtractedPoints(pointsWithCoords);
        const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
        draft.extractedPoints = pointsWithCoords;
        draft.lastModified = Date.now();
        localStorage.setItem('draft-route', JSON.stringify(draft));
      } else {
        alert('추출된 지점이 없습니다.');
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractedDelete = async (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    const point = extractedPoints.find((p) => p.id === id);
    if (point?.photoUrl && point.photoUrl.startsWith('https://')) {
      try { await fetch('/api/delete-blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: point.photoUrl }) }); } catch (e) { console.error('Blob 삭제 오류:', e); }
    }
    const updated = extractedPoints.filter((p) => p.id !== id);
    setExtractedPoints(updated);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    draft.extractedPoints = updated;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    setDeletingId(null);
  };

  const handleExtractedEdit = (point: typeof extractedPoints[0]) => {
  setExtractEditTarget(point);
  setExtractEditForm({
    address: point.address || '',
    destination: point.destination || '',
    complaint: point.complaint || '',
    manager: '',
    photoUrl: '',
    originalId: point.originalId != null ? String(point.originalId) : '',
  });
  if (point.lat && point.lng) {
    setExtractEditCoordStatus('success');
    setExtractEditCoord({ lat: point.lat ?? null, lng: point.lng ?? null, placeName: point.placeName ?? null, source: point.source ?? null, coordMessage: (point as any).coordMessage ?? null });
  } else {
    setExtractEditCoordStatus('fail');
    setExtractEditCoord({ lat: null, lng: null, placeName: null, source: null, coordMessage: null });
  }
  setShowExtractEditModal(true);
};

  const handleExtractEditCheckCoord = async () => {
    setExtractEditCoordStatus('loading');
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: extractEditForm.destination, address: extractEditForm.address }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) {
          setExtractEditCoord({ lat: data.lat, lng: data.lng, placeName: data.placeName, source: data.source, coordMessage: data.coordMessage || null });
          setExtractEditCoordStatus('success');
        } else {
          setExtractEditCoordStatus('fail');
        }
      } else {
        setExtractEditCoordStatus('fail');
      }
    } catch {
      setExtractEditCoordStatus('fail');
    }
  };

  const handleExtractEditSave = () => {
  if (!extractEditTarget) return;
  const parsedOriginalId = extractEditForm.originalId ? Number(extractEditForm.originalId) : null;
  const updatedPoint = {
    ...extractEditTarget,
    originalId: !isNaN(parsedOriginalId as number) && parsedOriginalId !== null ? parsedOriginalId : extractEditTarget.originalId ?? null,
    address: extractEditForm.address,
    destination: extractEditForm.destination || null,
    complaint: extractEditForm.complaint,
    lat: extractEditCoord.lat,
    lng: extractEditCoord.lng,
    placeName: extractEditCoord.placeName,
    source: extractEditCoord.source,
    coordMessage: extractEditCoord.coordMessage,
  };
  const updatedPoints = extractedPoints.map((p) =>
    p.id === extractEditTarget.id ? updatedPoint : p
  );
  setExtractedPoints(updatedPoints);

  // draft-route localStorage 저장
  const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
  draft.extractedPoints = updatedPoints;
  draft.lastModified = Date.now();
  localStorage.setItem('draft-route', JSON.stringify(draft));

  setShowExtractEditModal(false);
  console.log('💾 지점 수정 저장:', updatedPoint);
};

  const loadCurrentRoute = async () => {
    setIsLoadingRoute(true);
    try {
      const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      const res = await fetch(`/api/get-route?date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentRoute(data);
      } else {
        setCurrentRoute(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleGenerateRoute = async () => {
    if (isGenerating) return;

    // 추가지점 포함 여부 확인
    let includeAdditional = false;
    if (additionalPoints.filter(p => p.lat && p.lng).length > 0) {
      const answer = await showAdditionalConfirmDialog();
      if (answer === 'cancel') return;
      includeAdditional = answer === 'include';
    }

    const basePoints = [
      ...extractedPoints.filter(p => p.lat && p.lng),
      ...directPoints.filter(p => p.lat && p.lng),
    ];
    const addPoints = includeAdditional ? additionalPoints.filter(p => p.lat && p.lng) : [];
    const allPoints = [...basePoints, ...addPoints];

    if (allPoints.length === 0) {
      alert('좌표가 확인된 지점이 없습니다.');
      return;
    }

    if (!window.confirm(`좌표 확인된 지점 ${allPoints.length}개로 최적화 경로를 생성합니다. 계속하시겠습니까?`)) return;

    setIsGenerating(true);
    try {
      // ① ORS Matrix API로 도로 거리 행렬 계산 시도
      let ordered: typeof allPoints = [];
      let usedORS = false;

      const cityHallCoord = { lat: 37.7381, lng: 127.0338 };
      const matrixLocations = [cityHallCoord, ...allPoints.map(p => ({ lat: p.lat!, lng: p.lng! }))];

      try {
        const matrixRes = await fetch('/api/ors-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations: matrixLocations }),
        });
        const matrixData = await matrixRes.json();

        if (matrixData.ok && matrixData.matrix) {
          const matrix: number[][] = matrixData.matrix;
          const n = allPoints.length;

          // ── Step 1: 최근접 이웃 알고리즘 (시청=0번 고정 출발)
          const visited = new Array(n + 1).fill(false);
          visited[0] = true;
          const orderIdxs: number[] = []; // matrix 인덱스 (1~n)
          let current = 0;

          while (orderIdxs.length < n) {
            let nearestIdx = -1;
            let nearestDist = Infinity;
            for (let i = 1; i <= n; i++) {
              if (!visited[i] && matrix[current][i] < nearestDist) {
                nearestDist = matrix[current][i];
                nearestIdx = i;
              }
            }
            if (nearestIdx === -1) break;
            visited[nearestIdx] = true;
            orderIdxs.push(nearestIdx);
            current = nearestIdx;
          }

          // ── Step 2: 2-opt 개선 (교차 구간 제거)
          // 전체 경로: [0(시청), ...orderIdxs, 0(시청 복귀)]
          // orderIdxs만 개선 대상 (시청 위치 고정)
          const routeCost = (idxs: number[]) => {
            let cost = matrix[0][idxs[0]]; // 시청 → 첫 지점
            for (let i = 0; i < idxs.length - 1; i++) cost += matrix[idxs[i]][idxs[i + 1]];
            cost += matrix[idxs[idxs.length - 1]][0]; // 마지막 지점 → 시청
            return cost;
          };

          let improved = true;
          let route2opt = [...orderIdxs];
          let iterations = 0;
          const beforeCost = routeCost(route2opt);

          while (improved && iterations < 100) {
            improved = false;
            iterations++;
            const len = route2opt.length;
            // 전체 경로 노드: [0(시청), r[0], r[1], ..., r[n-1], 0(시청복귀)]
            // 노드 인덱스 0~n+1, 실제값: node(k) = k===0||k===len+1 ? 0 : route2opt[k-1]
            const node = (k: number) => k === 0 || k === len + 1 ? 0 : route2opt[k - 1];
            outer:
            for (let i = 1; i <= len - 1; i++) {
              for (let j = i + 1; j <= len; j++) {
                // 엣지 i-1→i 와 j→j+1 을 교체
                const a = node(i - 1);
                const b = node(i);
                const c = node(j);
                const d = node(j + 1);
                const before = matrix[a][b] + matrix[c][d];
                const after  = matrix[a][c] + matrix[b][d];
                if (after < before - 0.1) {
                  // i~j 구간 역순
                  route2opt = [
                    ...route2opt.slice(0, i - 1),
                    ...route2opt.slice(i - 1, j).reverse(),
                    ...route2opt.slice(j),
                  ];
                  improved = true;
                  break outer;
                }
              }
            }
          }

          const afterCost = routeCost(route2opt);
          const improvement = Math.round((beforeCost - afterCost) / 10) / 100; // km
          console.log(`✅ 2-opt 완료: ${iterations}회 반복, ${improvement}km 단축`);

          ordered = route2opt.map(i => allPoints[i - 1]); // matrix 인덱스 → allPoints 0-based
          usedORS = true;
        }
      } catch (matrixErr) {
        console.warn('⚠️ ORS Matrix 실패, 직선거리 fallback:', matrixErr);
      }

      // ② ORS 실패 시 직선거리 최근접 이웃 알고리즘 (기존 방식)
      if (!usedORS) {
        const unvisited = [...allPoints];
        const orderedFallback = [unvisited.splice(0, 1)[0]];
        while (unvisited.length > 0) {
          const last = orderedFallback[orderedFallback.length - 1];
          let nearestIdx = 0;
          let nearestDist = Infinity;
          unvisited.forEach((p, i) => {
            const dist = Math.pow((p.lat! - last.lat!), 2) + Math.pow((p.lng! - last.lng!), 2);
            if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
          });
          orderedFallback.push(unvisited.splice(nearestIdx, 1)[0]);
        }
        ordered = orderedFallback;
        console.log('⚠️ 직선거리 알고리즘 사용');
      }

      const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      const cityHall = { order: 0, address: '의정부시 의정부동 358-1', destination: '의정부시청', complaint: '출발/복귀', lat: 37.7381, lng: 127.0338, placeName: '의정부시청', source: 'fixed' };
      const routePoints = [
        { ...cityHall, order: 0 },
        ...ordered.map((p, i) => ({
          order: i + 1,
          originalId: ('originalId' in p ? (p as any).originalId : null) ?? null,
          address: p.address,
          destination: ('destination' in p ? p.destination : null) || null,
          complaint: p.complaint,
          lat: p.lat,
          lng: p.lng,
          placeName: p.placeName || null,
          source: p.source || null,
          coordMessage: ('coordMessage' in p ? p.coordMessage : null) || null,
          photoDescription: ('photoDescription' in p ? p.photoDescription : null) || null,
          photoUrl: ('photoUrl' in p ? p.photoUrl : null) || null,
          manager: ('manager' in p ? p.manager : null) || null,
        })),
        { ...cityHall, order: ordered.length + 1 },
      ];

      const res = await fetch('/api/save-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, points: routePoints }),
      });

      if (!res.ok) throw new Error('저장 실패');
      const data = await res.json();
      console.log('✅ 경로 저장 완료:', JSON.stringify(data, null, 2));

      // 추가지점 포함하여 재최적화한 경우 additionalPoints 초기화
      if (includeAdditional) {
        setAdditionalPoints([]);
        const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
        delete draft.additionalPoints;
        localStorage.setItem('draft-route', JSON.stringify(draft));
      }

      alert(`최적화 경로 생성 완료! (${today} 버전${data.version}, ${routePoints.length}개 지점)\n경로 계산: ${usedORS ? '도로 거리 기반 + 2-opt 개선 (ORS)' : '직선 거리 기반 (fallback)'}${includeAdditional ? '\n추가지점 포함하여 재최적화되었습니다.' : ''}`);
      await loadCurrentRoute(); // 이력 즉시 갱신
    } catch (e) {
      console.error(e);
      alert('경로 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadReset = async () => {
    if (isResetting) return;
    if (!window.confirm('추출된 지점 전체와 업로드 이미지를 모두 삭제합니다. 계속하시겠습니까?')) return;
    setIsResetting(true);
    // 병렬 삭제로 변경 (순차 → 동시)
    await Promise.all(
      extractedPoints
        .filter(p => p.photoUrl && p.photoUrl.startsWith('https://'))
        .map(p => fetch('/api/delete-blob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: p.photoUrl }),
        }).catch(e => console.error('Blob 삭제 오류:', e)))
    );
    setUploadedImages([]);
    setExtractedPoints([]);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    delete draft.extractedPoints;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    setIsResetting(false);
  };

  const handleDirectReset = async () => {
    if (!window.confirm('직접입력 지점 전체를 삭제합니다. 계속하시겠습니까?')) return;
    setIsResetting(true);
    await Promise.all(
      directPoints
        .filter(p => p.photoUrl && p.photoUrl.startsWith('https://'))
        .map(p => fetch('/api/delete-blob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: p.photoUrl }),
        }).catch(e => console.error('Blob 삭제 오류:', e)))
    );
    setDirectPoints([]);
    const draft = JSON.parse(localStorage.getItem('draft-route') || '{}');
    delete draft.directPoints;
    draft.lastModified = Date.now();
    localStorage.setItem('draft-route', JSON.stringify(draft));
    setIsResetting(false);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a3a6e 0%, #1565c0 40%, #1976d2 100%)' }}>
      {/* 헤더 */}
      <header className="px-4 py-3 text-white" style={{ background: 'linear-gradient(180deg, #0d2444 0%, #1a3a6e 100%)' }}>
        <h1 className="text-lg font-bold text-center">길도사 2.0 <span className="text-xs font-normal">(No헤맴 보장)</span></h1>
        <p className="text-xs text-blue-200 mt-1 text-center leading-relaxed">
          최적화 순회 경로는 인공지능 클로드가 네이버 클라우드의 지리정보를 기반으로 동선 낭비 없는 루프형 동선으로 설계한 것입니다.
        </p>
      </header>

      {/* 탭바 */}
      <div className="flex" style={{ background: '#1a3a6e' }}>
        <button
          onClick={handleViewTabClick}
          className={`py-3 text-sm font-medium transition-all ${activeTab === 'view' ? 'w-2/3 text-white font-bold' : 'w-1/3 text-blue-300'}`}
          style={activeTab === 'view' ? { background: 'linear-gradient(180deg, #2196f3 0%, #1565c0 100%)' } : { background: '#2a4a7e' }}
        >
          최적화 경로 확인
        </button>
        <button
          onClick={handleInputTabClick}
          className={`py-3 text-sm font-medium transition-all ${activeTab === 'input' ? 'w-2/3 text-white font-bold' : 'w-1/3 text-blue-300'}`}
          style={activeTab === 'input' ? { background: 'linear-gradient(180deg, #b0bec5 0%, #78909c 100%)' } : { background: '#2a4a7e' }}
        >
          지점 정보 입력
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <style>{`
        @keyframes pulse-btn {
          0%, 100% { background-color: #16a34a; }
          50% { background-color: #f97316; }
        }
      `}</style>
      <main className="px-3 py-3 max-w-lg mx-auto space-y-2">

        {/* ── 최적화 경로 확인 탭 ── */}
        {activeTab === 'view' && (
          <>
            {isLoadingRoute && (
              <div className="text-center py-8 text-blue-200 text-sm">경로 불러오는 중...</div>
            )}
            {!isLoadingRoute && !currentRoute && (
              <div className="text-center py-8 text-blue-200 text-sm">오늘 생성된 경로가 없습니다.</div>
            )}
            {!isLoadingRoute && currentRoute && (
              <>
                {/* 지도 뷰 - 상단 배치 */}
                <div className="rounded overflow-hidden">
                  <div className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                    style={{ background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fb4 100%)' }}>
                    <button
                      onClick={() => { sessionStorage.setItem('map-entry', '1'); window.location.href = '/map'; }}
                      style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span className="font-medium text-sm">지도 뷰</span>
                      <span className="text-xs" style={{ color: 'rgba(200,230,255,0.85)' }}>{currentRoute.date} 버전{currentRoute.version}</span>
                    </button>
                    <span className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); loadCurrentRoute(); }}
                        title="최신 정보로 가져오기"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="#7dd3fc"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => { sessionStorage.setItem('map-entry', '1'); window.location.href = '/map'; }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'white', fontSize: '14px', lineHeight: 1 }}>
                        ▶
                      </button>
                    </span>
                  </div>
                </div>

                {/* 카드 리스트 - 하단 배치, 기본 닫힘 */}
                <div className="rounded overflow-hidden mt-2">
                  <button
                    onClick={() => setCardListOpen(!cardListOpen)}
                    className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                    style={{ background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fb4 100%)' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>카드 리스트</span>
                      <span className="text-xs" style={{ color: 'rgba(200,230,255,0.85)' }}>{currentRoute.date} 버전{currentRoute.version}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); loadCurrentRoute(); }}
                        title="최신 정보로 가져오기"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="#7dd3fc"/>
                        </svg>
                      </button>
                      <span>{cardListOpen ? '▲' : '▼'}</span>
                    </span>
                  </button>
                  {cardListOpen && (
                    <div className="pt-0 pb-2">
                      {currentRoute.points.map((point, idx) => (
                        <div key={point.order} style={idx === 0 ? { marginTop: '28px' } : {}}>
                        {(() => {
                          const st = pointStatuses[statusKey(point)];
                          const isDone = st && ['민원처리완료','기처리','확인불가'].includes(st.status);
                          // 의정부시청(fixed) 카드는 1번 지점 완료 여부로 색상 결정
                          const firstPoint = currentRoute?.points.find(p => p.source !== 'fixed');
                          const firstDone = firstPoint && (() => { const fst = pointStatuses[statusKey(firstPoint)]; return fst && ['민원처리완료','기처리','확인불가'].includes(fst.status); })();
                          const cardBg = point.source === 'fixed'
                            ? (firstDone ? 'rgba(255,255,255,0.12)' : 'rgba(235,100,0,0.55)')
                            : (isDone ? 'rgba(255,255,255,0.12)' : 'rgba(235,100,0,0.55)');
                          return (
                        <div className="mx-2 rounded px-3 py-3"
                          style={{ background: cardBg, cursor: point.source !== 'fixed' ? 'pointer' : 'default' }}
                          onClick={() => { if (point.source !== 'fixed') { setSelectedPoint(point); setShowDetailModal(true); document.body.style.overflow = 'hidden'; } }}>
                          <div style={{ display: 'flex', alignItems: point.source === 'fixed' ? 'center' : 'flex-start', gap: '8px' }}>
                            <div style={{
                              flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                              background: point.source === 'fixed' ? (firstDone ? '#1565c0' : '#f57f17') : 'rgba(0,0,0,0.35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: 'bold', fontSize: '13px',
                            }}>
                              {point.source === 'fixed'
                                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                : point.order}
                            </div>
                            {/* 정보 영역 + 버튼 */}
                            <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              {/* 정보 영역 */}
                              <div className="flex-1">
                                <p className="text-sm leading-snug font-medium">
                                  {point.source === 'fixed' ? (
                                    <span style={{ color: firstDone ? '#a5d6a7' : '#ffcc80' }}>{point.destination || point.address}</span>
                                  ) : point.source ? (
                                    <span style={{ color: '#a5d6a7' }}>{point.address}{point.destination ? ` (${point.destination})` : ''}</span>
                                  ) : (
                                    <span className="text-white">{point.address}{point.destination ? ` (${point.destination})` : ''}</span>
                                  )}
                                </p>
                                {point.source !== 'fixed' && (
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px', color: '#a5d6a7', fontSize: '12px' }}>
                                    <span style={{ flexShrink: 0 }}>🔍</span>
                                    <span>{(point.source === 'place_nearest' || point.source === 'place_single') ? (point.placeName || '') : ''}</span>
                                  </div>
                                )}
                                {point.source !== 'fixed' && (
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px', fontSize: '12px' }}>
                                    <span style={{ flexShrink: 0 }}>📍</span>
                                    <span style={{ color: point.coordMessage?.includes('⚠️') ? '#ffb74d' : point.source ? '#fff176' : 'rgba(255,255,255,0.5)' }}>
                                      {point.coordMessage || (point.source ? '' : '좌표 없음. (⚠️주소나 목적지명 확인 필요)')}
                                    </span>
                                  </div>
                                )}
                                {point.source !== 'fixed' && (
                                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 5, marginBottom: 4 }} />
                                )}
                                {point.source !== 'fixed' && (
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', width: '4rem', flexShrink: 0 }}>민원번호:</span>
                                    <span style={{ color: '#a5d6a7', fontSize: '12px' }}>{point.originalId ? `${point.originalId} 번` : ''}</span>
                                  </div>
                                )}
                                {point.source !== 'fixed' && (
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', width: '4rem', flexShrink: 0 }}>민원내용:</span>
                                    <span style={{ color: '#a5d6a7', fontSize: '12px' }}>{point.complaint || ''}</span>
                                  </div>
                                )}
                                {point.source !== 'fixed' && (
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', width: '4rem', flexShrink: 0 }}>사진설명:</span>
                                    <span style={{ color: '#a5d6a7', fontSize: '12px' }}>{point.photoDescription || ''}</span>
                                  </div>
                                )}
                                {point.source !== 'fixed' && (
                                  <>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 6, marginBottom: 4 }} />
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', width: '4rem', flexShrink: 0 }}>작업상태:</span>
                                      <span style={{ color: '#80cbc4', fontWeight: 'bold', fontSize: '12px' }}>{st?.status || ''}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', width: '4rem', flexShrink: 0 }}>작업메모:</span>
                                      <span style={{ color: '#a5d6a7', fontSize: '12px' }}>{st?.memo || ''}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                              {/* 버튼 영역 - 우측 하단 정렬 */}
                              {point.source !== 'fixed' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0, justifyContent: 'flex-end', alignSelf: 'flex-end' }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); window.open(`tmap://route?goalname=${encodeURIComponent(point.destination || point.address)}&goaly=${point.lat}&goalx=${point.lng}`); }}
                                    className="text-xs text-white px-3 py-1.5 rounded font-bold" style={{ background: '#0a3d8f' }}>티맵</button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); window.open(`nmap://navigation?dlat=${point.lat}&dlng=${point.lng}&dname=${encodeURIComponent(point.destination || point.address)}&appname=patrol-optimizer`); }}
                                    className="text-xs text-white px-3 py-1.5 rounded font-bold" style={{ background: '#1b5e20' }}>네이버</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                          );
                        })()}
                          <div className="flex justify-center py-1.5">
                            <div className="flex flex-col items-center">
                              {idx < currentRoute.points.length - 1 && (
                                <div style={{ width: 6, height: 10, background: 'rgba(100,180,255,0.6)', borderRadius: 3 }} />
                              )}
                              {idx < currentRoute.points.length - 1 && (
                                <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                                  <path d="M10 12C9.6 12 9.2 11.8 9 11.5L0.5 1.5C0.1 1 0.4 0 1 0H19C19.6 0 19.9 1 19.5 1.5L11 11.5C10.8 11.8 10.4 12 10 12Z" fill="rgba(100,180,255,0.8)" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </>
            )}

          </>
        )}

        {/* ── 지점 정보 입력 탭 ── */}
        {activeTab === 'input' && (
          <>
            {/* 이미지 업로드 아코디언 */}
            <div className="rounded overflow-hidden">
              <button
                onClick={() => setUploadOpen(!uploadOpen)}
                className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                style={{ background: 'linear-gradient(180deg, #b0bec5 0%, #78909c 100%)' }}
              >
                <span>이미지를 업로드하여 지점정보 추출하기</span>
                <span className="flex items-center gap-2">
                  <div
                    onClick={(e) => { e.stopPropagation(); handleUploadReset(); }}
                    className="text-white text-xs px-2 py-1 rounded cursor-pointer"
                    style={{ background: isResetting ? '#888' : '#2e7d32', cursor: isResetting ? 'not-allowed' : 'pointer' }}
                  >{isResetting ? '초기화 중...' : '초기화'}</div>
                  <span>{uploadOpen ? '▲' : '▼'}</span>
                </span>
              </button>

              {uploadOpen && (
                <div className="px-3 py-3 space-y-3" style={{ background: 'rgba(255,255,255,0.08)' }}>

                  {/* 이미지 불러오기 */}
                  <div>
                    <label className="inline-block text-white text-xs font-bold px-4 py-2 rounded cursor-pointer w-32 text-center"
                      style={{ background: '#0a3d8f' }}>
                      이미지 불러오기
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                    </label>

                    {/* 썸네일 목록 */}
                    {uploadedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {uploadedImages.map((img) => (
                          <div key={img.id} className="relative w-16 h-16">
                            <img src={img.url} alt={img.name} className="w-16 h-16 object-cover rounded" />
                            <button
                              onClick={() => handleImageDelete(img.id)}
                              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold"
                              style={{ background: '#c62828' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 지점 추출하기 버튼 + 도움말 버튼 */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={isExtracting ? undefined : handleExtract}
                      disabled={isExtracting}
                      className="py-2 rounded text-white text-xs font-bold w-32"
                      style={{ background: isExtracting ? '#f97316' : '#0a3d8f', animation: isExtracting ? 'pulse-btn 1s ease-in-out infinite' : 'none' }}
                    >
                      {isExtracting ? '추출 중...' : '지점 추출하기'}
                    </button>
                    <button
                      onClick={() => setShowHelpModal(true)}
                      title="좌표 생성 도움말"
                      className="flex items-center justify-center rounded-full text-white text-xs font-bold"
                      style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', flexShrink: 0 }}
                    >?</button>
                  </div>

                  {/* 추출된 지점카드 */}
                  {extractedPoints.length > 0 && (
                    <div className="space-y-2">
                      {extractedPoints.map((point) => (
                        <div key={point.id} className="rounded px-3 py-2"
                          style={{ background: 'rgba(255,255,255,0.12)' }}>
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{ background: 'rgba(0,0,0,0.35)' }}>
                              {point.id}
                            </div>
                            <div className="flex-1 cursor-pointer" onClick={() => handleExtractedEdit(point)}>
                              <p className="text-sm leading-snug font-medium">
                                {point.source ? (
                                  <span style={{ color: '#a5d6a7' }}>{point.address}{point.destination ? ` (${point.destination})` : ''}</span>
                                ) : (
                                  <span className="text-white">{point.address}{point.destination ? ` (${point.destination})` : ''}</span>
                                )}
                              </p>
                              {/* 돋보기: place_nearest/place_single일 때만 플레이스명 표시 */}
                              <p className="text-xs mt-0.5" style={{ color: '#a5d6a7' }}>
                                <span style={{ display: 'inline-block', width: '4rem' }}>🔍</span>
                                {(point.source === 'place_nearest' || point.source === 'place_single') ? (point.placeName || '') : ''}
                              </p>
                              {/* 핀: coordMessage 또는 케이스6 메시지 */}
                              <p className="text-xs mt-0.5" style={{ color: point.coordMessage?.includes('⚠️') ? '#ffb74d' : point.source ? '#fff176' : 'rgba(255,255,255,0.5)' }}>
                                <span style={{ display: 'inline-block', width: '4rem' }}>📍</span>
                                {point.coordMessage || '좌표 없음. (⚠️주소나 목적지명 확인 필요)'}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: '#a5d6a7' }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-block', width: '4rem' }}>민원내용:</span><span style={{ color: '#a5d6a7' }}>{point.complaint}</span>
                              </p>
                              {point.photoDescription && (
                                <p className="text-xs mt-0.5" style={{ color: '#a5d6a7' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-block', width: '4rem' }}>사진설명:</span>{point.photoDescription}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleExtractedDelete(point.id)}
                              disabled={deletingId !== null}
                              className="text-xs text-white px-2 py-1 rounded flex-shrink-0"
                              style={{ background: deletingId === point.id ? '#888' : '#c62828', cursor: deletingId !== null ? 'not-allowed' : 'pointer' }}>
                              {deletingId === point.id ? '삭제 중' : '삭제'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 직접 입력 아코디언 */}
            <div className="rounded overflow-hidden">
              <button
                onClick={() => setDirectOpen(!directOpen)}
                className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                style={{ background: 'linear-gradient(180deg, #b0bec5 0%, #78909c 100%)' }}
              >
                <span>지점정보 직접 입력하기</span>
                <span className="flex items-center gap-2">
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDirectReset(); }}
                    className="text-white text-xs px-2 py-1 rounded cursor-pointer"
                    style={{ background: '#2e7d32' }}
                  >초기화</div>
                  <span>{directOpen ? '▲' : '▼'}</span>
                </span>
              </button>
              {directOpen && (
                <div className="px-3 py-3 space-y-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  {/* 직접입력 지점카드 목록 */}
                  {directPoints.map((point, index) => (
                    <div key={point.id} className="rounded px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ background: 'rgba(0,0,0,0.35)' }}>
                          D{index + 1}
                        </div>
                        <div className="flex-1 cursor-pointer" onClick={() => handleDirectEdit(point)}>
                          <p className="text-sm leading-snug font-medium">
                            {point.source ? (
                              <span style={{ color: '#a5d6a7' }}>{point.address || '주소 없음'}{point.destination ? ` (${point.destination})` : ''}</span>
                            ) : (
                              <span className="text-white">{point.address || '주소 없음'}{point.destination ? ` (${point.destination})` : ''}</span>
                            )}
                          </p>
                          {/* 돋보기: place_nearest/place_single일 때만 플레이스명 표시 */}
                          <p className="text-xs mt-0.5" style={{ color: '#a5d6a7' }}>
                            <span style={{ display: 'inline-block', width: '4rem' }}>🔍</span>
                            {(point.source === 'place_nearest' || point.source === 'place_single') ? (point.placeName || '') : ''}
                          </p>
                          {/* 핀: coordMessage 또는 케이스6 메시지 */}
                          <p className="text-xs mt-0.5" style={{ color: point.coordMessage?.includes('⚠️') ? '#ffb74d' : point.source ? '#fff176' : 'rgba(255,255,255,0.5)' }}>
                            <span style={{ display: 'inline-block', width: '4rem' }}>📍</span>
                            {point.coordMessage || '좌표 없음. (⚠️주소나 목적지명 확인 필요)'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#a5d6a7' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-block', width: '4rem' }}>민원내용:</span><span style={{ color: '#a5d6a7' }}>{point.complaint}</span>
                          </p>
                          {point.photoDescription && (
                            <p className="text-xs mt-0.5" style={{ color: '#a5d6a7' }}>
                              <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-block', width: '4rem' }}>사진설명:</span>{point.photoDescription}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDirectDelete(point.id)}
                          disabled={deletingId !== null}
                          className="text-xs text-white px-2 py-1 rounded flex-shrink-0"
                          style={{ background: deletingId === point.id ? '#888' : '#c62828', cursor: deletingId !== null ? 'not-allowed' : 'pointer' }}>
                          {deletingId === point.id ? '삭제 중' : '삭제'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 지점 추가 아이콘 */}
                  <div
                    onClick={() => handleDirectAdd()}
                    className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer mx-auto mt-1"
                    style={{ background: 'rgba(255,255,255,0.2)', border: '2px dashed rgba(255,255,255,0.5)' }}
                  >
                    <span className="text-white text-xl font-bold">+</span>
                  </div>
                </div>
              )}
            </div>

            {/* 추가 지점 아코디언 */}
            <div className="rounded overflow-hidden">
              <button
                onClick={() => setAdditionalOpen(!additionalOpen)}
                className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                style={{ background: 'linear-gradient(180deg, #6a3fa0 0%, #4a2080 100%)' }}
              >
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                    <polygon points="7,0 14,7 7,14 0,7" fill="#f97316" stroke="none"/>
                  </svg>
                  추가 지점 입력하기
                  {additionalPoints.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#f97316', color: 'white' }}>
                      {additionalPoints.length}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {additionalPoints.length > 0 && (
                    <div
                      onClick={(e) => { e.stopPropagation(); handleAdditionalReset(); }}
                      className="text-white text-xs px-2 py-1 rounded cursor-pointer"
                      style={{ background: '#7b1fa2' }}
                    >초기화</div>
                  )}
                  <span>{additionalOpen ? '▲' : '▼'}</span>
                </span>
              </button>
              {additionalOpen && (
                <div className="px-3 py-3 space-y-2" style={{ background: 'rgba(106,63,160,0.15)' }}>
                  {/* 추가지점 설명 */}
                  <p className="text-xs px-1" style={{ color: 'rgba(200,160,255,0.85)' }}>
                    최적화 경로 완성 후 현장에서 추가되는 민원 지점입니다. 지점을 입력하면 지도에 마름모 마커로 표시됩니다.
                  </p>
                  {/* 추가지점 카드 목록 */}
                  {additionalPoints.map((point, index) => (
                    <div key={point.id} className="rounded px-3 py-2"
                      style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)' }}>
                      <div className="flex justify-between items-start gap-2">
                        {/* 마름모 마커 */}
                        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '28px', height: '28px' }}>
                          <svg width="26" height="26" viewBox="0 0 26 26">
                            <polygon points="13,1 25,13 13,25 1,13" fill="#f97316" stroke="none"/>
                            <text x="13" y="17" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white">A{index + 1}</text>
                          </svg>
                        </div>
                        <div className="flex-1 cursor-pointer" onClick={() => handleAdditionalEdit(point)}>
                          <p className="text-sm leading-snug font-medium">
                            <span style={{ color: point.source ? '#fbbf77' : 'white' }}>
                              {point.address || '주소 없음'}{point.destination ? ` (${point.destination})` : ''}
                            </span>
                          </p>
                          {(point.source === 'place_nearest' || point.source === 'place_single') && point.placeName && (
                            <p className="text-xs mt-0.5" style={{ color: '#fbbf77' }}>🔍 {point.placeName}</p>
                          )}
                          <p className="text-xs mt-0.5" style={{ color: point.coordMessage?.includes('⚠️') ? '#ffb74d' : point.source ? '#fde68a' : 'rgba(255,255,255,0.5)' }}>
                            📍 {point.coordMessage || '좌표 없음'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#fbbf77' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-block', width: '4rem' }}>민원내용:</span>
                            {point.complaint}
                          </p>
                          {point.insertAfterOrder != null && (
                            <p className="text-xs mt-0.5" style={{ color: '#c4b5fd' }}>
                              📌 {point.insertAfterOrder}번 지점 다음 삽입
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAdditionalDelete(point.id)}
                          disabled={deletingId !== null}
                          className="text-xs text-white px-2 py-1 rounded flex-shrink-0"
                          style={{ background: deletingId === point.id ? '#888' : '#c62828', cursor: deletingId !== null ? 'not-allowed' : 'pointer' }}>
                          {deletingId === point.id ? '삭제 중' : '삭제'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* 추가 버튼 */}
                  <div
                    onClick={handleAdditionalAdd}
                    className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer mx-auto mt-1"
                    style={{ background: 'rgba(249,115,22,0.3)', border: '2px dashed rgba(249,115,22,0.7)' }}
                  >
                    <span className="text-white text-xl font-bold">+</span>
                  </div>
                </div>
              )}
            </div>

            {/* 최적화 경로 생성하기 */}
            <div className="rounded mt-2" style={{ background: '#0d2444' }}>
              <button
                onClick={handleGenerateRoute}
                className="w-full py-3 text-white text-sm font-medium"
                style={{ opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}
              >{isGenerating ? '경로 생성 중...' : '최적화 경로 생성하기'}</button>
            </div>

            {/* 오늘 버전 이력 */}
            {currentRoute?.history && currentRoute.history.length > 0 && (
              <div className="mt-2 px-1">
                {currentRoute.history.map((h) => {
                  const d = new Date(h.createdAt);
                  const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                  return (
                    <div key={h.version} style={{ color: 'rgba(180,210,255,0.55)', fontSize: '11px', lineHeight: '1.9' }}>
                      {currentRoute.date} 버전{h.version} · {timeStr}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* 관리자 인증 모달 */}
      {showAuthModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-lg px-6 py-6 w-72" style={{ background: '#1a3a6e' }}>
            <h2 className="text-white font-bold text-base text-center mb-4">관리자 인증</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
              placeholder="비밀번호"
              className="w-full px-3 py-2 rounded text-sm mb-2 outline-none"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
            />
            {authError && (
              <p className="text-red-300 text-xs text-center mb-2">{authError}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={handleAuthClose}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ background: '#455a64' }}>닫기</button>
              <button onClick={handleAuth}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#0a3d8f' }}>인증</button>
            </div>
          </div>
        </div>
      )}
      {/* 직접 입력 지점정보 모달 */}
      {showDirectModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-lg px-5 py-5 w-80 max-h-screen overflow-y-auto" style={{ background: '#1a3a6e' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-white text-blue-900 text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {editingPoint ? `D${directPoints.findIndex(p => p.id === editingPoint.id) + 1}` : `D${directPoints.length + 1}`}
                </span>
                지점정보 {editingPoint ? '수정' : '입력'}
              </h2>
              <span className="text-white cursor-pointer text-lg" onClick={() => setShowDirectModal(false)}>✕</span>
            </div>

            {/* 위치정보 묶음 */}
            <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="mb-2">
                <label className="text-blue-200 text-xs mb-1 block">주소</label>
                <input type="text" value={directForm.address} placeholder=""
                  onChange={(e) => { setDirectForm((prev) => ({ ...prev, address: e.target.value })); setDirectCoordStatus('idle'); }}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', color: directCoordStatus === 'success' ? '#a5d6a7' : 'white' }} />
              </div>
              <div className="mb-2">
                <label className="text-blue-200 text-xs mb-1 block">목적지</label>
                <input type="text" value={directForm.destination} placeholder=""
                  onChange={(e) => { setDirectForm((prev) => ({ ...prev, destination: e.target.value })); setDirectCoordStatus('idle'); }}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', color: directCoordStatus === 'success' ? '#a5d6a7' : 'white' }} />
              </div>
              <button
                onClick={async () => {
                  setDirectCoordStatus('loading');
                  try {
                    const res = await fetch('/api/geocode', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ address: directForm.address, destination: directForm.destination }),
                    });
                    const data = await res.json();
                    if (res.ok && data.lat && data.lng) {
                      setDirectCoord({ lat: data.lat, lng: data.lng, placeName: data.placeName || null, source: data.source || null, coordMessage: data.coordMessage || null });
                      setDirectCoordStatus('success');
                    } else {
                      setDirectCoordStatus('fail');
                    }
                  } catch (e) {
                    console.error('geocode 오류:', e);
                    setDirectCoordStatus('fail');
                  }
                }}
                disabled={directCoordStatus === 'loading'}
                className="w-full py-2 rounded text-sm font-bold text-white mb-2"
                style={{ background: directCoordStatus === 'loading' ? '#555' : '#0a3d8f' }}
              >
                {directCoordStatus === 'loading' ? '확인 중...' : '좌표 확인하기'}
              </button>
              <p className="text-xs mt-1 text-left"
                style={{ color: directCoordStatus === 'success' ? '#a5d6a7' : directCoordStatus === 'fail' ? '#ef9a9a' : 'rgba(255,255,255,0.5)' }}>
                {directCoordStatus === 'idle' && '주소나 목적지를 입력한 후 좌표 확인 버튼을 누르세요.'}
                {directCoordStatus === 'loading' && '좌표를 검색하는 중입니다...'}
                {directCoordStatus === 'success' && '✅ 좌표가 확인되었습니다.'}
                {directCoordStatus === 'fail' && '❌ 좌표를 찾지 못했습니다. 주소나 목적지를 다시 확인해주세요.'}
              </p>
              {directCoordStatus === 'success' && directCoord.placeName && (
                <p className="text-xs mt-1 text-left" style={{ color: '#a5d6a7' }}>🔍 {directCoord.placeName}</p>
              )}
              {directCoordStatus === 'success' && (
                <p className="text-xs mt-1 text-left" style={{ color: directCoord.coordMessage?.includes('⚠️') ? '#ffb74d' : '#fff176' }}>📍 {directCoord.coordMessage || ''}</p>
              )}
            </div>

            {/* 민원내용 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">민원내용</label>
              <input type="text" value={directForm.complaint} placeholder=""
                onChange={(e) => setDirectForm((prev) => ({ ...prev, complaint: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#a5d6a7' }} />
            </div>

            {/* 담당자 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">담당자</label>
              <input type="text" value={directForm.manager} placeholder=""
                onChange={(e) => setDirectForm((prev) => ({ ...prev, manager: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#a5d6a7' }} />
            </div>

            {/* 현장사진 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">현장사진</label>
              {directForm.photoUrl && (
                <img src={directForm.photoUrl} alt="현장사진" className="w-full rounded mb-2" />
              )}
              <label className="flex items-center justify-center w-full py-2 rounded cursor-pointer text-white text-xs font-medium gap-1"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                📷 사진 선택
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setDirectForm((prev) => ({ ...prev, photoUrl: url }));
                    }
                    e.target.value = '';
                  }} />
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowDirectModal(false)}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ background: '#455a64' }}>취소</button>
              <button onClick={handleDirectSave}
                disabled={isSaving}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: isSaving ? '#555' : '#0a3d8f' }}>
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* draft-route 복원 확인 팝업 */}
      {showDraftRestoreModal && pendingDraft && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-lg px-5 py-5 w-80" style={{ background: '#1a3a6e' }}>
            <h2 className="text-white font-bold text-base mb-3">📋 이전 작업 내역 복원</h2>
            <p className="text-blue-200 text-sm mb-2">오늘 작업하던 내역이 있습니다.</p>
            <div className="rounded px-3 py-2 mb-4" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <p className="text-white text-xs">📅 {new Date(pendingDraft.lastModified).toLocaleString('ko-KR')}</p>
              {pendingDraft.extractedPoints?.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#a5d6a7' }}>🔍 추출 지점 {pendingDraft.extractedPoints.length}건</p>
              )}
              {pendingDraft.directPoints?.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#a5d6a7' }}>✏️ 직접입력 지점 {pendingDraft.directPoints.length}건</p>
              )}
              {(pendingDraft as any).additionalPoints?.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#fbbf77' }}>◆ 추가지점 {(pendingDraft as any).additionalPoints.length}건</p>
              )}
            </div>
            <p className="text-blue-200 text-xs mb-4">복원하시겠습니까? 취소하면 이전 내역이 삭제됩니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  localStorage.removeItem('draft-route');
                  setPendingDraft(null);
                  setShowDraftRestoreModal(false);
                  setActiveTab('input');
                }}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ background: '#455a64' }}>취소 (삭제)</button>
              <button
                onClick={() => {
                  if (pendingDraft.extractedPoints?.length > 0) setExtractedPoints(pendingDraft.extractedPoints);
                  if (pendingDraft.directPoints?.length > 0) setDirectPoints(pendingDraft.directPoints);
                  if ((pendingDraft as any).additionalPoints?.length > 0) setAdditionalPoints((pendingDraft as any).additionalPoints);
                  setPendingDraft(null);
                  setShowDraftRestoreModal(false);
                  setActiveTab('input');
                }}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#0a3d8f' }}>복원하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 잠금 오버레이 */}
      {(isExtracting || isResetting || isGenerating || deletingId !== null) && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)', cursor: 'not-allowed' }} />
      )}

      {/* 추가 지점 입력/수정 모달 */}
      {showAdditionalModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-lg px-5 py-5 w-80 max-h-screen overflow-y-auto" style={{ background: '#1a3a6e', border: '2px solid rgba(249,115,22,0.5)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28">
                  <polygon points="14,1 27,14 14,27 1,14" fill="#f97316" stroke="none"/>
                  <text x="14" y="18" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">
                    {editingAdditionalPoint
                      ? `A${additionalPoints.findIndex(p => p.id === editingAdditionalPoint.id) + 1}`
                      : `A${additionalPoints.length + 1}`}
                  </text>
                </svg>
                추가지점 {editingAdditionalPoint ? '수정' : '입력'}
              </h2>
              <span className="text-white cursor-pointer text-lg" onClick={() => setShowAdditionalModal(false)}>✕</span>
            </div>

            {/* 위치정보 묶음 */}
            <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="mb-2">
                <label className="text-blue-200 text-xs mb-1 block">주소</label>
                <input type="text" value={additionalForm.address} placeholder=""
                  onChange={(e) => { setAdditionalForm((prev) => ({ ...prev, address: e.target.value })); setAdditionalCoordStatus('idle'); }}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', color: additionalCoordStatus === 'success' ? '#fbbf77' : 'white' }} />
              </div>
              <div className="mb-2">
                <label className="text-blue-200 text-xs mb-1 block">목적지</label>
                <input type="text" value={additionalForm.destination} placeholder=""
                  onChange={(e) => { setAdditionalForm((prev) => ({ ...prev, destination: e.target.value })); setAdditionalCoordStatus('idle'); }}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', color: additionalCoordStatus === 'success' ? '#fbbf77' : 'white' }} />
              </div>
              <button
                onClick={async () => {
                  setAdditionalCoordStatus('loading');
                  try {
                    const res = await fetch('/api/geocode', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ address: additionalForm.address, destination: additionalForm.destination }),
                    });
                    const data = await res.json();
                    if (res.ok && data.lat && data.lng) {
                      setAdditionalCoord({ lat: data.lat, lng: data.lng, placeName: data.placeName || null, source: data.source || null, coordMessage: data.coordMessage || null });
                      setAdditionalCoordStatus('success');
                    } else {
                      setAdditionalCoordStatus('fail');
                    }
                  } catch { setAdditionalCoordStatus('fail'); }
                }}
                disabled={additionalCoordStatus === 'loading'}
                className="w-full py-2 rounded text-sm font-bold text-white mb-2"
                style={{ background: additionalCoordStatus === 'loading' ? '#555' : '#7b2d00' }}
              >
                {additionalCoordStatus === 'loading' ? '확인 중...' : '좌표 확인하기'}
              </button>
              <p className="text-xs mt-1"
                style={{ color: additionalCoordStatus === 'success' ? '#fbbf77' : additionalCoordStatus === 'fail' ? '#ef9a9a' : 'rgba(255,255,255,0.5)' }}>
                {additionalCoordStatus === 'idle' && '주소나 목적지를 입력한 후 좌표 확인 버튼을 누르세요.'}
                {additionalCoordStatus === 'loading' && '좌표를 검색하는 중입니다...'}
                {additionalCoordStatus === 'success' && '✅ 좌표가 확인되었습니다.'}
                {additionalCoordStatus === 'fail' && '❌ 좌표를 찾지 못했습니다.'}
              </p>
              {additionalCoordStatus === 'success' && additionalCoord.placeName && (
                <p className="text-xs mt-1" style={{ color: '#fbbf77' }}>🔍 {additionalCoord.placeName}</p>
              )}
              {additionalCoordStatus === 'success' && (
                <p className="text-xs mt-1" style={{ color: additionalCoord.coordMessage?.includes('⚠️') ? '#ffb74d' : '#fde68a' }}>📍 {additionalCoord.coordMessage || ''}</p>
              )}
            </div>

            {/* 민원내용 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">민원내용</label>
              <input type="text" value={additionalForm.complaint}
                onChange={(e) => setAdditionalForm((prev) => ({ ...prev, complaint: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fbbf77' }} />
            </div>

            {/* 담당자 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">담당자</label>
              <input type="text" value={additionalForm.manager}
                onChange={(e) => setAdditionalForm((prev) => ({ ...prev, manager: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fbbf77' }} />
            </div>

            {/* 현장사진 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">현장사진</label>
              {additionalForm.photoUrl && (
                <img src={additionalForm.photoUrl} alt="현장사진" className="w-full rounded mb-2" />
              )}
              <label className="flex items-center justify-center w-full py-2 rounded cursor-pointer text-white text-xs font-medium gap-1"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                📷 사진 선택
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setAdditionalForm((prev) => ({ ...prev, photoUrl: url }));
                    }
                    e.target.value = '';
                  }} />
              </label>
            </div>

            {/* 경로 삽입 위치 선택 */}
            <div className="mb-4 rounded-lg p-3" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)' }}>
              <label className="text-orange-200 text-xs mb-2 block font-bold">📌 경로 삽입 위치 (선택)</label>
              <p className="text-xs mb-2" style={{ color: 'rgba(255,200,150,0.8)' }}>
                현재 경로의 어느 지점 다음에 넣을지 선택하세요. 선택하지 않으면 지도에만 표시됩니다.
              </p>
              <select
                value={additionalInsertAfter ?? ''}
                onChange={(e) => setAdditionalInsertAfter(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-3 py-2 rounded text-sm text-white"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(249,115,22,0.5)' }}>
                <option value="" style={{ background: '#1a3a6e' }}>선택 안 함 (지도에만 표시)</option>
                {currentRoute?.points
                  .filter(p => p.source !== 'fixed' || p.order === 0)
                  .map(p => (
                    <option key={p.order} value={p.order} style={{ background: '#1a3a6e' }}>
                      {p.order === 0 ? '출발지(시청) 다음' : `${p.order}번 (${p.destination || p.address}) 다음`}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowAdditionalModal(false)}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ background: '#455a64' }}>취소</button>
              <button onClick={handleAdditionalSave}
                disabled={isSaving}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: isSaving ? '#555' : '#7b2d00' }}>
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추출지점 수정 모달 */}
      {showExtractEditModal && extractEditTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-lg px-5 py-5 w-80 max-h-screen overflow-y-auto" style={{ background: '#1a3a6e' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-white text-blue-900 text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {extractEditTarget?.id}
                </span>
                지점정보 수정
              </h2>
              <span className="text-white cursor-pointer text-lg" onClick={() => setShowExtractEditModal(false)}>✕</span>
            </div>

            {/* 위치정보 묶음 */}
            <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="mb-2">
                <label className="text-blue-200 text-xs mb-1 block">주소</label>
                <input
                  type="text"
                  placeholder=""
                  value={extractEditForm.address}
                  onChange={(e) => { setExtractEditForm((prev) => ({ ...prev, address: e.target.value })); setExtractEditCoordStatus('idle'); }}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', color: (extractEditCoordStatus === 'success' && extractEditCoord.lat) ? '#a5d6a7' : 'white' }}
                />
              </div>
              <div className="mb-3">
                <label className="text-blue-200 text-xs mb-1 block">목적지</label>
                <input
                  type="text"
                  placeholder=""
                  value={extractEditForm.destination}
                  onChange={(e) => { setExtractEditForm((prev) => ({ ...prev, destination: e.target.value })); setExtractEditCoordStatus('idle'); }}
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.15)', color: (extractEditCoordStatus === 'success' && (extractEditCoord.source === 'place_single' || extractEditCoord.source === 'place_nearest')) ? '#a5d6a7' : 'white' }}
                />
              </div>

              {/* 좌표 확인 버튼 */}
              <button
                onClick={handleExtractEditCheckCoord}
                disabled={extractEditCoordStatus === 'loading'}
                className="w-full py-2 rounded text-sm font-bold text-white"
                style={{ background: extractEditCoordStatus === 'loading' ? '#555' : '#0a3d8f' }}
              >
                {extractEditCoordStatus === 'loading' ? '확인 중...' : '📍 좌표 확인하기'}
              </button>

              {/* 좌표 상태 안내 */}
              <p className="text-xs mt-2 text-left"
                style={{ color: extractEditCoordStatus === 'success' ? '#a5d6a7' : extractEditCoordStatus === 'fail' ? '#ef9a9a' : 'rgba(255,255,255,0.5)' }}>
                {extractEditCoordStatus === 'idle' && '주소나 목적지를 수정한 후 좌표 확인 버튼을 누르세요.'}
                {extractEditCoordStatus === 'loading' && '좌표를 검색하는 중입니다...'}
                {extractEditCoordStatus === 'success' && '✅ 좌표가 확인되었습니다.'}
                {extractEditCoordStatus === 'fail' && '❌ 좌표를 찾지 못했습니다. 주소나 목적지를 다시 확인해주세요.'}
              </p>
              {extractEditCoordStatus === 'success' && extractEditCoord.placeName && (
                <p className="text-xs mt-1 text-left" style={{ color: '#a5d6a7' }}>🔍 {extractEditCoord.placeName}</p>
              )}
              {extractEditCoordStatus === 'success' && (
                <p className="text-xs mt-1 text-left" style={{ color: extractEditCoord.coordMessage?.includes('⚠️') ? '#ffb74d' : '#fff176' }}>📍 {extractEditCoord.coordMessage || ''}</p>
              )}
            </div>

            {/* 민원번호 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">민원번호</label>
              <input
                type="number"
                placeholder="예) 12"
                value={extractEditForm.originalId}
                onChange={(e) => setExtractEditForm((prev) => ({ ...prev, originalId: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#a5d6a7' }}
              />
            </div>

            {/* 민원내용 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">민원내용</label>
              <input
                type="text"
                placeholder="예) 불법 현수막"
                value={extractEditForm.complaint}
                onChange={(e) => setExtractEditForm((prev) => ({ ...prev, complaint: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#a5d6a7' }}
              />
            </div>
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">담당자</label>
              <input
                type="text"
                placeholder=""
                value={extractEditForm.manager}
                onChange={(e) => setExtractEditForm((prev) => ({ ...prev, manager: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#a5d6a7' }}
              />
            </div>

            {/* 현장사진 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">현장사진</label>
              {extractEditTarget?.photoUrl && extractEditTarget.photoUrl !== '' && (
                <img src={extractEditTarget.photoUrl} alt="현장사진"
                  className="w-full rounded mb-2" />
              )}
              {extractEditTarget?.photoDescription && (
                <p className="text-xs mb-2" style={{ color: '#a5d6a7' }}>
                  {extractEditTarget.photoDescription}
                </p>
              )}
              {extractEditForm.photoUrl ? (
                <div className="relative w-full h-36">
                  <img src={extractEditForm.photoUrl} alt="현장사진"
                    className="w-full h-36 object-cover rounded" />
                  <button
                    onClick={() => setExtractEditForm((prev) => ({ ...prev, photoUrl: '' }))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ background: '#c62828' }}>✕</button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-12 rounded cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.4)' }}>
                  <p className="text-blue-200 text-xs">📷 사진 선택</p>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setExtractEditForm((prev) => ({ ...prev, photoUrl: url }));
                      }
                      e.target.value = '';
                    }} />
                </label>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowExtractEditModal(false)}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ background: '#455a64' }}>취소</button>
              <button onClick={handleExtractEditSave}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#0a3d8f' }}>저장</button>
            </div>
          </div>
        </div>
      )}
      {/* 지점 상세정보 팝업 */}
      {showDetailModal && selectedPoint && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => { setShowDetailModal(false); document.body.style.overflow = ''; }}>
          <div className="rounded-lg px-5 py-5 w-11/12 max-h-screen overflow-y-auto"
            style={{ background: (() => { const st = pointStatuses[statusKey(selectedPoint)]; return st && ['민원처리완료','기처리','확인불가'].includes(st.status) ? '#1a3a6e' : '#7a2800'; })() }}
            onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-base flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-full bg-white text-blue-900 text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {selectedPoint.order}
                </span>
                <span className="truncate">
                  {selectedPoint.destination
                    ? `${selectedPoint.address} (${selectedPoint.destination})`
                    : selectedPoint.address}
                </span>
              </h2>
              <span className="text-white cursor-pointer text-lg" onClick={() => { setShowDetailModal(false); document.body.style.overflow = ''; }}>✕</span>
            </div>

            {/* 정보 목록 */}
            {(() => {
              const st = pointStatuses[statusKey(selectedPoint)];
              const curStatus = st?.status || '';
              const curMemo = st?.memo || '';
              const isDone = ['민원처리완료','기처리','확인불가'].includes(curStatus);
              return (
                <div className="space-y-2">
                  {[
                    { label: '주소', value: selectedPoint.address || '' },
                    { label: '목적지', value: selectedPoint.destination || '' },
                    { label: '플레이스명', value: (selectedPoint.source === 'place_nearest' || selectedPoint.source === 'place_single') ? (selectedPoint.placeName || '') : '' },
                    { label: '좌표메시지', value: selectedPoint.coordMessage || '' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 items-start">
                      <span className="text-blue-300 text-xs w-16 flex-shrink-0 pt-0.5">{label}</span>
                      <span className="text-xs flex-1" style={{ color: selectedPoint.coordMessage?.includes('⚠️') && label === '좌표메시지' ? '#ffb74d' : 'white' }}>{value}</span>
                    </div>
                  ))}

                  {/* 좌표확인 아래 수평선 */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '4px', marginBottom: '4px' }} />

                  {[
                    { label: '민원번호', value: selectedPoint.originalId ? `${selectedPoint.originalId}번` : '' },
                    { label: '민원내용', value: selectedPoint.complaint || '' },
                    { label: '담당자', value: selectedPoint.manager || '' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 items-start">
                      <span className="text-blue-300 text-xs w-16 flex-shrink-0 pt-0.5">{label}</span>
                      <span className="text-white text-xs flex-1">{value}</span>
                    </div>
                  ))}

                  {/* 현장사진 */}
                  <div className="flex gap-3 items-start">
                    <span className="text-blue-300 text-xs w-16 flex-shrink-0 pt-0.5">현장사진</span>
                    <div className="flex-1">
                      {selectedPoint.photoUrl ? (
                        <img src={selectedPoint.photoUrl} alt="현장사진" className="w-full rounded" />
                      ) : (
                        <div className="rounded h-20 flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)' }}>
                          <span className="text-blue-300 text-xs">사진 없음</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 사진설명 - 레이블 없이 값만 표시 */}
                  {selectedPoint.photoDescription && (
                    <div className="flex gap-3 items-start">
                      <span className="w-16 flex-shrink-0" />
                      <span className="text-xs flex-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{selectedPoint.photoDescription}</span>
                    </div>
                  )}

                  {/* 작업상태 */}
                  <div className="mt-1 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    {isAuthenticated ? (
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <span className="text-blue-300 text-xs w-16 flex-shrink-0">작업상태</span>
                          <select
                            className="flex-1 rounded px-2 py-1.5 text-xs text-white font-bold"
                            style={{ background: isDone ? 'rgba(255,255,255,0.15)' : 'rgba(235,100,0,0.65)', border: '1px solid rgba(255,255,255,0.3)' }}
                            value={curStatus}
                            onChange={(e) => handleSaveStatus(e.target.value, curMemo)}
                            disabled={savingStatus}>
                            <option value="" style={{ background: '#1a3a6e' }}></option>
                            <option value="민원처리완료" style={{ background: '#7a2800' }}>민원처리완료</option>
                            <option value="기처리" style={{ background: '#7a2800' }}>기처리</option>
                            <option value="확인불가" style={{ background: '#7a2800' }}>확인불가</option>
                          </select>
                        </div>
                        <div className="flex gap-2 items-start">
                          <span className="text-blue-300 text-xs w-16 flex-shrink-0 pt-1">작업메모</span>
                          <textarea
                            className="flex-1 rounded px-2 py-1.5 text-xs text-white resize-none"
                            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)' }}
                            rows={2}
                            placeholder="메모 입력..."
                            defaultValue={curMemo}
                            onBlur={(e) => { if (e.target.value !== curMemo) handleSaveStatus(curStatus, e.target.value); }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-3 items-start">
                          <span className="text-blue-300 text-xs w-16 flex-shrink-0">작업상태</span>
                          <span className="text-xs font-bold" style={{ color: '#80cbc4' }}>{curStatus}</span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <span className="text-blue-300 text-xs w-16 flex-shrink-0">작업메모</span>
                          <span className="text-xs text-white flex-1">{curMemo}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 티맵 / 네이버지도 / 타임마크 버튼 - 맨 아래 */}
            <div className="flex gap-2 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              {/* 타임마크 카메라 버튼 */}
              <button
                onClick={() => window.location.href = 'timemarkcamera://'}
                title="타임마크 촬영"
                className="rounded flex items-center justify-center"
                style={{ background: '#f9d835', width: '44px', flexShrink: 0, minHeight: '36px' }}>
                <svg width="22" height="20" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z" fill="#1a1a1a"/>
                  <circle cx="12" cy="12" r="3.5" fill="#1a1a1a"/>
                </svg>
              </button>
              <button
                onClick={() => window.open(`tmap://route?goalname=${encodeURIComponent(selectedPoint.destination || selectedPoint.address)}&goaly=${selectedPoint.lat}&goalx=${selectedPoint.lng}`)}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#0a3d8f' }}>티맵</button>
              <button
                onClick={() => window.open(`nmap://navigation?dlat=${selectedPoint.lat}&dlng=${selectedPoint.lng}&dname=${encodeURIComponent(selectedPoint.destination || selectedPoint.address)}&appname=patrol-optimizer`)}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#1b5e20' }}>네이버지도</button>
            </div>
          </div>
        </div>
      )}

      {/* 좌표 생성 도움말 팝업 */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowHelpModal(false)}>
          <div
            className="rounded-xl mx-3 overflow-y-auto"
            style={{ background: '#1a3a6e', border: '1px solid rgba(100,180,255,0.3)', maxHeight: '85vh', width: '100%', maxWidth: '480px' }}
            onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <span className="text-white font-bold text-sm">📍 좌표 생성 도움말</span>
              <button onClick={() => setShowHelpModal(false)} className="text-white text-lg">✕</button>
            </div>

            {/* 표 */}
            <div className="px-4 pt-3 pb-2 overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                    {['민원요청주소', '좌표생성기준', '플레이스명', '좌표 생성 메시지'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', color: '#90caf9', fontWeight: 'bold', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['도로명 + 목적지명 있음', '도로명 주소 직접 변환', '❌', '도로명 주소로 좌표 생성'],
                    ['도로명 + 목적지명 없음', '도로명 주소 직접 변환', '❌', '도로명 주소로 좌표 생성'],
                    ['지번 + 목적지명 있음\n(POI 보정 성공)', '목적지명 POI 검색\n100m 내 최근접', '✅', '목적지명으로 좌표 보정'],
                    ['지번 + 목적지명 있음\n(POI 보정 실패)', '지번 주소 중심점', '❌', '지번 주소로 좌표 생성'],
                    ['지번 + 목적지명 없음', '지번 주소 중심점', '❌', '지번 주소로 좌표 생성'],
                    ['목적지명만 (1건)', '목적지명 POI 검색', '✅', '목적지명으로 좌표 생성'],
                    ['목적지명만 (복수)', 'POI 검색 첫번째 결과', '✅', '목적지명으로 좌표 생성\n(⚠️복수 검색됨, 확인 필요)'],
                    ['주소·목적지 모두 없음', '좌표 생성 불가', '❌', '좌표 없음.\n(⚠️주소나 목적지명 확인 필요)'],
                  ].map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '6px 8px',
                          color: j === 2 ? (cell === '✅' ? '#a5d6a7' : '#ef9a9a') : j === 3 ? '#fff176' : 'rgba(255,255,255,0.85)',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                          whiteSpace: 'pre-wrap',
                          verticalAlign: 'top',
                          fontSize: '10px',
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 설명 */}
            <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {[
                '📌 도로명 주소는 건물 단위까지 식별되므로 별도 POI 검색 없이 주소로 직접 좌표를 생성합니다.',
                '📌 지번 주소는 토지(필지) 중심점 좌표를 생성하므로 현장 찾기가 어려울 수 있습니다. 목적지명이 있는 경우 반경 100m 내 POI 검색으로 좌표를 보정합니다.',
                '📌 목적지명만 있는 경우 복수의 검색 결과가 나오면 첫 번째 결과를 사용합니다. ⚠️ 경고가 표시되면 지점 편집에서 확인해 주세요.',
                '📌 좌표가 없는 지점은 최적화 경로 생성에서 제외됩니다. 지점 편집에서 주소나 목적지명을 입력해 주세요.',
              ].map((text, i) => (
                <p key={i} style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11px', lineHeight: '1.6' }}>{text}</p>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ★ 추가지점 포함 여부 3버튼 다이얼로그 */}
      {showAdditionalConfirm && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, background: 'rgba(0,0,0,0.65)' }}>
          <div style={{ background: '#1a3a6e', borderRadius: '12px', padding: '24px 20px', width: '88%', maxWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <p style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>추가지점 처리</p>
            <p style={{ color: 'rgba(200,220,255,0.85)', fontSize: '12px', marginBottom: '20px', lineHeight: '1.6' }}>
              추가지점 {additionalPoints.filter(p => p.lat && p.lng).length}개가 있습니다.<br />
              최적화 경로 생성에 포함하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setShowAdditionalConfirm(false); additionalConfirmResolveRef.current?.('include'); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#0a3d8f', color: 'white', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                포함
              </button>
              <button
                onClick={() => { setShowAdditionalConfirm(false); additionalConfirmResolveRef.current?.('exclude'); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#455a64', color: 'white', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                미포함
              </button>
              <button
                onClick={() => { setShowAdditionalConfirm(false); additionalConfirmResolveRef.current?.('cancel'); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#7a2800', color: 'white', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}