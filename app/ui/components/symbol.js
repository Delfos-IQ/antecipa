// ui/components/symbol.js
// Símbolo de marca — o logotipo fornecido pelo Dani (documento fiscal
// "IRS" sobre uma calculadora, ladeado por dois arcos que sugerem
// "antecipação"). A partir desta versão usa-se diretamente a arte
// original (assets/mark.png), não uma recriação vetorial — ver
// BRAND.md §4. Caminho relativo assume que o marcador é renderizado
// dentro de app/index.html.

export function simboloSVG({ size = 32 } = {}) {
  const h = Math.round(size * 1.03); // a arte original é ligeiramente mais alta que larga
  return `<img src="../assets/mark.png" alt="Antecipa" width="${size}" height="${h}" style="display:inline-block;object-fit:contain;" />`;
}

/** Lockup horizontal — símbolo + wordmark, para cabeçalhos e a landing. */
export function lockupSVG({ height = 28, corTexto = "var(--navy-deep)" } = {}) {
  return `
    <span class="lockup" style="display:inline-flex;align-items:center;gap:10px;">
      ${simboloSVG({ size: height })}
      <span style="font-family:var(--font-display);font-size:${height * 0.82}px;color:${corTexto};letter-spacing:-0.01em;">antecipa<span style="color:#1F4E9E">.</span></span>
    </span>
  `;
}
