// engine/deducoes/donativos.js
// Donativos (mecenato, art.º 63º EBF) — 25% do valor doado, até 15% da
// coleta total (linha 7, ANTES da própria dedução — é essa a base legal
// do teto, não a coleta já líquida).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). Refatoração pura. Ver nota em
// data/legislacao-2026.js sobre os casos especiais não modelados.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

export function calcularDonativos({ deducoesColeta, limites, coletaTotal }) {
  if (!limites.donativos) {
    return { valor: 0, teto: null, referenciaLegal: "art.º 63º EBF" };
  }
  const teto = round2((coletaTotal || 0) * limites.donativos.limitePercentagemColeta);
  const valor = clamp((deducoesColeta.donativos || 0) * limites.donativos.percentagem, teto);
  return { valor, teto, referenciaLegal: "art.º 63º EBF" };
}
