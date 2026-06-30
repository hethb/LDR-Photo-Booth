/* =========================================================
   LDR PHOTO BOOTH ♥  — webcam booth + cross-machine sync
   ========================================================= */

/* ---------- tiny helpers ---------- */
const $  = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sanitize = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ---------- floating pixel hearts ---------- */
(function hearts() {
  const bg = $('heartsBg');
  const glyphs = ['♥', '♡', '💕', '✦', '💗', '★'];
  for (let i = 0; i < 22; i++) {
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = glyphs[(Math.random() * glyphs.length) | 0];
    h.style.left = Math.random() * 100 + 'vw';
    h.style.fontSize = 14 + Math.random() * 22 + 'px';
    h.style.animationDuration = 7 + Math.random() * 10 + 's';
    h.style.animationDelay = -Math.random() * 12 + 's';
    h.style.color = ['#ff6fb5', '#9b5de5', '#ffe07a', '#ffffff'][(Math.random() * 4) | 0];
    bg.appendChild(h);
  }
})();

/* ---------- cute frame definitions ---------- */
const FRAMES = [
  { id:'hearts',  label:'Hearts',  emoji:'💕', bg:'#ffe3f1', band:'#ffc2e0', accent:'#d63d8b', title:'♥ U & ME ♥',         deco:['♥','💕','♡'] },
  { id:'stars',   label:'Stars',   emoji:'✨', bg:'#efe6ff', band:'#d9c6ff', accent:'#6a2bb0', title:'✦ STARRY US ✦',      deco:['★','✨','☆'] },
  { id:'flowers', label:'Flowers', emoji:'🌸', bg:'#eafff3', band:'#c2f2da', accent:'#1f9d5a', title:'✿ IN BLOOM ✿',       deco:['🌸','🌼','🌺'] },
  { id:'rainbow', label:'Rainbow', emoji:'🌈', bg:'#fff5e3', band:'#ffe2b0', accent:'#ff8a3d', title:'⊹ OUR RAINBOW ⊹',     deco:['🌈','☁','💛'] },
  { id:'cherry',  label:'Sweet',   emoji:'🍓', bg:'#ffe9e9', band:'#ffc7c7', accent:'#d63d3d', title:'♥ SO SWEET ♥',        deco:['🍓','🍒','💋'] },
  { id:'pastel',  label:'Dreamy',  emoji:'☁️', bg:'#f6ecff', band:'#e3d2ff', accent:'#9b5de5', title:'·｡ JUST US ｡·',      deco:['♡','◆','◇'] },
];
let selectedFrame = FRAMES[0];

/* ---------- app state ---------- */
const state = {
  myName: 'me',
  theirName: 'my love',
  isHost: true,      // host => left column, joiner => right column
  solo: false,
  myPhotos: [],      // array of dataURLs (raw, non-mirrored)
  theirPhotos: [],
  capturing: false,
  shotIndex: 0,      // which of the 4 shots we're on
  stripImgs: [],     // cached loaded Image objects for the result (left 4, then right 4)
  stripTitle: '',    // custom top text ('' = use theme default)
  stripCaption: '',  // custom bottom text ('' = use names default)
  defaultCaption: '',
};

let peer = null;
let conn = null;

/* ---------- screen switching ---------- */
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(screenId).classList.add('active');
}

/* =========================================================
   1) CONNECTION
   ========================================================= */
function setStatus(msg, kind) {
  const el = $('connectStatus');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function peerIdFor(code) { return 'ldrpb-v1-' + sanitize(code); }

function readNameAndCode() {
  const code = sanitize($('loveCode').value);
  state.myName = ($('myName').value || '').trim() || (state.isHost ? 'cutie #1' : 'cutie #2');
  return code;
}

$('btnCreate').onclick = () => {
  const code = readNameAndCode();
  if (!code) return setStatus('type a love code first ♥', 'err');
  state.isHost = true;
  state.solo = false;
  setStatus('opening your room…');
  try { if (peer) peer.destroy(); } catch (_) {}
  peer = new Peer(peerIdFor(code));

  peer.on('open', () => setStatus('room "' + code + '" is open! tell your person to JOIN with the same code ♥', 'ok'));
  peer.on('connection', (c) => { conn = c; wireConn(); });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      setStatus('that room is already open — try JOIN instead (or pick a new code).', 'err');
    } else {
      setStatus('connection hiccup: ' + err.type + ' — try again ♥', 'err');
    }
  });
};

