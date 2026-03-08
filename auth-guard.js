/**
 * Golden Icy Studio — Auth Guard
 * Add this ONE line to any HTML page inside <head> to protect it:
 *
 *   <script src="auth-guard.js"></script>
 *
 * That's it. No other changes needed.
 *
 * What it does:
 * - Checks if the user is logged in via sessionStorage / localStorage
 * - If NOT logged in → redirects to login.html?redirect=currentPage
 * - If logged in → restores currentUser and updates the Login button UI
 * - Keeps session alive across all pages
 */

(function GISAuthGuard() {
  'use strict';

  // Pages that do NOT require login (public pages)
  const PUBLIC_PAGES = ['login.html', 'index-1.html'];

  const currentPage = location.pathname.split('/').pop() || 'index-1.html';
  const isPublic    = PUBLIC_PAGES.some(p => currentPage.includes(p));

  // Try to restore session
  let currentUser = null;
  try {
    const session = sessionStorage.getItem('gis_session');
    const stored  = localStorage.getItem('gis_current');

    if (session) {
      currentUser = JSON.parse(session);
    } else if (stored) {
      // Restore from localStorage backup if session expired
      currentUser = JSON.parse(stored);
      sessionStorage.setItem('gis_session', stored);
    }
  } catch (e) { currentUser = null; }

  // If page requires login and user is not logged in → redirect
  if (!isPublic && !currentUser) {
    location.replace('login.html?redirect=' + encodeURIComponent(currentPage));
    return;
  }

  // Expose user globally so the page can use it
  window.gisUser = currentUser;

  // On DOM ready: update the Login button to show user's name
  document.addEventListener('DOMContentLoaded', function () {
    if (!currentUser) return;

    // Update any Login/Signup button in the nav
    const userBtn = document.getElementById('user-btn');
    if (userBtn) {
      const avatar = userBtn.querySelector('.user-avatar');
      const nameEl = userBtn.querySelector('span');
      if (avatar) avatar.textContent = currentUser.fname[0].toUpperCase();
      if (nameEl)  nameEl.textContent = currentUser.fname;
    }

    // Update the btn-ice login button text
    const loginBtn = document.querySelector('.btn-ice[onclick*="openAuth"]');
    if (loginBtn && loginBtn.id !== 'user-btn') {
      loginBtn.textContent = '👤 ' + currentUser.fname;
    }

    // Patch doLogout to also clear gis_current
    if (typeof doLogout === 'function') {
      const _orig = doLogout;
      window.doLogout = function () {
        localStorage.removeItem('gis_current');
        sessionStorage.removeItem('gis_session');
        _orig();
      };
    }

    // Patch doLogin to save to localStorage
    if (typeof doLogin === 'function') {
      const _orig = doLogin;
      window.doLogin = function () {
        _orig();
        try {
          const s = sessionStorage.getItem('gis_session');
          if (s) localStorage.setItem('gis_current', s);
        } catch (e) {}
      };
    }
  });

})();
