document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([36.5, 127.5], 7); // 전국 중심

  // ✅ 내 위치를 중심으로 이동
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      map.setView([lat, lon], 11);
      L.marker([lat, lon]).addTo(map).bindPopup('📍 현재 위치').openPopup();
    },
    (err) => {
      console.error('❌ 위치 정보 오류:', err);
      alert('위치 정보를 가져올 수 없습니다.');
    }
  );

  // ✅ GeoJSON 로드
  fetch('/HCI/assets/geo/korea-sigungu.json')
    .then(res => res.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: {
          color: '#000',
          weight: 1.5,
          fillColor: '#fff',
          fillOpacity: 1
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties.name;

          // ✅ 중심 좌표 계산
          const center = getFeatureCenter(feature.geometry);

          // ✅ 지도에 텍스트 툴팁 추가
          L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'region-tooltip'
          })
            .setContent(name)
            .setLatLng(center)
            .addTo(map);
        }
      }).addTo(map);
    })
    .catch(err => {
      console.error('❌ GeoJSON 로드 오류:', err);
    });
});


// ✅ 중심 좌표 계산 함수
function getFeatureCenter(geometry) {
  let coords = [];

  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates[0][0]; // 첫 번째 폴리곤만 사용
  }

  let latSum = 0, lonSum = 0;
  coords.forEach(([lon, lat]) => {
    latSum += lat;
    lonSum += lon;
  });

  const len = coords.length;
  return [latSum / len, lonSum / len];
}