$('btnJoin').onclick = () => {
  const code = readNameAndCode();
  if (!code) return setStatus('type a love code first ♥', 'err');
  state.isHost = false;
  state.solo = false;
  if (!state.myName || state.myName === 'cutie #1') state.myName = ($('myName').value || '').trim() || 'cutie #2';
  setStatus('finding your person…');
  try { if (peer) peer.destroy(); } catch (_) {}
  peer = new Peer();

  peer.on('open', () => {
    conn = peer.connect(peerIdFor(code), { reliable: true });
    conn.on('open', () => wireConn());
    setTimeout(() => {
      if (!conn || !conn.open) setStatus('no room found for "' + code + '" yet. make sure your person hit CREATE first ♥', 'err');
    }, 6000);
  });
  peer.on('error', (err) => setStatus('connection hiccup: ' + err.type + ' — try again ♥', 'err'));
};

$('btnSolo').onclick = () => {
  state.solo = true;
  state.isHost = true;
  state.myName = ($('myName').value || '').trim() || 'me';
  state.theirName = 'me too';
  enterBooth();
};

function wireConn() {
  setStatus('connected! ♥ entering the booth…', 'ok');
  conn.on('data', onData);
  conn.on('close', () => setPartner('your person left the booth 😢', false));
  // greet + share current frame
  send({ type: 'hello', name: state.myName });
  send({ type: 'frame', frame: selectedFrame.id });
  setTimeout(enterBooth, 600);
}

function send(obj) { if (conn && conn.open) { try { conn.send(obj); } catch (_) {} } }

function onData(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'hello') {
    state.theirName = msg.name || 'my love';
    setPartner(state.theirName + ' is here! ♥', true);
  } else if (msg.type === 'frame') {
    const f = FRAMES.find((x) => x.id === msg.frame);
    if (f) { selectedFrame = f; markFrameSelected(); }
  } else if (msg.type === 'photos') {
    state.theirPhotos = msg.photos || [];
    state.theirName = msg.name || state.theirName;
    setPartner(state.theirName + ' finished their 4 shots! ♥', true, true);
    maybeFinish();
  }
}

function setPartner(text, ready, done) {
  const box = $('partnerStatus');
  $('partnerText').textContent = text;
  box.classList.toggle('ready', !!ready);
  box.classList.toggle('done', !!done);
}

/* =========================================================
   2) BOOTH — camera, frames, capture
   ========================================================= */
async function enterBooth() {
  show('screen-booth');
  // booth picker: selecting a frame syncs it to your partner
  buildFramePicker('framePicker', (f) => {
    selectedFrame = f;
    markFrameSelected();
    send({ type: 'frame', frame: f.id });
  });
  // result picker: changing the theme just re-renders your own strip
  buildFramePicker('framePickerResult', (f) => {
    selectedFrame = f;
    markFrameSelected();
    refreshStripInputs();
    renderStrip();
  });
  markFrameSelected();
  state.shotIndex = 0;
  $('btnStart').textContent = 'TAKE SHOT 1 ✦';
  $('btnRetake').hidden = true;
  if (state.solo) setPartner('solo mode — both sides will be you ♥', true);
  await startCamera();
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' },
      audio: false,
    });
    $('video').srcObject = stream;
  } catch (err) {
    $('camCaption').textContent = 'could not open your camera 😢 — please allow webcam access & reload.';
  }
}

function buildFramePicker(containerId, onPick) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  FRAMES.forEach((f) => {
    const b = document.createElement('button');
    b.className = 'frame-opt';
    b.dataset.id = f.id;
    b.innerHTML = `<span class="emoji">${f.emoji}</span>${f.label}`;
    b.onclick = () => onPick(f);
    wrap.appendChild(b);
  });
}

function markFrameSelected() {
  document.querySelectorAll('.frame-opt').forEach((el) =>
    el.classList.toggle('sel', el.dataset.id === selectedFrame.id));
}

/* ----- per-shot countdown + capture ----- */
$('btnStart').onclick = takeNextShot;
$('btnRetake').onclick = resetMyShots;

function resetMyShots() {
  state.myPhotos = [];
  state.shotIndex = 0;
  state.capturing = false;
  renderMyShots();
  const b = $('btnStart');
  b.hidden = false; b.disabled = false; b.textContent = 'TAKE SHOT 1 ✦';
  $('btnRetake').hidden = true;
  $('camCaption').textContent = 'ready when you are — take each shot one at a time ♥';
}

