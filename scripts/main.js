const pm10Btn = document.getElementById('pm10Btn');
const pm25Btn = document.getElementById('pm25Btn');

let currentPollutant = 'PM10'; // 기본값
let geojsonLayer;
let map;
let codeToFullnameMap = {};
let groupAvgMap = {};
let currentDataFile = './assets/data/group_avg_good.json'; // 기본 파일

const toggleDataBtn = document.getElementById('toggleDataBtn');

if (toggleDataBtn) {
  toggleDataBtn.addEventListener('click', () => {
    currentDataFile = currentDataFile.includes('good')
      ? './assets/data/group_avg_bad.json'
      : './assets/data/group_avg_good.json';

    // 다시 group_avgMap과 geojsonLayer 재로드
    fetch(currentDataFile)
      .then(res => res.json())
      .then(avgMap => {
        groupAvgMap = avgMap;

        // 지도 스타일 업데이트
        updateMapStyle();

        // 현재 위치에 대한 대기질 및 차트 갱신
        const location = document.getElementById('location')?.textContent;
        const avg = groupAvgMap[location];
        if (avg) {
          const pm10 = avg?.PM10?.toFixed(1);
          const pm25 = avg?.['PM2.5']?.toFixed(1);
          const o3 = avg?.오존?.toFixed(3);
          updateGraphSection(pm10, pm25, o3);
        }

        updateSolutionGuide(); // 대처방안도 새로고침
      })
      .catch(err => {
        console.error('❌ 데이터 전환 실패:', err);
        alert('데이터 전환 중 오류가 발생했습니다.');
      });
  });
}

pm10Btn.addEventListener('click', () => {
  pm10Btn.classList.add('btn-primary');
  pm10Btn.classList.remove('btn-light');
  pm25Btn.classList.add('btn-light');
  pm25Btn.classList.remove('btn-primary');

  currentPollutant = 'PM10';
  updateMapStyle();
  updateGaugeImage();
});

pm25Btn.addEventListener('click', () => {
  pm25Btn.classList.add('btn-primary');
  pm25Btn.classList.remove('btn-light');
  pm10Btn.classList.add('btn-light');
  pm10Btn.classList.remove('btn-primary');

  currentPollutant = 'PM2.5';
  updateMapStyle();
  updateGaugeImage();
});

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

  map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true
  }).setView([36.5, 127.5], 7);

  const myLocationBtn = document.getElementById('myLocationBtn');
  myLocationBtn.addEventListener('click', moveToMyLocation);

  const locationText = document.getElementById('location');
  const timeText = document.getElementById('time');

  fetch('./assets/geo/code_to_fullname_map_combined.json')
    .then(res => res.json())
    .then(codeMap => {
      codeToFullnameMap = codeMap;
      return fetch(currentDataFile);
    })
    .then(res => res.json())
    .then(avgMap => {
      groupAvgMap = avgMap;
      return fetch('./assets/geo/korea-sigungu.json');
    })
    .then(res => res.json())
    .then(geojson => {
      geojsonLayer = L.geoJSON(geojson, {
        style: feature => getStyleByPollutant(feature),
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
          }).setContent(short).setLatLng(center).addTo(map);

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
            window.updateSolutionGuide(); // ✅ 이 줄 추가
          });
        }
      }).addTo(map);

      updateSolutionGuide();
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

function updateGaugeImage() {
  const gaugeImg = document.getElementById('ruleGauge');
  if (!gaugeImg) return;

  if (currentPollutant === 'PM10') {
    gaugeImg.src = './assets/pm10Gauge.png';
    gaugeImg.alt = '미세먼지 수치 분류';
  } else if (currentPollutant === 'PM2.5') {
    gaugeImg.src = './assets/pm25Gauge.png';
    gaugeImg.alt = '초미세먼지 수치 분류';
  }
}

function updateMapStyle() {
  geojsonLayer.setStyle(feature => getStyleByPollutant(feature));
}

