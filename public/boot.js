// Runs before the app, from a file so the Content Security Policy needs no inline scripts.
// Apply the saved theme before first paint to avoid a light flash in dark mode.
try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  }
} catch (e) {}
// Android paints the status bar in the solid theme-color, so the header
// switches to a matching solid top edge there (see theme.css).
if (/Android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('android');
}
