// engine/deducoes/despesas-gerais.js
// Dedução de despesas gerais e familiares (art.º 78º-B CIRS).
//
// Extraído de calcularDeducoesAColeta em engine/calculo-irs.js (13/10/2026,
// split do motor em submódulos por categoria). Refatoração pura.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

// Faturas emitidas com o NIF de um dependente também contam para esta
// dedução (art.º 78º-B CIRS não distingue o NIF de quem paga, só que a
// despesa seja de "qualquer membro do agregado familiar") — pedido de
// uma validadora real (03/09/2026): em guarda partilhada, cada
// progenitor só reclama a sua parte (normalmente 50%) das faturas do
// dependente, campo próprio para não obrigar a somar isso à mão dentro
// do campo "despesasGerais". Soma-se à MESMA base antes da percentagem
// e do teto — não é um plafond adicional, é só mais base de cálculo
// para o mesmo limite de 250€/500€ por sujeito passivo (confirmado via
// Portal das Finanças: o limite é "por sujeito passivo", não por membro
// do agregado).
export function calcularDespesasGerais({ deducoesColeta, limites, regime }) {
  const baseDespesasGerais = (deducoesColeta.despesasGerais || 0) + (deducoesColeta.despesasGeraisDependentes || 0);
  const teto = regime === "conjunta" ? limites.despesasGeraisFamiliares.limiteCasal : limites.despesasGeraisFamiliares.limiteSolteiro;
  const valor = clamp(baseDespesasGerais * limites.despesasGeraisFamiliares.percentagem, teto);
  return { valor, teto, referenciaLegal: "art.º 78º-B CIRS" };
}
