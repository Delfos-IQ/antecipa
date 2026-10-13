// engine/deducoes/saude.js
// Dedução à coleta de despesas de saúde (art.º 78º-C CIRS) — 15% da
// despesa, com teto de 1.000€/agregado (ver data/legislacao-2026.js para a
// fonte confirmada do valor exato por ano fiscal).
//
// Extraído de calcularDeducoesAColeta em engine/calculo-irs.js (13/10/2026,
// split do motor em submódulos por categoria — ver app/engine/deducoes/).
// Refatoração pura: o cálculo é idêntico ao que já existia ali.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

// Faturas emitidas com o NIF de um dependente também contam para saúde
// (art.º 78º-C/D CIRS — "despesas de qualquer membro do agregado
// familiar"), mesmo padrão usado para despesasGerais/exigência de fatura:
// soma-se à MESMA base antes da percentagem e do teto, não é um plafond à
// parte. Pedido real (03/09/2026): despesas dos filhos (dentista,
// consultas, vacinas, comedor escolar) pedidas com o NIF deles não
// apareciam em lado nenhum da simulação.
export function calcularDeducaoSaude({ deducoesColeta, limites }) {
  const baseSaude = (deducoesColeta.saude || 0) + (deducoesColeta.saudeDependentes || 0);
  const valor = clamp(baseSaude * limites.saude.percentagem, limites.saude.limite);
  return {
    valor,
    teto: limites.saude.limite,
    referenciaLegal: "art.º 78º-C CIRS",
  };
}
