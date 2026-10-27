/* Aizawa letter interaction. MIT licensed.
   页面只剩标题：悬停某个字母时，文字换成该字母对应的词、照片填进字里，
   黑场以这个字母为圆心向外扩散，直到铺满整个背景。 */
const CONFIG = window.LETTER_CONFIG;
const BASE_TEXT = CONFIG.text.trim();
const words = document.querySelector('#words');

const tokens = Array.from(BASE_TEXT);
const letterTokens = tokens.filter(ch => !/\s/.test(ch));
const ASSETS = letterTokens.map((ch, i) => CONFIG.imagesByPosition[i] || []);
const LABELS = CONFIG.labels || [];
const photos = [];
document.querySelector('h1').setAttribute('aria-label', BASE_TEXT);

/* ---------- DOM：sizer 决定热区尺寸，display 显示会变的文字，hit-layer 是固定热区 ---------- */
function makeWord(text) {
  const group = document.createElement('span');
  group.className = 'word';
  [...text].forEach((ch, n) => {
    const el = document.createElement('span'); el.className = 'letter';
    const c = document.createElement('span'); c.className = 'char'; c.textContent = ch;
    el.append(c);
    el.style.setProperty('--bob-delay', ((n % 6) * .14).toFixed(2) + 's');
    group.append(el);
  });
  return group;
}
function makeText(text) {
  const frag = document.createDocumentFragment();
  text.split(/\s+/).forEach((w, i) => {
    if (i) {
      const sp = document.createElement('span'); sp.className = 'space'; frag.append(sp);
    }
    frag.append(makeWord(w));
  });
  return frag;
}

const sizer = document.createElement('span');
sizer.className = 'sizer';
sizer.setAttribute('aria-hidden', 'true');
sizer.append(makeText(BASE_TEXT));

const hitLayer = document.createElement('span');
hitLayer.className = 'hit-layer';
let hitIndex = 0;
BASE_TEXT.split(/\s+/).forEach((w, wi) => {
  if (wi) {
    const sp = document.createElement('span'); sp.className = 'space'; hitLayer.append(sp);
  }
  const group = document.createElement('span'); group.className = 'word';
  for (const ch of w) {
    const hit = document.createElement('span');
    hit.className = 'hit'; hit.dataset.index = hitIndex; hit.textContent = ch;
    hit.style.setProperty('--bob-delay', ((hitIndex % 6) * .14).toFixed(2) + 's');
    group.append(hit); hitIndex++;
  }
  hitLayer.append(group);
});

const display = document.createElement('span');
display.className = 'display';

words.append(sizer, hitLayer, display);

function renderWord(text, src) {
  display.replaceChildren(makeText(text));
  display.classList.toggle('filled', !!src);
  if (src) display.style.setProperty('--photo', `url("${src}")`);
  const chars = [...display.querySelectorAll('.char')];
  chars.forEach((ch, n) => ch.style.setProperty('--bx', chars.length > 1 ? (n / (chars.length - 1) * 100).toFixed(1) + '%' : '50%'));
  document.querySelector('h1').setAttribute('aria-label', text);
}

/* ---------- 状态 ---------- */
let hovered = null, ready = false, revertTimer = null;

function activate(i) {
  if (!ready || !LABELS[i]) return;
  clearTimeout(revertTimer);
  hovered = i;
  const hit = hitLayer.querySelector(`[data-index="${i}"]`);
  if (hit) {
    const r = hit.getBoundingClientRect();
    document.documentElement.style.setProperty('--spot-x', (r.left + r.width / 2) + 'px');
    document.documentElement.style.setProperty('--spot-y', (r.top + r.height / 2) + 'px');
  }
  document.body.classList.add('focusing');
  renderWord(LABELS[i], photos[i] || null);
}

function deactivate() {
  if (hovered === null && !document.body.classList.contains('focusing')) return;
  hovered = null;
  document.body.classList.remove('focusing');
  clearTimeout(revertTimer);
  revertTimer = setTimeout(() => { if (hovered === null) renderWord(BASE_TEXT, null); }, 460);
}

/* ---------- 指针 ---------- */
function point(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-index]');
  if (!hit || !words.contains(hit)) return;
  const next = Number(hit.dataset.index);
  if (next !== hovered) activate(next);
}
words.addEventListener('pointermove', point);
words.addEventListener('pointerdown', point);
words.addEventListener('pointerleave', deactivate);
words.addEventListener('pointercancel', deactivate);
words.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') deactivate(); });

/* ---------- 素材 ---------- */
function load(i, name) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => { if (!photos[i]) photos[i] = `assets/${name}`; resolve(); };
    im.onerror = () => resolve();
    im.src = `assets/${name}`;
  });
}
Promise.all(letterTokens.flatMap((ch, i) => ASSETS[i].map(name => load(i, name)))).then(() => {
  ready = true;
  renderWord(BASE_TEXT, null);
});
