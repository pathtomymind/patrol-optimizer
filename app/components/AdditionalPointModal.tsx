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
  isAdmin?: boolean;
  onClose: () => void;
  onSave: (data: SaveData) => Promise<void>;
  onDelete?: () => void;
  onPhotoUpload?: (file: File) => Promise<string | null>;
};

export default function AdditionalPointModal({
  label, point, apSt, insertOptions, isNew = false, isAdmin = false,
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

  const handleClose = async () => {
    if (saving) return;
    // ★ 비관리자이거나 새 지점(isNew)인데 관리자가 아니면 저장 없이 닫기
    if (!isAdmin) {
      onClose();
      return;
    }
    setSaving(true);
    await onSave(buildData());
    setSaving(false);
    onClose();
  };

  const renderCoordMsg = () => {
    if (coordStatus === 'idle') return null;
    if (coordStatus === 'loading') return <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'rgba(255,255,255,0.5)' }}>좌표를 검색하는 중입니다...</p>;
    if (coordStatus === 'fail') return <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'white', fontWeight: 'bold' }}>⚠️ 좌표 없음. (주소나 방문지명 확인 필요)</p>;
    const msg = coordMessage || '';
    const hw = msg.includes('⚠️');
    const rm = msg.replace('⚠️', '').trim();
    const isPOILocal = source === 'place_nearest' || source === 'place_single';
    return (
      <>
        {hw
          ? <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'white', fontWeight: 'bold' }}>⚠️ {rm}</p>
          : <p style={{ fontSize: '11px', margin: '4px 0 0', color: '#fff176' }}>✅ {rm}</p>
        }
        {isPOILocal && placeName && (
          <p style={{ fontSize: '11px', margin: '2px 0 0', color: '#a5d6a7' }}>📍 플레이스명: {placeName}</p>
        )}
      </>
    );
  };

  const isDone = ['민원처리완료', '기처리', '확인불가'].includes(localStatus);
  const bgColor = isDone ? '#4a148c' : '#7a2800';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', background: bgColor }}
      onClick={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}>
      {/* 타이틀 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="30" height="30" viewBox="0 0 26 26">
            <polygon points="13,1 25,13 13,25 1,13" fill="#f97316" stroke="none"/>
            <text x="13" y="17" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white" fontFamily="Arial,sans-serif">{label}</text>
          </svg>
        </div>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', flex: 1 }}>{isAdmin ? '방문지 수정 (추가 방문지)' : '방문지 조회 (추가 방문지)'}</span>
        <button onClick={e => { e.stopPropagation(); handleClose(); }}
          style={{ background: saving ? '#888' : '#c62828', border: 'none', borderRadius: '6px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{saving ? '...' : '✕'}</span>
        </button>
      </div>

      {/* 내용 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px', overscrollBehavior: 'contain' }}>

        {/* 주소 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>주소</label>
          {isAdmin ? (
            <input type="text" value={address} placeholder=""
              onChange={e => { setAddress(e.target.value); setCoordStatus('idle'); setLat(null); setLng(null); setPlaceName(null); setSource(null); setCoordMessage(null); }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' }} />
          ) : (
            <span style={{ flex: 1, color: address ? 'white' : 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{address || '(없음)'}</span>
          )}
        </div>

        {/* 방문지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>방문지</label>
          {isAdmin ? (
            <input type="text" value={destination} placeholder=""
              onChange={e => { setDestination(e.target.value); setCoordStatus('idle'); setLat(null); setLng(null); setPlaceName(null); setSource(null); setCoordMessage(null); }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' }} />
          ) : (
            <span style={{ flex: 1, color: destination ? 'white' : 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{destination || '(없음)'}</span>
          )}
        </div>

        {/* 좌표 확인하기 - 관리자만 */}
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '5rem', flexShrink: 0 }} />
            <button onClick={handleCheckCoord} disabled={coordStatus === 'loading'}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', background: coordStatus === 'loading' ? '#555' : '#1565c0', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
              {coordStatus === 'loading' ? '확인 중...' : '좌표 확인하기'}
            </button>
          </div>
        )}

        {/* 좌표 메시지 */}
        {coordStatus !== 'idle' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ width: '5rem', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{renderCoordMsg()}</div>
          </div>
        )}

        {/* 구분선 */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }} />

        {/* 사진번호 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>사진번호</label>
          <input type="number" placeholder="" defaultValue="" readOnly={!isAdmin}
            style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: isAdmin ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#a5d6a7', border: isAdmin ? 'none' : 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' as const }} />
        </div>

        {/* 방문내용 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>방문내용</label>
          {isAdmin ? (
            <input type="text" value={complaint} placeholder="" onChange={e => setComplaint(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#a5d6a7', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' as const }} />
          ) : (
            <span style={{ flex: 1, color: complaint ? '#a5d6a7' : 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{complaint || '(없음)'}</span>
          )}
        </div>

        {/* 담당자 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>담당자</label>
          {isAdmin ? (
            <input type="text" value={manager} placeholder="" onChange={e => setManager(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)', color: '#a5d6a7', border: 'none', outline: 'none', fontSize: '12px', boxSizing: 'border-box' as const }} />
          ) : (
            <span style={{ flex: 1, color: manager ? '#a5d6a7' : 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{manager || '(없음)'}</span>
          )}
        </div>

        {/* 방문지사진 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem', paddingTop: '4px' }}>방문지사진</label>
          <div style={{ flex: 1 }}>
            {photoUrl && (
              <div style={{ marginBottom: '6px' }}>
                <img src={photoUrl} alt="방문지사진" style={{ width: '100%', borderRadius: '6px' }}
                  crossOrigin="anonymous" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            {!photoUrl && !isAdmin && (
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>(사진없음)</span>
            )}
            {isAdmin && (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1565c0', borderRadius: '6px', padding: '8px', cursor: 'pointer', color: 'white', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)' }}>
                사진 선택
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const dataUrl = ev.target?.result as string;
                      setPhotoUrl(dataUrl);
                      if (onPhotoUpload) { const url = await onPhotoUpload(file); if (url) setPhotoUrl(url); }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} />
              </label>
            )}
          </div>
        </div>

        {/* 방문결과/방문메모 - 항상 표시, 관리자만 수정 가능 */}
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem' }}>방문결과</label>
            {isAdmin ? (
              <select value={localStatus} onChange={e => setLocalStatus(e.target.value)}
                style={{ flex: 1, borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: 'white', fontWeight: 'bold', background: isDone ? 'rgba(255,255,255,0.15)' : 'rgba(235,100,0,0.65)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <option value="" style={{ background: '#1a3a6e' }}></option>
                <option value="민원처리완료" style={{ background: '#1a3a6e' }}>민원처리완료</option>
                <option value="기처리" style={{ background: '#1a3a6e' }}>기처리</option>
                <option value="확인불가" style={{ background: '#1a3a6e' }}>확인불가</option>
              </select>
            ) : (
              <span style={{ flex: 1, color: isDone ? '#a5d6a7' : 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 'bold' }}>
                {localStatus || '(미완료)'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <label style={{ color: '#90caf9', fontSize: '11px', flexShrink: 0, width: '5rem', paddingTop: '5px' }}>방문메모</label>
            {isAdmin ? (
              <textarea value={localMemo} onChange={e => setLocalMemo(e.target.value)}
                rows={2} placeholder="메모 입력..."
                style={{ flex: 1, borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', resize: 'none', boxSizing: 'border-box' as const }} />
            ) : (
              <span style={{ flex: 1, color: localMemo ? 'white' : 'rgba(255,255,255,0.35)', fontSize: '12px', paddingTop: '5px' }}>
                {localMemo || '(메모없음)'}
              </span>
            )}
          </div>
        </>

        {/* 관리자 - 경로 삽입 위치 + 삭제 */}
        {isAdmin && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ color: '#fed7aa', fontSize: '11px', fontWeight: 'bold', flexShrink: 0, width: '5rem' }}>삽입 위치</label>
              <select
                value={localInsert === null ? '' : String(localInsert)}
                onChange={e => { const v = e.target.value; setLocalInsert(v === '' ? null : v.startsWith('add_') ? v : Number(v)); }}
                style={{ flex: 1, borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(249,115,22,0.5)' }}>
                {insertOptions.map(opt => (
                  <option key={String(opt.value)} value={opt.value === null ? '' : String(opt.value)} style={{ background: '#1a3a6e' }}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {onDelete && (
                <button onClick={onDelete}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#c62828', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                  삭제
                </button>
              )}
            </div>
          </>
        )}

        {saving && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>저장 중...</p>}
      </div>

      {/* 하단 버튼 */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
        <button onClick={() => window.location.href = 'timemarkcamera://'}
          style={{ background: '#f9d835', width: '48px', height: '48px', flexShrink: 0, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
            <path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z" fill="#1a1a1a"/>
            <circle cx="12" cy="12" r="3.5" fill="#1a1a1a"/>
          </svg>
        </button>
        {point.lat && point.lng ? (
          <>
            <button onClick={() => window.open(`tmap://route?goalname=${encodeURIComponent(point.destination || point.address)}&goaly=${point.lat}&goalx=${point.lng}`)}
              style={{ flex: 1, height: '48px', borderRadius: '8px', background: '#0a3d8f', color: 'white', fontSize: '14px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>티맵</button>
            <button onClick={() => window.open(`nmap://navigation?dlat=${point.lat}&dlng=${point.lng}&dname=${encodeURIComponent(point.destination || point.address)}&appname=patrol-optimizer`)}
              style={{ flex: 1, height: '48px', borderRadius: '8px', background: '#1b5e20', color: 'white', fontSize: '14px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>네이버지도</button>
          </>
        ) : (
          <div style={{ flex: 1, height: '48px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>좌표 확인 후 내비 사용 가능</span>
          </div>
        )}
      </div>
    </div>
  );
}
