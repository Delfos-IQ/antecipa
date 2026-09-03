// engine/calculo-irs.js
// Motor de cálculo do IRS — replica linha a linha a estrutura da
// Demonstração de Liquidação de IRS da Autoridade Tributária.
//
// Este ficheiro é a peça "auditável" do Antecipa: cada função corresponde
// a um número da lista da secção 5 do prompt de build, e cada resultado
// devolve também `linhaOficial` (a referência à numeração da Demonstração)
// e `referenciaLegal` para que a UI (Ventana 14 → "Ver cálculo completo")
// possa mostrar a proveniência de cada valor.
//
// Regra de ouro: isto é um motor de REPLICAÇÃO EXATA, não de estimativa.
// Se o resultado não bater com uma Demonstração de Liquidação real, o
// erro está aqui — depurar linha a linha (ver secção 12 do prompt).

import { obterTabelaFiscal } from "../data/legislacao-2026.js";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
// NOTA (corrigido nesta sessão): a versão anterior não passava o índice a
// `fn`, pelo que qualquer chamador que distinguisse "1º" de "2º e
// seguintes" por posição (ex.: calcularDeducoesAColeta/porDependentes)
// ficava sempre a tratar todos os itens como "2º e seguintes" — bug
// silencioso, nunca dava erro, só um valor errado. `getModeloEntidade`/
// quociente não são afetados (não usam o índice).
const sum = (arr, fn) => arr.reduce((acc, x, i) => acc + (fn ? fn(x, i) : x), 0);

/**
 * 1. Rendimento Global
 * Soma de todos os rendimentos das categorias A, B, E/G das pessoas
 * incluídas nesta declaração.
 */
function calcularRendimentoGlobal(rubricasPorPessoa) {
  let categoriaA = 0;
  let categoriaB = 0;
  let categoriaEG = 0;

  for (const rubricas of rubricasPorPessoa) {
    for (const r of rubricas) {
      if (r.tipo !== "abono") continue; // só rendimentos, não descontos
      if (r.categoria === "A") categoriaA += r.valorComRedu ?? r.valorSemRedu ?? 0;
      else if (r.categoria === "B") categoriaB += r.valorComRedu ?? r.valorSemRedu ?? 0;
      else if (r.categoria === "E" || r.categoria === "G") categoriaEG += r.valorComRedu ?? r.valorSemRedu ?? 0;
    }
  }

  return {
    linhaOficial: 1,
    referenciaLegal: "art.º 1º e 22º CIRS",
    categoriaA: round2(categoriaA),
    categoriaB: round2(categoriaB),
    categoriaEG: round2(categoriaEG),
    total: round2(categoriaA + categoriaB + categoriaEG),
  };
}

/**
 * 2. Deduções Específicas
 * Categoria A: dedução legal fixa por sujeito passivo com rendimento A > 0
 * (art.º 25º/1 CIRS). A quotização sindical (quota paga a sindicato) NÃO
 * substitui esse valor fixo — é uma dedução adicional, própria, igual ao
 * dobro (majoração de 100%) do valor efetivamente pago, com o limite de 1%
 * do rendimento bruto de Categoria A do próprio sujeito passivo (art.º 25º/4
 * CIRS). Ver tabela.majoracaoQuotizacaoSindical — confirmado via Jornal de
 * Negócios (majoração 50%→100%) e aspe.pt (exemplo: 100€ pagos → 200€
 * dedutíveis, limite 1% do rendimento de Categoria A).
 * Categoria B (regime simplificado): coeficiente por tipo de atividade,
 * com mínimo garantido de 15% do rendimento bruto se superior.
 */
function calcularDeducoesEspecificas({ rendimentoGlobal, rubricasPorPessoa, tabela, coeficienteB }) {
  let deducaoA = 0;
  const majoracao = tabela.majoracaoQuotizacaoSindical ?? { percentagem: 1, limitePercentagemRendimentoBruto: 0.01 };
  for (const rubricas of rubricasPorPessoa) {
    const rendimentoBrutoCategoriaAPessoa = rubricas
      .filter((r) => r.tipo === "abono" && r.categoria === "A")
      .reduce((s, r) => s + (r.valorComRedu ?? r.valorSemRedu ?? 0), 0);
    if (rendimentoBrutoCategoriaAPessoa <= 0) continue;

    const quotaSindicalPaga = rubricas
      .filter((r) => r.tipo === "desconto" && r.categoriaSindicato)
      .reduce((s, r) => s + (r.valorComRedu ?? 0), 0);

    const deducaoSindical = Math.min(
      quotaSindicalPaga * (1 + majoracao.percentagem),
      rendimentoBrutoCategoriaAPessoa * majoracao.limitePercentagemRendimentoBruto
    );

    deducaoA += tabela.deducaoEspecificaCategoriaA.valorFixo + Math.max(0, deducaoSindical);
  }

  const coefAplicavel = coeficienteB ?? tabela.coeficientesSimplificadoB.prestacaoServicosGeral;
  const deducaoBPorCoeficiente = rendimentoGlobal.categoriaB * (1 - coefAplicavel);
  const minimoGarantido = rendimentoGlobal.categoriaB * tabela.coeficientesSimplificadoB.minimoGarantidoPercentagem;
  const deducaoB = Math.max(deducaoBPorCoeficiente, 0);

  return {
    linhaOficial: 2,
    referenciaLegal: "art.º 25º CIRS (Cat. A) / art.º 31º CIRS (Cat. B, regime simplificado)",
    categoriaA: round2(deducaoA),
    categoriaB: round2(deducaoB),
    minimoGarantidoB: round2(minimoGarantido),
    coeficienteBAplicado: coefAplicavel,
    total: round2(deducaoA + deducaoB),
  };
}

