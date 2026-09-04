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
    // Ano fiscal 2025 — ADICIONADO a pedido do Dani (04/09/2026): "Podemos
    // colocar o ano fiscal a partir de 2025. Em 2025 tenho dados completos
    // e poderia fazer uma simulação retrospetiva e ver se coincide."
    // Objetivo: validar a precisão do motor contra uma Demonstração de
    // Liquidação REAL de 2025 já emitida pela AT — não é um ano corrente,
    // é um teste de regressão contra a realidade.
    //
    // Metodologia desta pesquisa (04/09/2026): os escalões e a percentagem
    // do limite de encargos com habitação vêm de pwc.pt/pt/pwcinforfisco/
    // guia-fiscal/2025/irs.html (a MESMA fonte já usada como desempate no
    // ficheiro 2026, que resolveu lá um erro de transcrição de ~2€
    // propagado por vários blogs — por isso preferida aqui também).
    // Verificação de continuidade matemática feita (Coleta deve ser
    // contínua em cada fronteira de escalão, Coleta = RC×taxa−parcela): as
    // 9 parcelas do PwC batem certo entre si com um resíduo máximo de
    // 0,27€ (ruído normal de arredondamento das taxas publicadas a 1
    // casa decimal — muito abaixo do erro de ~2€ que tinha de ser
    // corrigido no ficheiro 2026, portanto sem sinal de erro de
    // transcrição desta vez).
    //
    // Todos os restantes blocos (quociente familiar, coeficientes da
    // Categoria B, deduções à coleta exceto habitação, limite agregado,
    // mínimo de existência, taxa de solidariedade, quotização sindical,
    // benefício municipal, tributação autónoma de mais-valias) são regras
    // do CIRS que NÃO mudaram entre 2025 e 2026 segundo as fontes
    // consultadas — reutilizados tal e qual do bloco 2026 abaixo, com a
    // mesma ressalva de confiança (`confirmado`) de cada um. Duas exceções
    // conhecidas e explicitamente NÃO modeladas: (1) os coeficientes do
    // regime simplificado da Categoria B só têm esta redação a partir de
    // 1/07/2025 (DL 49/2025) — a 1ª metade de 2025 usava o texto anterior
    // do art.º 31º, ligeiramente diferente; o motor não faz "split" a meio
    // do ano, por isso um recibo verde com atividade emitido no 1º
    // semestre de 2025 pode ter um coeficiente ligeiramente diferente do
    // real; (2) a majoração da quotização sindical (100%) parece já estar
    // em vigor desde 2024 segundo fontes sindicais (stal.pt), pelo que foi
    // mantida igual a 2026 sem re-confirmar letra a letra.
    anoFiscal: 2025,
    vigenciaDesde: "2025-01-01",
    confirmado: false,
    fonte:
      "Lei do Orçamento do Estado 2025 (Lei 45-A/2024) e art.º 68º CIRS. Escalões e limite de encargos com " +
      "habitação confirmados via pwc.pt/pt/pwcinforfisco/guia-fiscal/2025/irs.html (verificação de continuidade " +
      "matemática entre escalões feita nesta sessão, resíduo máximo 0,27€). IAS 2025 (522,50€) e dedução " +
      "específica de Categoria A (4.462,15€) confirmados por 2 fontes (OCC — occ.pt/sites/default/files/" +
      "public/2024-12/ANALISE_OE2025.pdf — e o próprio ficheiro 2026, que já usava este valor como retrocálculo " +
      "de verificação). Restantes blocos herdados de 2026 por ausência de indicação de mudança nas fontes " +
      "consultadas — ver nota de metodologia acima para as 2 exceções conhecidas e não modeladas. Ainda por " +
      "confirmar letra a letra contra o Diário da República antes de uso em produção.",

    escaloes: [
      { limite: 8059, taxaMarginal: 0.125, parcelaAbater: 0 },
      { limite: 12160, taxaMarginal: 0.16, parcelaAbater: 282.07 },
      { limite: 17233, taxaMarginal: 0.215, parcelaAbater: 950.91 },
      { limite: 22306, taxaMarginal: 0.244, parcelaAbater: 1450.67 },
      { limite: 28400, taxaMarginal: 0.314, parcelaAbater: 3011.98 },
      { limite: 41629, taxaMarginal: 0.349, parcelaAbater: 4006.1 },
      { limite: 44987, taxaMarginal: 0.431, parcelaAbater: 7419.54 },
      { limite: 83696, taxaMarginal: 0.446, parcelaAbater: 8094.51 },
      { limite: Infinity, taxaMarginal: 0.48, parcelaAbater: 10939.9 },
    ],

    taxaSolidariedade: [
      { desde: 80000, ate: 250000, taxa: 0.025 },
      { desde: 250000, ate: Infinity, taxa: 0.05 },
    ],

    // IAS 2025 = 522,50€ → 8,54 × 522,50 = 4.462,15€. Este é exatamente o
    // valor já usado como retrocálculo de verificação no comentário do
    // bloco 2026 acima ("bate certo com a Demonstração de Liquidação real
    // de referência") — por isso trazido com confiança alta para aqui.
    deducaoEspecificaCategoriaA: {
      valorFixo: 4462.15,
      confirmado: true,
      fonte:
        "art.º 25º/1 CIRS. IAS 2025 = 522,50€ (occ.pt/sites/default/files/public/2024-12/ANALISE_OE2025.pdf). " +
        "8,54 × 522,50 = 4.462,15€ — valor já confirmado por retrocálculo cruzado no ficheiro do ano fiscal 2026 " +
        "desta mesma tabela (bate certo com uma Demonstração de Liquidação real usada nessa auditoria).",
    },

    majoracaoQuotizacaoSindical: {
      percentagem: 1,
      limitePercentagemRendimentoBruto: 0.01,
      confirmado: true,
      fonte:
        "Herdado do bloco 2026 — a majoração de 100% (dobro) parece já estar em vigor desde 2024/2025 segundo " +
        "fontes sindicais (stal.pt/index.php/jornal/n-º-127-abril-2024, snqtb.pt/media/nkbafzov/" +
        "comunicado_18_2025.pdf), não re-confirmado letra a letra para 2025 nesta sessão.",
    },

    // Coeficientes do regime simplificado — Categoria B. Herdados de 2026
    // (mesma redação do art.º 31º, DL 49/2025). RESSALVA (ver nota de
    // metodologia acima): esta redação só vigora desde 1/07/2025 — o 1º
    // semestre de 2025 usava o texto anterior do artigo, ligeiramente
    // diferente, não modelado nesta versão (o motor não faz split a meio
    // do ano fiscal).
    coeficientesSimplificadoB: {
      vendaMercadorias: 0.15,
      hoteleiraELocalAlojamento: 0.15,
      prestacaoServicosGeral: 0.35,
      prestacaoServicosTabelaAnexa: 0.75,
      outrosRendimentosCapitaisEPrediais: 0.95,
      minimoGarantidoPercentagem: 0.15,
      confirmado: false,
      fonte:
        "Herdado do bloco 2026 (art.º 31º CIRS, redação DL 49/2025, em vigor desde 1/07/2025). Para rendimentos " +
        "de Categoria B do 1º semestre de 2025, a redação anterior do artigo pode divergir ligeiramente — não " +
        "modelado nesta versão.",
    },

    quociente: {
      base: { individual: 1, conjunta: 2 },
      confirmado: true,
      fonte: "Herdado do bloco 2026 — art.º 69º CIRS, regra inalterada desde a Lei n.º 7-A/2016.",
    },

    limitesDeducoes: {
      dependentes: {
        primeiro: 600,
        primeiroComMajoracaoAte3Anos: 726,
        segundoEmDianteAte6Anos: 900,
        confirmado: false,
        fonte: "Herdado do bloco 2026 (art.º 78º-A CIRS) — não re-confirmado especificamente para 2025 nesta sessão.",
      },
      saude: {
        percentagem: 0.15,
        limite: 1000,
        confirmado: true,
        fonte: "art.º 78º-C CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2025/irs.html.",
      },
      educacao: {
        percentagem: 0.3,
        limite: 800,
        confirmado: true,
        fonte: "art.º 78º-D CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2025/irs.html.",
      },
      ppr: {
        percentagem: 0.2,
        limiteAte35Anos: 400,
        limite35a50Anos: 350,
        limiteMais50Anos: 300,
        confirmado: false,
        fonte:
          "Herdado do bloco 2026 (art.º 21º/2 EBF, valores desde a Lei n.º 60-A/2005, nunca atualizados) — não " +
          "re-confirmado especificamente para 2025 nesta sessão.",
      },
      // Único valor que se sabe ter mudado de 2025 para 2026: o limite
      // geral de encargos com habitação subiu de 700€ (2025) para 900€
      // (2026) — o próprio comentário do bloco 2026 já menciona "a
      // divergência anterior (700€ a 900€)" a propósito disto, e o guia
      // PwC 2025 confirma 700€ para este ano. A distinção por 1º escalão
      // (1.100€) só aparece nas fontes de 2026 — não modelada para 2025.
      encargosHabitacao: {
        percentagem: 0.15,
        limite: 700,
        confirmado: true,
        fonte:
          "art.º 78º-E CIRS — pwc.pt/pt/pwcinforfisco/guia-fiscal/2025/irs.html (700€, antes da subida para 900€ " +
          "em 2026 confirmada por comunicado do Conselho de Ministros — ver bloco 2026).",
      },
      exigenciaFatura: {
        percentagem: 0.15,
        percentagemTransportesPublicos: 1.0,
        limite: 250,
        confirmado: false,
        fonte: "Herdado do bloco 2026 (art.º 78º-F CIRS) — não re-confirmado especificamente para 2025 nesta sessão.",
      },
      despesasGeraisFamiliares: {
        percentagem: 0.35,
        limiteCasal: 500,
        limiteSolteiro: 250,
        confirmado: true,
        fonte: "art.º 78º CIRS — confirmado via pwc.pt/pt/pwcinforfisco/guia-fiscal/2025/irs.html.",
      },
      donativos: {
        percentagem: 0.25,
        limitePercentagemColeta: 0.15,
        confirmado: false,
        fonte: "Herdado do bloco 2026 (art.º 63º EBF) — não re-confirmado especificamente para 2025 nesta sessão.",
      },
      limiteAgregado: {
        semLimiteAteEscalao1: true,
        minimo: 1000,
        maximo: 2500,
        majoracaoPorDependentePercentagem: 0.05,
        numDependentesParaMajoracao: 3,
        aplicavelA: ["saude", "educacao", "habitacao", "ppr", "despesasGerais", "exigenciaFatura"],
        confirmado: false,
        fonte: "Herdado do bloco 2026 (art.º 78º, n.º 7 e n.º 8 CIRS) — não re-confirmado especificamente para 2025 nesta sessão.",
      },
    },

    minimoExistencia: {
      // MAX(12.180€, 1,5×14×IAS). Com IAS 2025 = 522,50€: 1,5×14×522,50 =
      // 10.972,50€, inferior a 12.180€ — prevalece o valor fixo, igual ao
      // usado em 2026 (o mesmo cálculo lá também resulta no valor fixo).
      valorAnual: 12180,
      confirmado: false,
      fonte:
        "art.º 70º CIRS — MAX(12.180€, 1,5×14×IAS). IAS 2025 = 522,50€ → 1,5×14×522,50 = 10.972,50€ < 12.180€ → " +
        "usa-se o valor fixo. Herdado do mecanismo do bloco 2026, `confirmado: false` pela mesma razão (fórmula " +
        "com confiança alta, valor fixo de 12.180€ não confirmado letra a letra contra o Diário da República).",
    },

    beneficioMunicipalMaximo: 0.05,
    beneficioMunicipalFonte: "Herdado do bloco 2026 — Lei das Finanças Locais, participação variável de IRS (0%-5%), regra inalterada.",

    taxaAutonomaMaisValias: 0.28,
    taxaAutonomaMaisValiasFonte: "Herdado do bloco 2026 — art.º 72º/1 CIRS, taxa fixa inalterada.",
  },
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
    // CORRIGIDO na auditoria de 03/09/2026 (2ª ronda): os coeficientes
    // "geral" e "hotelaria" estavam trocados/errados. O texto do art.º 31º
    // (info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/
    // cirs_rep/Pages/irs31.aspx) mostra que:
    //  - 0,15 aplica-se a vendas de mercadorias/produtos E a restauração,
    //    bebidas e atividades hoteleiras/alojamento (não 0,35 como estava).
    //  - 0,75 aplica-se SÓ às atividades profissionais especificamente
    //    listadas no art.º 151º (a "tabela anexa" — médicos, advogados,
    //    engenheiros, etc.).
    //  - 0,35 é o coeficiente para as restantes prestações de serviços — a
    //    maioria dos recibos verdes de quem presta serviços fora da lista
    //    do art.º 151º — e é este o valor usado por omissão
    //    (prestacaoServicosGeral), não 0,75. Este era o erro de maior
    //    impacto desta ronda: estava a tributar como "profissão liberal
    //    listada" (75% do rendimento é matéria coletável) qualquer
    //    freelancer genérico, quando devia ser 35%.
    coeficientesSimplificadoB: {
      vendaMercadorias: 0.15,
      hoteleiraELocalAlojamento: 0.15,
      prestacaoServicosGeral: 0.35, // maioria dos recibos verdes "serviços" fora da lista do art.º 151º
      prestacaoServicosTabelaAnexa: 0.75, // só atividades da lista do art.º 151º CIRS
      outrosRendimentosCapitaisEPrediais: 0.95, // propriedade intelectual/industrial; mineração de criptoativos
      // Mínimo garantido: dedução mínima de 15% do rendimento bruto de
      // Categoria B mesmo com o coeficiente aplicado, se superior.
      minimoGarantidoPercentagem: 0.15,
      confirmado: true,
      fonte:
        "art.º 31º CIRS, n.º 1 (redação em vigor desde 1/07/2025, DL 49/2025) — " +
        "info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs31.aspx, " +
        "confirmado por OCC (occ.pt/pt-pt/noticias/regime-simplificado-1). Corrigido na auditoria de 03/09/2026 " +
        "(2ª ronda): 'geral' 0,75→0,35 e 'hotelaria/alojamento' 0,35→0,15 (estavam trocados com a lista do art.º " +
        "151º). Ainda não modelados nesta versão: coeficiente 0,30 (subsídios não destinados à exploração), 0,10 " +
        "(subsídios à exploração e outros rendimentos B não especificados), 0,50 (alojamento local em zona de " +
        "contenção) e 1,00 (transparência fiscal / participação qualificada na entidade pagadora) — casos menos " +
        "comuns, o utilizador nesses casos fica com um valor aproximado.",
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
      // CORRIGIDO na auditoria de 03/09/2026 (2ª ronda): os valores 800/700/600€
      // estavam ERRADOS — o limite legal é POR SUJEITO PASSIVO (não por
      // declaração). Confirmado por 3 fontes independentes e convergentes
      // (duas páginas do Portal das Finanças + folheto oficial da AT, ver
      // fonte): 400/350/300€ por titular de PPR, valores em vigor desde
      // 2005 (Lei 60-A/2005), nunca atualizados. A evidência da
      // Demonstração de Liquidação real usada nesta auditoria (610€
      // deduzidos, sem clamping) já é consistente com isto: é uma
      // declaração CONJUNTA (quociente 2,00), pelo que o teto do agregado é
      // a SOMA dos tetos de cada titular — até 800€ se ambos tiverem menos
      // de 35 anos, o que comporta os 610€ sem qualquer problema.
      // limitesPorTitular = valor por sujeito passivo; a app aplica ×2 em
      // regime conjunta (ver calcularDeducoesAColeta) — ainda simplificado
      // por não distinguir a idade de cada titular individualmente (falta
      // capturar data de nascimento do 2º sujeito passivo).
      ppr: {
        percentagem: 0.2,
        limiteAte35Anos: 400,
        limite35a50Anos: 350,
        limiteMais50Anos: 300,
        confirmado: true,
        fonte:
          "art.º 21º, n.º 2, do Estatuto dos Benefícios Fiscais (EBF) — NÃO é o art.º 78º CIRS como estava " +
          "referenciado antes. info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/bf_rep/" +
          "Pages/ebf-artigo-21-ordm-.aspx e folheto oficial da AT (IRS_deducoes_2025.pdf), confirmado também por " +
          "doutorfinancas.pt. Valores 400/350/300€ por sujeito passivo, desde a Lei n.º 60-A/2005 (nunca " +
          "atualizados). Corrige o valor anterior (800/700/600€), que tratava incorretamente o limite do agregado " +
          "como se fosse por sujeito passivo.",
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
      // Limite agregado às deduções à coleta (art.º 78º, n.º 7 e n.º 8
      // CIRS) — NOVO na auditoria de 03/09/2026 (2ª ronda), o gap de maior
      // prioridade identificado na 1ª ronda. Mecanismo (confiança ALTA,
      // texto do artigo lido diretamente em
      // info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/
      // cirs_rep/Pages/irs78.aspx): as deduções das alíneas c) a h), k) e
      // m) do n.º 1 do art.º 78º (saúde, educação, habitação, PPR,
      // despesas gerais e familiares, exigência de fatura, entre outras)
      // ficam sujeitas a um limite GLOBAL por agregado que varia com o
      // rendimento: sem limite até ao 1º escalão de IRS; entre 2.500€ (no
      // limite do 1º escalão) e 1.000€ (no limite do último escalão
      // finito), de forma decrescente; fixo em 1.000€ acima disso. Há
      // ainda uma majoração de 5% por dependente para agregados com 3 ou
      // mais dependentes (n.º 8). As alíneas a) e b) do n.º 1 — dedução
      // por dependentes/ascendentes e quotização sindical — ficam SEMPRE
      // de fora deste limite (já assim na app, que as trata em separado).
      // `confirmado: false` porque os valores exatos em euros (2.500€ /
      // 1.000€) e a lista completa e exata de alíneas abrangidas foram
      // extrapolados a partir da descrição do artigo e de fontes
      // secundárias convergentes, não confirmados letra-a-letra contra o
      // Diário da República — é uma aproximação deliberadamente melhor
      // que não ter limite nenhum (o estado anterior), não uma réplica
      // certificada linha a linha.
      limiteAgregado: {
        semLimiteAteEscalao1: true,
        minimo: 1000,
        maximo: 2500,
        majoracaoPorDependentePercentagem: 0.05,
        numDependentesParaMajoracao: 3,
        aplicavelA: ["saude", "educacao", "habitacao", "ppr", "despesasGerais", "exigenciaFatura"],
        confirmado: false,
        fonte:
          "art.º 78º, n.º 7 e n.º 8 CIRS (NÃO '78º-A' como referenciado antes noutros blocos — esse artigo não " +
          "existe autonomamente) — info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/" +
          "cirs_rep/Pages/irs78.aspx. Mecanismo (sem limite/2.500€→1.000€/1.000€ fixo, majoração 5% por " +
          "dependente com 3+, exclusão das alíneas a) e b)) confiança ALTA; valores exatos em euros e lista " +
          "exaustiva de alíneas abrangidas confiança MÉDIA — confirmar contra o Diário da República antes de " +
          "produção. Gap de maior prioridade identificado na auditoria de 03/09/2026 (1ª ronda), agora " +
          "implementado como aproximação em vez de ausente.",
      },
    },

    // Mínimo de existência (art.º 70º CIRS). CORRIGIDO na auditoria de
    // 03/09/2026 (2ª ronda): o valor de referência da lei NÃO é "14 ×
    // RMMG" — é o MAIOR entre 12.180€ (valor fixo) e 1,5×14×IAS. Para 2026
    // (IAS = 537,13€): 1,5×14×537,13 = 11.279,73€, que é INFERIOR a
    // 12.180€ — logo prevalece o valor fixo de 12.180€ (não 12.880€ como
    // estava, que vinha de "14×920€", uma fórmula que não corresponde ao
    // texto do artigo). O motor continua a aplicar uma APROXIMAÇÃO do
    // mecanismo oficial (ver aplicarMinimoExistencia em calculo-irs.js) —
    // a lei tem 3 patamares com multiplicadores 2,60× e 1,35× sobre o
    // excesso de rendimento, não implementados por falta de confirmação
    // exata dos limiares superiores; a app usa antes uma garantia simples
    // de rendimento líquido mínimo, que replica o EFEITO mas não o
    // cálculo linha a linha.
    minimoExistencia: {
      valorAnual: 12180,
      confirmado: false,
      fonte:
        "art.º 70º CIRS (texto do artigo: info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/" +
        "cirs_rep/ra/Pages/irs70ra_202512.aspx) — valor de referência = MAX(12.180€, 1,5×14×IAS). IAS 2026 = " +
        "537,13€ (jornaldenegocios.pt, citando publicação em Diário da República) → 1,5×14×537,13 = 11.279,73€ < " +
        "12.180€ → usa-se 12.180€. `confirmado: false` porque não foi possível ler o texto do DRE diretamente " +
        "para confirmar que 12.180€ já é o valor 2026 (a fórmula em si tem confiança alta).",
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
