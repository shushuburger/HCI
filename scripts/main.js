// 1. 지도 생성 (기본 위치 설정)
const map = L.map('map').setView([36.5, 127.5], 7);

// 2. 배경 지도 타일 추가
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

// 3. 사용자 현재 위치 받아오기
navigator.geolocation.getCurrentPosition(
  function (position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    map.setView([lat, lon], 12);
    L.marker([lat, lon]).addTo(map).bindPopup('현재 위치').openPopup();
  },
  function (error) {
    console.error('❌ 위치 정보 가져오기 실패:', error);
    alert('위치 정보를 가져올 수 없습니다.');
  }
);
