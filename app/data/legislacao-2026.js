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
      "Compilado via comparafacil.pt/escaloes-irs-2026 e especialistadoirs.pt/blog/escaloes-irs-2026-tabela-atualizada. " +
      "ATUALIZAÇÃO (auditoria de 03/09/2026): a parcela a abater dos escalões 4-7 estava ~2€ abaixo do valor correto " +
      "(erro de transcrição propagado por vários blogs) — corrigida contra uma terceira fonte independente, PwC " +
      "Portugal (pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html), que bate certo com um recálculo por " +
      "continuidade matemática pura entre escalões. Ainda por confirmar contra o Diário da República antes de uso " +
      "em produção — ver auditoria completa no doc do projeto para os restantes pontos revistos.",

    // Escalões de rendimento coletável (continente). Cada escalão define o
    // limite superior, a taxa marginal aplicável a esse escalão, e a
    // parcela a abater já pré-calculada pela fórmula oficial
    // (Coleta = Rendimento Coletável × Taxa − Parcela a Abater).
    // CORRIGIDO na auditoria de 03/09/2026: a parcela a abater dos
    // escalões 4-7 estava ~2€ abaixo do valor correto — erro de
    // transcrição propagado por vários blogs (CRN-Contabilidade,
    // ComparaFácil), que se copiam uns aos outros. Confirmado por uma
    // terceira fonte independente (PwC Portugal, Guia Fiscal 2026) que
    // bate certo com um recálculo por continuidade matemática pura a
    // partir do escalão 1 (a coleta tem de ser contínua em cada fronteira
    // de escalão). Escalões 1-3, 8 e 9 já estavam corretos.
    escaloes: [
      { limite: 8342, taxaMarginal: 0.125, parcelaAbater: 0 },
      { limite: 12587, taxaMarginal: 0.157, parcelaAbater: 266.94 },
      { limite: 17838, taxaMarginal: 0.212, parcelaAbater: 959.23 },
      { limite: 23089, taxaMarginal: 0.241, parcelaAbater: 1476.53 },
      { limite: 29397, taxaMarginal: 0.311, parcelaAbater: 3092.76 },
      { limite: 43090, taxaMarginal: 0.349, parcelaAbater: 4209.89 },
      { limite: 46566, taxaMarginal: 0.431, parcelaAbater: 7743.27 },
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

    // Quociente familiar (art.º 69º CIRS). CORRIGIDO na auditoria de
    // 03/09/2026: só a base (1,00 individual / 2,00 conjunta) — o
    // acréscimo por dependente foi revogado pela Lei n.º 7-A/2016 (revogou
    // os n.os 2, 4 e 5 do art.º 69º). Confirmado por fonte primária (uma
    // Demonstração de Liquidação real com dependentes mostra "Quociente
    // familiar 2,00", sem acréscimo) — ver engine/calculo-irs.js,
    // calcularQuocienteFamiliar, para o histórico completo do erro.
    quociente: {
      base: { individual: 1, conjunta: 2 },
      confirmado: true,
      fonte:
        "art.º 69º CIRS, na redação vigente desde a Lei n.º 7-A/2016 (revogou o acréscimo por dependente) — " +
        "info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs69.aspx, " +
        "cgd.pt/Site/Saldo-Positivo/leis-e-impostos/Pages/quociente-familiar.aspx, e confirmado por fonte primária " +
        "(Demonstração de Liquidação de IRS real com dependentes, linha 10: quociente 2,00 sem acréscimo).",
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
      // santander.pt/salto, crncontabilidade.pt). ATUALIZADO na auditoria
      // de 03/09/2026: a divergência anterior (700€ a 900€) foi resolvida
      // por uma fonte OFICIAL — comunicado do Conselho de Ministros de
      // 27/03/2026 — que confirma a subida do limite geral para 900€ em
      // 2026 (e 1.000€ a partir de 2027). O limite do 1º escalão de
      // rendimento subiu em conjunto para 1.100€ segundo 3 fontes
      // convergentes (DECO Proteste, Montepio, idealista.pt) — ainda sem
      // confirmação oficial direta do valor exato, por isso mantido
      // `confirmado: false` só para este sub-valor. Juros de empréstimos
      // à habitação contraídos até 2011 (mesma percentagem, 15%) não têm
      // limite confirmado nesta sessão — `limite` abaixo cobre só rendas
      // por agora.
      encargosHabitacao: {
        percentagem: 0.15,
        limite: 900,
        limitePrimeiroEscalao: 1100,
        confirmado: false,
        fonte:
          "art.º 78º-E CIRS — percentagem (15%) confirmada. Limite geral (900€) CONFIRMADO por fonte oficial: " +
          "comunicado do Conselho de Ministros, portugal.gov.pt/pt/gc25/governo/comunicados-do-conselho-de-ministros/719 " +
          "(\"aumento progressivo do limite de dedução dos encargos com rendas... para 900 euros em 2026 e 1.000 " +
          "euros a partir de 2027\"). limitePrimeiroEscalao (1.100€) por 3 fontes convergentes mas não oficiais " +
          "(deco.proteste.pt, montepio.org, idealista.pt) — confirmar contra o diploma antes de uso em produção.",
      },
      // Dedução por exigência de fatura (art.º 78º-F CIRS, "IVAucher"-like)
      // — 15% do IVA suportado em setores como restauração, reparação de
      // veículos, cabeleireiros/estética, veterinários, hotelaria, ginásios,
      // até 250€ por agregado familiar/ano (CONFIRMADO por 2 fontes
      // independentes: coverflex.com, executivedigest.sapo.pt). Transportes
      // públicos (passes mensais e bilhetes) são a EXCEÇÃO dentro desta
      // mesma dedução: 100% do IVA suportado (não 15%), mas partilhando o
      // MESMO teto de 250€/agregado — não é um plafond adicional separado
      // (CONFIRMADO por 2 fontes: eco.sapo.pt/2023/02/16/bilhetes-dos-
      // transportes-abatem-no-irs-e-entram-como-passes-mensais-no-portal-e-
      // fatura, e idealista.pt/news/financas/fiscalidade/2026/02/24/74061).
      exigenciaFatura: {
        percentagem: 0.15,
        percentagemTransportesPublicos: 1.0,
        limite: 250,
        confirmado: true,
        fonte:
          "art.º 78º-F CIRS (dedução por exigência de fatura) — coverflex.com/pt/blog/despesas-dedutiveis-no-irs, " +
          "executivedigest.sapo.pt, eco.sapo.pt/2023/02/16/bilhetes-dos-transportes-abatem-no-irs-e-entram-como-" +
          "passes-mensais-no-portal-e-fatura (100% IVA em transportes públicos, mesmo teto de 250€) e " +
          "idealista.pt/news/financas/fiscalidade/2026/02/24/74061-despesas-dedutiveis-em-irs-tudo-o-que-precisas-de-saber.",
      },
      despesasGeraisFamiliares: {
        percentagem: 0.35,
        limiteCasal: 500,
        limiteSolteiro: 250,
        confirmado: true,
        fonte: "art.º 78º CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html",
      },
      // Donativos (mecenato, art.º 63º EBF) — confirmado por 3 fontes
      // independentes (pwc.pt/guia-fiscal/2026, cgd.pt/Saldo-Positivo,
      // montepio.org): 25% do valor doado, com teto de 15% da coleta, para
      // donativos à generalidade das entidades (IPSS, associações,
      // instituições particulares de solidariedade social — o caso comum).
      // NÃO modelado nesta versão (casos especiais, mais raros): donativos
      // ao Estado/regiões autónomas/autarquias/certas fundações são "sem
      // limite" em vez de 15% da coleta; donativos a instituições
      // religiosas contam a 130% do valor doado; donativos acima de
      // 50.000€ têm reporte a 3 anos do valor não aproveitado. Modela-se só
      // o caso comum — o utilizador que se enquadre nos casos especiais
      // fica com um valor conservador (mais baixo que o real), nunca mais
      // alto.
      donativos: {
        percentagem: 0.25,
        limitePercentagemColeta: 0.15,
        confirmado: true,
        fonte:
          "art.º 63º EBF (mecenato) — confirmado por 3 fontes independentes: " +
          "pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html, " +
          "cgd.pt/Site/Saldo-Positivo/leis-e-impostos/Pages/deduzir-donativos-no-IRS.aspx, " +
          "montepio.org/ei/pessoal/impostos/como-deduzir-donativos-no-irs/.",
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
    // municípios revertem ao contribuinte. CORRIGIDO na auditoria de
    // 03/09/2026: o intervalo legal real é 0% a 5% da coleta (não 0,30% —
    // esse era o valor concreto que UM município específico aplicava num
    // exemplo real, não o teto legal). Confirmado por 2 fontes
    // independentes (CGD, Doutor Finanças): cada município define
    // anualmente a percentagem que retém (0% a 5%); o desconto ao
    // residente é 5% menos a percentagem retida. Este valor é só o TETO
    // que limita o input do utilizador (`participacaoMunicipal`) — a
    // percentagem real do seu município continua a ser inserida por ele.
    beneficioMunicipalMaximo: 0.05,
    beneficioMunicipalFonte:
      "Lei das Finanças Locais, participação variável de IRS — cgd.pt/Site/Saldo-Positivo/leis-e-impostos/Pages/" +
      "desconto-municipal-irs.aspx e doutorfinancas.pt/impostos/irs/desconto-municipal-no-irs-como-se-aplica/ " +
      "(intervalo 0%-5%, ~207 municípios participantes, 44 a devolver os 5% completos).",

    // Tributação autónoma de mais-valias e rendimentos de capitais não
    // englobados (art.º 72º/1 CIRS) — taxa fixa de 28%, aplicada à parte
    // (mais-valias mobiliárias, juros, dividendos, etc.) que o sujeito
    // passivo opta por NÃO englobar no rendimento global. CONFIRMADO por
    // fonte primária: a "Demonstração de Liquidação de IRS" real usada
    // nesta sessão de auditoria mostra exatamente esta taxa aplicada a
    // "Rendimentos capitais não englobados" e "Mais-valias não englobadas"
    // (linha 17, discriminação das tributações autónomas). Existe também
    // uma taxa agravada de 35% para rendimentos de jurisdições com regime
    // fiscal claramente mais favorável (lista negra, art.º 72º/12 CIRS) —
    // caso raro, fora do âmbito do v1 (não modelado).
    taxaAutonomaMaisValias: 0.28,
    taxaAutonomaMaisValiasFonte:
      "art.º 72º/1 CIRS — confirmado por fonte primária (Demonstração de Liquidação de IRS real, linha 17, " +
      "\"Discriminação da linha 17\": 28,00% sobre rendimentos de capitais e mais-valias não englobados).",
  },
];

// Metadados de revisão da tabela fiscal acima — quando foi verificada pela
// última vez contra fontes fiscais, e quando está prevista a próxima
// revisão (normalmente à volta da entrada em vigor do Orçamento do Estado
// seguinte). Fonte única para os avisos mostrados na landing (index.html,
// via import direto deste módulo) e em Perfil (ui/ventana-perfil.js) — ao
// rever a legislação para um novo ano, atualizar só aqui.
export const revisaoFiscal = {
  dataRevisao: "setembro de 2026",
  proximaRevisaoPrevista: "março de 2027",
};

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