/**
 * 3. Rendimento Coletável
 * Global − (Deduções Específicas + Perdas a recuperar + Abatimentos)
 */
function calcularRendimentoColetavel({ rendimentoGlobal, deducoesEspecificas, perdasARecuperar = 0, abatimentos = 0 }) {
  const coletavel = rendimentoGlobal.total - deducoesEspecificas.total - perdasARecuperar - abatimentos;
  return {
    linhaOficial: 3,
    referenciaLegal: "art.º 22º CIRS",
    perdasARecuperar: round2(perdasARecuperar),
    abatimentos: round2(abatimentos),
    total: round2(Math.max(coletavel, 0)),
  };
}

/**
 * 4. Ajuste por quociente de rendimentos de anos anteriores (raro no v1).
 */
function calcularAjusteRendimentosAnosAnteriores(valor = 0) {
  return { linhaOficial: 4, referenciaLegal: "art.º 74º CIRS", total: round2(valor) };
}

/**
 * 5. Quociente Familiar
 * CORRIGIDO (auditoria fiscal de 03/09/2026): o acréscimo de 0,5 (ou 0,25
 * em guarda partilhada) por dependente ao QUOCIENTE FAMILIAR foi revogado
 * pela Lei n.º 7-A/2016, de 30 de março (revogou os n.os 2, 4 e 5 do
 * art.º 69º CIRS). Desde então o quociente é SEMPRE 1,00 (sujeito passivo
 * único) ou 2,00 (tributação conjunta), independentemente do número de
 * dependentes — os dependentes só afetam o IRS através da dedução FIXA à
 * coleta (linha 8, art.º 78º-A: 600/726/900€, dividida a meio em guarda
 * partilhada — ver valorDeducaoPorDependente), nunca através do divisor
 * usado para calcular a taxa marginal.
 *
 * Este código chegou a implementar (e a app chegou a mostrar na UI) a
 * versão pré-2016 (quociente = base + 0,5×dependentes), o que inflacionava
 * artificialmente o divisor e subestimava o IRS de qualquer família com
 * dependentes. Confirmado por duas fontes independentes: (a) o texto
 * vigente do art.º 69º CIRS no Portal das Finanças e a CGD (Saldo
 * Positivo), que citam explicitamente a revogação de 2016; (b) uma
 * Demonstração de Liquidação de IRS REAL (sujeito passivo com dependentes,
 * dedução de dependentes de 1.800€ na linha 19 — ou seja, tem
 * dependentes), que mostra "Quociente familiar 2,00" na linha 10, sem
 * qualquer acréscimo — prova primária definitiva.
 */
function calcularQuocienteFamiliar({ regime, dependentes, tabela }) {
  const base = regime === "conjunta" ? tabela.quociente.base.conjunta : tabela.quociente.base.individual;
  return {
    linhaOficial: 5,
    referenciaLegal: "art.º 69º CIRS (na redação vigente desde a Lei n.º 7-A/2016 — dependentes já não alteram o quociente)",
    base,
    dependentesConsiderados: dependentes.length,
    somaDependentes: 0,
    total: round2(base),
  };
}

/**
 * 6. Importância Apurada
 * (Rendimento Coletável ÷ Quociente) × Taxa marginal − Parcela a Abater,
 * depois × Quociente.
 */
function calcularImportanciaApurada({ rendimentoColetavel, quociente, tabela }) {
  const rendimentoPorQuociente = quociente.total > 0 ? rendimentoColetavel.total / quociente.total : 0;

  const escalao =
    tabela.escaloes.find((e) => rendimentoPorQuociente <= e.limite) ?? tabela.escaloes[tabela.escaloes.length - 1];

  const coletaPorQuociente = Math.max(
    rendimentoPorQuociente * escalao.taxaMarginal - escalao.parcelaAbater,
    0
  );
  const importanciaApurada = coletaPorQuociente * quociente.total;

  return {
    linhaOficial: 6,
    referenciaLegal: "art.º 68º CIRS",
    rendimentoPorQuociente: round2(rendimentoPorQuociente),
    escalaoAplicado: {
      limite: escalao.limite,
      taxaMarginal: escalao.taxaMarginal,
      parcelaAbater: escalao.parcelaAbater,
    },
    coletaPorQuociente: round2(coletaPorQuociente),
    total: round2(importanciaApurada),
  };
}

/**
 * 6-bis. Taxa adicional de solidariedade (art.º 68º-A), sobre o rendimento
 * coletável total (sem divisão pelo quociente), na parte que exceda os
 * limiares. Soma-se à coleta, não é afetada pelo quociente.
 */
