// engine/deducoes/ppr.js
// Dedução de entregas para Plano Poupança-Reforma (PPR, art.º 21º EBF).
//
// Extraído de calcularDeducoesAColeta em engine/calculo-irs.js (13/10/2026,
// split do motor em submódulos por categoria). Refatoração pura: o cálculo
// é idêntico ao que já existia ali, incluindo o fallback para o campo
// legado `deducoesColeta.ppr`.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

// PPR: o limite legal é POR SUJEITO PASSIVO (art.º 21º EBF — ver
// legislacao-2026.js para o histórico do erro 800/700/600€ vs.
// 400/350/300€), não um plafond partilhado do agregado. CORRIGIDO
// (24/09/2026, pedido do Dani a partir do ecrã real: "el PPR es por
// titular, pero aqui solo hay espaço para um titular... este campo
// tendria que estar vinculado com os sujeitos pasivos definidos"). Até
// aqui `deducoesColeta.ppr` era um único número do agregado, capado ao
// teto ×2 em conjunta — o que dava a mesma dedução quer as entregas
// fossem feitas 50/50 por cada titular, quer um só titular tivesse
// feito tudo (caso em que a lei só permite deduzir até ao SEU próprio
// teto, não o do agregado inteiro). Confirmado que o teto do agregado é
// mesmo a soma de dois tetos independentes via uma Demonstração de
// Liquidação real (ver nota em legislacao-2026.js, bloco 2025: 610€
// deduzidos, sem clamping, em declaração conjunta). Agora calcula-se a
// dedução de cada titular (`deducoesColeta.pprPorPessoa`, mapa
// pessoaId → valor entregue) independentemente, cada uma capada ao seu
// próprio teto, e soma-se — `pessoas` já vem correctamente âmbito por
// quem chama esta função (compararRegimes passa só o titular relevante
// em cada declaração separada; o ecrã de Simulação/Deduções passa os
// dois em conjunta). Ainda simplificado: usa-se sempre o teto mais alto
// (menor idade) por titular, por não termos a data de nascimento de
// cada um disponível neste ponto — refinar em v1.1.
export function calcularDeducaoPPR({ deducoesColeta, pessoas = [], limites }) {
  const pprTetoPorTitular = limites.ppr.limiteAte35Anos;
  const pprPorPessoaMapa = deducoesColeta.pprPorPessoa || {};
  // Legado: se ainda não há nenhum valor no novo mapa por titular mas
  // existe o antigo campo único `ppr` (dados gravados antes desta
  // correção), atribui-se por omissão ao 1º titular — não há forma de
  // saber retroativamente como as entregas se repartiram entre os dois.
  // ui/ventana-deducoes.js já migra isto para o mapa novo assim que o
  // ecrã de Deduções é aberto (e zera o campo antigo), por isso este
  // fallback só serve quem chama o motor diretamente sem passar por lá.
  const usaValorLegadoPpr = Object.keys(pprPorPessoaMapa).length === 0 && (deducoesColeta.ppr || 0) > 0;
  const titularesPpr = pessoas.length ? pessoas : [{ id: "household" }];
  const pprDetalhePorPessoa = {};
  let total = 0;
  titularesPpr.forEach((titular, indice) => {
    const contributo = usaValorLegadoPpr && indice === 0 ? deducoesColeta.ppr || 0 : pprPorPessoaMapa[titular.id] || 0;
    const deducaoTitular = clamp(contributo * limites.ppr.percentagem, pprTetoPorTitular);
    pprDetalhePorPessoa[titular.id] = { contributo: round2(contributo), deducao: deducaoTitular, teto: pprTetoPorTitular };
    total = round2(total + deducaoTitular);
  });
  const teto = round2(pprTetoPorTitular * titularesPpr.length);

  return { total, pprDetalhePorPessoa, teto, referenciaLegal: "art.º 21º EBF" };
}
