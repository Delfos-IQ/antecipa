// engine/deducoes/educacao.js
// Dedução à coleta de despesas de educação (art.º 78º-D CIRS) — 30% da
// despesa, com teto por agregado (ver data/legislacao-2026.js).
//
// Extraído de calcularDeducoesAColeta em engine/calculo-irs.js (13/10/2026,
// split do motor em submódulos por categoria). Refatoração pura.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

// Faturas emitidas com o NIF de um dependente também contam para educação
// (art.º 78º-C/D CIRS — "despesas de qualquer membro do agregado
// familiar"), somadas à MESMA base antes da percentagem e do teto — pedido
// real (03/09/2026): despesas escolares dos filhos não apareciam em lado
// nenhum da simulação.
export function calcularDeducaoEducacao({ deducoesColeta, limites }) {
  const baseEducacao = (deducoesColeta.educacao || 0) + (deducoesColeta.educacaoDependentes || 0);
  const valor = clamp(baseEducacao * limites.educacao.percentagem, limites.educacao.limite);
  return {
    valor,
    teto: limites.educacao.limite,
    referenciaLegal: "art.º 78º-D CIRS",
  };
}