function calcularTaxaSolidariedade({ rendimentoColetavel, tabela }) {
  let valor = 0;
  const detalhe = [];
  for (const escalao of tabela.taxaSolidariedade) {
    const baseTributavel = Math.max(
      0,
      Math.min(rendimentoColetavel.total, escalao.ate) - escalao.desde
    );
    if (baseTributavel > 0) {
      const parcial = baseTributavel * escalao.taxa;
      valor += parcial;
      detalhe.push({ desde: escalao.desde, ate: escalao.ate, taxa: escalao.taxa, baseTributavel: round2(baseTributavel), valor: round2(parcial) });
    }
  }
  return { linhaOficial: "6-A", referenciaLegal: "art.º 68º-A CIRS", detalhe, total: round2(valor) };
}

/**
 * 7. Coleta Total
 * Importância apurada + taxa de solidariedade + tributações autónomas
 * (capitais não englobados a taxa fixa, se aplicável).
 */
function calcularColetaTotal({ importanciaApurada, taxaSolidariedade, tributacoesAutonomas = 0, tributacaoCapitalAutonoma = 0 }) {
  const total = importanciaApurada.total + taxaSolidariedade.total + tributacoesAutonomas + tributacaoCapitalAutonoma;
  return {
    linhaOficial: 7,
    referenciaLegal: "art.º 68º + 68º-A + 72º CIRS",
    tributacoesAutonomas: round2(tributacoesAutonomas),
    tributacaoCapitalAutonoma: round2(tributacaoCapitalAutonoma),
    total: round2(Math.max(total, 0)),
  };
}

/**
 * 8. Deduções à Coleta
 * Aplica os limites do art.º 78º por categoria, respeitando tetos.
 */
