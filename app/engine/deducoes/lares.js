// engine/deducoes/lares.js
// Encargos com lares (art.º 84º CIRS) — NOVO (24/09/2026). 25% do valor
// suportado, com um teto de 403,75€ POR BENEFICIÁRIO (a pessoa cujos
// encargos são pagos — sujeito passivo, ascendente, etc.), não por quem
// paga nem pelo agregado.
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). `valorDeducaoLares` continua exportada com o
// mesmo nome e assinatura a partir de calculo-irs.js (re-exportada daqui),
// por ser usada diretamente em ui/ventana-perfil.js. Refatoração pura.

import { round2, sum } from "../numero.js";

// `encargosLarAnual` vive no próprio objeto do beneficiário (pessoa ou
// ascendente) — ver comentário em legislacao-2026.js para o texto legal e
// a razão de não modelar dependentes/colaterais nesta versão.
export function valorDeducaoLares(encargosLarAnual, limites) {
  const config = limites.lares;
  if (!config || !encargosLarAnual) return 0;
  return round2(Math.min(encargosLarAnual * config.percentagem, config.limitePorBeneficiario));
}

export function calcularDeducaoLares({ pessoas = [], ascendentes = [], limites }) {
  const laresSujeitosPassivos = round2(sum(pessoas, (p) => valorDeducaoLares(p?.encargosLarAnual, limites)));
  const laresAscendentes = round2(sum(ascendentes, (a) => valorDeducaoLares(a?.encargosLarAnual, limites)));
  const total = round2(laresSujeitosPassivos + laresAscendentes);
  return { total, laresSujeitosPassivos, laresAscendentes, referenciaLegal: "art.º 84º CIRS" };
}