async function takeNextShot() {
  if (state.capturing || state.shotIndex >= 4) return;
  const video = $('video');
  if (!video.srcObject) { $('camCaption').textContent = 'camera not ready yet ♥'; return; }

  state.capturing = true;
  $('btnStart').disabled = true;
  $('btnRetake').hidden = true;
  $('camCaption').textContent = `shot ${state.shotIndex + 1} of 4 — strike a pose! ♥`;

  await countdown(3);
  capturePhoto();          // appends to myPhotos + renders thumbnail
  flash();
  await wait(600);         // let them see the shot land

  state.shotIndex++;
  state.capturing = false;

  if (state.shotIndex < 4) {
    const left = 4 - state.shotIndex;
    $('btnStart').disabled = false;
    $('btnStart').textContent = `TAKE SHOT ${state.shotIndex + 1} ✦`;
    $('btnRetake').hidden = false;
    $('camCaption').textContent = `cute! ${left} more to go — go when you're ready ♥`;
  } else {
    finishMyShots();
  }
}

function finishMyShots() {
  $('btnStart').hidden = true;
  $('btnRetake').hidden = false;
  $('camCaption').textContent = state.solo
    ? 'looking adorable! building your strip… ♥'
    : 'all 4 sent! waiting for your person to finish theirs ♥';

  if (state.solo) {
    state.theirPhotos = state.myPhotos.slice();
  } else {
    send({ type: 'photos', photos: state.myPhotos, name: state.myName });
  }
  maybeFinish();
}

function countdown(n) {
  return new Promise((resolve) => {
    const el = $('countdown');
    let c = n;
    const tick = () => {
      el.textContent = c;
      el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
      if (c === 0) { resolve(); return; }
      c--;
      setTimeout(tick, 900);
    };
    tick();
  });
}

function capturePhoto() {
  const video = $('video');
  const cv = $('captureCanvas');
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 960;
  // center-crop to 4:3
  const targetRatio = 4 / 3;
  let sw = vw, sh = vw / targetRatio;
  if (sh > vh) { sh = vh; sw = vh * targetRatio; }
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  cv.width = 640; cv.height = 480;
  const ctx = cv.getContext('2d');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 640, 480); // store NON-mirrored
  state.myPhotos.push(cv.toDataURL('image/jpeg', 0.85));
  renderMyShots();
}

function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

function renderMyShots() {
  document.querySelectorAll('#myShots .shot-slot').forEach((slot, i) => {
    const url = state.myPhotos[i];
    if (url) { slot.classList.add('filled'); slot.innerHTML = `<img src="${url}" alt="shot ${i + 1}">`; }
    else { slot.classList.remove('filled'); slot.innerHTML = ''; }
  });
}

/* =========================================================
   3) RESULT — combine into 2x4 strip
   ========================================================= */
function maybeFinish() {
  if (state.myPhotos.length === 4 && state.theirPhotos.length === 4) {
    buildStrip();
  }
}

function loadImg(src) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = src; });
}

// Load the photos once, set up the editable text controls, then draw + show.
async function buildStrip() {
  await (document.fonts ? document.fonts.ready : Promise.resolve());

  // left column = host's photos, right column = joiner's photos
  const leftSet  = state.isHost ? state.myPhotos : state.theirPhotos;
  const rightSet = state.isHost ? state.theirPhotos : state.myPhotos;
  state.leftName  = (state.isHost ? state.myName : state.theirName) || 'me';
  state.rightName = (state.isHost ? state.theirName : state.myName) || 'my love';

  state.stripImgs = await Promise.all([...leftSet, ...rightSet].map(loadImg));

  refreshStripInputs();
  renderStrip();
  show('screen-result');
}

function defaultCaption() {
  return (state.leftName + '  ' + selectedFrame.emoji + '  ' + state.rightName).toUpperCase();
}

// Keep the input placeholders showing what the current theme would use.
function refreshStripInputs() {
  $('stripTitleInput').placeholder = selectedFrame.title;
  $('stripCaptionInput').placeholder = defaultCaption();
}

$('stripTitleInput').oninput = (e) => { state.stripTitle = e.target.value; renderStrip(); };
$('stripCaptionInput').oninput = (e) => { state.stripCaption = e.target.value; renderStrip(); };

// Draw text centered, shrinking the font until it fits within maxW.
function drawFitted(ctx, text, cx, y, maxW, px, family, color) {
  let size = px;
  ctx.fillStyle = color;
  ctx.font = size + "px " + family;
  while (ctx.measureText(text).width > maxW && size > 8) {
    size -= 1; ctx.font = size + "px " + family;
  }
  ctx.fillText(text, cx, y);
}