// Idade do dependente a 31 de dezembro do ano fiscal (data legalmente
// relevante para os escalões etários do art.º 78º-A CIRS). `dataNascimento`
// pode faltar (dependentes criados antes desta funcionalidade existir, ou
// sem data preenchida) — nesse caso assume-se idade "adulta" (sem
// majoração), a opção mais conservadora (não infla a dedução por engano).
function idadeDoDependenteNoAno(dependente, anoFiscal) {
  if (!dependente?.dataNascimento) return null;
  const nascimento = new Date(dependente.dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;
  const referencia = new Date(`${anoFiscal}-12-31`);
  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAnos =
    referencia.getMonth() < nascimento.getMonth() ||
    (referencia.getMonth() === nascimento.getMonth() && referencia.getDate() < nascimento.getDate());
  if (aindaNaoFezAnos) idade -= 1;
  return idade;
}

// Dedução por dependente (art.º 78º-A CIRS) — modelo real de 3 escalões,
// confirmado nesta sessão contra 3 fontes independentes (pwc.pt,
// doutorfinancas.pt, info.portaldasfinancas.gov.pt): 600€ base por
// dependente; 726€ para o 1º dependente com menos de 3 anos (majoração de
// 126€); 900€ para o 2º dependente em diante com até 6 anos. Se a guarda
// for partilhada, o valor de cada dependente é dividido a meio (cada
// sujeito passivo só pode deduzir metade) — mesmo critério já usado no
// quociente familiar (calcularQuocienteFamiliar).
export function valorDeducaoPorDependente(dependente, posicao, anoFiscal, limites) {
  const idade = idadeDoDependenteNoAno(dependente, anoFiscal);
  let valor;
  if (posicao === 0) {
    valor = idade !== null && idade < 3 ? limites.dependentes.primeiroComMajoracaoAte3Anos : limites.dependentes.primeiro;
  } else {
    valor = idade !== null && idade <= 6 ? limites.dependentes.segundoEmDianteAte6Anos : limites.dependentes.primeiro;
  }
  return dependente?.guarda === "partilhada" ? round2(valor / 2) : valor;
}

// Limite agregado às deduções à coleta (art.º 78º, n.º 7 e n.º 8 CIRS) —
// NOVO nesta auditoria (03/09/2026, 2ª ronda). Ver legislacao-2026.js,
// limitesDeducoes.limiteAgregado, para a fonte e o nível de confiança.
// Sem limite até ao 1º escalão de IRS; entre o 1º escalão e o último
// escalão finito, decresce linearmente de 2.500€ para 1.000€; fixo em
// 1.000€ acima disso. Majoração de 5% por dependente para agregados com 3+
// dependentes.
function calcularLimiteAgregadoDeducoes({ rendimentoPorQuociente, numDependentes, tabela }) {
  const config = tabela.limitesDeducoes?.limiteAgregado;
  if (!config) return Infinity;

  const escaloes = tabela.escaloes;
  const primeiroLimite = escaloes[0].limite;
  const ultimoFinito = escaloes[escaloes.length - 2].limite; // penúltimo, já que o último é Infinity

  let limite;
  if (rendimentoPorQuociente <= primeiroLimite) {
    limite = Infinity;
  } else if (rendimentoPorQuociente >= ultimoFinito) {
    limite = config.minimo;
  } else {
    const fracao = (ultimoFinito - rendimentoPorQuociente) / (ultimoFinito - primeiroLimite);
    limite = config.minimo + (config.maximo - config.minimo) * fracao;
  }

  if (limite !== Infinity && numDependentes >= config.numDependentesParaMajoracao) {
    limite = limite * (1 + config.majoracaoPorDependentePercentagem * numDependentes);
  }

  return limite === Infinity ? Infinity : round2(limite);
}

function calcularDeducoesAColeta({
  deducoesColeta,
  dependentes,
  tabela,
  regime,
  anoFiscal,
  escalaoAplicado,
  rendimentoPorQuociente,
  coletaTotal,
}) {
  const limites = tabela.limitesDeducoes;
  const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

  // Faturas emitidas com o NIF de um dependente também contam para saúde e
  // educação (art.º 78º-C/D CIRS — "despesas de qualquer membro do agregado
  // familiar"), mesmo padrão já usado acima para despesasGerais/exigência
  // de fatura: soma-se à MESMA base antes da percentagem e do teto, não é
  // um plafond à parte. Pedido real (03/09/2026): despesas dos filhos
  // (dentista, consultas, vacinas, comedor escolar) pedidas com o NIF deles
  // não apareciam em lado nenhum da simulação.
  const baseSaude = (deducoesColeta.saude || 0) + (deducoesColeta.saudeDependentes || 0);
  const saude = clamp(baseSaude * limites.saude.percentagem, limites.saude.limite);
  const baseEducacao = (deducoesColeta.educacao || 0) + (deducoesColeta.educacaoDependentes || 0);
  const educacao = clamp(baseEducacao * limites.educacao.percentagem, limites.educacao.limite);

  // PPR: o limite legal é POR SUJEITO PASSIVO (art.º 21º EBF — ver
  // legislacao-2026.js para o histórico do erro 800/700/600€ vs.
  // 400/350/300€). Em regime conjunta há dois titulares possíveis, por
  // isso o teto do agregado é ×2. Ainda simplificado: usa-se sempre o
  // teto mais alto (menor idade) por não termos a data de nascimento de
  // cada titular disponível neste ponto — refinar em v1.1.
  const pprTetoPorTitular = limites.ppr.limiteAte35Anos;
  const pprTeto = regime === "conjunta" ? round2(pprTetoPorTitular * 2) : pprTetoPorTitular;
  const ppr = clamp((deducoesColeta.ppr || 0) * limites.ppr.percentagem, pprTeto);

  // Limite de rendas de habitação: mais alto (limitePrimeiroEscalao) para
  // quem tem rendimento (por quociente) dentro do 1º escalão de IRS — o
  // mesmo escalão já calculado na Importância Apurada (linha 6), para
  // ficar consistente com o quociente familiar em vez de comparar o
  // rendimento coletável bruto. Ver nota em data/legislacao-2026.js sobre
  // a divergência de fontes no limite geral.
  const dentroDoPrimeiroEscalao = escalaoAplicado?.limite === tabela.escaloes?.[0]?.limite;
  const limiteHabitacao =
    dentroDoPrimeiroEscalao && limites.encargosHabitacao.limitePrimeiroEscalao
      ? limites.encargosHabitacao.limitePrimeiroEscalao
      : limites.encargosHabitacao.limite;
  const habitacao = clamp((deducoesColeta.habitacao || 0) * limites.encargosHabitacao.percentagem, limiteHabitacao);

  // Exigência de fatura (IVAucher, art.º 78º-F CIRS): 15% do IVA suportado
  // nas categorias "normais" (restauração, reparação automóvel, e outras —
  // cabeleireiros, veterinários, hotelaria, ginásios) + 100% nos transportes
  // públicos (passes mensais/bilhetes), todos a partilhar o MESMO teto de
  // 250€/agregado (ver nota em legislacao-2026.js). Mantém-se também o
  // campo legado `exigenciaFatura` (valor já pré-calculado, para quem
  // preferir inserir diretamente o total que o e-Fatura mostra) — soma-se
  // aos restantes antes do teto.
  const baseNormal =
    (deducoesColeta.exigenciaFaturaRestauracao || 0) +
    (deducoesColeta.exigenciaFaturaReparacaoAutomovel || 0) +
    (deducoesColeta.exigenciaFaturaOutras || 0);
  const baseTransportes = deducoesColeta.exigenciaFaturaPassesMensais || 0;
  const exigenciaFaturaCalculada =
    baseNormal * (limites.exigenciaFatura.percentagem ?? 0.15) +
    baseTransportes * (limites.exigenciaFatura.percentagemTransportesPublicos ?? 1);
  const exigenciaFatura = clamp(
    exigenciaFaturaCalculada + (deducoesColeta.exigenciaFatura || 0),
    limites.exigenciaFatura.limite
  );

  // Faturas emitidas com o NIF de um dependente também contam para esta
  // dedução (art.º 78º-B CIRS não distingue o NIF de quem paga, só que a
  // despesa seja de "qualquer membro do agregado familiar") — pedido de
  // uma validadora real (03/09/2026): em guarda partilhada, cada
  // progenitor só reclama a sua parte (normalmente 50%) das faturas do
  // dependente, campo próprio para não obrigar a somar isso à mão dentro
  // do campo "despesasGerais". Soma-se à MESMA base antes da percentagem
  // e do teto — não é um plafond adicional, é só mais base de cálculo
  // para o mesmo limite de 250€/500€ por sujeito passivo (confirmado via
  // Portal das Finanças: o limite é "por sujeito passivo", não por membro
  // do agregado).
  const baseDespesasGerais = (deducoesColeta.despesasGerais || 0) + (deducoesColeta.despesasGeraisDependentes || 0);
  const despesasGerais = clamp(
    baseDespesasGerais * limites.despesasGeraisFamiliares.percentagem,
    regime === "conjunta" ? limites.despesasGeraisFamiliares.limiteCasal : limites.despesasGeraisFamiliares.limiteSolteiro
  );

  const porDependentes = sum(dependentes, (d, i) => valorDeducaoPorDependente(d, i, anoFiscal, limites));

  const duplaTributacao = round2(deducoesColeta.duplaTributacao || 0);

  // Donativos (mecenato, art.º 63º EBF) — 25% do valor doado, até 15% da
  // coleta total (linha 7, ANTES desta própria dedução — é essa a base
  // legal do teto, não a coleta já líquida). Ver nota em
  // data/legislacao-2026.js sobre os casos especiais não modelados.
  const limiteDonativos = limites.donativos ? round2((coletaTotal || 0) * limites.donativos.limitePercentagemColeta) : 0;
  const donativos = limites.donativos
    ? clamp((deducoesColeta.donativos || 0) * limites.donativos.percentagem, limiteDonativos)
    : 0;

  // Limite agregado (art.º 78º, n.º 7/8 CIRS): aplica-se só à soma das
  // deduções "gerais" do art.º 78º — saúde, educação, habitação, PPR,
  // despesas gerais e familiares e exigência de fatura. Fica DE FORA:
  // dependentes (alínea a) do n.º 1, expressamente excluída), dupla
  // tributação internacional (regida por tratado, fora do art.º 78º) e
  // donativos (regime próprio do art.º 63º EBF, já com o seu teto de 15%
  // da coleta aplicado acima).
  const subtotalSujeitoALimite = round2(saude + educacao + habitacao + ppr + despesasGerais + exigenciaFatura);
  const limiteAgregado = calcularLimiteAgregadoDeducoes({
    rendimentoPorQuociente: rendimentoPorQuociente ?? 0,
    numDependentes: dependentes.length,
    tabela,
  });
  const limiteAgregadoAplicado = limiteAgregado !== Infinity && subtotalSujeitoALimite > limiteAgregado;
  const subtotalAposLimite = limiteAgregadoAplicado ? limiteAgregado : subtotalSujeitoALimite;

  const total = round2(subtotalAposLimite + porDependentes + duplaTributacao + donativos);

  return {
    linhaOficial: 8,
    referenciaLegal: "art.º 78º (n.º 1 a n.º 8) CIRS + art.º 63º EBF (donativos)",
    saude,
    educacao,
    ppr,
    habitacao,
    exigenciaFatura,
    despesasGerais,
    porDependentes: round2(porDependentes),
    duplaTributacao,
    donativos,
    limiteAgregado: limiteAgregado === Infinity ? null : limiteAgregado,
    limiteAgregadoAplicado,
    total,
  };
}

/**
 * 9. Coleta Líquida
 * Coleta Total − Deduções à Coleta − Benefício Municipal.
 */
// Mínimo de existência (art.º 70º CIRS) — SIMPLIFICAÇÃO, não a fórmula
// oficial exata. A regra real deduz um valor variável ao rendimento
// coletável ANTES do cálculo do imposto, através de uma fórmula com vários
// ramos (por escalão de rendimento, com multiplicadores 2,3× e 1,4× sobre
// o excesso acima de um limiar L calculado a partir dos limites de
// despesas gerais e do 1º escalão) — não conseguimos confirmar essa
// fórmula com precisão suficiente nesta sessão para a implementar sem
// risco de dar um valor errado. Em vez disso, aplicamos aqui uma
// aproximação conservadora e claramente documentada: garantir que o
// rendimento líquido de IRS (rendimento global − coleta) nunca fica
// abaixo do `minimoExistencia.valorAnual`, reduzindo a coleta até esse
// ponto (nunca abaixo de 0) quando isso se aplicar — só para sujeitos
// passivos cujo rendimento seja predominantemente de Categoria A ou B,
// como exige o art.º 70º. Isto replica o EFEITO final da lei (ninguém com
// rendimentos baixos de trabalho fica com menos que o mínimo de
// existência líquido), mas não é o cálculo linha a linha oficial — não
// usar este valor para preencher uma declaração real sem confirmar contra
// a fórmula exata do Portal das Finanças.
function aplicarMinimoExistencia({ coletaAntes, rendimentoGlobal, tabela }) {
  const minimo = tabela.minimoExistencia;
  if (!minimo?.valorAnual) return coletaAntes;
  const total = rendimentoGlobal.total || 0;
  if (total <= 0) return coletaAntes;
  const predominanteAouB = (rendimentoGlobal.categoriaA + rendimentoGlobal.categoriaB) / total >= 0.5;
  if (!predominanteAouB) return coletaAntes;
  const rendimentoLiquidoAposImposto = total - coletaAntes;
  if (rendimentoLiquidoAposImposto >= minimo.valorAnual) return coletaAntes;
  return Math.max(0, round2(total - minimo.valorAnual));
}

function calcularColetaLiquida({ coletaTotal, deducoesAColeta, tabela, participacaoMunicipal = 0, rendimentoGlobal }) {
  const beneficioMunicipal = round2(
    coletaTotal.total * Math.min(participacaoMunicipal, tabela.beneficioMunicipalMaximo)
  );
  const antesDoMinimo = Math.max(coletaTotal.total - deducoesAColeta.total - beneficioMunicipal, 0);
  const total = aplicarMinimoExistencia({ coletaAntes: antesDoMinimo, rendimentoGlobal, tabela });
  return {
    linhaOficial: 9,
    referenciaLegal: "art.º 78º CIRS + Lei das Finanças Locais + art.º 70º CIRS (mínimo de existência, aproximado)",
    beneficioMunicipal,
    total: round2(total),
  };
}

/**
 * 10. Retenções na Fonte acumuladas
 * Soma das rubricas de desconto com incidência de IRS de todos os
 * documentos carregados (Real) + a projeção dos meses em falta.
 */
function calcularRetencoesAcumuladas(rubricasPorPessoa) {
  let total = 0;
  for (const rubricas of rubricasPorPessoa) {
    for (const r of rubricas) {
      if (r.tipo === "desconto" && (r.categoriaIRS || r.codigoTipo === "irs")) {
        total += r.valorComRedu ?? r.valorSemRedu ?? 0;
      }
    }
  }
  return {
    linhaOficial: 10,
    referenciaLegal: "art.º 98º a 101º CIRS (retenção na fonte)",
    total: round2(total),
  };
}

/**
 * 11. Resultado final.
 * IMPOSTOS APURADOS = Coleta Líquida − (Pagamentos por Conta + Retenções
 * na Fonte) — fórmula confirmada linha a linha contra uma Demonstração de
 * Liquidação real (linha 25: "22 - (23 + 24)"). `pagamentosPorConta`
 * (linha 23) é um campo que faltava por completo até esta auditoria
 * (03/09/2026) — relevante sobretudo para quem tem rendimentos de
 * Categoria B (recibos verdes) e faz adiantamentos trimestrais de IRS ao
 * longo do ano; até aqui só as retenções na fonte (linha 24, tipicamente
 * Categoria A) eram subtraídas.
 */
function calcularResultado({ coletaLiquida, retencoesAcumuladas, pagamentosPorConta = 0 }) {
  const diferenca = round2(coletaLiquida.total - pagamentosPorConta - retencoesAcumuladas.total);
  return {
    linhaOficial: 11,
    referenciaLegal: "Demonstração de Liquidação de IRS, AT (linha 25: 22 - (23 + 24))",
    pagamentosPorConta: round2(pagamentosPorConta),
    tipo: diferenca <= 0 ? "a_devolver" : "a_pagar",
    valor: Math.abs(diferenca),
  };
}

/**
 * Corre a cadeia completa 1→11 para UMA declaração (individual, conjunta,
 * ou separada de uma das pessoas).
 *
 * @param {Object} input
 * @param {number} input.anoFiscal
 * @param {string} input.regime - "individual" | "conjunta" | "separada"
 * @param {Array<Array<Object>>} input.rubricasPorPessoa - rubricas de cada pessoa incluída
 * @param {Array<Object>} input.dependentes - dependentes atribuídos a esta declaração
 * @param {Object} input.deducoesColeta - { saude, educacao, ppr, habitacao, exigenciaFaturaRestauracao,
 *   exigenciaFaturaReparacaoAutomovel, exigenciaFaturaPassesMensais, exigenciaFaturaOutras, despesasGerais,
 *   duplaTributacao, maisValias }
 * @param {number} [input.coeficienteB] - override do coeficiente simplificado B
 * @param {number} [input.percentagemMesesReais] - 0..1, fiabilidade da projeção
 * @param {string} [input.dataReferencia]
 */
export function calcularDeclaracao(input) {
  const {
    anoFiscal,
    regime,
    rubricasPorPessoa,
    dependentes = [],
    deducoesColeta = {},
    coeficienteB,
    perdasARecuperar = 0,
    abatimentos = 0,
    ajusteRendimentosAnosAnteriores = 0,
    tributacoesAutonomas = 0,
    pagamentosPorConta = 0,
    participacaoMunicipal = 0,
    percentagemMesesReais = 0,
    dataReferencia,
  } = input;

  const tabela = obterTabelaFiscal(anoFiscal, dataReferencia);

  const rendimentoGlobal = calcularRendimentoGlobal(rubricasPorPessoa);
  const deducoesEspecificas = calcularDeducoesEspecificas({
    rendimentoGlobal,
    rubricasPorPessoa,
    tabela,
    coeficienteB,
  });
  const rendimentoColetavelResult = calcularRendimentoColetavel({
    rendimentoGlobal,
    deducoesEspecificas,
    perdasARecuperar,
    abatimentos,
  });
  const ajusteAnosAnteriores = calcularAjusteRendimentosAnosAnteriores(ajusteRendimentosAnosAnteriores);
  const quociente = calcularQuocienteFamiliar({
    regime: regime === "conjunta" ? "conjunta" : "individual",
    dependentes,
    tabela,
  });
  const importanciaApurada = calcularImportanciaApurada({
    rendimentoColetavel: rendimentoColetavelResult,
    quociente,
    tabela,
  });
  const taxaSolidariedade = calcularTaxaSolidariedade({ rendimentoColetavel: rendimentoColetavelResult, tabela });
  // Mais-valias e rendimentos de capitais não englobados (art.º 72º/1
  // CIRS) — tributados autonomamente à taxa fixa da tabela (28% em 2026,
  // confirmado por fonte primária, ver legislacao-2026.js), fora do
  // englobamento progressivo. Introduzido como campo próprio e desacoplado
  // do fluxo de rubricas de categoria E/G (que continua a englobar-se
  // normalmente via rendimentoGlobal.categoriaEG, para quem optar por essa
  // via manual no ecrã de confirmação).
  const tributacaoCapitalAutonoma = round2((deducoesColeta.maisValias || 0) * (tabela.taxaAutonomaMaisValias ?? 0.28));
  const coletaTotal = calcularColetaTotal({
    importanciaApurada,
    taxaSolidariedade,
    tributacoesAutonomas,
    tributacaoCapitalAutonoma,
  });
  const deducoesAColeta = calcularDeducoesAColeta({
    deducoesColeta,
    dependentes,
    tabela,
    regime,
    anoFiscal,
    escalaoAplicado: importanciaApurada.escalaoAplicado,
    rendimentoPorQuociente: importanciaApurada.rendimentoPorQuociente,
    coletaTotal: coletaTotal.total,
  });
  const coletaLiquida = calcularColetaLiquida({
    coletaTotal,
    deducoesAColeta,
    tabela,
    participacaoMunicipal,
    rendimentoGlobal,
  });
  const retencoesAcumuladas = calcularRetencoesAcumuladas(rubricasPorPessoa);
  const resultado = calcularResultado({ coletaLiquida, retencoesAcumuladas, pagamentosPorConta });

  return {
    anoFiscal,
    regime,
    tabelaUsada: { anoFiscal: tabela.anoFiscal, vigenciaDesde: tabela.vigenciaDesde, confirmado: tabela.confirmado },
    percentagemMesesReais,
    linhas: {
      1: rendimentoGlobal,
      2: deducoesEspecificas,
      3: rendimentoColetavelResult,
      4: ajusteAnosAnteriores,
      5: quociente,
      6: importanciaApurada,
      "6A": taxaSolidariedade,
      7: coletaTotal,
      8: deducoesAColeta,
      9: coletaLiquida,
      10: retencoesAcumuladas,
      11: resultado,
    },
    resultado,
  };
}

/**
 * Modo comparação automática: corre a cadeia duas vezes com os mesmos
 * dados de base — conjunta vs. separada A + separada B — e devolve os
 * dois resultados lado a lado, com o mais vantajoso assinalado.
 *
 * @param {Object} inputBase - tudo o que calcularDeclaracao precisa, EXCETO regime/rubricasPorPessoa/dependentes
 * @param {Object} pessoaA - { rubricas, dependentesAtribuidos }
 * @param {Object} pessoaB - { rubricas, dependentesAtribuidos }
 * @param {Array<Object>} todosDependentes - lista completa para o cenário conjunto
 */
export function compararRegimes(inputBase, pessoaA, pessoaB, todosDependentes) {
  const conjunta = calcularDeclaracao({
    ...inputBase,
    regime: "conjunta",
    rubricasPorPessoa: [pessoaA.rubricas, pessoaB.rubricas],
    dependentes: todosDependentes,
  });

  const separadaA = calcularDeclaracao({
    ...inputBase,
    regime: "separada",
    rubricasPorPessoa: [pessoaA.rubricas],
    dependentes: pessoaA.dependentesAtribuidos ?? [],
  });

  const separadaB = calcularDeclaracao({
    ...inputBase,
    regime: "separada",
    rubricasPorPessoa: [pessoaB.rubricas],
    dependentes: pessoaB.dependentesAtribuidos ?? [],
  });

  const sinal = (r) => (r.tipo === "a_devolver" ? r.valor : -r.valor);
  const totalSeparado = sinal(separadaA.resultado) + sinal(separadaB.resultado);
  const totalConjunto = sinal(conjunta.resultado);

  const maisVantajoso = totalConjunto >= totalSeparado ? "conjunta" : "separada";
  const diferenca = Math.abs(round2(totalConjunto - totalSeparado));

  return {
    conjunta,
    separada: { A: separadaA, B: separadaB, total: round2(totalSeparado) },
    maisVantajoso,
    diferenca,
  };
}

/**
 * Oportunidades de poupança fiscal — v1: só PPR (Plano Poupança-Reforma,
 * art.º 78º CIRS). Pedido do utilizador (02/09/2026): detetar quando um
 * sujeito passivo ainda não esgotou um benefício fiscal disponível e
 * mostrar quanto poderia poupar.
 *
 * Em vez de duplicar as regras de dedução/mínimo de existência/teto de
 * coleta aqui, reutiliza-se o próprio motor: corre-se `calcularDeclaracao`
 * outra vez com o mesmo input, só trocando `deducoesColeta.ppr` pelo valor
 * que atinge o teto legal, e compara-se a linha 11 (Resultado) das duas
 * simulações. Isto garante que a poupança estimada respeita tudo o que já
 * está implementado (mínimo de existência, teto de coleta líquida a 0,
 * etc.) sem risco de o número mostrado aqui divergir do motor real.
 *
 * NÃO é aconselhamento financeiro — é uma simulação "e se" com os mesmos
 * dados já introduzidos pelo utilizador, para que ele decida por si.
 *
 * @param {Object} input - o mesmo objeto passado a calcularDeclaracao.
 * @param {Object} [resultadoAtual] - se já tiver sido calculado, evita
 *   recalcular a declaração atual (poupa 1 das 2 chamadas ao motor).
 * @returns {null|{tipo:"ppr", entregaNecessaria:number, poupancaEstimada:number, tetoAnual:number}}
 */
export function detectarOportunidadePPR(input, resultadoAtual) {
  const { anoFiscal, regime, deducoesColeta = {}, dataReferencia } = input;
  const tabela = obterTabelaFiscal(anoFiscal, dataReferencia);
  const limitesPpr = tabela.limitesDeducoes.ppr;
  if (!limitesPpr) return null;

  const pprAtual = deducoesColeta.ppr || 0;
  // Mesma simplificação v1 já usada em calcularDeducoesAColeta: usa-se o
  // teto mais alto (menor idade) por não termos ainda a data de nascimento
  // do(s) sujeito(s) passivo(s) disponível neste ponto. O limite é por
  // titular (art.º 21º EBF) — em regime conjunta há dois titulares
  // possíveis, por isso ×2. Ver nota em calcularDeducoesAColeta.
  const tetoPorTitular = limitesPpr.limiteAte35Anos;
  const teto = regime === "conjunta" ? round2(tetoPorTitular * 2) : tetoPorTitular;
  const deducaoAtual = Math.min(pprAtual * limitesPpr.percentagem, teto);
  if (deducaoAtual >= teto) return null; // já no limite — nada a sugerir

  const entregaNecessaria = round2(teto / limitesPpr.percentagem - pprAtual);

  const declaracaoAtual = resultadoAtual ?? calcularDeclaracao(input);
  const declaracaoComPPR = calcularDeclaracao({
    ...input,
    deducoesColeta: { ...deducoesColeta, ppr: pprAtual + entregaNecessaria },
  });

  const sinal = (r) => (r.tipo === "a_devolver" ? r.valor : -r.valor);
  const poupancaEstimada = round2(sinal(declaracaoComPPR.resultado) - sinal(declaracaoAtual.resultado));
  if (poupancaEstimada <= 0) return null; // sem coleta suficiente para beneficiar

  return { tipo: "ppr", entregaNecessaria, poupancaEstimada, tetoAnual: teto, pprAtual };
}

/**
 * Oportunidades de poupança fiscal — fase 2: mais-valias/rendimentos de
 * capitais (art.º 72º CIRS). Quem tem `deducoesColeta.maisValias` > 0 está
 * a ser tributado à taxa autónoma fixa (28%). A lei permite, em alternativa,
 * OPTAR pelo englobamento — somar esse valor ao rendimento global e ser
 * tributado à taxa progressiva normal (com o benefício do quociente
 * familiar). Para quem tem rendimento baixo/médio, isso pode sair mais
 * barato do que os 28% fixos.
 *
 * Tal como o PPR, reutiliza-se o motor em vez de duplicar regras: simula-se
 * o englobamento através do MESMO mecanismo que a Ventana Deduções já
 * expõe para quem quiser fazer isto manualmente (uma rubrica sintética de
 * Categoria G somada a rubricasPorPessoa, com `deducoesColeta.maisValias`
 * a zero para não haver dupla tributação) e compara-se o resultado final.
 *
 * SIMPLIFICAÇÃO v1, documentada: não modela o englobamento OBRIGATÓRIO
 * (que a lei impõe acima de certos limiares de rendimento, nem a exclusão
 * parcial de 50% para mais-valias imobiliárias de habitação própria e
 * permanente reinvestida) — compara só as duas hipóteses simples
 * (tudo autónomo vs. tudo englobado) para o valor introduzido pelo
 * utilizador. Isto é suficiente para dar uma direção (vale a pena
 * perguntar ao contabilista?), não para preencher a declaração sem
 * verificar o enquadramento exato do caso.
 *
 * @param {Object} input - o mesmo objeto passado a calcularDeclaracao.
 * @param {Object} [resultadoAtual] - se já tiver sido calculado, evita
 *   recalcular a declaração atual.
 * @returns {null|{tipo:"maisValias", valorMaisValias:number, poupancaEstimada:number}}
 */
export function detectarOportunidadeMaisValias(input, resultadoAtual) {
  const { deducoesColeta = {}, rubricasPorPessoa } = input;
  const valorMaisValias = deducoesColeta.maisValias || 0;
  if (valorMaisValias <= 0) return null;

  const declaracaoAtual = resultadoAtual ?? calcularDeclaracao(input);

  const rubricasEnglobadas = rubricasPorPessoa.map((rubricas) => [...rubricas]);
  if (rubricasEnglobadas.length === 0) rubricasEnglobadas.push([]);
  rubricasEnglobadas[0] = [
    ...rubricasEnglobadas[0],
    { categoria: "G", tipo: "abono", descricao: "Mais-valias (englobadas — simulação)", valorComRedu: valorMaisValias },
  ];
  const declaracaoEnglobada = calcularDeclaracao({
    ...input,
    rubricasPorPessoa: rubricasEnglobadas,
    deducoesColeta: { ...deducoesColeta, maisValias: 0 },
  });

  const sinal = (r) => (r.tipo === "a_devolver" ? r.valor : -r.valor);
  const poupancaEstimada = round2(sinal(declaracaoEnglobada.resultado) - sinal(declaracaoAtual.resultado));
  if (poupancaEstimada <= 0) return null; // taxa autónoma já é a melhor opção

  return { tipo: "maisValias", valorMaisValias, poupancaEstimada };
}
