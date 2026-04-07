'use client';

import { useState } from 'react';

export type AdditionalPointData = {
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
  insertAfterOrder?: number | string | null;
};

export type PointStatusData = {
  status: string;
  memo: string;
  updatedAt: number;
};

export type InsertOption = {
  value: number | string | null;
  label: string;
};

type Props = {
  // 표시 정보
  label: string;           // "A1", "A2" 등
  point: AdditionalPointData;
  apSt?: PointStatusData;
  insertOptions: InsertOption[];
  isNew?: boolean;         // true면 신규 입력 모드 (취소/저장 버튼)

  // 콜백
  onClose: () => void;
  onSave: (data: {
    address: string;
    destination: string;
    complaint: string;
    manager: string;
    photoUrl: string;
    lat: number | null;
    lng: number | null;
    placeName: string | null;
    source: string | null;
    coordMessage: string | null;
    insertAfterOrder: number | string | null;
    status: string;
    memo: string;
  }) => Promise<void>;
  onDelete?: () => void;
  onPhotoUpload?: (file: File) => Promise<string | null>;
};

export default function AdditionalPointModal({
  label, point, apSt, insertOptions, isNew = false,
  onClose, onSave, onDelete, onPhotoUpload,
}: Props) {
  const [address, setAddress] = useState(point.address || '');
  const [destination, setDestination] = useState(point.destination || '');
  const [complaint, setComplaint] = useState(point.complaint || '');
  const [manager, setManager] = useState(point.manager || '');
  const [photoUrl, setPhotoUrl] = useState(point.photoUrl || '');
  const [coordStatus, setCoordStatus] = useState<'idle'|'loading'|'success'|'fail'>(
    point.lat && point.lng ? 'success' : 'idle'
  );
  const [lat, setLat] = useState<number | null>(point.lat ?? null);
  const [lng, setLng] = useState<number | null>(point.lng ?? null);
  const [placeName, setPlaceName] = useState<string | null>(point.placeName ?? null);
  const [source, setSource] = useState<string | null>(point.source ?? null);
  const [coordMessage, setCoordMessage] = useState<string | null>(point.coordMessage ?? null);
  const [localInsert, setLocalInsert] = useState<number | string | null>(point.insertAfterOrder ?? null);
  const [localStatus, setLocalStatus] = useState(apSt?.status || '');
  const [localMemo, setLocalMemo] = useState(apSt?.memo || '');
  const [saving, setSaving] = useState(false);

  const isDone = ['민원처리완료', '기처리', '확인불가'].includes(localStatus);

  const handleCheckCoord = async () => {
    if (!address && !destination) return;
    setCoordStatus('loading');
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, destination }),
      });
      const data = await res.json();
      if (res.ok && data.lat && data.lng) {
        setLat(data.lat); setLng(data.lng);
        setPlaceName(data.placeName || null);
        setSource(data.source || null);
        setCoordMessage(data.coordMessage || null);
        setCoordStatus('success');
      } else {
        setCoordStatus('fail');
      }
    } catch { setCoordStatus('fail'); }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      address, destination, complaint, manager, photoUrl,
      lat, lng, placeName, source, coordMessage,
      insertAfterOrder: localInsert,
      status: localStatus, memo: localMemo,
    });
    setSaving(false);
  };

  // 비신규(수정) 모드에서 상태/삽입위치 변경 시 자동저장
  const autoSave = async (overrides: Partial<Parameters<typeof onSave>[0]> = {}) => {
    if (isNew) return; // 신규 입력 모드에서는 자동저장 안 함
    setSaving(true);
    await onSave({
      address, destination, complaint, manager, photoUrl,
      lat, lng, placeName, source, coordMessage,
      insertAfterOrder: localInsert,
      status: localStatus, memo: localMemo,
      ...overrides,
    });
    setSaving(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}>
      <div
        style={{ background: '#1a3a6e', border: '2px solid rgba(249,115,22,0.5)', borderRadius: '12px', padding: '20px', width: '320px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28">
              <polygon points="14,1 27,14 14,27 1,14" fill="#f97316" stroke="none"/>
              <text x="14" y="18" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif">{label}</text>
            </svg>
            추가지점 {isNew ? '입력' : '수정'}
          </h2>
          <span style={{ color: 'white', cursor: 'pointer', fontSize: '18px' }} onClick={onClose}>✕</span>
        </div>

        {/* 위치정보 묶음 */}
        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ color: '#93c5fd', fontSize: '11px', display: 'block', marginBottom: '4px' }}>주소</label>
            <input type="text" value={address}
              onChange={e => { setAddress(e.target.value); setCoordStatus('idle'); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: coordStatus === 'success' ? '#fbbf77' : 'white', border: 'none', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ color: '#93c5fd', fontSize: '11px', display: 'block', marginBottom: '4px' }}>목적지</label>
            <input type="text" value={destination}
              onChange={e => { setDestination(e.target.value); setCoordStatus('idle'); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: coordStatus === 'success' ? '#fbbf77' : 'white', border: 'none', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <button
            onClick={handleCheckCoord}
            disabled={coordStatus === 'loading'}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', background: coordStatus === 'loading' ? '#555' : '#7b2d00', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}>
            {coordStatus === 'loading' ? '확인 중...' : '좌표 확인하기'}
          </button>
          <p style={{ fontSize: '11px', margin: 0, color: coordStatus === 'success' ? '#fbbf77' : coordStatus === 'fail' ? '#ef9a9a' : 'rgba(255,255,255,0.5)' }}>
            {coordStatus === 'idle' && '주소나 목적지를 입력한 후 좌표 확인 버튼을 누르세요.'}
            {coordStatus === 'loading' && '좌표를 검색하는 중입니다...'}
            {coordStatus === 'success' && '✅ 좌표가 확인되었습니다.'}
            {coordStatus === 'fail' && '❌ 좌표를 찾지 못했습니다.'}
          </p>
          {coordStatus === 'success' && placeName && (
            <p style={{ fontSize: '11px', color: '#fbbf77', marginTop: '4px' }}>🔍 {placeName}</p>
          )}
          {coordStatus === 'success' && coordMessage && (
            <p style={{ fontSize: '11px', color: coordMessage.includes('⚠️') ? '#ffb74d' : '#fde68a', marginTop: '2px' }}>📍 {coordMessage}</p>
          )}
        </div>

        {/* 민원내용 */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#93c5fd', fontSize: '11px', display: 'block', marginBottom: '4px' }}>민원내용</label>
          <input type="text" value={complaint}
            onChange={e => setComplaint(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#fbbf77', border: 'none', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        {/* 담당자 */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#93c5fd', fontSize: '11px', display: 'block', marginBottom: '4px' }}>담당자</label>
          <input type="text" value={manager}
            onChange={e => setManager(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#fbbf77', border: 'none', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        {/* 현장사진 */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ color: '#93c5fd', fontSize: '11px', display: 'block', marginBottom: '4px' }}>현장사진</label>
          {photoUrl ? (
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <img src={photoUrl} alt="현장사진" style={{ width: '100%', borderRadius: '6px', objectFit: 'cover', maxHeight: '140px' }}
                crossOrigin="anonymous" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : null}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '8px', cursor: 'pointer', color: 'white', fontSize: '12px' }}>
            📷 사진 선택
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const localUrl = URL.createObjectURL(file);
                setPhotoUrl(localUrl);
                if (onPhotoUpload) {
                  const url = await onPhotoUpload(file);
                  if (url) setPhotoUrl(url);
                }
                e.target.value = '';
              }} />
          </label>
        </div>

        {/* 작업상태 / 작업메모 */}
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#93c5fd', fontSize: '11px', width: '56px', flexShrink: 0 }}>작업상태</span>
            <select
              value={localStatus}
              onChange={async e => {
                const v = e.target.value;
                setLocalStatus(v);
                await autoSave({ status: v });
              }}
              style={{ flex: 1, borderRadius: '4px', padding: '6px 8px', fontSize: '11px', color: 'white', fontWeight: 'bold', background: isDone ? 'rgba(255,255,255,0.15)' : 'rgba(235,100,0,0.65)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <option value="" style={{ background: '#1a3a6e' }}></option>
              <option value="민원처리완료" style={{ background: '#7a2800' }}>민원처리완료</option>
              <option value="기처리" style={{ background: '#7a2800' }}>기처리</option>
              <option value="확인불가" style={{ background: '#7a2800' }}>확인불가</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ color: '#93c5fd', fontSize: '11px', width: '56px', flexShrink: 0, paddingTop: '6px' }}>작업메모</span>
            <textarea
              value={localMemo}
              onChange={e => setLocalMemo(e.target.value)}
              onBlur={async e => { await autoSave({ memo: e.target.value }); }}
              rows={2} placeholder="메모 입력..."
              style={{ flex: 1, borderRadius: '4px', padding: '6px 8px', fontSize: '11px', color: 'white', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', resize: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* 경로 삽입 위치 + 지점 삭제 */}
        <div style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label style={{ color: '#fed7aa', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>📌 경로 삽입 위치 (선택)</label>
            {onDelete && (
              <button onClick={onDelete}
                style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#c62828', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                지점 삭제
              </button>
            )}
          </div>
          <select
            value={localInsert === null ? '' : String(localInsert)}
            onChange={async e => {
              const v = e.target.value;
              const newInsert = v === '' ? null : v.startsWith('add_') ? v : Number(v);
              setLocalInsert(newInsert);
              await autoSave({ insertAfterOrder: newInsert });
            }}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', color: 'white', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(249,115,22,0.5)' }}>
            {insertOptions.map(opt => (
              <option key={String(opt.value)} value={opt.value === null ? '' : String(opt.value)} style={{ background: '#1a3a6e' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          {isNew ? (
            <>
              <button onClick={onClose}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#455a64', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: saving ? '#555' : '#7b2d00', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => window.location.href = 'timemarkcamera://'}
                title="타임마크 촬영"
                style={{ background: '#f9d835', width: '48px', flexShrink: 0, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
                <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
                  <path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z" fill="#1a1a1a"/>
                  <circle cx="12" cy="12" r="3.5" fill="#1a1a1a"/>
                </svg>
              </button>
              <button onClick={() => window.open(`tmap://route?goalname=${encodeURIComponent(point.destination || point.address)}&goaly=${point.lat}&goalx=${point.lng}`)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#0a3d8f', color: 'white', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>티맵</button>
              <button onClick={() => window.open(`nmap://navigation?dlat=${point.lat}&dlng=${point.lng}&dname=${encodeURIComponent(point.destination || point.address)}&appname=patrol-optimizer`)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1b5e20', color: 'white', fontSize: '13px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>네이버</button>
            </>
          )}
        </div>

        {saving && !isNew && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '8px' }}>저장 중...</div>
        )}
      </div>
    </div>
  );
}
