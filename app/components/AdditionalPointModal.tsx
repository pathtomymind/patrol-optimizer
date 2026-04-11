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
  const [saving, setSaving] = useState(false);

  const buildData = (overrides: Partial<SaveData> = {}): SaveData => ({
    address, destination, complaint, manager, photoUrl,
    lat, lng, placeName, source, coordMessage,
    insertAfterOrder: localInsert,
    status: '', memo: '',
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


  const renderCoordMsg = () => {
    if (coordStatus === 'idle') return <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'rgba(255,255,255,0.5)' }}>주소나 방문지를 입력한 후 좌표 확인 버튼을 누르세요.</p>;
    if (coordStatus === 'loading') return <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'rgba(255,255,255,0.5)' }}>좌표를 검색하는 중입니다...</p>;
    if (coordStatus === 'fail') return (
      <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'white', fontWeight: 'bold' }}>
        <span style={{ display: 'inline-block', width: '1.2rem' }}>⚠️</span>
        <span style={{ animation: 'blink-text 1.2s ease-in-out infinite' }}>좌표 없음. (주소나 방문지명 확인 필요)</span>
      </p>
    );
    const msg = coordMessage || '';
    const hasWarning = msg.includes('⚠️');
    const rawMsg = msg.replace('⚠️', '').trim();
    const isPOI = source === 'place_nearest' || source === 'place_single';
    return (
      <>
        {hasWarning ? (
          <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'white', fontWeight: 'bold' }}>
            <span style={{ display: 'inline-block', width: '1.2rem' }}>⚠️</span>
            <span style={{ animation: 'blink-text 1.2s ease-in-out infinite' }}>{rawMsg}</span>
          </p>
        ) : (
          <p style={{ fontSize: '11px', margin: '4px 0 0', color: '#fff176' }}>
            <span style={{ display: 'inline-block', width: '1.2rem' }}>✅</span>{rawMsg}
          </p>
        )}
        {isPOI && placeName && (
          <p style={{ fontSize: '11px', margin: '2px 0 0', color: '#a5d6a7' }}>📍 플레이스명: {placeName}</p>
        )}
      </>
    );
  };

  const handleClose = async () => {
    if (!isNew) {
      setSaving(true);
      await onSave(buildData());
      setSaving(false);
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', background: '#1a3a6e' }}>
      {/* 타이틀 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#0d2444', borderBottom: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="30" height="30" viewBox="0 0 26 26">
            <polygon points="13,1 25,13 13,25 1,13" fill="#f97316" stroke="none"/>
            <text x="13" y="17" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif">{label}</text>
          </svg>
        </div>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', flex: 1 }}>방문지 수정 (추가 방문지)</span>
        <button onClick={handleClose}
          style={{ background: '#c62828', border: 'none', borderRadius: '6px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>✕</span>
        </button>
      </div>

      {/* 내용 - 스크롤 격리 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', overscrollBehavior: 'contain' }}>

        {/* 위치정보 묶음 */}
        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>주소</label>
            <input type="text" value={address}
              onChange={e => { setAddress(e.target.value); setCoordStatus('idle'); setLat(null); setLng(null); setPlaceName(null); setSource(null); setCoordMessage(null); }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>방문지</label>
            <input type="text" value={destination}
              onChange={e => { setDestination(e.target.value); setCoordStatus('idle'); setLat(null); setLng(null); setPlaceName(null); setSource(null); setCoordMessage(null); }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleCheckCoord} disabled={coordStatus === 'loading'}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', background: coordStatus === 'loading' ? '#555' : '#0a3d8f', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
            {coordStatus === 'loading' ? '확인 중...' : '좌표 확인하기'}
          </button>
          {renderCoordMsg()}
        </div>

        {/* 사진번호 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>사진번호</label>
          <input type="number" placeholder="예) 12" defaultValue=""
            style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#a5d6a7', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' as const }} />
        </div>

        {/* 방문내용 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>방문내용</label>
          <input type="text" value={complaint} onChange={e => setComplaint(e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#a5d6a7', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' as const }} />
        </div>

        {/* 담당자 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>담당자</label>
          <input type="text" value={manager} onChange={e => setManager(e.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#a5d6a7', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' as const }} />
        </div>

        {/* 방문지사진 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem', paddingTop: '4px' }}>방문지사진</label>
          <div style={{ flex: 1 }}>
            {photoUrl && (
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <img src={photoUrl} alt="방문지사진" style={{ width: '100%', borderRadius: '6px' }}
                  crossOrigin="anonymous" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button onClick={() => setPhotoUrl('')}
                  style={{ position: 'absolute', top: 4, right: 4, background: '#c62828', border: 'none', borderRadius: '50%', color: 'white', width: 24, height: 24, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕</button>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.4)', borderRadius: '6px', padding: '8px', cursor: 'pointer', color: '#90caf9', fontSize: '12px' }}>
              사진 선택
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoUrl(URL.createObjectURL(file));
                  if (onPhotoUpload) { const url = await onPhotoUpload(file); if (url) setPhotoUrl(url); }
                  e.target.value = '';
                }} />
            </label>
          </div>
        </div>

        {saving && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>저장 중...</p>}

        {/* 신규 입력 시만 저장 버튼 표시 */}
        {isNew && (
          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: saving ? '#555' : '#0a3d8f', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        )}
      </div>
    </div>
  );
}
