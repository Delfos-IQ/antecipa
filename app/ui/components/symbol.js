// ui/components/symbol.js
// Símbolo de marca — documento fiscal ("IRS") sobre uma calculadora,
// ladeado por dois arcos que sugerem "antecipação" (o resultado já
// calculado antes do círculo fiscal fechar). É o único elemento gráfico
// de assinatura da marca: usar com moderação, sem duplicar como padrão
// decorativo. Cores fixas da paleta (ver BRAND.md) — não variam consoante
// o fundo, ao contrário da versão anterior do símbolo.

export function simboloSVG({ size = 32 } = {}) {
  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Antecipa">
      <path d="M20,26 Q9,50 20,74" fill="none" stroke="#1F4E9E" stroke-width="6" stroke-linecap="round"/>
      <path d="M80,26 Q91,50 80,74" fill="none" stroke="#1F4E9E" stroke-width="6" stroke-linecap="round"/>

      <rect x="29" y="46" width="42" height="34" rx="7" fill="#0B1D3A"/>
      <g fill="#FFFFFF">
        <rect x="35" y="56" width="8" height="8" rx="2"/>
        <rect x="46" y="56" width="8" height="8" rx="2"/>
        <rect x="57" y="56" width="8" height="8" rx="2"/>
        <rect x="35" y="68" width="8" height="8" rx="2"/>
        <rect x="46" y="68" width="8" height="8" rx="2"/>
        <rect x="57" y="68" width="8" height="8" rx="2"/>
      </g>

      <path d="M35,17 H60 L68,25 V56 A4,4 0 0 1 64,60 H35 A4,4 0 0 1 31,56 V21 A4,4 0 0 1 35,17 Z" fill="#FFFFFF" stroke="#0B1D3A" stroke-width="2.5"/>
      <path d="M60,17 L68,25 H60 Z" fill="#1F4E9E"/>

      <text x="49.5" y="35" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="13" fill="#0B1D3A" text-anchor="middle">IRS</text>
      <line x1="38" y1="42" x2="58" y2="42" stroke="#5B8DD9" stroke-width="2.6" stroke-linecap="round"/>
      <line x1="38" y1="48" x2="52" y2="48" stroke="#5B8DD9" stroke-width="2.6" stroke-linecap="round"/>
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
