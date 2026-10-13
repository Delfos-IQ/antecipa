// engine/deducoes/ascendentes.js
// Dedução por ascendente a cargo (art.º 78º-A CIRS) + extra por
// deficiência (art.º 87º) — NOVO (04/09/2026).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). `valorDeducaoAscendente` continua exportada
// com o mesmo nome e assinatura a partir de calculo-irs.js (re-exportada
// daqui), por ser usada diretamente em ui/ventana-perfil.js. Refatoração
// pura: nenhum cálculo foi alterado.

import { round2, sum } from "../numero.js";

// `posicao`/`totalAscendentes` decidem entre o valor "único ascendente"
// (635€, só quando há exatamente 1 no agregado) e o valor "por ascendente"
// (525€ cada, quando há 2 ou mais) — ver nota em legislacao-2026.js sobre
// isto ser um valor de SUBSTITUIÇÃO, não uma majoração adicional. Ao
// contrário dos dependentes, a dedução de deficiência de um ascendente não
// tem a "despesa de acompanhamento" de incapacidade ≥90% (o art.º 87º só a
// prevê para sujeito passivo ou dependente).
export function valorDeducaoAscendente(ascendente, totalAscendentes, limites) {
  const config = limites.ascendentes;
  if (!config) return 0;
  const base = totalAscendentes === 1 ? config.unicoAscendente : config.primeiro;
  const extraDeficiencia = ascendente?.deficiencia ? (limites.deficiencia?.dependenteOuAscendente ?? 0) : 0;
  return round2(base + extraDeficiencia);
}

export function calcularDeducaoAscendentes({ ascendentes = [], limites }) {
  const total = round2(sum(ascendentes, (a) => valorDeducaoAscendente(a, ascendentes.length, limites)));
  return { total, referenciaLegal: "art.º 78º-A CIRS" };
}
