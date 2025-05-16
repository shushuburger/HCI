document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = 'AIzaSyCj5cR1M_IWWo2ApvMTDtkS1Wgwb7pHIeU';  // ← 본인의 API 키로 교체
    const CLIENT_ID = '262480863168-9i3c8g4i6e97432l4d708t3ttc8j24qc.apps.googleusercontent.com';  // ← 본인의 Client ID로 교체
    const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
    const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

    let accessToken = null;
    const loadBtn = document.getElementById('loadCalendar');
    const content = document.getElementById('content');

    // ✅ Google Identity Services에서 로그인 완료 후 호출됨
    window.handleCredentialResponse = async function (response) {
        const jwt = response.credential;
        const base64Url = jwt.split('.')[1];
        const userInfo = JSON.parse(atob(base64Url));
        console.log('👤 로그인한 사용자:', userInfo);

        // ✅ access token 요청 (OAuth 2.0 방식, GIS 권장)
        google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    loadBtn.style.display = 'inline-block';
                    content.innerHTML = `<p>✅ ${userInfo.name}님 환영합니다!</p>`;
                    listUpcomingEvents(); // ✅ 바로 일정 표시

                } else {
                    console.error('토큰 발급 실패:', tokenResponse);
                }
            }
        }).requestAccessToken();
    };

    // ✅ 버튼 클릭 시 캘린더 일정 불러오기
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
            }).catch(err => {
                console.error('캘린더 API 호출 오류:', err);
                content.innerHTML += '<p>❌ 일정 불러오기 실패</p>';
            });
        });
    };
});
