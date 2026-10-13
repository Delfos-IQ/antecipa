// engine/deducoes/habitacao.js
// Dedução de encargos com rendas de habitação própria e permanente (art.º
// 78º-E CIRS).
//
// Extraído de calcularDeducoesAColeta em engine/calculo-irs.js (13/10/2026,
// split do motor em submódulos por categoria). Refatoração pura.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

// Limite de rendas de habitação: mais alto (limitePrimeiroEscalao) para
// quem tem rendimento (por quociente) dentro do 1º escalão de IRS — o
// mesmo escalão já calculado na Importância Apurada (linha 6), para
// ficar consistente com o quociente familiar em vez de comparar o
// rendimento coletável bruto. Ver nota em data/legislacao-2026.js sobre
// a divergência de fontes no limite geral.
export function calcularDeducaoHabitacao({ deducoesColeta, limites, escalaoAplicado, tabela }) {
  const dentroDoPrimeiroEscalao = escalaoAplicado?.limite === tabela.escaloes?.[0]?.limite;
  const teto =
    dentroDoPrimeiroEscalao && limites.encargosHabitacao.limitePrimeiroEscalao
      ? limites.encargosHabitacao.limitePrimeiroEscalao
      : limites.encargosHabitacao.limite;
  const valor = clamp((deducoesColeta.habitacao || 0) * limites.encargosHabitacao.percentagem, teto);
  return { valor, teto, referenciaLegal: "art.º 78º-E CIRS" };
}
