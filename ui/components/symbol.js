// ui/components/symbol.js
// Símbolo de marca — círculo (ciclo fiscal anual) com um ponteiro que
// atravessa o limite do círculo. É o único elemento gráfico de assinatura
// da marca (secção 1.2 do prompt de build): usar com moderação.

export function simboloSVG({ size = 32, corAro = "var(--navy-mid)", corPonteiro = "var(--brass)" } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Antecipa">
      <circle cx="50" cy="50" r="38" fill="none" stroke="${corAro}" stroke-width="4"/>
      <line x1="50" y1="50" x2="80" y2="20" stroke="${corPonteiro}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="6" fill="${corPonteiro}"/>
      <circle cx="84" cy="16" r="5.5" fill="${corPonteiro}"/>
    </svg>
  `;
}