function getStyleByPollutant(feature) {
  const code = feature.properties.code.toString().padStart(5, '0');
  const full = codeToFullnameMap[code]?.full || feature.properties.name;
  const avg = groupAvgMap[full];
  const value = avg?.[currentPollutant];

  let fillColor = '#7F7F7F';
  if (currentPollutant === 'PM10') fillColor = getColorByPm10(value);
  else if (currentPollutant === 'PM2.5') fillColor = getColorByPm25(value);

  return {
    color: '#000',
    weight: 1.5,
    fillColor,
    fillOpacity: 0.8
  };
}

function getColorByPm10(pm10) {
  if (pm10 === null || pm10 === undefined || isNaN(pm10)) return '#7F7F7F';
  if (pm10 <= 15) return '#4285F4';
  if (pm10 <= 30) return '#9CD5F9';
  if (pm10 <= 55) return '#22B14C';
  if (pm10 <= 80) return '#B5E61D';
  if (pm10 <= 115) return '#FFD400';
  if (pm10 <= 150) return '#FF7F27';
  return '#F52020';
}

function getColorByPm25(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) return '#7F7F7F';
  if (pm25 <= 7.5) return '#4285F4';
  if (pm25 <= 15) return '#9CD5F9';
  if (pm25 <= 25) return '#22B14C';
  if (pm25 <= 35) return '#B5E61D';
  if (pm25 <= 55) return '#FFD400';
  if (pm25 <= 75) return '#FF7F27';
  return '#F52020';
}

function getColorByO3(o3) {
  if (o3 === null || o3 === undefined || isNaN(o3)) return '#7F7F7F';
  if (o3 <= 0.015) return '#4285F4';
  if (o3 <= 0.03) return '#9CD5F9';
  if (o3 <= 0.06) return '#22B14C';
  if (o3 <= 0.09) return '#B5E61D';
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
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        layout: {
          padding: {
            bottom: 50 // 👈 아래에 여백 줘야 글씨가 보입니다!
          }
        }
      },
      plugins: [{
        id: 'customLabels',
        beforeDraw: (chart) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return; // 안전장치
          const { left, right, bottom } = chartArea;

          ctx.save();
          ctx.font = 'bold 20px Arial';
          ctx.fillStyle = '#555';
          ctx.textAlign = 'center';

          // 왼쪽 (0)
          ctx.fillText('0', left + 10, bottom + 10);
          // 오른쪽 (150)
          ctx.fillText('150', right - 18, bottom + 10);

          ctx.restore();
        }
      }]
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
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        layout: {
          padding: {
            bottom: 50 // 👈 아래에 여백 줘야 글씨가 보입니다!
          }
        }
      },
      plugins: [{
        id: 'customLabels',
        beforeDraw: (chart) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return; // 안전장치
          const { left, right, bottom } = chartArea;

          ctx.save();
          ctx.font = 'bold 20px Arial';
          ctx.fillStyle = '#555';
          ctx.textAlign = 'center';

          // 왼쪽 (0)
          ctx.fillText('0', left + 10, bottom + 10);
          // 오른쪽 (150)
          ctx.fillText('75', right - 15, bottom + 10);

          ctx.restore();
        }
      }]
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
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        layout: {
          padding: {
            bottom: 50 // 👈 아래에 여백 줘야 글씨가 보입니다!
          }
        }
      },
      plugins: [{
        id: 'customLabels',
        beforeDraw: (chart) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return; // 안전장치
          const { left, right, bottom } = chartArea;

          ctx.save();
          ctx.font = 'bold 20px Arial';
          ctx.fillStyle = '#555';
          ctx.textAlign = 'center';

          // 왼쪽 (0)
          ctx.fillText('0', left + 10, bottom + 10);
          // 오른쪽 (150)
          ctx.fillText('0.15', right - 20, bottom + 10);

          ctx.restore();
        }
      }]
    });
  }
  if (levelSelect && !isNaN(pm10Value)) {
    levelSelect.value = getLevelForJson(pm10Value);
  }
}

