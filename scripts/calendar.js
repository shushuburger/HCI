document.addEventListener('DOMContentLoaded', () => {
  const API_KEY = 'AIzaSyCj5cR1M_IWWo2ApvMTDtkS1Wgwb7pHIeU';
  const CLIENT_ID = '262480863168-9i3c8g4i6e97432l4d708t3ttc8j24qc.apps.googleusercontent.com';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

  let accessToken = null;

  // 로그인 완료 시 호출되는 함수
  window.handleCredentialResponse = async function(response) {
    const jwt = response.credential;
    const base64Url = jwt.split('.')[1];
    const userInfo = JSON.parse(atob(base64Url));
    console.log('👤 로그인한 사용자:', userInfo.name);

    // access token 요청
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) {
          accessToken = tokenResponse.access_token;
          loadCalendarEvents(); // 바로 일정 불러오기
        }
      }
    }).requestAccessToken();
  };

  // 일정 불러오고 FullCalendar에 표시
  function loadCalendarEvents() {
    gapi.load('client', () => {
      gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC]
      }).then(() => {
        gapi.client.setToken({ access_token: accessToken });

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
        console.error('캘린더 API 오류:', err);
        document.getElementById('calendar').innerHTML = '❌ 일정 불러오기 실패';
      });
    });

    console.log('📅 FullCalendar에 표시할 데이터:', calendarEvents);
console.log('📅 FullCalendar 요소 찾음:', calendarEl);

  }
});
