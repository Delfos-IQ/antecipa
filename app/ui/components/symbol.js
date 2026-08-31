// ui/components/symbol.js
// Símbolo de marca — documento fiscal ("IRS") sobre uma calculadora,
// ladeado por dois arcos que sugerem "antecipação" (o resultado já
// calculado antes do círculo fiscal fechar). É o único elemento gráfico
// de assinatura da marca: usar com moderação, sem duplicar como padrão
// decorativo. Geometria e cores seguem o logotipo de referência (ver
// BRAND.md) — cores fixas, não variam consoante o fundo.

export function simboloSVG({ size = 32 } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Antecipa">
      <path d="M18,26 Q7,50 18,74" fill="none" stroke="#1F4E9E" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M82,26 Q93,50 82,74" fill="none" stroke="#1F4E9E" stroke-width="6.5" stroke-linecap="round"/>

      <rect x="28" y="47" width="44" height="35" rx="7" fill="#0B1D3A"/>
      <g fill="#FFFFFF">
        <rect x="34" y="57" width="8.5" height="8.5" rx="2"/>
        <rect x="45.75" y="57" width="8.5" height="8.5" rx="2"/>
        <rect x="57.5" y="57" width="8.5" height="8.5" rx="2"/>
        <rect x="34" y="69.5" width="8.5" height="8.5" rx="2"/>
        <rect x="45.75" y="69.5" width="8.5" height="8.5" rx="2"/>
        <rect x="57.5" y="69.5" width="8.5" height="8.5" rx="2"/>
      </g>

      <path d="M34,16 H62 L74,28 V57 A4.5,4.5 0 0 1 69.5,61.5 H34 A4.5,4.5 0 0 1 29.5,57 V20.5 A4.5,4.5 0 0 1 34,16 Z" fill="#FFFFFF" stroke="#0B1D3A" stroke-width="2.6"/>
      <path d="M62,16 L74,28 H62 Z" fill="#1F4E9E"/>

      <text x="48" y="35.5" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="14" fill="#0B1D3A" text-anchor="middle">IRS</text>
      <line x1="36.5" y1="43" x2="60" y2="43" stroke="#1F4E9E" stroke-width="2.8" stroke-linecap="round"/>
      <line x1="36.5" y1="50" x2="60" y2="50" stroke="#1F4E9E" stroke-width="2.8" stroke-linecap="round"/>
    </svg>
  `;
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
