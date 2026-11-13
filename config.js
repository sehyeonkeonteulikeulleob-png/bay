/******************** 설정 (여기만 바꾸면 됩니다) ********************/
// Apps Script 웹앱 배포 후 받은 URL을 따옴표 안에 붙여넣기
var API_URL = 'https://script.google.com/macros/s/AKfycbwFIWO6BAUXB_P3OhdkaXE1NofND7MKyBG-x_T4Q8h3bXh17KEtUqduj3rgbVFqksnn/exec';

// 체크인 때 고를 수 있는 이용시간 (단위: 초) — 숫자만 바꾸면 버튼이 바뀜
//   테스트: [10, 20, 30, 40, 50]
//   운영 예: [300, 600, 900, 1200]  (= 5분, 10분, 15분, 20분)
var DUR_OPTIONS = [10, 20, 30, 40, 50];
var DUR_DEFAULT = 20;
/*********************************************************************/

// 서버 호출 공통 함수 (수정 불필요)
function apiGet(action) {
  return fetch(API_URL + '?action=' + action).then(function (r) { return r.json(); });
}
function apiPost(action, data) {
  data = data || {};
  data.action = action;
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  }).then(function (r) { return r.json(); });
}
function param(name, def) {
  var v = new URLSearchParams(location.search).get(name);
  return v === null ? def : v;
}

var VOICE = param('voice', 'on') === 'on';
function speak(text) {
  if (!VOICE || !window.speechSynthesis) return;
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = 0.95;
  speechSynthesis.speak(u);
}
// 음성용 타석 번호: 1 → "일" (안 그러면 "한번 타석"으로 읽음)
function bayWord(n) {
  var w = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'];
  return w[n] || String(n);
}
// 초 → "20초" / "10분" / "1분 30초"
function durLabel(sec) {
  sec = Math.round(sec);
  var m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return s + '초';
  return s ? m + '분 ' + s + '초' : m + '분';
}
function mmss(sec) {
  var m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}