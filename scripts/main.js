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

  let groupAvgMap = {};

  fetch('./assets/data/group_avg.json')
    .then(res => res.json())
    .then(groupAvg => {
      groupAvgMap = groupAvg;

      fetch('/assets/geo/code_to_name_map.json')
        .then(res => res.json())
        .then(codeToNameMap => {
          fetch('/assets/geo/korea-sigungu.json')
            .then(res => res.json())
            .then(geojson => {
              L.geoJSON(geojson, {
                style: feature => {
                  const code = feature.properties.code.toString().padStart(5, '0');
                  const name = codeToNameMap[code] || feature.properties.name;
                  const avg = groupAvgMap[name];
                  const pm10 = avg?.PM10;
                  return {
                    color: '#000',
                    weight: 1.5,
                    fillColor: getColorByPm10(pm10),
                    fillOpacity: 0.8
                  };
                },
                onEachFeature: (feature, layer) => {
                  const code = feature.properties.code.toString().padStart(5, '0');
                  const name = codeToNameMap[code] || feature.properties.name;
                  const center = getFeatureCenter(feature.geometry);

                  const avg = groupAvgMap[name];
                  const pm10 = avg?.PM10?.toFixed(1);
                  const pm25 = avg?.['PM2.5']?.toFixed(1);
                  const o3 = avg?.O3?.toFixed(3);

                  const tooltipText = pm10
                    ? `${name}<br>PM10: ${pm10}㎍/㎥`
                    : name;

                  L.tooltip({
                    permanent: true,
                    direction: 'center',
                    className: 'region-tooltip'
                  })
                    .setContent(name)
                    .setLatLng(center)
                    .addTo(map);

                  layer.on('click', () => {
                    locationText.textContent = name;
                    timeText.textContent = formatTime(new Date());

                    L.popup()
                      .setLatLng(center)
                      .setContent(`
                        📍 <strong>${name}</strong><br>
                        PM10: ${pm10 ?? '-'}<br>
                        PM2.5: ${pm25 ?? '-'}<br>
                        O₃: ${o3 ?? '-'}
                      `)
                      .openOn(map);

                    const parts = name.split(' ');
                    const sido = parts[0];
                    const gugun = parts[1] || '';
                    fetchAirData(sido, gugun);
                  });
                }
              }).addTo(map);
            });
        });
    })
    .catch(err => console.error('❌ group_avg.json 로딩 오류:', err));

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
            const fullName = `${region.region_1depth_name} ${region.region_2depth_name}`;
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
});

// 색상 구간 설정 함수
function getColorByPm10(pm10) {
  if (pm10 === null || pm10 === undefined || isNaN(pm10)) return '#ccc';
  if (pm10 <= 30) return '#66c2a5';      // 좋음 (초록)
  if (pm10 <= 80) return '#ffd92f';      // 보통 (노랑)
  if (pm10 <= 150) return '#fc8d62';     // 나쁨 (주황)
  return '#e31a1c';                      // 매우 나쁨 (빨강)
}

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

// function fetchAirData(sido, gugun) {
//   const serviceKey = 'MNUICj9LF0yMX9b9cMQiBVz62JWYaqaGxBOIATmwvQgzkfdHQjzCouGaBLIzyg6MYGQOHqefVCRf3E23XoqVGA%3D%3D';
//   const url = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${serviceKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${sido}&ver=1.0`;

//   fetch(url)
//     .then(res => res.json())
//     .then(data => {
//       const list = data.response.body.items;
//       const target = list.find(item =>
//         item.cityName === gugun ||
//         item.stationName.includes(gugun) ||
//         item.stationName.includes(gugun.replace('구', '').replace('시', ''))
//       );
//       updateGraphSection(target);
//     })
//     .catch(err => console.error('❌ 대기오염 API 오류:', err));
// }

function updateGraphSection(data) {
  if (!data) return;

  const pm10 = parseInt(data.pm10Value);
  const pm25 = parseInt(data.pm25Value);
  const ozone = parseFloat(data.o3Value);

  const pm10El = document.querySelector('#pm10');
  const pm25El = document.querySelector('#pm25');
  const ozoneEl = document.querySelector('#ozone');

  pm10El.textContent = getGradeText('PM10', pm10);
  pm25El.textContent = getGradeText('PM2.5', pm25);
  ozoneEl.textContent = getGradeText('O3', ozone);

  updateColorClass(pm10El, 'PM10', pm10);
  updateColorClass(pm25El, 'PM2.5', pm25);
  updateColorClass(ozoneEl, 'O3', ozone);
}