// Synchronous re-draw using cached images + current theme & text.
function renderStrip() {
  if (state.stripImgs.length < 8) return;
  const f = selectedFrame;
  const PAD = 30, GAP = 14, CW = 320, CH = 240;
  const HEAD = 110, FOOT = 90;
  const W = PAD * 2 + CW * 2 + GAP;
  const H = PAD * 2 + HEAD + FOOT + CH * 4 + GAP * 3;
  const innerW = W - PAD * 2 - 24;

  const cv = $('stripCanvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // background
  ctx.fillStyle = f.bg; ctx.fillRect(0, 0, W, H);

  // outer pixel border
  ctx.lineWidth = 8; ctx.strokeStyle = f.accent;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.lineWidth = 3; ctx.strokeStyle = '#3a1c40';
  ctx.strokeRect(15, 15, W - 30, H - 30);

  // header band
  ctx.fillStyle = f.band;
  ctx.fillRect(PAD, PAD, W - PAD * 2, HEAD - 12);
  ctx.strokeStyle = '#3a1c40'; ctx.lineWidth = 3;
  ctx.strokeRect(PAD, PAD, W - PAD * 2, HEAD - 12);

  // emoji garland (top) + title (custom or theme default)
  garland(ctx, PAD + 16, PAD + 26, W - PAD - 16, f.deco, 22);
  const title = (state.stripTitle || '').trim() || f.title;
  drawFitted(ctx, title, W / 2, PAD + 64, innerW, 20, "'Press Start 2P', monospace", f.accent);

  // photo grid (mirrored for selfie look)
  const gridTop = PAD + HEAD;
  for (let row = 0; row < 4; row++) {
    drawCell(ctx, state.stripImgs[row],     PAD,            gridTop + row * (CH + GAP), CW, CH, f.accent);
    drawCell(ctx, state.stripImgs[4 + row], PAD + CW + GAP, gridTop + row * (CH + GAP), CW, CH, f.accent);
  }

  // footer band
  const footTop = H - PAD - FOOT + 12;
  ctx.fillStyle = f.band;
  ctx.fillRect(PAD, footTop, W - PAD * 2, FOOT - 12);
  ctx.strokeStyle = '#3a1c40'; ctx.lineWidth = 3;
  ctx.strokeRect(PAD, footTop, W - PAD * 2, FOOT - 12);

  // caption (custom or names) + date line
  const caption = (state.stripCaption || '').trim() || defaultCaption();
  drawFitted(ctx, caption, W / 2, footTop + 26, innerW, 13, "'Press Start 2P', monospace", f.accent);
  const d = new Date();
  const dateStr = `${d.getFullYear()}·${String(d.getMonth() + 1).padStart(2, '0')}·${String(d.getDate()).padStart(2, '0')}  ♥ LDR PHOTO BOOTH ♥`;
  drawFitted(ctx, dateStr, W / 2, footTop + 52, innerW, 16, "'VT323', monospace", '#3a1c40');
}

function drawCell(ctx, img, x, y, w, h, accent) {
  // mirror the photo so it matches the selfie preview
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w, y); ctx.scale(-1, 1);
  if (img) {
    // cover-fit
    const ir = img.width / img.height, cr = w / h;
    let dw = w, dh = h, dx = 0, dy = 0;
    if (ir > cr) { dh = h; dw = h * ir; dx = -(dw - w) / 2; }
    else { dw = w; dh = w / ir; dy = -(dh - h) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
  // cell frame
  ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 3; ctx.strokeStyle = accent;  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

function garland(ctx, x0, y, x1, deco, size) {
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = size + "px 'VT323', monospace";
  const span = x1 - x0, n = 11;
  for (let i = 0; i <= n; i++) {
    ctx.fillText(deco[i % deco.length], x0 + (span * i) / n, y);
  }
  ctx.restore();
}

/* ----- result buttons ----- */
$('btnDownload').onclick = () => {
  const a = document.createElement('a');
  a.download = 'ldr-photobooth-' + Date.now() + '.png';
  a.href = $('stripCanvas').toDataURL('image/png');
  a.click();
};

$('btnAgain').onclick = () => {
  state.theirPhotos = [];
  state.stripImgs = [];
  state.stripTitle = '';
  state.stripCaption = '';
  $('stripTitleInput').value = '';
  $('stripCaptionInput').value = '';
  resetMyShots();
  setPartner(state.solo ? 'solo mode ♥' : 'waiting for your person…', state.solo);
  show('screen-booth');
};
