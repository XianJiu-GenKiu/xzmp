/* 顶部/底部导航：滑动定位、当前区域标记、下滑隐藏、上滑出现。 */
(() => {
  const nav = document.querySelector('.top-nav');
  if (!nav) return;

  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const targets = links
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if (!targets.length) return;

  const mobileQuery = window.matchMedia('(max-width: 760px)');
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  let frame = 0;
  let lastY = window.scrollY;
  let programmatic = false;
  let animationId = 0;
  let keyboardNav = false;

  function setActive(id) {
    links.forEach(link => {
      const active = link.getAttribute('href') === '#' + id;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function showNav() {
    nav.classList.remove('is-hidden');
  }

  function hideNav() {
    nav.classList.add('is-hidden');
  }

  function updateActive() {
    const marker = window.scrollY + Math.min(window.innerHeight * 0.38, 300);
    let current = targets[0];
    for (const target of targets) {
      const top = target.getBoundingClientRect().top + window.scrollY;
      if (top <= marker) current = target;
    }
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
    if (atBottom) current = targets[targets.length - 1];
    setActive(current.id);
  }

  function update() {
    frame = 0;
    const y = window.scrollY;

    if (programmatic) {
      lastY = y;
      return;
    }

    const delta = y - lastY;

    if (Math.abs(delta) > 6) {
      const keyboardFocus = nav.contains(document.activeElement) && keyboardNav;
      if (delta > 0 && y > 120 && !keyboardFocus) hideNav();
      else showNav();
      lastY = y;
    }

    if (y < 40) {
      showNav();
      lastY = y;
    }

    if (!programmatic) updateActive();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function animateTo(top, duration) {
    const from = window.scrollY;
    const distance = top - from;
    if (Math.abs(distance) < 2) {
      window.scrollTo(0, top);
      return;
    }

    const start = performance.now();
    const id = ++animationId;
    programmatic = true;

    function step(now) {
      if (id !== animationId) return;
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo(0, from + distance * easeOutCubic(t));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        programmatic = false;
        updateActive();
      }
    }

    requestAnimationFrame(step);
  }

  function cancelAnimation() {
    if (!programmatic) return;
    animationId++;
    programmatic = false;
    updateActive();
  }

  links.forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      const hash = link.getAttribute('href');
      const target = document.querySelector(hash);
      if (!target) return;

      event.preventDefault();
      const offset = mobileQuery.matches ? 24 : 104;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const destination = Math.min(max, Math.max(0,
        target.getBoundingClientRect().top + window.scrollY - offset));

      try {
        history.replaceState(null, '', hash);
      } catch (error) {
        /* 本地 file:// 打开时忽略地址栏更新 */
      }

      setActive(target.id);
      const distance = Math.abs(destination - window.scrollY);
      animateTo(destination, Math.min(900, Math.max(420, distance * 0.55)));
    });
  });

  nav.addEventListener('focusin', () => {
    if (!programmatic) showNav();
  });

  nav.addEventListener('keydown', () => {
    keyboardNav = true;
  });

  window.addEventListener('pointerdown', () => {
    keyboardNav = false;
  }, { passive: true });

  window.addEventListener('wheel', () => {
    keyboardNav = false;
  }, { passive: true });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('wheel', cancelAnimation, { passive: true });
  window.addEventListener('touchstart', cancelAnimation, { passive: true });
  window.addEventListener('keydown', event => {
    if ([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) cancelAnimation();
  }, { passive: true });

  update();
})();
