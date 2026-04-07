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

type SaveData = {
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
};

type Props = {
  label: string;
  point: AdditionalPointData;
  apSt?: PointStatusData;
  insertOptions: InsertOption[];
  isNew?: boolean;
  onClose: () => void;
  onSave: (data: SaveData) => Promise<void>;
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

  const buildData = (overrides: Partial<SaveData> = {}): SaveData => ({
    address, destination, complaint, manager, photoUrl,
    lat, lng, placeName, source, coordMessage,
    insertAfterOrder: localInsert,
    status: localStatus, memo: localMemo,
    ...overrides,
  });

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
      } else { setCoordStatus('fail'); }
    } catch { setCoordStatus('fail'); }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(buildData());
    setSaving(false);
  };

  // 수정 모드에서 자동저장 (팝업 닫지 않음)
  const autoSave = async (overrides: Partial<SaveData> = {}) => {
    if (isNew) return;
    setSaving(true);
    await onSave(buildData(overrides));
    setSaving(false);
  };

  const inputStyle = (highlight = false): React.CSSProperties => ({
    flex: 1,
    padding: '5px 8px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.12)',
    color: highlight ? '#fbbf77' : 'white',
    border: 'none',
    outline: 'none',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  });

  const labelStyle: React.CSSProperties = {
    color: '#90caf9',
    fontSize: '11px',
    width: '56px',
    flexShrink: 0,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const divider = <div style={{ borderTop: '1px solid rgba(255,255,255,0.18)', margin: '10px 0' }} />;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}>
      <div style={{ background: '#1a3a6e', border: '2px solid rgba(249,115,22,0.5)', borderRadius: '12px', padding: '16px 18px', width: '320px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <svg width="26" height="26" viewBox="0 0 26 26">
              <polygon points="13,1 25,13 13,25 1,13" fill="#f97316" stroke="none"/>
              <text x="13" y="17" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif">{label}</text>
            </svg>
            추가지점 {isNew ? '입력' : '수정'}
          </h2>
          <span style={{ color: 'white', cursor: 'pointer', fontSize: '18px' }} onClick={onClose}>✕</span>
        </div>

        {/* 주소 */}
        <div style={rowStyle}>
          <span style={labelStyle}>주소</span>
          <input type="text" value={address}
            onChange={e => { setAddress(e.target.value); setCoordStatus('idle'); }}
            style={inputStyle(coordStatus === 'success')} />
        </div>
        <div style={{ height: '6px' }} />

        {/* 목적지 */}
        <div style={rowStyle}>
          <span style={labelStyle}>목적지</span>
          <input type="text" value={destination}
            onChange={e => { setDestination(e.target.value); setCoordStatus('idle'); }}
            style={inputStyle(coordStatus === 'success')} />
        </div>
        <div style={{ height: '8px' }} />

        {/* 좌표 확인 버튼 */}
        <button onClick={handleCheckCoord} disabled={coordStatus === 'loading'}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', background: coordStatus === 'loading' ? '#555' : '#7b2d00', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginBottom: '6px' }}>
          {coordStatus === 'loading' ? '확인 중...' : '좌표 확인하기'}
        </button>

        {/* 좌표 메시지 */}
        <p style={{ fontSize: '11px', margin: '0 0 2px', color: coordStatus === 'success' ? '#fbbf77' : coordStatus === 'fail' ? '#ef9a9a' : 'rgba(255,255,255,0.5)' }}>
          {coordStatus === 'idle' && '주소나 목적지를 입력한 후 좌표 확인 버튼을 누르세요.'}
          {coordStatus === 'loading' && '좌표를 검색하는 중입니다...'}
          {coordStatus === 'success' && '✅ 좌표가 확인되었습니다.'}
          {coordStatus === 'fail' && '❌ 좌표를 찾지 못했습니다.'}
        </p>
        {coordStatus === 'success' && placeName && (
          <p style={{ fontSize: '11px', color: '#fbbf77', margin: '2px 0' }}>🔍 {placeName}</p>
        )}
        {coordStatus === 'success' && coordMessage && (
          <p style={{ fontSize: '11px', color: coordMessage.includes('⚠️') ? '#ffb74d' : '#fde68a', margin: '2px 0' }}>📍 {coordMessage}</p>
        )}

        {divider}

        {/* 민원내용 */}
        <div style={rowStyle}>
          <span style={labelStyle}>민원내용</span>
          <input type="text" value={complaint} onChange={e => setComplaint(e.target.value)} style={inputStyle(true)} />
        </div>
        <div style={{ height: '6px' }} />

        {/* 담당자 */}
        <div style={rowStyle}>
          <span style={labelStyle}>담당자</span>
          <input type="text" value={manager} onChange={e => setManager(e.target.value)} style={inputStyle(true)} />
        </div>
        <div style={{ height: '6px' }} />

        {/* 현장사진 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ ...labelStyle, paddingTop: '4px' }}>현장사진</span>
          <div style={{ flex: 1 }}>
            {photoUrl && (
              <div style={{ position: 'relative', marginBottom: '4px' }}>
                <img src={photoUrl} alt="현장사진" style={{ width: '100%', borderRadius: '6px', objectFit: 'cover', maxHeight: '120px' }}
                  crossOrigin="anonymous" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button onClick={() => setPhotoUrl('')}
                  style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white', width: 20, height: 20, cursor: 'pointer', fontSize: '10px' }}>✕</button>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '4px', padding: '5px', cursor: 'pointer', color: 'white', fontSize: '11px' }}>
              📷 사진 선택
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoUrl(URL.createObjectURL(file));
                  if (onPhotoUpload) {
                    const url = await onPhotoUpload(file);
                    if (url) setPhotoUrl(url);
                  }
                  e.target.value = '';
                }} />
            </label>
          </div>
        </div>

        {divider}

        {/* 작업상태 */}
        <div style={rowStyle}>
          <span style={labelStyle}>작업상태</span>
          <select value={localStatus}
            onChange={async e => {
              const v = e.target.value;
              setLocalStatus(v);
              await autoSave({ status: v });
            }}
            style={{ flex: 1, borderRadius: '4px', padding: '5px 8px', fontSize: '11px', color: 'white', fontWeight: 'bold', background: isDone ? 'rgba(255,255,255,0.15)' : 'rgba(235,100,0,0.65)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <option value="" style={{ background: '#1a3a6e' }}></option>
            <option value="민원처리완료" style={{ background: '#7a2800' }}>민원처리완료</option>
            <option value="기처리" style={{ background: '#7a2800' }}>기처리</option>
            <option value="확인불가" style={{ background: '#7a2800' }}>확인불가</option>
          </select>
        </div>
        <div style={{ height: '6px' }} />

        {/* 작업메모 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ ...labelStyle, paddingTop: '5px' }}>작업메모</span>
          <textarea value={localMemo} onChange={e => setLocalMemo(e.target.value)}
            onBlur={async e => { await autoSave({ memo: e.target.value }); }}
            rows={2} placeholder="메모 입력..."
            style={{ flex: 1, borderRadius: '4px', padding: '5px 8px', fontSize: '11px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', resize: 'none', boxSizing: 'border-box' }} />
        </div>

        {divider}

        {/* 경로 삽입 위치 + 지점 삭제 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ color: '#fed7aa', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>📌 경로 삽입 위치</span>
          <select
            value={localInsert === null ? '' : String(localInsert)}
            onChange={async e => {
              const v = e.target.value;
              const newInsert = v === '' ? null : v.startsWith('add_') ? v : Number(v);
              setLocalInsert(newInsert);
              await autoSave({ insertAfterOrder: newInsert });
            }}
            style={{ flex: 1, borderRadius: '4px', padding: '4px 6px', fontSize: '11px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(249,115,22,0.5)' }}>
            {insertOptions.map(opt => (
              <option key={String(opt.value)} value={opt.value === null ? '' : String(opt.value)} style={{ background: '#1a3a6e' }}>
                {opt.label}
              </option>
            ))}
          </select>
          {onDelete && (
            <button onClick={onDelete}
              style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: '#c62828', color: 'white', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
              지점 삭제
            </button>
          )}
        </div>

        {saving && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '4px 0' }}>저장 중...</p>}

        {divider}

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
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
                style={{ background: '#f9d835', width: '44px', flexShrink: 0, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                <svg width="22" height="20" viewBox="0 0 24 22" fill="none">
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
      </div>
    </div>
  );
}
