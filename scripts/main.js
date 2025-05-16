document.addEventListener('DOMContentLoaded', () => {
  // 1. 지도 생성 (기본 중심은 한국)
  const map = L.map('map').setView([36.5, 127.5], 7);

  // 2. 타일 레이어 추가 (배경 지도)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(map);

  // 3. 현재 위치 요청
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      console.log('✅ 현재 위치 가져옴');
      console.log('위도:', lat);
      console.log('경도:', lon);

      // 지도 중심을 현재 위치로 이동
      map.setView([lat, lon], 12);

      // 마커 찍기
      const marker = L.marker([lat, lon]).addTo(map);
      marker.bindPopup('📍 현재 위치').openPopup();
    },
    (error) => {
      console.error('❌ 위치 정보 가져오기 실패:', error);
      alert('위치 정보를 가져올 수 없습니다.');
    }
  );
});
