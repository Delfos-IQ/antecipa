// assets/landing-copyright.js — extraído de index.html (24/09/2026) para
// permitir uma Content-Security-Policy sem 'unsafe-inline' em script-src.
const elAno = document.getElementById("ano-copyright");
if (elAno) elAno.textContent = new Date().getFullYear();
