// main.js

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
  let groupAvgMap = {};

  fetch('./assets/geo/code_to_fullname_map_combined.json')
    .then(res => res.json())
    .then(codeMap => {
      codeToFullnameMap = codeMap;
      return fetch('./assets/data/group_avg.json');
    })
    .then(res => res.json())
    .then(avgMap => {
      groupAvgMap = avgMap;
      return fetch('./assets/geo/korea-sigungu.json');
    })
    .then(res => res.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: feature => {
          const code = feature.properties.code.toString().padStart(5, '0');
          const full = codeToFullnameMap[code]?.full || feature.properties.name;
          const avg = groupAvgMap[full];
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
          const short = codeToFullnameMap[code]?.short || feature.properties.name;
          const full = codeToFullnameMap[code]?.full || feature.properties.name;
          const center = getFeatureCenter(feature.geometry);
          const avg = groupAvgMap[full];

          const pm10 = avg?.PM10?.toFixed(1);
          const pm25 = avg?.['PM2.5']?.toFixed(1);
          const o3 = avg?.오존?.toFixed(3);

          L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'region-tooltip'
          })
            .setContent(short)
            .setLatLng(center)
            .addTo(map);

          layer.on('click', () => {
            locationText.textContent = full;
            timeText.textContent = formatTime(new Date());

            L.popup()
              .setLatLng(center)
              .setContent(`
                <strong>${full}</strong><br>
                PM10: ${pm10 ?? '-'}<br>
                PM2.5: ${pm25 ?? '-'}<br>
                O₃: ${o3 ?? '-'}
              `)
              .openOn(map);

            updateGraphSection(pm10, pm25, o3);
          });
        }
      }).addTo(map);
    })
    .catch(err => console.error('❌ JSON 로딩 오류:', err));

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
            const code = Object.keys(codeToFullnameMap).find(
              key => codeToFullnameMap[key].full === fullName
            );
            const full = codeToFullnameMap[code]?.full || fullName;
            locationText.textContent = full;

            const avg = groupAvgMap[full];
            if (avg) {
              const pm10 = avg?.PM10?.toFixed(1);
              const pm25 = avg?.['PM2.5']?.toFixed(1);
              const o3 = avg?.오존?.toFixed(3);
              updateGraphSection(pm10, pm25, o3);
            }
          }
        })
        .catch(err => {
          console.error('❌ Kakao 주소 변환 실패:', err);
          locationText.textContent = '위치 정보를 불러올 수 없습니다.';
        });
    },
    (err) => {
      console.error('❌ 위치 정보 오류:', err);
      locationText.textContent = '위치 정보를 불러올 수 없습니다.';
      timeText.textContent = formatTime(new Date());
    }
  );
});

function getColorByPm10(pm10) {
  if (pm10 === null || pm10 === undefined || isNaN(pm10)) return '#7F7F7F';
  if (pm10 <= 15) return '#4285F4';
  if (pm10 <= 30) return '#9CD5F9';
  if (pm10 <= 40) return '#B5E61D';
  if (pm10 <= 50) return '#22B14C';
  if (pm10 <= 75) return '#FFD400';
  if (pm10 <= 100) return '#FF7F27';
  return '#F52020';
}

function getFeatureCenter(geometry) {
  let coords = [];
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates[0][0];

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

function updateGraphSection(pm10, pm25, o3) {
  const pm10Value = parseFloat(pm10);
  const pm25Value = parseFloat(pm25);
  const o3Value = parseFloat(o3);

  const pm10El = document.getElementById('pm10');
  const pm25El = document.getElementById('pm25');
  const o3El = document.getElementById('o3');

  pm10El.textContent = getGradeText('PM10', pm10Value);
  pm25El.textContent = getGradeText('PM2.5', pm25Value);
  o3El.textContent = getGradeText('O3', o3Value);

  updateColorClass(pm10El, 'PM10', pm10Value);
  updateColorClass(pm25El, 'PM2.5', pm25Value);
  updateColorClass(o3El, 'O3', o3Value);
}

function getGradeText(type, value) {
  if (value === null || isNaN(value)) return '정보 없음';

  if (type === 'PM10') {
    if (value <= 15) return `매우 좋음 (${value})`;
    if (value <= 30) return `좋음 (${value})`;
    if (value <= 40) return `양호 (${value})`;
    if (value <= 50) return `보통 (${value})`;
    if (value <= 75) return `나쁨 (${value})`;
    if (value <= 100) return `매우 나쁨 (${value})`;
    return `최악 (${value})`;
  }

  if (type === 'PM2.5') {
    if (value <= 15) return `좋음 (${value})`;
    if (value <= 35) return `보통 (${value})`;
    if (value <= 75) return `나쁨 (${value})`;
    return `매우 나쁨 (${value})`;
  }

  if (type === 'O3') {
    if (value <= 0.03) return `좋음 (${value})`;
    if (value <= 0.09) return `보통 (${value})`;
    if (value <= 0.15) return `나쁨 (${value})`;
    return `매우 나쁨 (${value})`;
  }

  return `${value}`;
}

function updateColorClass(element, type, value) {
  element.className = '';
  if (value === null || isNaN(value)) return;

  if (type === 'PM10') {
    if (value <= 15) element.classList.add('text-primary');
    else if (value <= 30) element.classList.add('text-info');
    else if (value <= 50) element.classList.add('text-success');
    else if (value <= 75) element.classList.add('text-warning');
    else element.classList.add('text-danger');
  }

  if (type === 'PM2.5') {
    if (value <= 15) element.classList.add('text-success');
    else if (value <= 35) element.classList.add('text-warning');
    else element.classList.add('text-danger');
  }

  if (type === 'O3') {
    if (value <= 0.03) element.classList.add('text-success');
    else if (value <= 0.09) element.classList.add('text-warning');
    else element.classList.add('text-danger');
  }
}