function getGradeText(type, value) {
  if (value === null || isNaN(value)) return '정보 없음';

  if (type === 'PM10') {
    if (value <= 15) return `매우 좋음 (${value})`;
    if (value <= 30) return `좋음 (${value})`;
    if (value <= 55) return `양호 (${value})`;
    if (value <= 80) return `보통 (${value})`;
    if (value <= 115) return `주의 (${value})`;
    if (value <= 150) return `나쁨 (${value})`;
    return `매우 나쁨 (${value})`;
  }

  if (type === 'PM2.5') {
    if (value <= 7.5) return `매우 좋음 (${value})`;
    if (value <= 15) return `좋음 (${value})`;
    if (value <= 25) return `양호 (${value})`;
    if (value <= 35) return `보통 (${value})`;
    if (value <= 55) return `주의 (${value})`;
    if (value <= 75) return `나쁨 (${value})`;
    return `매우 나쁨 (${value})`;
  }

  if (type === 'O3') {
    if (value <= 0.015) return `매우 좋음 (${value})`;
    if (value <= 0.03) return `좋음 (${value})`;
    if (value <= 0.06) return `양호 (${value})`;
    if (value <= 0.09) return `보통 (${value})`;
    if (value <= 0.12) return `주의 (${value})`;
    if (value <= 0.15) return `나쁨 (${value})`;
    return `매우 나쁨 (${value})`;
  }

  return `${value}`;
}

function updateColorClass(element, type, value) {
  element.className = '';
  if (value === null || isNaN(value)) return;

  const thresholds = {
    'PM10': [15, 30, 55, 80, 115, 150],
    'PM2.5': [7.5, 15, 25, 35, 55, 75],
    'O3': [0.015, 0.03, 0.06, 0.09, 0.12, 0.15]
  };

  const grades = ['text-grade1', 'text-grade2', 'text-grade3', 'text-grade4', 'text-grade5', 'text-grade6', 'text-grade7'];
  const limits = thresholds[type];

  for (let i = 0; i < limits.length; i++) {
    if (value <= limits[i]) {
      element.classList.add(grades[i]);
      return;
    }
  }
  element.classList.add(grades[grades.length - 1]);
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

document.addEventListener('click', (e) => {
  const isBtn = e.target.closest('.infoBtn');
  if (!isBtn) {
    document.querySelectorAll('.popover-box').forEach(p => {
      p.style.display = 'none';
    });
  }
});

function moveToMyLocation() {
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

              const center = map.getCenter();
              L.popup()
                .setLatLng(center)
                .setContent(`
                  <strong>${full}</strong><br>
                  PM10: ${pm10 ?? '-'}<br>
                  PM2.5: ${pm25 ?? '-'}<br>
                  O₃: ${o3 ?? '-'}
                `)
                .openOn(map);
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
}

// 📍 index.html과 연결된 main.js 파일 내부에 아래 코드 추가

const alertBtn = document.getElementById('alertBtn');

if (alertBtn) {
  alertBtn.addEventListener('click', async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      showAlertBox('⚠️ Google 계정에 먼저 로그인해주세요.');
      return;
    }

    if (typeof gapi === 'undefined') {
      showAlertBox('⚠️ Google API가 아직 로드되지 않았습니다.');
      return;
    }

    gapi.load('client', async () => {
      try {
        await gapi.client.init({
          apiKey: 'AIzaSyCj5cR1M_IWWo2ApvMTDtkS1Wgwb7pHIeU',
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
        });

        gapi.client.setToken({ access_token: accessToken });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const res = await gapi.client.calendar.events.list({
          calendarId: 'primary',
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          showDeleted: false,
          singleEvents: true,
          orderBy: 'startTime'
        });

        const events = res.result.items;
        if (!events || events.length === 0) {
          showAlertBox('📅 오늘 등록된 일정이 없습니다.');
          return;
        }

        const lines = await Promise.all(events.map(async e => {
          const start = e.start?.dateTime || e.start?.date;
          const date = new Date(start);
          const time = date.toTimeString().substring(0, 5);
          const summary = e.summary || '제목 없음';
          const location = e.location || '장소 미정';

          let pm10Text = '';

          if (location !== '장소 미정') {
            try {
              const kakaoSearchRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(location)}`, {
                headers: {
                  Authorization: 'KakaoAK 6bc3bb7db30d6057283b9bf04a9fec97'
                }
              });

              const kakaoSearch = await kakaoSearchRes.json();
              const coord = kakaoSearch.documents[0];
              if (coord) {
                const x = coord.x;
                const y = coord.y;

                const regionRes = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${x}&y=${y}`, {
                  headers: {
                    Authorization: 'KakaoAK 6bc3bb7db30d6057283b9bf04a9fec97'
                  }
                });

                const regionData = await regionRes.json();
                const region = regionData.documents.find(doc => doc.region_type === 'B');

                if (region) {
                  const regionName = `${region.region_1depth_name} ${region.region_2depth_name}`;
                  const fullRegionName = Object.values(codeToFullnameMap).find(obj => obj.full === regionName)?.full;

                  if (fullRegionName) {
                    const pm10 = groupAvgMap[fullRegionName]?.PM10;
                    if (pm10 !== undefined) {
                      let grade = '';
                      if (pm10 <= 15) grade = '매우 좋음';
                      else if (pm10 <= 30) grade = '좋음';
                      else if (pm10 <= 55) grade = '양호';
                      else if (pm10 <= 80) grade = '보통';
                      else if (pm10 <= 115) grade = '주의';
                      else if (pm10 <= 150) grade = '나쁨';
                      else grade = '매우 나쁨';

                      pm10Text = `PM10: ${pm10.toFixed(1)} (${grade})`;
                    }
                  }
                }
              }
            } catch (err) {
              console.warn(`❗ 위치 "${location}" 미세먼지 정보 조회 실패`, err);
            }
          }

          return `${time}: ${summary}<br>${location}<br>${pm10Text}`;
        }));

        showAlertBox('<strong>📅 오늘의 일정</strong><br>' + lines.join('<br><br>') + '<br><br><em>지도에서 해당 지역을 클릭한 다음 본인에게 맞는 대처방안을 알아보세요</em>');
      } catch (err) {
        console.error('⛔ 일정 조회 실패:', err);
        showAlertBox('일정을 불러오는 데 실패했습니다.');
      }
    });
  });
}


