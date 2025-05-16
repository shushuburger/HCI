const API_KEY = 'AIzaSyCj5cR1M_IWWo2ApvMTDtkS1Wgwb7pHIeU';  // Calendar API 호출용
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let accessToken = null;
const loadBtn = document.getElementById('loadCalendar');
const content = document.getElementById('content');

// Google Identity Services에서 호출됨
window.handleCredentialResponse = async function(response) {
  const jwt = response.credential;

  // ID 토큰 디코드 및 사용자 확인 (생략 가능)
  const base64Url = jwt.split('.')[1];
  const userInfo = JSON.parse(atob(base64Url));
  console.log('👤 로그인한 사용자:', userInfo);

  // ID 토큰을 access token으로 교환 (OAuth 2.0 방식 아님) → 직접 accessToken을 받아야 함 (SPA 방식)
  google.accounts.oauth2.initTokenClient({
    client_id: '262480863168-9i3c8g4i6e97432l4d708t3ttc8j24qc.apps.googleusercontent.com',
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        loadBtn.style.display = 'inline-block';
        content.innerHTML = `<p>✅ ${userInfo.name}님 환영합니다!</p>`;
      }
    }
  }).requestAccessToken();
};

loadBtn.onclick = () => {
  gapi.load('client', () => {
    gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC]
    }).then(() => {
      gapi.client.setToken({ access_token: accessToken });
      return gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 10,
        orderBy: 'startTime'
      });
    }).then(response => {
      const events = response.result.items;
      if (!events.length) {
        content.innerHTML += '<p>📭 다가오는 일정이 없습니다.</p>';
      } else {
        const list = events.map(e => {
          const when = e.start.dateTime || e.start.date;
          return `<li><strong>${e.summary}</strong> - ${when}</li>`;
        }).join('');
        content.innerHTML += `<ul>${list}</ul>`;
      }
    });
  });
};
