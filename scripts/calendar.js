document.addEventListener('DOMContentLoaded', () => {
  const homeBtn = document.getElementById('homeBtn');

  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  const API_KEY = 'AIzaSyCj5cR1M_IWWo2ApvMTDtkS1Wgwb7pHIeU';
  const CLIENT_ID = '262480863168-9i3c8g4i6e97432l4d708t3ttc8j24qc.apps.googleusercontent.com';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

  let accessToken = localStorage.getItem('access_token');

  // access token이 있다면 바로 캘린더 불러오기 시도
  if (accessToken) {
    console.log('저장된 토큰 있음, 바로 캘린더 렌더링');
    loadCalendarEvents(accessToken);
  }

  // 로그인 완료 시 호출
  window.handleCredentialResponse = (response) => {
    const jwt = response.credential;
    const base64Url = jwt.split('.')[1];
    const userInfo = JSON.parse(atob(base64Url));
    console.log('👤 로그인한 사용자:', userInfo.name);

    // access_token 요청
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          localStorage.setItem('access_token', accessToken); // 저장
          document.getElementById('loginContainer').style.display = 'none';
          loadCalendarEvents(accessToken);
        }
      }
    }).requestAccessToken();
  };

  // 캘린더 이벤트 로딩 함수
  function loadCalendarEvents(token) {
    gapi.load('client', () => {
      gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC]
      }).then(() => {
        gapi.client.setToken({ access_token: token });
        return gapi.client.calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date('2025-01-01').toISOString(),
          timeMax: new Date('2026-12-31').toISOString(),
          showDeleted: false,
          singleEvents: true,
          maxResults: 100,
          orderBy: 'startTime'
        });
      }).then(response => {
        const events = response.result.items || [];
        const calendarEvents = events.map(event => ({
          title: event.summary,
          start: event.start.dateTime || event.start.date,
          end: event.end?.dateTime || event.end?.date || event.start.dateTime || event.start.date,
          allDay: !event.start.dateTime
        }));

        const calendarEl = document.getElementById('calendar');
        const calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
          },
          locale: 'ko',
          events: calendarEvents
        });

        calendar.render();
      }).catch(err => {
        console.error('캘린더 불러오기 실패:', err);
        localStorage.removeItem('access_token'); // 실패 시 토큰 제거
        document.getElementById('loginContainer').style.display = 'block';
      });
    });
  }
});

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
                      else if (pm10 <= 115) grade = '나쁨';
                      else if (pm10 <= 150) grade = '심각';
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
  const anchor = document.getElementById('homeBtn');
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