function showAlertBox(htmlContent) {
  const anchor = document.getElementById('calendarBtn');
  let box = document.getElementById('calendar-alert-box');

  if (!box) {
    box = document.createElement('div');
    box.id = 'calendar-alert-box';
    box.className = 'popover-box';
    box.style.position = 'absolute';
    box.style.zIndex = '9999';
    box.style.width = '250px';
    box.style.textAlign = 'left';
    box.style.marginTop = '6px';

    document.body.appendChild(box);
  }

  const rect = anchor.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  box.style.top = `${rect.bottom + scrollTop + 6}px`;
  box.style.left = `${rect.right + scrollLeft - 70}px`;

  box.innerHTML = htmlContent;
  box.style.display = 'block';

  document.addEventListener('click', function handler(e) {
    if (!anchor.contains(e.target) && !box.contains(e.target)) {
      box.style.display = 'none';
      document.removeEventListener('click', handler);
    }
  });
}

// 행동 방안 보여주기
////////////////////////////////////////////////////////////////////////

// ✅ 맞춤형 대처방안 자동 변경 기능 추가
const ageSelect = document.getElementById('ageSelect');
const healthSelect = document.getElementById('healthSelect');
const activitySelect = document.getElementById('activitySelect');
const levelSelect = document.getElementById('levelSelect');
const recommendationsBox = document.querySelector('.recommendations');

function getLevelForJson(value) {
  if (value === null || isNaN(value)) return '정보 없음';

  if (value <= 30) return '좋음';
  if (value <= 80) return '보통';
  if (value <= 150) return '나쁨';
  return '매우 나쁨';
}

