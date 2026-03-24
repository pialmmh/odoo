/**
 * Telcobright Platform — Keycloak Login Theme Initializer
 *
 * Reads cookies set by the React app:
 *   tb_theme         — color theme name (green, blue, etc.)
 *   tb_login_title   — login page title from tenant branding config
 *   tb_login_subtitle — login page subtitle from tenant branding config
 *
 * Applies the matching CSS class to <body> and updates the login header text.
 */
(function() {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // Apply theme class
  var theme = getCookie('tb_theme') || 'green';
  var valid = ['green','blue','red','gray','orange','light-green','light-blue','light-red','light-gray'];
  if (valid.indexOf(theme) === -1) theme = 'green';
  document.body.classList.add('theme-' + theme);

  // Apply branding title
  var title = getCookie('tb_login_title');
  if (title) {
    var titleEl = document.getElementById('tb-login-title');
    if (titleEl) titleEl.textContent = title;
  }

  // Apply branding subtitle
  var subtitle = getCookie('tb_login_subtitle');
  if (subtitle) {
    var subtitleEl = document.getElementById('tb-login-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = subtitle;
      subtitleEl.style.display = 'block';
    }
  }
})();
