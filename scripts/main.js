document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([36.5, 127.5], 7);

  const locationText = document.getElementById('location');
  const timeText = document.getElementById('time');

  // ✅ 접속 시 사용자 위치 기반 지도 이동 + 위치명 + 시간 표시
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      map.setView([lat, lon], 11);
      L.marker([lat, lon]).addTo(map).bindPopup('📍 현재 위치').openPopup();

      // 시간 표시
      timeText.textContent = formatTime(new Date());

      // ✅ Kakao API로 행정구역명 가져오기
      fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`, {
        headers: {
          Authorization: 'KakaoAK 6bc3bb7db30d6057283b9bf04a9fec97' // 🔑 여기에 본인 REST API 키 입력
        }
      })
        .then(res => res.json())
        .then(data => {
          const region = data.documents.find(doc => doc.region_type === 'B');
          if (region) {
            const sido = region.region_1depth_name;
            const sigungu = region.region_2depth_name;
            locationText.textContent = `${sido} ${sigungu}`;
          }
        })
        .catch(err => {
          console.error('❌ Kakao 주소 변환 실패:', err);
        });
    },
    (err) => {
      console.error('❌ 위치 정보 오류:', err);
      locationText.textContent = '위치 정보를 불러올 수 없습니다.';
      timeText.textContent = formatTime(new Date());
    }
  );

  // ✅ GeoJSON 불러오기 및 지도 표시
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
          const code = feature.properties.code;
          const sidoCode = code.substring(0, 2);
          const sidoName = getSidoName(sidoCode);
          const fullName = `${sidoName} ${name}`;
          const center = getFeatureCenter(feature.geometry);

          // 항상 보이는 구 이름 텍스트
          L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'region-tooltip'
          })
            .setContent(name)
            .setLatLng(center)
            .addTo(map);

          // 클릭 시 팝업 및 상단 정보 변경
          layer.on('click', () => {
            L.popup()
              .setLatLng(center)
              .setContent(`📍 <strong>${fullName}</strong>`)
              .openOn(map);

            locationText.textContent = fullName;
            timeText.textContent = formatTime(new Date());
          });
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
    coords = geometry.coordinates[0][0];
  }

  let latSum = 0, lonSum = 0;
  coords.forEach(([lon, lat]) => {
    latSum += lat;
    lonSum += lon;
  });

  const len = coords.length;
  return [latSum / len, lonSum / len];
}


// ✅ 시도 코드 → 시도명 매핑 함수
function getSidoName(code) {
  const sidoMap = {
    '11': '서울특별시',
    '26': '부산광역시',
    '27': '대구광역시',
    '28': '인천광역시',
    '29': '광주광역시',
    '30': '대전광역시',
    '31': '울산광역시',
    '36': '세종특별자치시',
    '41': '경기도',
    '42': '강원도',
    '43': '충청북도',
    '44': '충청남도',
    '45': '전라북도',
    '46': '전라남도',
    '47': '경상북도',
    '48': '경상남도',
    '50': '제주특별자치도'
  };

  return sidoMap[code] || '';
}


// ✅ 현재 시각 포맷 함수
function formatTime(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  const period = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${year}.${month}.${day} ${period} ${hour12}:${minute} (${hour}시)`;
}
