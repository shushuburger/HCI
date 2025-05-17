document.addEventListener('DOMContentLoaded', () => {
  const calendarBtn = document.getElementById('calendarBtn');

  if (calendarBtn) {
    calendarBtn.addEventListener('click', () => {
      window.location.href = 'calendar.html';
    });
  }

  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([36.5, 127.5], 7);

  const locationText = document.getElementById('location');
  const timeText = document.getElementById('time');

  let codeToFullnameMap = {};
  fetch('/HCI/assets/geo/code_to_fullname_map.json')
    .then(res => res.json())
    .then(json => { codeToFullnameMap = json; });

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
            const code = region.code.substring(0, 5);
            const fullName = codeToFullnameMap[code] || `${region.region_1depth_name} ${region.region_2depth_name}`;
            locationText.textContent = fullName;
            fetchAirData(region.region_1depth_name, region.region_2depth_name);
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
                  .setContent(`📍 <strong>${name}</strong>`)
                  .openOn(map);

                const fullName = codeToFullnameMap[code] || name;
                locationText.textContent = fullName;
                timeText.textContent = formatTime(new Date());

                const parts = fullName.split(' ');
                const sido = parts[0];
                const gugun = parts[1] || '';
                fetchAirData(sido, gugun);
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

function fetchAirData(sido, gugun) {
  const serviceKey = 'MNUICj9LF0yMX9b9cMQiBVz62JWYaqaGxBOIATmwvQgzkfdHQjzCouGaBLIzyg6MYGQOHqefVCRf3E23XoqVGA%3D%3D';
  const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${serviceKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${sido}&ver=1.0`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const list = data.response.body.items;
      const target = list.find(item => item.cityName === gugun || item.stationName.includes(gugun));
      updateGraphSection(target);
    })
    .catch(err => console.error('❌ 대기오염 API 오류:', err));
}

function updateGraphSection(data) {
  if (!data) return;

  const pm10 = parseInt(data.pm10Value);
  const pm25 = parseInt(data.pm25Value);
  const ozone = parseFloat(data.o3Value);

  document.querySelector('#pm10').textContent = getGradeText('PM10', pm10);
  document.querySelector('#pm25').textContent = getGradeText('PM2.5', pm25);
  document.querySelector('#ozone').textContent = getGradeText('O3', ozone);
}

function getGradeText(type, value) {
  if (value === null || isNaN(value)) return '정보 없음';

  if (type === 'PM10') {
    if (value <= 30) return `좋음 (${value})`;
    if (value <= 80) return `보통 (${value})`;
    if (value <= 150) return `나쁨 (${value})`;
    return `매우나쁨 (${value})`;
  }

  if (type === 'PM2.5') {
    if (value <= 15) return `좋음 (${value})`;
    if (value <= 35) return `보통 (${value})`;
    if (value <= 75) return `나쁨 (${value})`;
    return `매우나쁨 (${value})`;
  }

  if (type === 'O3') {
    if (value <= 0.03) return `좋음 (${value})`;
    if (value <= 0.09) return `보통 (${value})`;
    if (value <= 0.15) return `나쁨 (${value})`;
    return `매우나쁨 (${value})`;
  }

  return `${value}`;
}