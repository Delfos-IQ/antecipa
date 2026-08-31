// data/legislacao-2026.js
// Tabelas fiscais versionadas — ano fiscal 2026 (Portugal continental).
//
// IMPORTANTE — LEIA ANTES DE CONFIAR NESTES VALORES:
// Estes valores foram compilados a partir de fontes jornalísticas/fiscais
// públicas (ver `fonte` em cada bloco) que reportam o Orçamento do Estado
// para 2026 (Lei 73-A/2025) e o art.º 68º do CIRS. Não foi possível, nesta
// sessão, confirmar cada valor diretamente contra o Diário da República.
// Antes de usar este motor para uma declaração real, confirme cada bloco
// marcado com `confirmado: false` contra a Portaria/Lei do OE2026 publicada
// em https://diariodarepublica.pt e atualize `confirmado: true`.
//
// O motor de cálculo (engine/calculo-irs.js) NUNCA lê valores fora desta
// tabela — qualquer correção fiscal faz-se apenas aqui.

export const legislacaoFiscal = [
  {
    anoFiscal: 2026,
    vigenciaDesde: "2026-01-01",
    confirmado: false,
    fonte:
      "Lei do Orçamento do Estado 2026 (Lei 73-A/2025), art.º 68º CIRS. " +
      "Compilado via comparafacil.pt/escaloes-irs-2026 e especialistadoirs.pt/blog/escaloes-irs-2026-tabela-atualizada " +
      "(confirmar contra Diário da República antes de uso em produção).",

    // Escalões de rendimento coletável (continente). Cada escalão define o
    // limite superior, a taxa marginal aplicável a esse escalão, e a
    // parcela a abater já pré-calculada pela fórmula oficial
    // (Coleta = Rendimento Coletável × Taxa − Parcela a Abater).
    escaloes: [
      { limite: 8342, taxaMarginal: 0.125, parcelaAbater: 0 },
      { limite: 12587, taxaMarginal: 0.157, parcelaAbater: 266.94 },
      { limite: 17838, taxaMarginal: 0.212, parcelaAbater: 959.23 },
      { limite: 23089, taxaMarginal: 0.241, parcelaAbater: 1474.53 },
      { limite: 29397, taxaMarginal: 0.311, parcelaAbater: 3090.76 },
      { limite: 43090, taxaMarginal: 0.349, parcelaAbater: 4207.85 },
      { limite: 46566, taxaMarginal: 0.431, parcelaAbater: 7741.23 },
      { limite: 86634, taxaMarginal: 0.446, parcelaAbater: 8441.72 },
      { limite: Infinity, taxaMarginal: 0.48, parcelaAbater: 11387.28 },
    ],

    // Taxa adicional de solidariedade (art.º 68º-A CIRS) — aplicada sobre a
    // parte do rendimento coletável que exceda os limiares abaixo, sobre o
    // conjunto (não afetada pelo quociente familiar).
    taxaSolidariedade: [
      { desde: 80000, ate: 250000, taxa: 0.025 },
      { desde: 250000, ate: Infinity, taxa: 0.05 },
    ],

    // Dedução específica por sujeito passivo com rendimentos de Categoria A
    // (trabalho dependente) — art.º 25º CIRS.
    deducaoEspecificaCategoriaA: {
      valorFixo: 4587.09,
      valorComQuotizacaoSindical: 4834.17, // se houver quotização p/ ordem/associação profissional dedutível
      // Se as contribuições obrigatórias p/ segurança social do ano forem
      // superiores ao valorFixo, usa-se o valor das contribuições (raro).
      fonte: "art.º 25º CIRS, valores 2026 via pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html",
    },

    // Coeficientes do regime simplificado — Categoria B (art.º 31º CIRS).
    coeficientesSimplificadoB: {
      vendaMercadorias: 0.15,
      hoteleiraELocalAlojamento: 0.35,
      prestacaoServicosGeral: 0.75, // maioria dos recibos verdes "serviços"
      prestacaoServicosTabelaAnexa: 0.75,
      outrosRendimentosCapitaisEPrediais: 0.95,
      // Mínimo garantido: dedução mínima de 15% do rendimento bruto de
      // Categoria B mesmo com o coeficiente aplicado, se superior.
      minimoGarantidoPercentagem: 0.15,
      fonte: "art.º 31º CIRS — confirmar coeficiente aplicável por atividade (CAE) antes de produção",
    },

    // Quociente familiar (art.º 69º CIRS).
    quociente: {
      base: { individual: 1, conjunta: 2 },
      porDependente: 0.5,
      porDependenteGuardaPartilhada: 0.25,
    },

    // Limites de deduções à coleta (art.º 78º-A a 78º-E CIRS).
    limitesDeducoes: {
      dependentes: {
        primeiro: 600, // dedução geral por dependente (ordem de grandeza — confirmar)
        segundoEseguintesAte3Anos: 750,
        fonte: "art.º 78º-A CIRS — confirmar valores exatos por posição do dependente",
      },
      saude: { percentagem: 0.15, limite: 1000, fonte: "art.º 78º-C CIRS" },
      educacao: { percentagem: 0.3, limite: 800, fonte: "art.º 78º-D CIRS" },
      ppr: {
        percentagem: 0.2,
        limiteAte35Anos: 800,
        limite35a50Anos: 700,
        limiteMais50Anos: 600,
        fonte: "art.º 78º CIRS / regime PPR",
      },
      encargosHabitacao: {
        percentagem: 0.15,
        limite: 750,
        limiteInterior: 1000,
        fonte: "art.º 78º CIRS — regime transitório de rendas/juros de habitação própria",
      },
      exigenciaFatura: { limite: 250, fonte: "IVAucher / dedução por exigência de fatura, art.º 78º CIRS" },
      despesasGeraisFamiliares: {
        percentagem: 0.35,
        limiteCasal: 500,
        limiteSolteiro: 250,
        fonte: "art.º 78º CIRS — despesas gerais familiares",
      },
    },

    // Mínimo de existência (art.º 70º CIRS) — rendimento líquido abaixo do
    // qual não há lugar a tributação (ajustado anualmente ao IAS).
    minimoExistencia: {
      valorAnual: 12180, // ordem de grandeza baseada em 1,5 × 14 × IAS aproximado — CONFIRMAR
      fonte: "art.º 70º CIRS — confirmar valor exato indexado ao IAS de 2026",
    },

    // Benefício municipal — participação variável de IRS que alguns
    // municípios revertem ao contribuinte (0% a 0,30% da coleta).
    beneficioMunicipalMaximo: 0.003,
  },
];

/**
 * Devolve a tabela fiscal aplicável a uma determinada data (ou ao ano
 * fiscal, por omissão 1 de janeiro desse ano), escolhendo a entrada mais
 * recente cuja vigenciaDesde seja igual ou anterior à data pedida.
 * Suporta o caso de a legislação mudar a meio do ano (ex.: 2025).
 */
export function obterTabelaFiscal(anoFiscal, dataReferencia) {
  const data = dataReferencia ? new Date(dataReferencia) : new Date(`${anoFiscal}-12-31`);
  const candidatas = legislacaoFiscal
    .filter((t) => t.anoFiscal === anoFiscal || new Date(t.vigenciaDesde).getFullYear() === anoFiscal)
    .filter((t) => new Date(t.vigenciaDesde) <= data)
    .sort((a, b) => new Date(b.vigenciaDesde) - new Date(a.vigenciaDesde));

  if (candidatas.length === 0) {
    throw new Error(
      `Sem tabela fiscal para o ano ${anoFiscal} (data ref. ${data.toISOString().slice(0, 10)}). ` +
        `Anos disponíveis: ${legislacaoFiscal.map((t) => t.anoFiscal).join(", ")}`
    );
  }
  return candidatas[0];
}
