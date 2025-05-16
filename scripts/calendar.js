const CLIENT_ID = '262480863168-9i3c8g4i6e97432l4d708t3ttc8j24qc.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCj5cR1M_IWWo2ApvMTDtkS1Wgwb7pHIeU';

// Google Calendar API scope
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const content = document.getElementById('content');

function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: [DISCOVERY_DOC],
    scope: SCOPES
  }).then(() => {
    const authInstance = gapi.auth2.getAuthInstance();

    // 상태 따라 버튼 표시
    if (authInstance.isSignedIn.get()) {
      updateSigninStatus(true);
    } else {
      updateSigninStatus(false);
    }

    authorizeButton.onclick = () => authInstance.signIn();
    signoutButton.onclick = () => authInstance.signOut();
    authInstance.isSignedIn.listen(updateSigninStatus);
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'inline-block';
    listUpcomingEvents();
  } else {
    authorizeButton.style.display = 'inline-block';
    signoutButton.style.display = 'none';
    content.innerHTML = '';
  }
}

function listUpcomingEvents() {
  gapi.client.calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    showDeleted: false,
    singleEvents: true,
    maxResults: 10,
    orderBy: 'startTime'
  }).then(response => {
    const events = response.result.items;
    if (events.length > 0) {
      content.innerHTML = '<ul>' +
        events.map(event => {
          const when = event.start.dateTime || event.start.date;
          return `<li><strong>${event.summary}</strong> - ${when}</li>`;
        }).join('') +
        '</ul>';
    } else {
      content.innerHTML = '다가오는 일정이 없습니다.';
    }
  });
}

// 초기화 호출
handleClientLoad();
