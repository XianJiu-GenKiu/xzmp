/* 留言板：读取 / 发布 /api/messages。
   所有留言内容都用 textContent 写入页面，不拼 HTML。 */
(() => {
  const API = '/api/messages';
  const MAX_MESSAGE = 280;
  const MAX_NAME = 24;

  const form = document.querySelector('#guestbook-form');
  const nameInput = document.querySelector('#guestbook-name');
  const messageInput = document.querySelector('#guestbook-message');
  const submitButton = document.querySelector('#guestbook-submit');
  const counter = document.querySelector('#guestbook-counter');
  const statusEl = document.querySelector('#guestbook-status');
  const listEl = document.querySelector('#guestbook-list');
  const countEl = document.querySelector('#guestbook-count');
  const emptyEl = document.querySelector('#guestbook-empty');

  if (!form || !listEl) return;

  const ERROR_TEXT = {
    rate_limited: '刚刚已经留过言了，稍等几秒再发～',
    bad_json: '提交的内容无法识别，请刷新后重试。',
    empty: '留言不能为空。',
    too_long: '内容有点长，删减一些再发。',
    server_error: '服务器出了点小问题，请稍后再试。',
    network: '连接不上服务器，请稍后再试。'
  };

  let messages = [];
  let total = 0;
  let busy = false;

  const pad = value => String(value).padStart(2, '0');

  function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    if (diff >= 0 && diff < 60 * 1000) return '刚刚';
    if (diff >= 0 && diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff >= 0 && diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
    return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate());
  }

  function setStatus(text, tone) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-ok', tone === 'ok');
    statusEl.classList.toggle('is-error', tone === 'error');
  }

  function updateCounter() {
    counter.textContent = messageInput.value.length + ' / ' + MAX_MESSAGE;
  }

  function makeItem(entry, highlightId) {
    const item = document.createElement('li');
    item.className = 'guestbook-item';
    if (highlightId && entry.id === highlightId) item.classList.add('is-new');

    const head = document.createElement('div');
    head.className = 'guestbook-item-head';

    const name = document.createElement('span');
    name.className = 'guestbook-item-name';
    name.textContent = entry.name || '匿名';

    const time = document.createElement('time');
    time.className = 'guestbook-item-time';
    time.dateTime = entry.createdAt || '';
    time.textContent = formatTime(entry.createdAt);
    time.title = entry.createdAt || '';

    const body = document.createElement('p');
    body.className = 'guestbook-item-message';
    body.textContent = entry.message;

    head.append(name, time);
    item.append(head, body);
    return item;
  }

  function render(highlightId) {
    listEl.replaceChildren(...messages.map(entry => makeItem(entry, highlightId)));
    countEl.textContent = total + ' 条';
    emptyEl.hidden = messages.length > 0;
  }

  async function request(url, options) {
    const response = await fetch(url, options);
    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
    if (!response.ok) {
      const code = data && data.error ? data.error : 'network';
      const failure = new Error(code);
      failure.code = code;
      throw failure;
    }
    return data;
  }

  async function load() {
    emptyEl.textContent = '正在加载留言…';
    try {
      const data = await request(API, { cache: 'no-store', headers: { Accept: 'application/json' } });
      messages = Array.isArray(data.messages) ? data.messages : [];
      total = Number.isFinite(data.total) ? data.total : messages.length;
      emptyEl.textContent = '还没有留言，来做第一个吧。';
      render();
    } catch (error) {
      total = 0;
      countEl.textContent = '—';
      emptyEl.textContent = '留言暂时没有加载出来，稍后刷新试试。';
      setStatus('留言加载失败，刷新页面再试。', 'error');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!message) {
      setStatus('留言不能为空。', 'error');
      messageInput.focus();
      return;
    }
    if (message.length > MAX_MESSAGE) {
      setStatus('留言最多 ' + MAX_MESSAGE + ' 字。', 'error');
      messageInput.focus();
      return;
    }
    if (name.length > MAX_NAME) {
      setStatus('称呼最多 ' + MAX_NAME + ' 个字符。', 'error');
      nameInput.focus();
      return;
    }

    busy = true;
    submitButton.disabled = true;
    submitButton.textContent = '发布中…';
    setStatus('');

    try {
      const data = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, message })
      });
      const entry = data && data.message ? data.message : null;
      if (!entry) throw new Error('server_error');

      messages.unshift(entry);
      if (messages.length > 50) messages.length = 50;
      total = Number.isFinite(data.total) ? data.total : total + 1;
      messageInput.value = '';
      updateCounter();
      emptyEl.textContent = '还没有留言，来做第一个吧。';
      render(entry.id);
      setStatus('留言已发布，谢谢你～', 'ok');
    } catch (error) {
      const code = error && error.code ? error.code : 'network';
      setStatus(ERROR_TEXT[code] || ERROR_TEXT.network, 'error');
    } finally {
      busy = false;
      submitButton.disabled = false;
      submitButton.textContent = '发布留言';
    }
  });

  messageInput.addEventListener('input', updateCounter);
  updateCounter();
  load();
})();
