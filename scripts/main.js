// main.js

// Chart.js gauge chart 초기화 변수
let pm10Chart;
let pm25Chart;
let o3Chart;

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
  if (pm10 <= 55) return '#B5E61D';
  if (pm10 <= 80) return '#22B14C';
  if (pm10 <= 115) return '#FFD400';
  if (pm10 <= 150) return '#FF7F27';
  return '#F52020';
}

function getColorByPm25(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) return '#7F7F7F';
  if (pm25 <= 7.5) return '#4285F4';
  if (pm25 <= 15) return '#9CD5F9';
  if (pm25 <= 25) return '#B5E61D';
  if (pm25 <= 35) return '#22B14C';
  if (pm25 <= 55) return '#FFD400';
  if (pm25 <= 75) return '#FF7F27';
  return '#F52020';
}

function getColorByO3(o3) {
  if (o3 === null || o3 === undefined || isNaN(o3)) return '#7F7F7F';
  if (o3 <= 0.015) return '#4285F4';
  if (o3 <= 0.03) return '#9CD5F9';
  if (o3 <= 0.06) return '#B5E61D';
  if (o3 <= 0.09) return '#22B14C';
  if (o3 <= 0.12) return '#FFD400';
  if (o3 <= 0.15) return '#FF7F27';
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

  if (pm10Chart) pm10Chart.destroy();
  if (pm25Chart) pm25Chart.destroy();
  if (o3Chart) o3Chart.destroy();

  const ctx10 = document.getElementById('pm10Chart');
  const ctx25 = document.getElementById('pm25Chart');
  const ctxO3 = document.getElementById('o3Chart');

  if (ctx10) {
    pm10Chart = new Chart(ctx10, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pm10Value, 150 - pm10Value],
          backgroundColor: [getColorByPm10(pm10Value), '#eee'],
          borderWidth: 0,
          cutout: '70%',
          circumference: 180,
          rotation: 270,
          borderRadius: 5
        }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }

  if (ctx25) {
    pm25Chart = new Chart(ctx25, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [pm25Value, 75 - pm25Value],
          backgroundColor: [getColorByPm25(pm25Value), '#eee'],
          borderWidth: 0,
          cutout: '70%',
          circumference: 180,
          rotation: 270,
          borderRadius: 5
        }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }

  if (ctxO3) {
    o3Chart = new Chart(ctxO3, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [o3Value, 0.15 - o3Value],
          backgroundColor: [getColorByO3(o3Value), '#eee'],
          borderWidth: 0,
          cutout: '70%',
          circumference: 180,
          rotation: 270,
          borderRadius: 5
        }]
      },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }
}

function getGradeText(type, value) {
  if (value === null || isNaN(value)) return '정보 없음';

  if (type === 'PM10') {
    if (value <= 15) return `매우 좋음 (${value})`;
    if (value <= 30) return `좋음 (${value})`;
    if (value <= 55) return `양호 (${value})`;
    if (value <= 80) return `보통 (${value})`;
    if (value <= 115) return `나쁨 (${value})`;
    if (value <= 150) return `매우 나쁨 (${value})`;
    return `최악 (${value})`;
  }

  if (type === 'PM2.5') {
    if (value <= 7.5) return `매우 좋음 (${value})`;
    if (value <= 15) return `좋음 (${value})`;
    if (value <= 25) return `양호 (${value})`;
    if (value <= 35) return `보통 (${value})`;
    if (value <= 55) return `나쁨 (${value})`;
    if (value <= 75) return `매우 나쁨 (${value})`;
    return `최악 (${value})`;
  }

  if (type === 'O3') {
    if (value <= 0.015) return `매우 좋음 (${value})`;
    if (value <= 0.03) return `좋음 (${value})`;
    if (value <= 0.06) return `양호 (${value})`;
    if (value <= 0.09) return `보통 (${value})`;
    if (value <= 0.12) return `나쁨 (${value})`;
    if (value <= 0.15) return `매우 나쁨 (${value})`;
    return `최악 (${value})`;
  }

  return `${value}`;
}

function updateColorClass(element, type, value) {
  element.className = '';
  if (value === null || isNaN(value)) return;

  if (type === 'PM10') {
    if (value <= 15) element.classList.add('text-grade1');
    else if (value <= 30) element.classList.add('text-grade2');
    else if (value <= 55) element.classList.add('text-grade3');
    else if (value <= 80) element.classList.add('text-grade4');
    else if (value <= 115) element.classList.add('text-grade5');
    else if (value <= 150) element.classList.add('text-grade6');
    else element.classList.add('text-grade7');
  }

  if (type === 'PM2.5') {
    if (value <= 7.5) element.classList.add('text-grade1');
    else if (value <= 15) element.classList.add('text-grade2');
    else if (value <= 25) element.classList.add('text-grade3');
    else if (value <= 35) element.classList.add('text-grade4');
    else if (value <= 55) element.classList.add('text-grade5');
    else if (value <= 75) element.classList.add('text-grade6');
    else element.classList.add('text-grade7');
  }

  if (type === 'O3') {
    if (value <= 0.015) element.classList.add('text-grade1');
    else if (value <= 0.03) element.classList.add('text-grade2');
    else if (value <= 0.06) element.classList.add('text-grade3');
    else if (value <= 0.09) element.classList.add('text-grade4');
    else if (value <= 0.12) element.classList.add('text-grade5');
    else if (value <= 0.15) element.classList.add('text-grade6');
    else element.classList.add('text-grade7');
  }
}

document.querySelectorAll('.infoBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    fetch('./assets/data/pollutant_info.json')
      .then(res => res.json())
      .then(data => {
        const info = data[type];
        if (info) {
          const popoverId = `${type.toLowerCase()}-popover`;
          let popover = document.getElementById(popoverId);

          // 이미 있으면 토글
          if (popover.style.display === 'block') {
            popover.style.display = 'none';
            return;
          }

          popover.textContent = info.description;
          popover.style.display = 'block';
        }
      });
  });
});

// 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  const isBtn = e.target.closest('.infoBtn');
  if (!isBtn) {
    document.querySelectorAll('.popover-box').forEach(p => {
      p.style.display = 'none';
    });
  }
});
