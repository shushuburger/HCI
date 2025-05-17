document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([36.5, 127.5], 7);

  const locationText = document.getElementById('location');
  const timeText = document.getElementById('time');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      map.setView([lat, lon], 11);
      L.marker([lat, lon]).addTo(map).bindPopup('📍 현재 위치').openPopup();
      timeText.textContent = formatTime(new Date());

      fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`, {
        headers: {
          Authorization: 'KakaoAK 6bc3bb7db30d6057283b9bf04a9fec97'
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

  fetch('/HCI/assets/geo/code_to_name_map.json')
    .then(res => res.json())
    .then(codeToNameMap => {
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
              const code = feature.properties.code.toString().padStart(5, '0');
              const name = codeToNameMap[code] || feature.properties.name;
              const center = getFeatureCenter(feature.geometry);

              // ✅ 광역시/시 정보 추출
              const fullSido = extractSidoFromName(name);
              const fullName = `${fullSido} ${name}`;

              L.tooltip({
                permanent: true,
                direction: 'center',
                className: 'region-tooltip'
              })
                .setContent(name)
                .setLatLng(center)
                .addTo(map);

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
        });
    })
    .catch(err => console.error('❌ JSON 매핑 로드 오류:', err));
});

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

// ✅ 시군구 이름으로부터 광역시 이름 유추하는 간단 로직 (지역 코드 기준)
function extractSidoFromName(name) {
  const keywordMap = {
    '서울': '서울특별시', '부산': '부산광역시', '대구': '대구광역시',
    '인천': '인천광역시', '광주': '광주광역시', '대전': '대전광역시',
    '울산': '울산광역시', '세종': '세종특별자치시', '수원': '경기도', '성남': '경기도',
    '고양': '경기도', '용인': '경기도', '창원': '경상남도', '전주': '전라북도',
    '청주': '충청북도', '천안': '충청남도', '포항': '경상북도', '제주': '제주특별자치도'
  };
  for (const key in keywordMap) {
    if (name.includes(key)) return keywordMap[key];
  }
  return ''; // 찾지 못한 경우 빈 문자열
}
