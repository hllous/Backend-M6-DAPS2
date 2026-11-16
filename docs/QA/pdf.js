// Se inyecta en la página antes de imprimir el PDF (ver scripts/build-qa-pdf.mjs).

// Las celdas cortas (ID, severidad, fecha, issue) no se parten: el texto largo sí.
const MAX_NOWRAP = 22;
document.querySelectorAll('td, th').forEach((cell) => {
  if (cell.textContent.trim().length <= MAX_NOWRAP) cell.classList.add('nw');
});

// Un identificador largo en código (archivo, ruta, constante) se parte solo después de . - _ / :
// y no en medio de una palabra ("demo-personas.e2e-/spec.ts", no "RESOLV/ED").
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
document.querySelectorAll('td code, th code').forEach((code) => {
  if (code.children.length > 0) return;
  code.innerHTML = escapeHtml(code.textContent).replace(/([./_:-])/g, '$1<wbr>');
});
