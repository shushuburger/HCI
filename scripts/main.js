document.addEventListener('DOMContentLoaded', () => {
  const calendarBtn = document.getElementById('calendarBtn');
  calendarBtn.addEventListener('click', () => {
    window.location.href = 'calendar.html';
  });

  const map = L.map('map').setView([36.5, 127.5], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  const locationText = document.getElementById('location');
  const timeText = document.getElementById('time');
  timeText.textContent = formatTime(new Date());

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      map.setView([lat, lon], 11);
      L.marker([lat, lon]).addTo(map).bindPopup('📍 현재 위치').openPopup();
      fetchAddressFromCoords(lat, lon).then(region => {
        locationText.textContent = region.sido + ' ' + region.gugun;
        fetchAirData(region.sido, region.gugun);
      });
    },
    (err) => console.error('위치 정보를 가져올 수 없습니다:', err)
  );

  fetch('./assets/korea-sigungu.json')
    .then(res => res.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: {
          color: '#000',
          weight: 1,
          fillColor: '#fff',
          fillOpacity: 0.3
        },
        onEachFeature: (feature, layer) => {
          const gugunName = feature.properties.name;
          const sidoName = '울산광역시'; // 현재 예시는 울산 기준 (자동화 가능)
          layer.bindTooltip(gugunName, { permanent: false });
          layer.on('click', () => {
            document.getElementById('location').textContent = `${sidoName} ${gugunName}`;
            fetchAirData(sidoName, gugunName);
          });
        }
      }).addTo(map);
    });
});

function fetchAddressFromCoords(lat, lon) {
  return fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lon}&y=${lat}`, {
    headers: {
      Authorization: 'KakaoAK 6bc3bb7db30d6057283b9bf04a9fec97'
    }
  })
    .then(res => res.json())
    .then(data => {
      const region = data.documents.find(doc => doc.region_type === 'B');
      const sido = region.region_1depth_name;
      const gugun = region.region_2depth_name;
      return { sido, gugun };
    });
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
    .catch(err => console.error('대기오염 데이터 오류:', err));
}

function updateGraphSection(data) {
  if (!data) return;
  const pm10 = parseInt(data.pm10Value);
  const pm25 = parseInt(data.pm25Value);
  const ozone = parseFloat(data.o3Value);

  document.getElementById('pm10').textContent = getGradeText('PM10', pm10);
  document.getElementById('pm25').textContent = getGradeText('PM2.5', pm25);
  document.getElementById('ozone').textContent = getGradeText('O3', ozone);
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

function formatTime(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
