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
const sum = (arr, fn) => arr.reduce((acc, x) => acc + (fn ? fn(x) : x), 0);

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
 * Categoria A: dedução legal fixa por sujeito passivo com rendimento A > 0.
 * Categoria B (regime simplificado): coeficiente por tipo de atividade,
 * com mínimo garantido de 15% do rendimento bruto se superior.
 */
function calcularDeducoesEspecificas({ rendimentoGlobal, numPessoasComCategoriaA, tabela, coeficienteB }) {
  const deducaoA = numPessoasComCategoriaA * tabela.deducaoEspecificaCategoriaA.valorFixo;

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
 * Individual/separada: 1,00 + 0,5 × dependentes (0,25 se guarda partilhada)
 * Conjunta: 2,00 + 0,5 × dependentes (0,25 se guarda partilhada)
 */
function calcularQuocienteFamiliar({ regime, dependentes, tabela }) {
  const base = regime === "conjunta" ? tabela.quociente.base.conjunta : tabela.quociente.base.individual;
  const somaDependentes = sum(dependentes, (d) =>
    d.guarda === "partilhada" ? tabela.quociente.porDependenteGuardaPartilhada : tabela.quociente.porDependente
  );
  return {
    linhaOficial: 5,
    referenciaLegal: "art.º 69º CIRS",
    base,
    dependentesConsiderados: dependentes.length,
    somaDependentes: round2(somaDependentes),
    total: round2(base + somaDependentes),
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
function calcularColetaTotal({ importanciaApurada, taxaSolidariedade, tributacoesAutonomas = 0 }) {
  const total = importanciaApurada.total + taxaSolidariedade.total + tributacoesAutonomas;
  return {
    linhaOficial: 7,
    referenciaLegal: "art.º 68º + 68º-A + 72º CIRS",
    tributacoesAutonomas: round2(tributacoesAutonomas),
    total: round2(Math.max(total, 0)),
  };
}

/**
 * 8. Deduções à Coleta
 * Aplica os limites do art.º 78º por categoria, respeitando tetos.
 */
function calcularDeducoesAColeta({ deducoesColeta, dependentes, tabela, regime }) {
  const limites = tabela.limitesDeducoes;
  const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

  const saude = clamp((deducoesColeta.saude || 0) * limites.saude.percentagem, limites.saude.limite);
  const educacao = clamp((deducoesColeta.educacao || 0) * limites.educacao.percentagem, limites.educacao.limite);

  const ppr = clamp(
    (deducoesColeta.ppr || 0) * limites.ppr.percentagem,
    limites.ppr.limiteAte35Anos // simplificação v1: usar o teto mais alto; refinar por idade em v1.1
  );

  const habitacao = clamp(
    (deducoesColeta.habitacao || 0) * limites.encargosHabitacao.percentagem,
    limites.encargosHabitacao.limite
  );

  const exigenciaFatura = clamp(deducoesColeta.exigenciaFatura || 0, limites.exigenciaFatura.limite);

  const despesasGerais = clamp(
    (deducoesColeta.despesasGerais || 0) * limites.despesasGeraisFamiliares.percentagem,
    regime === "conjunta" ? limites.despesasGeraisFamiliares.limiteCasal : limites.despesasGeraisFamiliares.limiteSolteiro
  );

  const porDependentes = sum(dependentes, (d, i) =>
    i === 0 ? limites.dependentes.primeiro : limites.dependentes.segundoEseguintesAte3Anos
  );

  const duplaTributacao = round2(deducoesColeta.duplaTributacao || 0);

  const total = round2(
    saude + educacao + ppr + habitacao + exigenciaFatura + despesasGerais + porDependentes + duplaTributacao
  );

  return {
    linhaOficial: 8,
    referenciaLegal: "art.º 78º-A a 78º-E CIRS",
    saude,
    educacao,
    ppr,
    habitacao,
    exigenciaFatura,
    despesasGerais,
    porDependentes: round2(porDependentes),
    duplaTributacao,
    total,
  };
}

/**
 * 9. Coleta Líquida
 * Coleta Total − Deduções à Coleta − Benefício Municipal.
 */
function calcularColetaLiquida({ coletaTotal, deducoesAColeta, tabela, participacaoMunicipal = 0 }) {
  const beneficioMunicipal = round2(
    coletaTotal.total * Math.min(participacaoMunicipal, tabela.beneficioMunicipalMaximo)
  );
  const total = Math.max(coletaTotal.total - deducoesAColeta.total - beneficioMunicipal, 0);
  return {
    linhaOficial: 9,
    referenciaLegal: "art.º 78º CIRS + Lei das Finanças Locais",
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
 */
function calcularResultado({ coletaLiquida, retencoesAcumuladas }) {
  const diferenca = round2(coletaLiquida.total - retencoesAcumuladas.total);
  return {
    linhaOficial: 11,
    referenciaLegal: "Demonstração de Liquidação de IRS, AT",
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
 * @param {Object} input.deducoesColeta - { saude, educacao, ppr, habitacao, exigenciaFatura, despesasGerais, duplaTributacao }
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
    participacaoMunicipal = 0,
    percentagemMesesReais = 0,
    dataReferencia,
  } = input;

  const tabela = obterTabelaFiscal(anoFiscal, dataReferencia);

  const numPessoasComCategoriaA = rubricasPorPessoa.filter((rubricas) =>
    rubricas.some((r) => r.tipo === "abono" && r.categoria === "A")
  ).length;

  const rendimentoGlobal = calcularRendimentoGlobal(rubricasPorPessoa);
  const deducoesEspecificas = calcularDeducoesEspecificas({
    rendimentoGlobal,
    numPessoasComCategoriaA,
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
  const coletaTotal = calcularColetaTotal({ importanciaApurada, taxaSolidariedade, tributacoesAutonomas });
  const deducoesAColeta = calcularDeducoesAColeta({ deducoesColeta, dependentes, tabela, regime });
  const coletaLiquida = calcularColetaLiquida({ coletaTotal, deducoesAColeta, tabela, participacaoMunicipal });
  const retencoesAcumuladas = calcularRetencoesAcumuladas(rubricasPorPessoa);
  const resultado = calcularResultado({ coletaLiquida, retencoesAcumuladas });

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
