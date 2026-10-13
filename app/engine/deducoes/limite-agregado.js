// engine/deducoes/limite-agregado.js
// Limite agregado às deduções à coleta (art.º 78º, n.º 7 e n.º 8 CIRS) —
// aplica-se só às deduções das alíneas c), d), e), f), h), k) e m) do n.º 1
// do art.º 78º (saúde, educação, habitação, PPR, exigência de fatura e
// trabalho doméstico).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). Refatoração pura — `calcularLimiteAgregadoDeducoes`
// nunca foi exportada publicamente, continua privada ao motor (só usada por
// calcularDeducoesAColeta).

import { round2 } from "../numero.js";

// CORRIGIDO 24/09/2026: a alínea b) do n.º 7 não decresce até ao último
// escalão FINITO da tabela de IRS (art.º 68º) — decresce até ao limiar do
// art.º 68º-A (taxa adicional de solidariedade), que é um valor FIXO de
// 80.000€, distinto e mais baixo do que o topo da tabela normal de
// escalões (83.696€ em 2025, por exemplo — já usado noutro sítio da app
// como `tabela.taxaSolidariedade[0].desde`). A fórmula literal (alínea b),
// confirmada por economiafinancas.com/2025/irs-regras-e-limitacoes-as-
// deducoes-a-coleta-de-2025/, com os números a baterem exatamente contra
// os já confirmados nesta app): "1000 + 1500 × (80.000 − rendimento
// coletável)/(71.941)" — onde 71.941 = 80.000 − 8.059 (8.059€ é o 1º
// escalão de 2025, já confirmado por fonte primária em `tabela.escaloes`).
// Antes desta correção, o motor usava o topo da tabela de escalões em vez
// de 80.000€, o que dava um limite ligeiramente mais alto do que a lei
// permite para rendimentos entre 80.000€ e o topo da tabela de escalões.
// Sem limite até ao 1º escalão de IRS; entre o 1º escalão e 80.000€,
// decresce linearmente de 2.500€ para 1.000€; fixo em 1.000€ acima disso.
// Majoração de 5% por dependente para agregados com 3+ dependentes.
export function calcularLimiteAgregadoDeducoes({ rendimentoPorQuociente, numDependentes, tabela }) {
  const config = tabela.limitesDeducoes?.limiteAgregado;
  if (!config) return Infinity;

  const primeiroLimite = tabela.escaloes[0].limite; // 1º escalão, art.º 68º
  const limiarSolidariedade = tabela.taxaSolidariedade?.[0]?.desde ?? Infinity; // 80.000€, art.º 68º-A

  let limite;
  if (rendimentoPorQuociente <= primeiroLimite) {
    limite = Infinity;
  } else if (rendimentoPorQuociente >= limiarSolidariedade) {
    limite = config.minimo;
  } else {
    const fracao = (limiarSolidariedade - rendimentoPorQuociente) / (limiarSolidariedade - primeiroLimite);
    limite = config.minimo + (config.maximo - config.minimo) * fracao;
  }

  if (limite !== Infinity && numDependentes >= config.numDependentesParaMajoracao) {
    limite = limite * (1 + config.majoracaoPorDependentePercentagem * numDependentes);
  }

  return limite === Infinity ? Infinity : round2(limite);
}