function updateSolutionGuide() {
  const ageMap = {
    kid: '유아/어린이',
    adult: '성인',
    elderly: '고령자'
  };

  const healthMap = {
    healthy: '건강함',
    asthma: '천식/호흡기 질환',
    allergy: '알레르기/비염'
  };

  const activityMap = {
    indoor: '주로 실내활동',
    outdoor: '주로 야외활동'
  };

  const ageText = ageMap[ageSelect.value];
  const healthText = healthMap[healthSelect.value];
  const activityText = activityMap[activitySelect.value];

  const locationText = document.getElementById('location');
  let pollutantLevel = levelSelect.value;
  if (!pollutantLevel) {
    const pollutantValue = groupAvgMap[locationText.textContent]?.PM10;
    pollutantLevel = getLevelForJson(pollutantValue);
  }

  fetch('./assets/data/solution.json')
    .then(res => res.json())
    .then(data => {
      const match = data.find(item =>
        item.연령대 === ageText &&
        item.건강상태 === healthText &&
        item.활동유형 === activityText &&
        item.미세먼지등급 === pollutantLevel
      );

      if (match) {
        const iconMap = [
          { keyword: /환기/, icon: 'indoor.png', alt: '실내 아이콘' },
          { keyword: /야외/, icon: 'outdoor.png', alt: '실외 아이콘' },
          { keyword: /외출/, icon: 'home.png', alt: '외출 자제 아이콘' },
          { keyword: /마스크/, icon: 'mask.png', alt: '마스크 아이콘' },
          { keyword: /공기청정기/, icon: 'refresh.png', alt: '공기청정기 아이콘' },
          { keyword: /(손 씻기|세안)/, icon: 'wash.png', alt: '손씻기 아이콘' },
          { keyword: /(수분|섭취)/, icon: 'water.png', alt: '물 아이콘' },
          { keyword: /(병원|증상)/, icon: 'hospital.png', alt: '병원 아이콘' },
          { keyword: /(보호 장비|고글)/, icon: 'protect.png', alt: '보호장비 아이콘' },
          { keyword: /코 세척/, icon: 'nose.png', alt: '코세척 아이콘' },
          { keyword: /(산책|운동)/, icon: 'walk.png', alt: '산책 아이콘' },
        ];

        const lines = match.대처방안.split('\n');
        recommendationsBox.innerHTML = lines.map(line => {
          const icon = iconMap.find(i => i.keyword.test(line));
          if (icon) {
            return `<p><img src="./assets/icons/${icon.icon}" alt="${icon.alt}" width="20" height="20">${line}</p>`;
          } else {
            return `<p>${line}</p>`;
          }
        }).join('');
      } else {
        recommendationsBox.innerHTML = '<p>❗ 해당 조건에 맞는 대처방안을 찾을 수 없습니다.</p>';
      }
    })
    .catch(err => {
      console.error('⛔ 대처방안 로딩 실패:', err);
      recommendationsBox.innerHTML = '<p>❌ 대처방안을 불러오는 데 실패했습니다.</p>';
    });
}

ageSelect.addEventListener('change', updateSolutionGuide);
healthSelect.addEventListener('change', updateSolutionGuide);
activitySelect.addEventListener('change', updateSolutionGuide);
levelSelect.addEventListener('change', updateSolutionGuide);

// 검색 부분
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (!query) {
    alert('검색어를 입력해주세요.');
    return;
  }

  // 유사 일치: query가 포함된 codeToFullnameMap의 full을 찾음
  const matched = Object.entries(codeToFullnameMap).find(([_, value]) =>
    value.full.includes(query)
  );

  if (!matched) {
    alert('해당 지역을 찾을 수 없습니다.');
    return;
  }

  const [matchedCode, matchedValue] = matched;
  const fullName = matchedValue.full;

  const geojsonFeature = geojsonLayer.getLayers().find(layer => {
    const code = layer.feature.properties.code.toString().padStart(5, '0');
    return code === matchedCode;
  });

  if (!geojsonFeature) {
    alert('지도에서 해당 지역을 찾을 수 없습니다.');
    return;
  }

  const center = getFeatureCenter(geojsonFeature.feature.geometry);
  map.setView(center, 11);
  document.getElementById('location').textContent = fullName;
  document.getElementById('time').textContent = formatTime(new Date());

  const avg = groupAvgMap[fullName];
  if (avg) {
    const pm10 = avg?.PM10?.toFixed(1);
    const pm25 = avg?.['PM2.5']?.toFixed(1);
    const o3 = avg?.오존?.toFixed(3);

    updateGraphSection(pm10, pm25, o3);
    updateSolutionGuide();

    L.popup()
      .setLatLng(center)
      .setContent(`
        <strong>${fullName}</strong><br>
        PM10: ${pm10 ?? '-'}<br>
        PM2.5: ${pm25 ?? '-'}<br>
        O₃: ${o3 ?? '-'}
      `)
      .openOn(map);
  }
});
