(function () {
  var KEY = 'bento-theme';
  var doc = document.documentElement;
  var themeBtn = document.getElementById('theme-toggle');
  var menuBtn = document.getElementById('menu-toggle');
  var mobileMenu = document.getElementById('mobile-menu');

  /* --- theme --- */
  function setTheme(mode) {
    doc.setAttribute('data-theme', mode);
    try { localStorage.setItem(KEY, mode); } catch (_) {}
    if (themeBtn) themeBtn.textContent = mode === 'dark' ? '☀' : '☾';
  }

  function toggleTheme() {
    var next = doc.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
  }

  var saved = (function () {
    try { return localStorage.getItem(KEY); } catch (_) { return null; }
  })();

  if (saved) {
    setTheme(saved);
  } else {
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  /* --- mobile menu --- */
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      mobileMenu.classList.toggle('open');
    });

    /* close on nav click */
    mobileMenu.querySelectorAll('.nav-item').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
      });
    });

    /* close on Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') mobileMenu.classList.remove('open');
    });
  }

  /* --- running days since 2026-04-10 --- */
  var el = document.getElementById('run-days');
  if (el) {
    var days = Math.max(0, Math.floor((Date.now() - new Date('2026-04-10').getTime()) / 86400000));
    el.textContent = days;
  }
})();
