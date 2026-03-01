'use client';

import { useState } from 'react';

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
  const [cardListOpen, setCardListOpen] = useState(true);
  const [mapViewOpen, setMapViewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [directOpen, setDirectOpen] = useState(false);
  // 직접 입력 지점
  const [directPoints, setDirectPoints] = useState<{
    id: number; address: string; destination: string; complaint: string; manager: string; photoUrl: string;
  }[]>([]);
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<{
    id: number; address: string; destination: string; complaint: string; manager: string;
  } | null>(null);
  const [directForm, setDirectForm] = useState({ address: '', destination: '', complaint: '', manager: '', photoUrl: '' });
  // 지점 상세정보 팝업
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    id: number; address: string; complaint: string;
  } | null>(null);

  const handleDirectAdd = () => {
    setEditingPoint(null);
    setDirectForm({ address: '', destination: '', complaint: '', manager: '' });
    setShowDirectModal(true);
  };

  const handleDirectEdit = (point: { id: number; address: string; destination: string; complaint: string; manager: string }) => {
    setEditingPoint(point);
    setDirectForm({ address: point.address, destination: point.destination, complaint: point.complaint, manager: point.manager, photoUrl: point.photoUrl || '' });
    setShowDirectModal(true);
  };

  const handleDirectDelete = (id: number) => {
    setDirectPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDirectSave = () => {
    if (editingPoint) {
      setDirectPoints((prev) => prev.map((p) =>
        p.id === editingPoint.id ? { ...p, ...directForm } : p
      ));
    } else {
      setDirectPoints((prev) => [...prev, { id: Date.now(), ...directForm }]);
    }
    setShowDirectModal(false);
  };

  // 관리자 인증
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // 이미지 업로드
  const [uploadedImages, setUploadedImages] = useState<{ id: number; url: string; name: string }[]>([]);
  const [extractedPoints, setExtractedPoints] = useState<{ id: number; address: string; complaint: string }[]>([]);

  const handleInputTabClick = () => {
    if (isAuthenticated) {
      setActiveTab('input');
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuth = () => {
    setIsAuthenticated(true);
    setShowAuthModal(false);
    setPassword('');
    setAuthError('');
    setActiveTab('input');
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

  const handleExtract = () => {
    // 임시: 더미 추출 결과
    setExtractedPoints([
      { id: 1, address: '태평로 132 (화순식당)', complaint: '에어라이트 보신탕 전단지' },
      { id: 2, address: '가능동 663-9 (백정밥상)', complaint: '푸르넷 광고 벽보' },
    ]);
  };

  const handleExtractedDelete = (id: number) => {
    setExtractedPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUploadReset = () => {
    setUploadedImages([]);
    setExtractedPoints([]);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a3a6e 0%, #1565c0 40%, #1976d2 100%)' }}>
      {/* 헤더 */}
      <header className="px-4 py-3 text-white" style={{ background: 'linear-gradient(180deg, #0d2444 0%, #1a3a6e 100%)' }}>
        <h1 className="text-lg font-bold text-center">패트롤 옵티마이저</h1>
        <p className="text-xs text-blue-200 mt-1 text-center leading-relaxed">
          최적화 순회 경로는 인공지능 제미나이가 네이버 클라우드의 지리정보를 기반으로 동선 낭비 없는 루프형 동선으로 설계한 것입니다.
        </p>
      </header>

      {/* 탭바 */}
      <div className="flex" style={{ background: '#1a3a6e' }}>
        <button
          onClick={() => setActiveTab('view')}
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
      <main className="px-3 py-3 max-w-lg mx-auto space-y-2">

        {/* ── 최적화 경로 확인 탭 ── */}
        {activeTab === 'view' && (
          <>
            <div className="rounded overflow-hidden">
              <button
                onClick={() => setCardListOpen(!cardListOpen)}
                className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                style={{ background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fb4 100%)' }}
              >
                <span>카드 리스트</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-blue-200">{dummyRoute.version}</span>
                  <span>{cardListOpen ? '▲' : '▼'}</span>
                </span>
              </button>
              {cardListOpen && (
                <div className="space-y-2 pt-2 pb-1">
                  {dummyRoute.points.map((point) => (
                    <div key={point.id} className="mx-2 rounded px-3 py-3 cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.12)' }}
                      onClick={() => { setSelectedPoint(point); setShowDetailModal(true); }}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ background: 'rgba(0,0,0,0.35)' }}>
                          {point.id}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-xs leading-snug">{point.address}</p>
                          <p className="text-blue-200 text-xs mt-1">{point.complaint}</p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button className="text-xs text-white px-2 py-1 rounded font-bold" style={{ background: '#0a3d8f' }}>티맵</button>
                          <button className="text-xs text-white px-2 py-1 rounded font-bold" style={{ background: '#1b5e20' }}>네이버</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded overflow-hidden">
              <button
                onClick={() => setMapViewOpen(!mapViewOpen)}
                className="w-full flex justify-between items-center px-4 py-3 text-white font-medium text-sm"
                style={{ background: 'linear-gradient(180deg, #4a90d9 0%, #1a5fb4 100%)' }}
              >
                <span>지도 뷰</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-blue-200">{dummyRoute.version}</span>
                  <span>{mapViewOpen ? '▲' : '▼'}</span>
                </span>
              </button>
              {mapViewOpen && (
                <div className="mx-2 my-2 rounded h-48 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <span className="text-blue-200 text-sm">지도 영역 (준비 중)</span>
                </div>
              )}
            </div>

            <div className="rounded mt-2" style={{ background: '#0d2444' }}>
              <button className="w-full py-3 text-white text-sm font-medium">
                최신 정보로 가져오기
              </button>
            </div>
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
                    style={{ background: '#2e7d32' }}
                  >초기화</div>
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

                  {/* 지점 추출하기 버튼 */}
                  <button
                    onClick={handleExtract}
                    className="py-2 rounded text-white text-xs font-bold w-32"
                    style={{ background: '#0a3d8f' }}
                  >
                    지점 추출하기
                  </button>

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
                            <div className="flex-1 cursor-pointer" onClick={() => {
                              setEditingPoint(point);
                              setDirectForm({ address: point.address, destination: '', complaint: point.complaint, manager: '' });
                              setShowDirectModal(true);
                            }}>
                              <p className="text-white text-xs leading-snug">{point.address}</p>
                              <p className="text-blue-200 text-xs mt-0.5">{point.complaint}</p>
                            </div>
                            <button
                              onClick={() => handleExtractedDelete(point.id)}
                              className="text-xs text-white px-2 py-1 rounded flex-shrink-0"
                              style={{ background: '#c62828' }}
                            >삭제</button>
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
                    onClick={(e) => { e.stopPropagation(); }}
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
                        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ background: 'rgba(0,0,0,0.35)' }}>
                          {index + 1}
                        </div>
                        <div className="flex-1 cursor-pointer" onClick={() => handleDirectEdit(point)}>
                          <p className="text-white text-xs leading-snug">{point.address || '주소 없음'}</p>
                          <p className="text-blue-200 text-xs mt-0.5">{point.complaint || '민원내용 없음'}</p>
                        </div>
                        <div
                          onClick={() => handleDirectDelete(point.id)}
                          className="text-xs text-white px-2 py-1 rounded flex-shrink-0 cursor-pointer"
                          style={{ background: '#c62828' }}
                        >삭제</div>
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

            {/* 최적화 경로 생성하기 */}
            <div className="rounded mt-2" style={{ background: '#0d2444' }}>
              <button className="w-full py-3 text-white text-sm font-medium">최적화 경로 생성하기</button>
            </div>
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
          <div className="rounded-lg px-5 py-5 w-80" style={{ background: '#1a3a6e' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-base">지점정보 입력</h2>
              <span className="text-white cursor-pointer text-lg" onClick={() => setShowDirectModal(false)}>✕</span>
            </div>

            {[
              { label: '주소', key: 'address', placeholder: '예) 태평로 132' },
              { label: '목적지', key: 'destination', placeholder: '예) 화순식당' },
              { label: '민원내용', key: 'complaint', placeholder: '예) 에어라이트' },
              { label: '담당자', key: 'manager', placeholder: '예) 홍길동' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="mb-3">
                <label className="text-blue-200 text-xs mb-1 block">{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={directForm[key as keyof typeof directForm]}
                  onChange={(e) => setDirectForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded text-sm outline-none text-white"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                />
              </div>
            ))}

            {/* 현장사진 업로드 */}
            <div className="mb-3">
              <label className="text-blue-200 text-xs mb-1 block">현장사진</label>
              {directForm.photoUrl ? (
                <div className="relative w-full h-36">
                  <img src={directForm.photoUrl} alt="현장사진"
                    className="w-full h-36 object-cover rounded" />
                  <button
                    onClick={() => setDirectForm((prev) => ({ ...prev, photoUrl: '' }))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    style={{ background: '#c62828' }}>✕</button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-24 rounded cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.4)' }}>
                  <div className="text-center">
                    <p className="text-blue-200 text-2xl">📷</p>
                    <p className="text-blue-200 text-xs mt-1">사진을 선택하세요</p>
                  </div>
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
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowDirectModal(false)}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ background: '#455a64' }}>취소</button>
              <button onClick={handleDirectSave}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#0a3d8f' }}>저장</button>
            </div>
          </div>
        </div>
      )}
      {/* 지점 상세정보 팝업 */}
      {showDetailModal && selectedPoint && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-lg px-5 py-5 w-80" style={{ background: '#1a3a6e' }}>
            {/* 헤더 */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-base">지점정보</h2>
              <span className="text-white cursor-pointer text-lg"
                onClick={() => setShowDetailModal(false)}>✕</span>
            </div>

            {/* 정보 목록 */}
            <div className="space-y-3">
              {[
                { label: '주소', value: selectedPoint.address },
                { label: '목적지', value: selectedPoint.address.match(/\((.+)\)/)?.[1] || '-' },
                { label: '원래순번', value: `${selectedPoint.id}번` },
                { label: '민원내용', value: selectedPoint.complaint },
                { label: '담당자', value: '이여은' },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 items-start">
                  <span className="text-blue-300 text-xs w-16 flex-shrink-0 pt-0.5">{label}</span>
                  <span className="text-white text-xs flex-1">{value}</span>
                </div>
              ))}

              {/* 현장사진 */}
              <div className="flex gap-3 items-start">
                <span className="text-blue-300 text-xs w-16 flex-shrink-0 pt-0.5">현장사진</span>
                <div className="flex-1 rounded h-28 flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)' }}>
                  <span className="text-blue-300 text-xs">사진 없음</span>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  const url = `tmap://route?goalname=${encodeURIComponent(selectedPoint.address)}&goalx=127.0&goaly=37.7`;
                  window.location.href = url;
                }}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#0a3d8f' }}>티맵</button>
              <button
                onClick={() => {
                  const url = `nmap://route/car?dlat=37.7&dlng=127.0&dname=${encodeURIComponent(selectedPoint.address)}`;
                  window.location.href = url;
                }}
                className="flex-1 py-2 rounded text-sm text-white font-bold"
                style={{ background: '#1b5e20' }}>네이버지도</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}