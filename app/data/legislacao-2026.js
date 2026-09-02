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
      "(confirmar contra Diário da República antes de uso em produção). NOTA: um recálculo interno por continuidade " +
      "matemática entre escalões sugere que parcelaAbater dos escalões 4-7 poderia ser ~2€ mais alto (ex.: escalão 4: " +
      "1476.53 em vez de 1474.53); no entanto, dois cálculos independentes (calculapt.pt e especialistadoirs.pt) " +
      "confirmam exatamente os valores já aqui codificados — mantidos como estão, discrepância documentada para futura revisão.",

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
    // (trabalho dependente) — art.º 25º/1 CIRS. valorFixo = 8,54 × IAS 2026
    // (537,13€ — CONFIRMADO, dois cálculos independentes batem certo: ver
    // fonte). Se as contribuições obrigatórias p/ segurança social do ano
    // forem superiores ao valorFixo, usa-se o valor das contribuições (raro,
    // não implementado nesta versão).
    deducaoEspecificaCategoriaA: {
      valorFixo: 4587.09, // 8.54 × 537.13 (IAS 2026) = 4587.0902 ≈ 4587.09
      confirmado: true,
      fonte:
        "art.º 25º/1 CIRS. IAS 2026 = 537,13€ confirmado em apcmc.pt/legislacao/ias-para-2026-fixado-em-e-53713 " +
        "e e-konomista.pt/indexante-dos-apoios-sociais (dois cálculos independentes); fórmula 8,54×IAS confirmada " +
        "por retrocálculo do valor 2025 (522,50€ × 8,54 = 4.462,15€, valor que bate certo com a 'Demonstração de " +
        "Liquidação' real de referência usada nesta sessão).",
    },

    // Quotização sindical (quota paga a sindicato, art.º 25º/4 CIRS) — NÃO é
    // um valor fixo alternativo à dedução específica acima; é uma dedução
    // ADICIONAL igual ao valor pago majorado em 100% (i.e., o dobro do
    // valor pago), com o limite de 1% do rendimento bruto de Categoria A do
    // próprio sujeito passivo. Ex.: 100€ pagos → 200€ dedutíveis (aspe.pt).
    majoracaoQuotizacaoSindical: {
      percentagem: 1, // majoração de 100% (dobro do valor pago)
      limitePercentagemRendimentoBruto: 0.01, // 1% do rendimento bruto de Categoria A
      confirmado: true,
      fonte:
        "jornaldenegocios.pt/economia/emprego/detalhe/majoracao-de-quotas-sindicais-em-irs-vai-subir-para-100 " +
        "(majoração 50%→100%, Lei do OE) e aspe.pt/dedução-das-quotas-sindicais-no-irs (exemplo numérico e limite de 1% " +
        "do rendimento de Categoria A). Substitui a versão anterior desta tabela, que tratava isto incorretamente " +
        "como uma troca para um valor fixo alternativo (valorComQuotizacaoSindical) em vez de uma dedução proporcional.",
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
      // CONFIRMADO por 3 fontes independentes: pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html,
      // doutorfinancas.pt/impostos/irs/guia-irs-para-quem-tem-dependentes-nao-perca-beneficios,
      // e info.portaldasfinancas.gov.pt (texto do art.º 78º-A CIRS). Modelo
      // de 3 escalões por posição/idade, agora implementado a sério em
      // engine/calculo-irs.js (valorDeducaoPorDependente) — deixou de ser
      // um modelo simplificado. Precisa da data de nascimento do
      // dependente (campo `dataNascimento`, gerido em Perfil); sem essa
      // data, aplica-se sempre o valor base (sem majoração), por omissão
      // conservadora.
      dependentes: {
        primeiro: 600, // 1º dependente, ou qualquer dependente sem data de nascimento
        primeiroComMajoracaoAte3Anos: 726, // 1º dependente com menos de 3 anos a 31/12
        segundoEmDianteAte6Anos: 900, // 2º dependente em diante, com até 6 anos a 31/12
        confirmado: true,
        fonte:
          "art.º 78º-A CIRS — pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html, doutorfinancas.pt e " +
          "info.portaldasfinancas.gov.pt (texto do artigo). Guarda partilhada: cada sujeito passivo deduz metade " +
          "do valor aplicável (dependente.guarda === 'partilhada' em código).",
      },
      saude: {
        percentagem: 0.15,
        limite: 1000,
        confirmado: true,
        fonte: "art.º 78º-C CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html",
      },
      educacao: {
        percentagem: 0.3,
        limite: 800,
        confirmado: true,
        fonte: "art.º 78º-D CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html",
      },
      ppr: {
        percentagem: 0.2,
        limiteAte35Anos: 800,
        limite35a50Anos: 700,
        limiteMais50Anos: 600,
        confirmado: true,
        fonte: "art.º 78º CIRS / regime PPR — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html",
      },
      // Rendas de habitação própria e permanente (art.º 78º-E CIRS).
      // Percentagem (15%) confirmada por 3 fontes (coverflex.com,
      // santander.pt/salto, crncontabilidade.pt). O limite geral para
      // 2026, porém, TEM FONTES A DIVERGIR: crncontabilidade.pt diz 750€
      // (mantido — é o valor já codificado e o único a bater certo com
      // uma segunda leitura), santander.pt/salto diz 700€, e
      // executivedigest.sapo.pt diz 900€. O limite mais alto para o 1º
      // escalão de rendimento (1.050€) está confirmado por 2 fontes
      // independentes (santander.pt/salto e crncontabilidade.pt) e já é
      // usado no motor. Juros de empréstimos à habitação contraídos até
      // 2011 (mesma percentagem, 15%) não têm limite confirmado nesta
      // sessão — `limite` abaixo cobre só rendas por agora.
      encargosHabitacao: {
        percentagem: 0.15,
        limite: 750,
        limitePrimeiroEscalao: 1050,
        confirmado: false,
        fonte:
          "art.º 78º-E CIRS — percentagem (15%) confirmada; limite geral DIVERGENTE entre fontes (700€ a 900€, " +
          "ver nota acima), mantido 750€ (crncontabilidade.pt/blog/deducao-de-rendas-no-irs-em-2026-valor-maximo-" +
          "condicoes-e-como-declarar). limitePrimeiroEscalao (1.050€) confirmado por 2 fontes independentes.",
      },
      // IVAucher / dedução por exigência de fatura — CONFIRMADO por 2
      // fontes independentes (coverflex.com, executivedigest.sapo.pt):
      // 250€ por agregado familiar/ano, cobrindo restauração, reparação
      // de veículos, ginásios, cultura e transportes públicos.
      exigenciaFatura: {
        limite: 250,
        confirmado: true,
        fonte: "art.º 78º CIRS (IVAucher) — coverflex.com/pt/blog/despesas-dedutiveis-no-irs e executivedigest.sapo.pt",
      },
      despesasGeraisFamiliares: {
        percentagem: 0.35,
        limiteCasal: 500,
        limiteSolteiro: 250,
        confirmado: true,
        fonte: "art.º 78º CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html",
      },
    },

    // Mínimo de existência (art.º 70º CIRS) — rendimento líquido abaixo do
    // qual não há lugar a tributação (14 × retribuição mínima mensal
    // garantida prevista para 2026, 920€/mês).
    minimoExistencia: {
      valorAnual: 12880,
      confirmado: true,
      fonte: "art.º 70º CIRS — eco.sapo.pt/2025/10/09/quem-ganha-ate-920-euros-nao-vai-pagar-irs-em-2026 (14 × 920€)",
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
