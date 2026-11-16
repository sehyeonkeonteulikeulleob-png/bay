/******************** 설정 (여기만 바꾸면 됩니다) ********************/
// Apps Script 웹앱 배포 후 받은 URL을 따옴표 안에 붙여넣기
var API_URL = 'https://script.google.com/macros/s/AKfycbwFIWO6BAUXB_P3OhdkaXE1NofND7MKyBG-x_T4Q8h3bXh17KEtUqduj3rgbVFqksnn/exec';

// 체크인 때 고를 수 있는 이용시간 (단위: 초) — 숫자만 바꾸면 버튼이 바뀜
//   테스트: [10, 20, 30, 40, 50]
//   운영 예: [300, 600, 900, 1200]  (= 5분, 10분, 15분, 20분)
var DUR_OPTIONS = [10, 20, 30, 40, 50];
var DUR_DEFAULT = 20;
/*********************************************************************/

// 화면을 터치하면 전체화면으로 전환 (주소창·상단바 숨김). 빠져나와도 다음 터치에 다시 꽉 참
document.addEventListener('pointerup', function () {
  var d = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  var fn = d.requestFullscreen || d.webkitRequestFullscreen;
  if (fn) { try { var p = fn.call(d); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
});

// 서버 호출 공통 함수 (수정 불필요)
function apiGet(action) {
  return fetch(API_URL + '?action=' + action).then(readJson_);
}
function apiPost(action, data) {
  data = data || {};
  data.action = action;
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  }).then(readJson_);
}
// 서버 응답 읽기: JSON이 아니면(구글 오류 화면 등) 그 안의 문구를 오류로 보여줌
function readJson_(r) {
  return r.text().then(function (t) {
    try { return JSON.parse(t); }
    catch (e) {
      var msg = t.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      throw new Error('[' + r.status + '] ' + (msg || '빈 응답'));
    }
  });
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

// 앱 설치용 서비스워커 등록 (GitHub Pages 같은 보안 주소에서만 동작)
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}

// 번호 4자리 칸: 숫자만 입력되게 하고, 4자리를 다 누르면 키패드를 자동으로 내림
// 잘못 눌렀을 때: 칸을 다시 누르면 번호가 지워지고 처음부터 입력
document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('id4');
  if (!el) return;
  el.addEventListener('focus', function () { el.value = ''; });
  el.addEventListener('input', function () {
    var v = el.value.replace(/\D/g, '').slice(0, 4);
    if (v !== el.value) el.value = v;
    if (v.length === 4) el.blur();
  });
});
