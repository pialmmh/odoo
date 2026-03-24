/**
 * Read the platform theme from the tb_theme cookie (set by React app)
 * and apply the matching CSS class to <body>.
 */
(function() {
  var match = document.cookie.match(/(?:^|;\s*)tb_theme=([^;]*)/);
  var theme = match ? decodeURIComponent(match[1]) : 'green';
  var valid = ['green','blue','red','gray','orange','light-green','light-blue','light-red','light-gray'];
  if (valid.indexOf(theme) === -1) theme = 'green';
  document.body.classList.add('theme-' + theme);
})();
