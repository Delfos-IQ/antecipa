// ui/components/symbol.js
// Símbolo de marca — círculo (ciclo fiscal anual) com um ponteiro que
// atravessa o limite do círculo. É o único elemento gráfico de assinatura
// da marca (secção 1.2 do prompt de build): usar com moderação.
//
// Versão refinada (ver assets/mark.svg): o aro usa currentColor/uma cor
// dada (para funcionar sobre fundo claro ou escuro), a ponta do ponteiro
// tem sempre o par brass/brass-light com o anel de precisão — esse
// detalhe nunca muda de cor consoante o fundo, é a assinatura da marca.

export function simboloSVG({ size = 32, corAro = "var(--navy-mid)", corPonteiro = "#A9843F", corPonta = "#D4B876" } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Antecipa">
      <circle cx="50" cy="50" r="34" fill="none" stroke="${corAro}" stroke-width="3"/>
      <line x1="50" y1="50" x2="76" y2="24" stroke="${corPonteiro}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="4.5" fill="${corPonteiro}"/>
      <circle cx="76" cy="24" r="6" fill="none" stroke="${corPonta}" stroke-width="1.5"/>
      <circle cx="76" cy="24" r="3" fill="${corPonta}"/>
    </svg>
  `;
}

/** Lockup horizontal — símbolo + wordmark, para cabeçalhos e a landing. */
export function lockupSVG({ height = 28, corAro = "var(--navy-mid)", corTexto = "var(--navy-deep)" } = {}) {
  return `
    <span class="lockup" style="display:inline-flex;align-items:center;gap:10px;">
      ${simboloSVG({ size: height, corAro })}
      <span style="font-family:var(--font-display);font-size:${height * 0.82}px;color:${corTexto};letter-spacing:-0.01em;">antecipa<span style="color:#A9843F">.</span></span>
    </span>
  `;
}
