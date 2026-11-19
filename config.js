/******************** 설정 (여기만 바꾸면 됩니다) ********************/
// Apps Script 웹앱 배포 후 받은 URL을 따옴표 안에 붙여넣기
var API_URL = 'https://script.google.com/macros/s/AKfycbwFIWO6BAUXB_P3OhdkaXE1NofND7MKyBG-x_T4Q8h3bXh17KEtUqduj3rgbVFqksnn/exec';

// 체크인 때 고를 수 있는 이용시간 (단위: 초) — 숫자만 바꾸면 버튼이 바뀜
//   예: [300, 600, 900] = 5분·10분·15분 / 테스트용 초 단위: [10, 20, 30]
var DUR_OPTIONS = [600];             // 10분 고정 (하나만 두면 '이용 시간' 선택칸이 화면에서 사라짐)
var DUR_DEFAULT = 600;               // 처음 선택돼 있는 시간 (10분)

// 체크인·대기 등록 완료 안내창이 떠 있는 시간 (초) — 화면을 누르면 바로 닫힘
var DONE_SECONDS = 1;

// 버튼 누를 때 '딸깍' 소리 (끄려면 false)
var CLICK_SOUND = true;
/*********************************************************************/

// 화면을 터치하면 전체화면으로 전환 (주소창·상단바 숨김). 빠져나와도 다음 터치에 다시 꽉 참
document.addEventListener('pointerup', function (e) {
  if (e.target && e.target.closest && e.target.closest('[data-nofs]')) return;   // [작게 띄우기] 버튼은 전체화면 전환 안 함
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
// 대기 호출용 번호 표시/음성 — 이름 대신 "락커 1234" / "휴대폰 1234" 로 부름
function whoLabel(p) { return String(p || '').trim(); }
function whoSpeak(p) {   // 음성: "락커 번호 일 이 삼 사" (안 그러면 "천이백삼십사"로 읽음)
  var m = String(p || '').match(/^(\S+)\s*(\d+)$/), d = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  if (!m) return String(p || '');
  var digits = m[2].split('').map(function (c) { return d[+c]; }).join(' ');
  return (m[1] === '휴대폰' ? '휴대폰 뒷번호 ' : m[1] + ' 번호 ') + digits;
}
function callSpeech(c) { return whoSpeak(c.phone4) + ' 고객님, ' + bayWord(c.bay) + '번 타석 이용 가능합니다. 입구 태블릿에서 입장을 시작해 주세요.'; }
// 준비시간: 체크인 후 1분 동안은 '입장 준비', 그 뒤부터 이용시간 카운트
//   prepLeft(b, now) → 준비시간 남은 초 (0이면 이용 중)   playTotal(b) → 이용시간(초, 준비 제외)
function prepLeft(b, now) { return b && b.status === 'busy' && b.playAt ? Math.max(0, Math.ceil((b.playAt - now) / 1000)) : 0; }
function playTotal(b) { return Math.max(1, Math.round((b.endAt - (b.playAt || b.startAt)) / 1000)); }
function startSpeech(r) { return bayWord(r.bay) + '번 타석입니다. ' + (r.prep ? durLabel(r.prep) + ' 뒤부터 ' : '') + durLabel(r.sec) + ' 이용 시간이 시작됩니다.'; }
function mmss(sec) {
  var m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ---------- 작은 타이머 창 (항상 위) ----------
// 크롬·엣지의 '문서 PIP' 기능: 다른 프로그램 위에 떠 있는 작은 창에 남은 시간만 보여줌
//  - [작게 띄우기] 버튼을 눌러야 열림 (브라우저 규칙상 자동으로는 못 엶)
//  - 이 타이머 페이지가 열려 있는 동안만 유지됨 (브라우저 창은 최소화해도 됨)
var _mini = null;
function miniSupported() { return 'documentPictureInPicture' in window; }
function miniOpen() {
  if (!miniSupported()) return Promise.resolve(false);
  if (_mini) { _mini.close(); _mini = null; return Promise.resolve(false); }
  return documentPictureInPicture.requestWindow({ width: 280, height: 160 }).then(function (w) {
    _mini = w;
    var d = w.document;
    d.body.style.cssText = 'margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;' +
      'font-family:"Noto Sans KR","Malgun Gothic",sans-serif;background:#0e3b24;color:#fff;user-select:none;overflow:hidden;transition:background .3s';
    d.body.innerHTML = '<div id="mTop" style="font-size:13vh;font-weight:800;color:#e6c877"></div>' +
                       '<div id="mTime" style="font-size:38vh;font-weight:900;line-height:1;font-variant-numeric:tabular-nums"></div>' +
                       '<button id="mEnd" style="display:none;font:inherit;font-size:11vh;font-weight:800;border:0;border-radius:6px;padding:3vh 6vw;background:#f7f4ec;color:#15241b;cursor:pointer">먼저 끝났어요 (종료)</button>';
    // [먼저 끝났어요] → 한 번 더 누르면 종료 (4초 안에 안 누르면 원래대로)
    var eb = d.getElementById('mEnd'), armed = 0;
    eb.onclick = function () {
      if (Date.now() < armed) { armed = 0; eb.textContent = '종료 처리 중…'; if (window.onMiniEnd) onMiniEnd(); setTimeout(function () { eb.textContent = '먼저 끝났어요 (종료)'; eb.style.background = '#f7f4ec'; eb.style.color = '#15241b'; }, 4000); return; }
      armed = Date.now() + 4000; eb.textContent = '한 번 더 누르면 종료'; eb.style.background = '#a4493f'; eb.style.color = '#fff';
      setTimeout(function () { if (armed && Date.now() >= armed) { armed = 0; eb.textContent = '먼저 끝났어요 (종료)'; eb.style.background = '#f7f4ec'; eb.style.color = '#15241b'; } }, 4100);
    };
    w.addEventListener('pagehide', function () { _mini = null; if (window.onMiniChange) onMiniChange(false); });
    if (window.onMiniChange) onMiniChange(true);
    return true;
  }).catch(function () { return false; });
}
// v = { top: '1번 타석 · 남은 시간', time: '04:59' 또는 '', level: 'busy' | 'warn' | 'end' | 'held' | 'free' }
function miniUpdate(v) {
  if (!_mini) return;
  var d = _mini.document, top = d.getElementById('mTop'), time = d.getElementById('mTime');
  if (!top) return;
  var C = { busy: ['#0e3b24', '#e6c877', '#fff'], warn: ['#e3a93c', '#15241b', '#15241b'], end: ['#a4493f', '#fff', '#fff'],
            held: ['#24405f', '#cfe0f5', '#fff'], free: ['#15241b', '#b9d8c2', '#fff'] }[v.level] || ['#0e3b24', '#e6c877', '#fff'];
  d.body.style.background = C[0]; top.style.color = C[1]; time.style.color = C[2];
  top.textContent = v.top; time.textContent = v.time || '';
  time.style.display = v.time ? '' : 'none';
  top.style.fontSize = v.time ? '13vh' : '20vh';
  var eb = d.getElementById('mEnd'); if (eb) eb.style.display = (v.level === 'busy' || v.level === 'warn') ? '' : 'none';
}

// 앱 설치용 서비스워커 등록 (GitHub Pages 같은 보안 주소에서만 동작)
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}

// 번호 4자리: 화면 숫자 키패드로 입력 (태블릿 기본 키보드는 안 뜸)
//  - 4자리가 차면 더 눌러도 입력 안 됨
//  - 번호 칸을 누르거나 [초기화]를 누르면 처음부터 다시 입력
document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('id4');
  var pad = document.getElementById('pad');
  if (!el) return;
  el.addEventListener('click', function () { el.value = ''; el.blur(); });
  if (!pad) return;
  ['1','2','3','4','5','6','7','8','9','초기화','0','←'].forEach(function (k) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = k;
    if (k === '초기화' || k === '←') b.className = 'fn';
    b.addEventListener('click', function () {
      if (k === '초기화') el.value = '';
      else if (k === '←') el.value = el.value.slice(0, -1);
      else if (el.value.length < 4) el.value += k;
    });
    pad.appendChild(b);
  });
});

