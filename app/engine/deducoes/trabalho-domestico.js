// engine/deducoes/trabalho-domestico.js
// Trabalho doméstico (art.º 78º-H CIRS, alínea m) do n.º 1 do art.º 78º) —
// NOVO (04/09/2026).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). Refatoração pura.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

export function calcularTrabalhoDomestico({ deducoesColeta, limites }) {
  if (!limites.trabalhoDomestico) {
    return { valor: 0, teto: null, referenciaLegal: "art.º 78º-H CIRS" };
  }
  const valor = clamp((deducoesColeta.trabalhoDomestico || 0) * limites.trabalhoDomestico.percentagem, limites.trabalhoDomestico.limite);
  return { valor, teto: limites.trabalhoDomestico.limite, referenciaLegal: "art.º 78º-H CIRS" };
}