// 클릭 소리: 키보드 키를 누를 때 나는 짧은 '톡' 소리 (소리 파일 없이 브라우저에서 생성)
var _ac = null, _clickBuf = null;
function clickSound() {
  if (!CLICK_SOUND) return;
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    var sr = _ac.sampleRate, t = _ac.currentTime;
    if (!_clickBuf) {                       // 아주 짧은(25ms) 잡음 → 키 '딸깍' 질감
      var len = Math.floor(sr * 0.025);
      _clickBuf = _ac.createBuffer(1, len, sr);
      var d = _clickBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 8);
    }
    var src = _ac.createBufferSource(); src.buffer = _clickBuf;
    var bp = _ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.8;
    var g = _ac.createGain(); g.gain.value = 0.9;
    src.connect(bp); bp.connect(g); g.connect(_ac.destination);
    src.start(t);
    var o = _ac.createOscillator(), g2 = _ac.createGain();   // 키가 바닥에 닿는 낮은 '톡'
    o.type = 'sine'; o.frequency.value = 180;
    g2.gain.setValueAtTime(0.18, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    o.connect(g2); g2.connect(_ac.destination);
    o.start(t); o.stop(t + 0.03);
  } catch (e) {}
}
document.addEventListener('pointerdown', function (e) {
  var el = e.target && e.target.closest ? e.target.closest('button, #id4') : null;
  if (el && !el.disabled) clickSound();
}, true);

// 왼쪽 화면 단계: 이용 수칙 → (동의) → 본인 확인
var AGREED = false;
function setAgreed(v) {
  AGREED = v;
  var r = document.getElementById('stepRules'), i = document.getElementById('stepId');
  if (r) r.style.display = v ? 'none' : 'flex';
  if (i) i.style.display = v ? 'flex' : 'none';
}
