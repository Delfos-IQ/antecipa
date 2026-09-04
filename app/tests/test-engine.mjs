// Teste sintético rápido do motor de cálculo — NÃO faz parte do app,
// serve apenas para verificar nesta sessão que engine/calculo-irs.js
// corre sem erros e produz números plausíveis. Critério de aceitação
// real (secção 12) exige testar contra uma Demonstração de Liquidação
// verdadeira, o que só o utilizador pode fornecer.

import {
  calcularDeclaracao,
  compararRegimes,
  detectarOportunidadePPR,
  detectarOportunidadeMaisValias,
  detectarSugestoesPagamento,
} from "../engine/calculo-irs.js";
import { obterTabelaFiscal } from "../data/legislacao-2026.js";

function assertIgual(valor, esperado, mensagem) {
  if (Math.abs(valor - esperado) > 0.005) {
    console.error(`FALHOU: ${mensagem} — esperado ${esperado}, obtido ${valor}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${mensagem} (${valor})`);
  }
}

const rubricasA = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 1800 * 14 },
  { categoria: "A", tipo: "desconto", descricao: "Retenção IRS", categoriaIRS: true, valorComRedu: 1800 * 0.15 * 12 },
  { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: 1800 * 0.11 * 14 },
];

console.log("--- Caso individual, sem dependentes ---");
const r1 = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { saude: 1200, educacao: 500 },
});
console.log(JSON.stringify(r1.resultado, null, 2));
console.log("Rendimento global:", r1.linhas[1].total, "| Coletável:", r1.linhas[3].total, "| Coleta líquida:", r1.linhas[9].total);

console.log("\n--- Comparação conjunta vs separada, casal com 1 dependente ---");
const rubricasB = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 1200 * 14 },
  { categoria: "A", tipo: "desconto", descricao: "Retenção IRS", categoriaIRS: true, valorComRedu: 1200 * 0.08 * 12 },
  { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: 1200 * 0.11 * 14 },
];
const dependente = { id: 1, nome: "Filho", guarda: "exclusiva" };

const comp = compararRegimes(
  { anoFiscal: 2026, deducoesColeta: { saude: 800 } },
  { rubricas: rubricasA, dependentesAtribuidos: [dependente] },
  { rubricas: rubricasB, dependentesAtribuidos: [] },
  [dependente]
);
console.log("Conjunta:", comp.conjunta.resultado);
console.log("Separada A:", comp.separada.A.resultado, "| Separada B:", comp.separada.B.resultado, "| total:", comp.separada.total);
console.log("Mais vantajoso:", comp.maisVantajoso, "| diferença:", comp.diferenca);

console.log("\n--- Guarda partilhada: dedução dividida a meio; quociente NUNCA muda com dependentes ---");
// Pedido real de um validador ("Faltam os dependentes em guarda
// partilhada Dani") — a lógica já existia no motor (calcularQuocienteFamiliar
// e valorDeducaoPorDependente, ambas em engine/calculo-irs.js) mas nunca
// tinha sido verificada por nenhum teste. Compara o mesmo cenário
// (sujeito passivo individual, 1 dependente adulto sem data de nascimento,
// para não entrar nas majorações por idade) só variando guarda exclusiva
// vs. partilhada.
//
// ATUALIZADO na auditoria fiscal de 03/09/2026: o quociente familiar
// deixou de ganhar +0,5/+0,25 por dependente — esse acréscimo foi
// revogado pela Lei n.º 7-A/2016 (confirmado por fonte primária, uma
// Demonstração de Liquidação real que mostra quociente 2,00 para um
// casal COM dependentes). Só a dedução fixa à coleta (linha 8) continua a
// ser dividida a meio em guarda partilhada.
const baseIndividual = {
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  deducoesColeta: {},
};

const rSemDependentes = calcularDeclaracao({ ...baseIndividual, dependentes: [] });
const rExclusiva = calcularDeclaracao({ ...baseIndividual, dependentes: [{ id: 1, nome: "Filho", guarda: "exclusiva" }] });
const rPartilhada = calcularDeclaracao({ ...baseIndividual, dependentes: [{ id: 1, nome: "Filho", guarda: "partilhada" }] });

// Quociente (linha 5): SEMPRE 1,00 (individual), com ou sem dependentes —
// proteção direta contra reintroduzir por engano a regra pré-2016.
assertIgual(rSemDependentes.linhas[5].total, 1.0, "quociente familiar individual sem dependentes = 1,00");
assertIgual(rExclusiva.linhas[5].total, 1.0, "quociente familiar individual com 1 dependente em guarda exclusiva continua = 1,00 (sem acréscimo)");
assertIgual(rPartilhada.linhas[5].total, 1.0, "quociente familiar individual com 1 dependente em guarda partilhada continua = 1,00 (sem acréscimo)");

// Dedução por dependente (linha 8, art.º 78º-A): 600€ base, metade (300€) se partilhada.
assertIgual(rExclusiva.linhas[8].porDependentes, 600, "dedução por dependente em guarda exclusiva = 600€ (valor base)");
assertIgual(rPartilhada.linhas[8].porDependentes, 300, "dedução por dependente em guarda partilhada = 300€ (metade do valor base)");

// A guarda partilhada nunca deve resultar numa dedução MAIOR do que a
// exclusiva — proteção contra uma futura regressão que inverta a condição
// por engano.
if (rPartilhada.linhas[8].porDependentes >= rExclusiva.linhas[8].porDependentes) {
  console.error("FALHOU: guarda partilhada devia dar uma dedução por dependente menor do que guarda exclusiva");
  process.exitCode = 1;
}

console.log("\n--- Oportunidade PPR: deteção e cálculo da poupança ---");
// Pedido do utilizador (02/09/2026): "para alguém que não tenha PPR, a app
// pode informar que pouparia". Usa-se o mesmo rendimento de rExclusiva
// acima (sem PPR registado) para confirmar que a oportunidade aparece, com
// a poupança estimada a bater certo com a diferença real de correr o
// motor com/sem o PPR sugerido.
const oportunidadeSemPpr = detectarOportunidadePPR(
  { ...baseIndividual, dependentes: [] },
  calcularDeclaracao({ ...baseIndividual, dependentes: [] })
);
if (!oportunidadeSemPpr) {
  console.error("FALHOU: devia detetar oportunidade de PPR quando não há PPR registado e há coleta suficiente");
  process.exitCode = 1;
} else {
  console.log(`OK: oportunidade PPR detetada — entrega sugerida ${oportunidadeSemPpr.entregaNecessaria}€, poupança estimada ${oportunidadeSemPpr.poupancaEstimada}€`);
  // CORRIGIDO na auditoria de 03/09/2026 (2ª ronda): o teto é por sujeito
  // passivo (art.º 21º EBF) = 400€ em regime individual, não 800€ (esse
  // valor era o erro antigo, que já incluía indevidamente o ×2 do
  // agregado mesmo para quem declara sozinho).
  assertIgual(oportunidadeSemPpr.tetoAnual, 400, "teto anual de dedução do PPR em regime individual (simplificação v1, sem idade) = 400€");
  // A entrega sugerida, aplicada ao mesmo motor, tem de produzir exatamente
  // a poupança indicada (senão o número mostrado na UI estaria a mentir).
  const semPpr = calcularDeclaracao({ ...baseIndividual, dependentes: [] });
  const comPprSugerido = calcularDeclaracao({
    ...baseIndividual,
    dependentes: [],
    deducoesColeta: { ppr: oportunidadeSemPpr.entregaNecessaria },
  });
  const sinal = (r) => (r.tipo === "a_devolver" ? r.valor : -r.valor);
  assertIgual(
    sinal(comPprSugerido.resultado) - sinal(semPpr.resultado),
    oportunidadeSemPpr.poupancaEstimada,
    "poupança estimada do PPR bate certo com a diferença real do motor"
  );
}

// Quem já está no teto do PPR não deve receber a sugestão outra vez.
const oportunidadeNoTeto = detectarOportunidadePPR({
  ...baseIndividual,
  dependentes: [],
  deducoesColeta: { ppr: 2000 }, // 2000 * 20% = 400€ = teto individual
});
if (oportunidadeNoTeto) {
  console.error("FALHOU: não devia sugerir PPR a quem já está no teto de dedução");
  process.exitCode = 1;
} else {
  console.log("OK: sem sugestão de PPR para quem já está no teto");
}

console.log("\n--- Fase 2: donativos (dedução) e mais-valias (englobamento vs. taxa autónoma) ---");

// Donativos (art.º 63º EBF): 25% do valor doado, até 15% da coleta total
// (linha 7). Usa-se um rendimento alto o suficiente para a coleta não ser
// o fator limitante, para isolar e confirmar só a percentagem de 25%.
const comDonativos = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { donativos: 400 }, // 400 × 25% = 100€, bem abaixo de 15% da coleta
});
assertIgual(comDonativos.linhas[8].donativos, 100, "dedução de donativos = 25% de 400€ = 100€ (dentro do teto de 15% da coleta)");

// Teto de 15% da coleta: um donativo desproporcionadamente alto tem de
// ficar limitado pela coleta, não pela percentagem de 25%.
const semDonativos = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: {},
});
const tetoEsperado = Math.round(semDonativos.linhas[7].total * 0.15 * 100) / 100;
const comDonativoAlto = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { donativos: 100000 }, // 25% disto (25.000€) excede de longe a coleta
});
assertIgual(comDonativoAlto.linhas[8].donativos, tetoEsperado, "donativo desproporcionado fica limitado a 15% da coleta total, não aos 25%");

// Mais-valias: cenário de rendimento médio em que o englobamento (taxa
// progressiva) sai mais barato do que a taxa autónoma fixa de 28% —
// confirmado manualmente (ver histórico desta sessão) que a escolha do
// motor bate certo com o resultado real de o comparar as duas hipóteses.
const rubricasMedio = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 1400 * 14 },
  { categoria: "A", tipo: "desconto", categoriaIRS: true, descricao: "Retenção IRS", valorComRedu: 1400 * 0.12 * 12 },
  { categoria: "A", tipo: "desconto", categoriaSS: true, descricao: "Segurança Social", valorComRedu: 1400 * 0.11 * 14 },
];
const inputMaisValias = {
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasMedio],
  dependentes: [],
  deducoesColeta: { maisValias: 5000 },
};
const declaracaoAutonoma = calcularDeclaracao(inputMaisValias);
const oportunidadeMaisValias = detectarOportunidadeMaisValias(inputMaisValias, declaracaoAutonoma);
if (!oportunidadeMaisValias) {
  console.error("FALHOU: devia detetar que o englobamento sai mais barato neste cenário de rendimento médio");
  process.exitCode = 1;
} else {
  console.log(`OK: oportunidade de englobamento de mais-valias detetada — poupança estimada ${oportunidadeMaisValias.poupancaEstimada}€`);
  const declaracaoEnglobadaManual = calcularDeclaracao({
    ...inputMaisValias,
    rubricasPorPessoa: [[...rubricasMedio, { categoria: "G", tipo: "abono", descricao: "MV englobadas", valorComRedu: 5000 }]],
    deducoesColeta: { maisValias: 0 },
  });
  const sinal = (r) => (r.tipo === "a_devolver" ? r.valor : -r.valor);
  assertIgual(
    sinal(declaracaoEnglobadaManual.resultado) - sinal(declaracaoAutonoma.resultado),
    oportunidadeMaisValias.poupancaEstimada,
    "poupança estimada do englobamento bate certo com a diferença real do motor"
  );
}

// Sem mais-valias registadas, não há nada a sugerir.
const semMaisValias = detectarOportunidadeMaisValias({ ...inputMaisValias, deducoesColeta: {} });
if (semMaisValias) {
  console.error("FALHOU: não devia sugerir englobamento quando não há mais-valias registadas");
  process.exitCode = 1;
} else {
  console.log("OK: sem sugestão de englobamento quando não há mais-valias registadas");
}

// Rendimento alto o suficiente para o englobamento empurrar para um
// escalão claramente pior do que 28% não deve sugerir a troca.
const rubricasAlto = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 5000 * 14 },
  { categoria: "A", tipo: "desconto", categoriaIRS: true, descricao: "Retenção IRS", valorComRedu: 5000 * 0.35 * 12 },
  { categoria: "A", tipo: "desconto", categoriaSS: true, descricao: "Segurança Social", valorComRedu: 5000 * 0.11 * 14 },
];
const oportunidadeRendimentoAlto = detectarOportunidadeMaisValias({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasAlto],
  dependentes: [],
  deducoesColeta: { maisValias: 5000 },
});
if (oportunidadeRendimentoAlto) {
  console.error("FALHOU: não devia sugerir englobamento a quem já está num escalão bem acima de 28%");
  process.exitCode = 1;
} else {
  console.log("OK: sem sugestão de englobamento para rendimento alto (escalão acima de 28%)");
}

console.log("\n--- Despesas gerais familiares: faturas dos dependentes somam à mesma base ---");
// Pedido de uma validadora real (03/09/2026): faturas com o NIF de um
// dependente também contam para a dedução de despesas gerais familiares
// (art.º 78º-B CIRS não distingue o NIF de quem paga), e em guarda
// partilhada cada progenitor só reclama a sua parte. Confirma que o novo
// campo `despesasGeraisDependentes` soma à MESMA base (mesmo limite de
// 250€ por sujeito passivo — não é um plafond adicional).
const semDespesasDependentes = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { despesasGerais: 250 }, // 250 × 35% = 87,50€, bem abaixo do teto de 250€
});
assertIgual(semDespesasDependentes.linhas[8].despesasGerais, 87.5, "despesas gerais só com o valor próprio (250€) = 35% = 87,50€");

const comDespesasDependentes = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  // 250€ próprias + 125€ do dependente (metade de 250€, guarda
  // partilhada) = 375€ de base × 35% = 131,25€ — ainda dentro do teto de
  // 250€, por isso o valor exato da percentagem deve aparecer, não o teto.
  deducoesColeta: { despesasGerais: 250, despesasGeraisDependentes: 125 },
});
assertIgual(comDespesasDependentes.linhas[8].despesasGerais, 131.25, "despesas gerais + parte do dependente (250€+125€) = 35% de 375€ = 131,25€");

// O teto continua a ser o MESMO (250€ solteiro) — uma base grande o
// suficiente (própria + dependentes) tem de ficar limitada por ele, não
// ganhar um plafond extra por ter um dependente.
const comBaseAcimaDoTeto = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { despesasGerais: 1000, despesasGeraisDependentes: 1000 }, // 2000 × 35% = 700€, bem acima do teto
});
assertIgual(comBaseAcimaDoTeto.linhas[8].despesasGerais, 250, "base própria + dependentes continua limitada ao mesmo teto de 250€ (sem plafond extra por dependente)");

console.log("\n--- Saúde e educação dos dependentes somam à mesma base (bug real reportado 03/09/2026) ---");
// Mesmo padrão de despesasGerais/despesasGeraisDependentes, agora para
// saúde e educação: faturas de dentista/consultas/vacinas/comedor escolar
// emitidas com o NIF de um dependente têm de aparecer na simulação.
const semDespesasSaudeDependentes = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { saude: 1000 }, // 1000 × 15% = 150€
});
assertIgual(semDespesasSaudeDependentes.linhas[8].saude, 150, "saúde só com valor próprio (1.000€) = 15% = 150€");

const comDespesasSaudeDependentes = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { saude: 1000, saudeDependentes: 1000 }, // 2000 × 15% = 300€
});
assertIgual(comDespesasSaudeDependentes.linhas[8].saude, 300, "saúde própria + dependentes (1.000€+1.000€) = 15% de 2.000€ = 300€");

const comDespesasEducacaoDependentes = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: { educacao: 500, educacaoDependentes: 500 }, // 1000 × 30% = 300€
});
assertIgual(comDespesasEducacaoDependentes.linhas[8].educacao, 300, "educação própria + dependentes (500€+500€) = 30% de 1.000€ = 300€");

console.log("\n--- Oportunidade PPR: pprAtual devolvido para a copy distinguir 'sem PPR' de 'já tem PPR, ainda há margem' ---");
// Bug real reportado (03/09/2026): o título da oportunidade era sempre
// "Ainda não tem PPR registado", mesmo para quem já tinha entregue PPR e só
// tinha margem até ao teto — ver ui/ventana-14.js, renderOportunidadePPR.
const oportunidadeComPprJaEntregue = detectarOportunidadePPR(
  {
    anoFiscal: 2026,
    regime: "individual",
    deducoesColeta: { ppr: 1000 },
    rubricasPorPessoa: [rubricasA],
    dependentes: [],
  },
  null
);
assertIgual(oportunidadeComPprJaEntregue?.pprAtual, 1000, "detectarOportunidadePPR devolve pprAtual para a UI distinguir os dois casos");

console.log("\n--- Pagamentos por conta: campo novo da auditoria fiscal de 03/09/2026 ---");
// Confirmado como linha própria (23) numa Demonstração de Liquidação real:
// IMPOSTOS APURADOS = Coleta Líquida − (Pagamentos por Conta + Retenções
// na Fonte). Até esta auditoria só as retenções eram subtraídas.
const semPagamentosPorConta = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: {},
});
const comPagamentosPorConta = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  dependentes: [],
  deducoesColeta: {},
  pagamentosPorConta: 500,
});
const sinalResultado = (r) => (r.tipo === "a_devolver" ? r.valor : -r.valor);
assertIgual(
  sinalResultado(comPagamentosPorConta.resultado) - sinalResultado(semPagamentosPorConta.resultado),
  500,
  "500€ de pagamentos por conta aumentam o valor a devolver (ou reduzem o a pagar) em exatamente 500€"
);

console.log("\n--- Categoria B: coeficientes do regime simplificado (auditoria 03/09/2026, 2ª ronda) ---");
// Corrigido: "geral" (maioria dos recibos verdes fora da lista do art.º
// 151º) usa 0,35, não 0,75. A dedução específica = rendimento × (1 −
// coeficiente); com coeficiente 0,35, um rendimento de 10.000€ deduz 6.500€
// (matéria coletável de 3.500€, 35%) — o oposto do que dava com o
// coeficiente antigo errado (0,75 → matéria coletável de 7.500€, 75%).
const rubricasCategoriaB = [
  { categoria: "B", tipo: "abono", descricao: "Serviços de consultoria (recibo verde)", valorComRedu: 10000 },
];
const declaracaoCategoriaB = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasCategoriaB],
  dependentes: [],
  deducoesColeta: {},
});
assertIgual(
  declaracaoCategoriaB.linhas[2].coeficienteBAplicado,
  0.35,
  "coeficiente por omissão da Categoria B (serviços gerais, fora da lista do art.º 151º) = 0,35"
);
assertIgual(
  declaracaoCategoriaB.linhas[3].total,
  3500,
  "rendimento coletável de 10.000€ de Categoria B com coeficiente 0,35 = 3.500€ (matéria coletável)"
);

console.log("\n--- Categoria B: coeficiente por atividade escolhida em Perfil (04/09/2026, a pedido do Dani, enfermeiro) ---");
// Antes desta alteração, o coeficiente era sempre 0,35 (prestação de
// serviços geral), mesmo para quem exerce uma atividade da tabela do
// art.º 151º (ex.: enfermagem) — para quem devia ser 0,75. Agora lê-se de
// `pessoas[i].atividadeCategoriaB`, alinhado por índice com rubricasPorPessoa.
const declaracaoEnfermeiro = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasCategoriaB],
  dependentes: [],
  pessoas: [{ id: "A", atividadeCategoriaB: "tabelaAnexa151" }],
  deducoesColeta: {},
});
assertIgual(
  declaracaoEnfermeiro.linhas[2].coeficienteBAplicado,
  0.75,
  "atividade 'tabelaAnexa151' (ex.: enfermagem) aplica o coeficiente 0,75, não o 0,35 por omissão"
);
assertIgual(
  declaracaoEnfermeiro.linhas[3].total,
  7500,
  "rendimento coletável de 10.000€ com coeficiente 0,75 = 7.500€ (matéria coletável de 75%, não 35%)"
);
// Override explícito `coeficienteB` continua a ganhar a qualquer atividade
// escolhida em Perfil (retrocompatibilidade com chamadores/testes antigos).
const declaracaoComOverride = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasCategoriaB],
  dependentes: [],
  pessoas: [{ id: "A", atividadeCategoriaB: "tabelaAnexa151" }],
  coeficienteB: 0.15,
  deducoesColeta: {},
});
assertIgual(declaracaoComOverride.linhas[2].coeficienteBAplicado, 0.15, "override explícito `coeficienteB` continua a ganhar à atividade escolhida em Perfil");

console.log("\n--- Retenção na fonte projetada para Categoria B (art.º 101º/101º-B CIRS, 04/09/2026) ---");
{
  const { projetarAno } = await import("../engine/projecao.js");
  const tabela2026 = obterTabelaFiscal(2026);

  // Um mês real com 2.000€ de Categoria B (sem retenção associada, como um
  // recibo verde de um profissional isento) — os restantes 11 meses ficam
  // projetados com a mesma média. Estimativa anual: 2.000×12=24.000€,
  // acima do limite de isenção de 15.000€ → deve projetar retenção.
  const docReal = [{ mes: 1, rubricas: [{ categoria: "B", tipo: "abono", descricao: "Recibo verde", valorComRedu: 2000 }] }];

  const semAtividade = projetarAno({
    documentosReais: docReal,
    ajustesManuais: [],
    anoFiscal: 2026,
    taxasRetencaoCategoriaB: tabela2026.taxasRetencaoCategoriaB,
    // atividadeCategoriaB omitido → cai para "servicosGeral" (11,5%)
  });
  const mesProjetadoSemAtividade = semAtividade.mesAMes.find((m) => m.mes === 2);
  const retencaoSemAtividade = mesProjetadoSemAtividade.rubricas.find((r) => r.tipo === "desconto" && r.categoria === "B");
  assertIgual(retencaoSemAtividade?.valorComRedu ?? 0, 230, "sem atividade escolhida (omissa) projeta retenção a 11,5% (2.000€ × 0,115 = 230€)");

  const comTabela151 = projetarAno({
    documentosReais: docReal,
    ajustesManuais: [],
    anoFiscal: 2026,
    atividadeCategoriaB: "tabelaAnexa151",
    taxasRetencaoCategoriaB: tabela2026.taxasRetencaoCategoriaB,
  });
  const mesProjetadoTabela151 = comTabela151.mesAMes.find((m) => m.mes === 2);
  const retencaoTabela151 = mesProjetadoTabela151.rubricas.find((r) => r.tipo === "desconto" && r.categoria === "B");
  assertIgual(retencaoTabela151?.valorComRedu ?? 0, 460, "atividade 'tabelaAnexa151' projeta retenção a 23% (2.000€ × 0,23 = 460€)");

  // Documento REAL nunca é alterado pela projeção — a retenção projetada só
  // se aplica aos meses SEM documento.
  const mesReal = comTabela151.mesAMes.find((m) => m.mes === 1);
  assertIgual(mesReal.rubricas.length, 1, "mês com documento real fica inalterado (sem retenção projetada acrescentada)");

  // Abaixo do limite de isenção anual (15.000€) — não deve projetar retenção.
  const docRealBaixo = [{ mes: 1, rubricas: [{ categoria: "B", tipo: "abono", descricao: "Recibo verde", valorComRedu: 500 }] }];
  const isento = projetarAno({
    documentosReais: docRealBaixo,
    ajustesManuais: [],
    anoFiscal: 2026,
    atividadeCategoriaB: "tabelaAnexa151",
    taxasRetencaoCategoriaB: tabela2026.taxasRetencaoCategoriaB,
  });
  const mesProjetadoIsento = isento.mesAMes.find((m) => m.mes === 2);
  const retencaoIsento = mesProjetadoIsento.rubricas.find((r) => r.tipo === "desconto" && r.categoria === "B");
  assertIgual(retencaoIsento?.valorComRedu ?? 0, 0, "estimativa anual (500×12=6.000€) abaixo do limite de 15.000€ → sem retenção projetada");

  // Sem `taxasRetencaoCategoriaB` (chamador antigo) — comportamento anterior preservado, sem exceções.
  const semTabela = projetarAno({ documentosReais: docReal, ajustesManuais: [], anoFiscal: 2026 });
  const mesSemTabela = semTabela.mesAMes.find((m) => m.mes === 2);
  const retencaoSemTabela = mesSemTabela.rubricas.find((r) => r.tipo === "desconto" && r.categoria === "B");
  assertIgual(retencaoSemTabela ? 1 : 0, 0, "chamador antigo sem `taxasRetencaoCategoriaB` não projeta retenção (retrocompatibilidade)");
}

console.log("\n--- PPR: limite por titular, ×2 em regime conjunta (auditoria 03/09/2026, 2ª ronda) ---");
// Corrigido: 400/350/300€ por sujeito passivo (art.º 21º EBF), não
// 800/700/600€ por declaração. Em regime individual o teto é 400€; em
// regime conjunta, 800€ (soma dos dois titulares possíveis).
const oportunidadePprConjunta = detectarOportunidadePPR({
  anoFiscal: 2026,
  regime: "conjunta",
  rubricasPorPessoa: [rubricasA, rubricasB],
  dependentes: [],
  deducoesColeta: {},
});
if (!oportunidadePprConjunta) {
  console.error("FALHOU: devia detetar oportunidade de PPR em regime conjunta");
  process.exitCode = 1;
} else {
  assertIgual(oportunidadePprConjunta.tetoAnual, 800, "teto anual de dedução do PPR em regime conjunta (2 titulares) = 800€");
}

console.log("\n--- Limite agregado às deduções à coleta (art.º 78º, n.º 7/8 CIRS — novo, 03/09/2026 2ª ronda) ---");
// Rendimento alto o suficiente para cair no último escalão finito (>86.634€
// de rendimento coletável), onde o limite agregado é fixo em 1.000€.
// Deduções somadas muito acima disso (saúde+educação+habitação+despesas
// gerais) têm de ficar limitadas a 1.000€, não à soma dos tetos
// individuais de cada categoria.
const rubricasRendimentoAlto = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 9000 * 14 },
];
// Valores de despesa (não de dedução) escolhidos para cada categoria
// atingir exatamente o seu próprio teto individual: saude 7000×15%→1000
// (teto), educacao 2700×30%→800 (teto), habitacao 6100×15%→900 (teto,
// fora do 1º escalão), despesasGerais 800×35%→250 (teto solteiro). Soma
// dos tetos individuais = 2.950€, bem acima do limite agregado de 1.000€.
const semLimiteAgregado = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasRendimentoAlto],
  dependentes: [],
  deducoesColeta: { saude: 7000, educacao: 2700, habitacao: 6100, despesasGerais: 800 },
});
assertIgual(
  semLimiteAgregado.linhas[8].limiteAgregado,
  1000,
  "limite agregado aplicado a rendimento no último escalão finito = 1.000€ (mínimo legal)"
);
assertIgual(
  semLimiteAgregado.linhas[8].saude + semLimiteAgregado.linhas[8].educacao + semLimiteAgregado.linhas[8].habitacao + semLimiteAgregado.linhas[8].despesasGerais,
  2950,
  "os valores individuais de cada categoria continuam a mostrar-se sem corte (só o total é limitado)"
);
if (semLimiteAgregado.linhas[8].limiteAgregadoAplicado !== true) {
  console.error("FALHOU: limiteAgregadoAplicado devia ser true quando a soma das deduções excede o limite");
  process.exitCode = 1;
} else {
  console.log("OK: limiteAgregadoAplicado = true quando a soma das deduções excede o limite");
}

// Rendimento dentro do 1º escalão: sem limite nenhum (mesmo com deduções
// altas), o total tem de ser a soma cheia.
const dentroPrimeiroEscalao = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasB],
  dependentes: [],
  deducoesColeta: { saude: 1000, educacao: 800 },
});
if (dentroPrimeiroEscalao.linhas[8].limiteAgregadoAplicado !== false) {
  console.error("FALHOU: dentro do 1º escalão de IRS não devia haver limite agregado");
  process.exitCode = 1;
} else {
  console.log("OK: sem limite agregado dentro do 1º escalão de IRS");
}

console.log("\n--- Despesas gerais familiares FORA do limite agregado (bug real, 04/09/2026, confirmado com uma Demonstração de Liquidação real) ---");
// Até esta correção, `despesasGerais` entrava por engano na soma sujeita
// ao limite do art.º 78º n.º 7/8 — a AT só sujeita a esse limite as
// alíneas c) a h), k) e m) do n.º 1 (saúde, educação, habitação, PPR,
// exigência de fatura, trabalho doméstico), NUNCA a alínea b) (despesas
// gerais e familiares, art.º 78º-B). Caso real: rendimento alto (último
// escalão, limite agregado = 1.000€), despesasGerais isolado bem acima do
// que caberia dentro desse limite se estivesse incluído.
const semDespesasGeraisNoLimite = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasRendimentoAlto],
  dependentes: [],
  deducoesColeta: { despesasGerais: 800 }, // 800×35%→250€ (teto solteiro), sozinho, sem mais nenhuma dedução "sujeita a limite"
});
assertIgual(
  semDespesasGeraisNoLimite.linhas[8].limiteAgregadoAplicado ? 1 : 0,
  0,
  "despesasGerais sozinho (250€) não aciona o limite agregado (1.000€), porque fica de fora dele"
);
assertIgual(semDespesasGeraisNoLimite.linhas[8].total, 250, "despesasGerais (250€) entra no total das deduções à coleta na mesma, só não conta para o limite");

// Reprodução da estrutura de um caso real (números redondos/fictícios por
// privacidade): a soma de saúde+educação+exigência de fatura+PPR deve
// corresponder exatamente ao "Total das Deduções sujeitas a limite" que a
// AT reporta — com despesasGerais bem maior à parte, sem ser cortado nem
// somado ao subtotal limitado.
const casoDespesasSujeitasALimite = calcularDeclaracao({
  anoFiscal: 2025,
  regime: "individual",
  rubricasPorPessoa: [rubricasRendimentoAlto],
  dependentes: [],
  // Soma abaixo do limite agregado (1.000€ no último escalão) para isolar
  // só o que este teste verifica: que despesasGerais fica de fora da soma,
  // sem interferência do próprio corte do limite.
  deducoesColeta: { saude: 1000, educacao: 1000, exigenciaFatura: 100, ppr: 1000, despesasGerais: 30000 },
});
assertIgual(
  casoDespesasSujeitasALimite.linhas[8].saude +
    casoDespesasSujeitasALimite.linhas[8].educacao +
    casoDespesasSujeitasALimite.linhas[8].exigenciaFatura +
    casoDespesasSujeitasALimite.linhas[8].ppr,
  750,
  "saúde (150€) + educação (300€) + exigência de fatura (100€) + PPR (200€) = 750€, exatamente o 'Total das Deduções sujeitas a limite' (despesasGerais de 30.000€ fica de fora)"
);

// --- Dedução específica de Cat. A: MAX(valor fixo, contribuições SS reais) (bug real, 04/09/2026) ---
// art.º 25º/1 CIRS: a dedução específica de Cat. A é o valor fixo da
// tabela (8,54×IAS) OU as contribuições obrigatórias reais para a
// Segurança Social/subsistemas de saúde, se estas forem SUPERIORES — o
// motor, antes desta correção, usava sempre o valor fixo, ignorando
// contribuições reais mais altas (caso comum em quem descontou por um
// salário elevado durante o ano todo).
const rSemSSAlta = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [[
    { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 90000 },
    { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: 6000 },
  ]],
  dependentes: [],
});
assertIgual(
  rSemSSAlta.linhas[2].categoriaA,
  6000,
  "dedução específica de Cat. A usa as contribuições SS reais (6.000€) quando excedem o valor fixo da tabela (4.587,09€)"
);
const rComSSBaixa = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [[
    { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 20000 },
    { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: 2200 },
  ]],
  dependentes: [],
});
assertIgual(
  rComSSBaixa.linhas[2].categoriaA,
  4587.09,
  "dedução específica de Cat. A mantém-se no valor fixo da tabela (4.587,09€) quando as contribuições SS reais (2.200€) são inferiores"
);

// --- Quotização sindical: teto de 1% aplicado ANTES de duplicar (bug real, 04/09/2026) ---
// art.º 25º/1-d) CIRS + majoração: a quota sindical é majorada em 100%
// (duplicada), mas o teto de 1% do rendimento bruto de Cat. A aplica-se
// à quota ORIGINAL, antes de duplicar — não ao valor já duplicado. O
// motor, antes desta correção, duplicava primeiro e só depois cortava
// pelo teto, o que subestimava a dedução em qualquer caso em que a quota
// original já estivesse perto do teto de 1%.
const rSindical = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [[
    { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 50000 },
    { categoria: "A", tipo: "desconto", descricao: "Quotização sindical", categoriaSindicato: true, valorComRedu: 700 },
  ]],
  dependentes: [],
});
assertIgual(
  rSindical.linhas[2].categoriaA,
  4587.09 + 1000,
  "quota sindical de 700€, rendimento bruto de 50.000€ (teto de 1% = 500€): o teto corta a quota para 500€ e SÓ DEPOIS duplica (500×2=1.000€ de dedução sindical), somados ao valor fixo de 4.587,09€"
);

// --- Caso combinado (casal, IRS 2025, tributação conjunta) ---
// Cenário representativo de um agregado real que motivou esta auditoria
// (04/09/2026) — números redondos/fictícios aqui por privacidade, mas com
// a mesma estrutura que expôs os bugs num caso real (um dos titulares com
// Categoria A + recibos verdes na tabela do art.º 151º, rendimento
// coletável conjunto entre 80.000€ e 160.000€, contribuições de SS acima
// do valor fixo, quotização sindical perto do teto de 1%) — usado para
// testar TRÊS correções em conjunto:
//   1. dedução específica de Cat. A = MAX(valor fixo, contribuições SS reais);
//   2. teto de 1% da quotização sindical aplicado ANTES de duplicar (majoração);
//   3. taxa adicional de solidariedade (art.º 68º-A) dividida pelo quociente
//      conjugal (2,00) antes de comparar com os limiares de 80.000€/250.000€
//      — sem esta correção, este casal pagaria uma taxa adicional indevida.
const rubricasPessoaA2025 = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 60000 },
  { categoria: "A", tipo: "desconto", descricao: "Retenção IRS", categoriaIRS: true, valorComRedu: 9000 },
  { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: 8000 },
  { categoria: "A", tipo: "desconto", descricao: "Quotização sindical", categoriaSindicato: true, valorComRedu: 700 },
  { categoria: "B", tipo: "abono", descricao: "Recibo verde (enfermagem)", valorComRedu: 8000 },
];
const rubricasPessoaB2025 = [
  { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 45000 },
  { categoria: "A", tipo: "desconto", descricao: "Retenção IRS", categoriaIRS: true, valorComRedu: 6500 },
  { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: 5000 },
];
const dependentesCasoCombinado = [
  { id: 1, dataNascimento: "2010-01-01", guarda: "exclusiva" },
  { id: 2, dataNascimento: "2012-01-01", guarda: "exclusiva" },
  { id: 3, dataNascimento: "2014-01-01", guarda: "exclusiva" },
];
const casoCombinado = calcularDeclaracao({
  anoFiscal: 2025,
  regime: "conjunta",
  rubricasPorPessoa: [rubricasPessoaA2025, rubricasPessoaB2025],
  dependentes: dependentesCasoCombinado,
  pessoas: [{ id: "A", atividadeCategoriaB: "tabelaAnexa151" }, { id: "B" }],
  deducoesColeta: { saude: 1200, educacao: 8000, exigenciaFatura: 130, ppr: 3000, despesasGerais: 30000 },
  tributacoesAutonomas: 100,
});
assertIgual(casoCombinado.linhas[3].total, 96800, "rendimento coletável do casal fica abaixo de 160.000€ (48.400€ por sujeito passivo)");
assertIgual(
  casoCombinado.linhas[2].categoriaA,
  14200,
  "dedução específica de Cat. A dos dois sujeitos passivos = MAX(fixo, SS) de cada um (8.000+5.000) + sindical já com teto aplicado antes de duplicar (600×2=1.200)"
);
assertIgual(
  casoCombinado.linhas["6A"].total,
  0,
  "taxa adicional de solidariedade = 0€ (rendimento coletável dividido por 2 = 48.400€, abaixo do limiar de 80.000€, art.º 68º-A/3 CIRS — antes da correção o motor aplicava o limiar ao total conjunto e cobrava taxa adicional indevida)"
);

// detectarSugestoesPagamento (03/09/2026) — não aparece nada quando o
// resultado é "a devolver", mesmo com household preenchido.
const semSugestoesQuandoDevolve = detectarSugestoesPagamento(
  { resultado: { tipo: "a_devolver", valor: 100 } },
  { household: { situacao: "casal", fontesRendimento: ["trabalhoDependente"], regimeTributacao: "individual" }, deducoesColeta: {} }
);
if (semSugestoesQuandoDevolve.length !== 0) {
  console.error("FALHOU: não deviam aparecer sugestões de pagamento quando o resultado é a_devolver");
  process.exitCode = 1;
} else {
  console.log("OK: sem sugestões de pagamento quando o resultado é a_devolver");
}

// Casal com trabalho dependente, sem comparar regimes, sem donativos —
// deve sugerir as 5 categorias (retenção, comparar regimes, donativos,
// dupla renda, horas extra), nesta ordem.
const sugestoesCompletas = detectarSugestoesPagamento(
  { resultado: { tipo: "a_pagar", valor: 800 } },
  { household: { situacao: "casal", fontesRendimento: ["trabalhoDependente"], regimeTributacao: "individual" }, deducoesColeta: {} }
);
const tiposEsperados = ["retencaoSuperior", "compararRegimes", "donativos", "duplaRenda", "horasExtra"];
if (JSON.stringify(sugestoesCompletas.map((s) => s.tipo)) !== JSON.stringify(tiposEsperados)) {
  console.error(`FALHOU: sugestões esperadas ${JSON.stringify(tiposEsperados)}, obtidas ${JSON.stringify(sugestoesCompletas.map((s) => s.tipo))}`);
  process.exitCode = 1;
} else {
  console.log("OK: casal com trabalho dependente, sem comparar regimes nem donativos, sugere as 5 categorias na ordem certa");
}

// Já a comparar regimes e já com donativos registados — essas duas
// sugestões desaparecem, mas as informativas continuam.
const sugestoesParciais = detectarSugestoesPagamento(
  { resultado: { tipo: "a_pagar", valor: 800 } },
  { household: { situacao: "casal", fontesRendimento: ["trabalhoDependente"], regimeTributacao: "comparar_ambos" }, deducoesColeta: { donativos: 50 } }
);
if (JSON.stringify(sugestoesParciais.map((s) => s.tipo)) !== JSON.stringify(["retencaoSuperior", "duplaRenda", "horasExtra"])) {
  console.error(`FALHOU: sugestões esperadas depois de já comparar regimes e ter donativos, obtidas ${JSON.stringify(sugestoesParciais.map((s) => s.tipo))}`);
  process.exitCode = 1;
} else {
  console.log("OK: já a comparar regimes e já com donativos — essas duas sugestões desaparecem");
}

// Só recibos verdes (sem trabalho dependente): nem retenção, nem dupla
// renda, nem horas extra fazem sentido — só donativos (sempre) sobra.
const sugestoesReciboVerde = detectarSugestoesPagamento(
  { resultado: { tipo: "a_pagar", valor: 300 } },
  { household: { situacao: "individual", fontesRendimento: ["recibosVerdes"] }, deducoesColeta: {} }
);
if (JSON.stringify(sugestoesReciboVerde.map((s) => s.tipo)) !== JSON.stringify(["donativos"])) {
  console.error(`FALHOU: sujeito só com recibos verdes devia só ter a sugestão de donativos, obtido ${JSON.stringify(sugestoesReciboVerde.map((s) => s.tipo))}`);
  process.exitCode = 1;
} else {
  console.log("OK: sujeito só com recibos verdes (sem trabalho dependente) só recebe a sugestão de donativos");
}

console.log("\n--- Sugestão de retenção quantificada (04/09/2026) ---");
// Casal/individual não interessa aqui, só que haja trabalho dependente e
// um valor a pagar, para isolar o cálculo de valorMensalSugerido.
const contextoBase = { household: { situacao: "individual", fontesRendimento: ["trabalhoDependente"] }, deducoesColeta: { donativos: 1 } };

const comMesesRestantes = detectarSugestoesPagamento({ resultado: { tipo: "a_pagar", valor: 600 } }, { ...contextoBase, mesesRestantes: 4 });
const retencaoComValor = comMesesRestantes.find((s) => s.tipo === "retencaoSuperior");
assertIgual(retencaoComValor?.valorMensalSugerido, 150, "valor mensal sugerido = valor a pagar / meses restantes (600€ / 4 meses)");

const semMesesInformados = detectarSugestoesPagamento({ resultado: { tipo: "a_pagar", valor: 600 } }, contextoBase);
const retencaoSemValor = semMesesInformados.find((s) => s.tipo === "retencaoSuperior");
if (retencaoSemValor?.valorMensalSugerido !== undefined) {
  console.error(`FALHOU: sem mesesRestantes informado, a sugestão não devia ter um valor calculado, obtido ${retencaoSemValor?.valorMensalSugerido}`);
  process.exitCode = 1;
} else {
  console.log("OK: sem mesesRestantes informado, mantém-se a sugestão genérica sem valor (compatibilidade com chamadas antigas)");
}

const anoFechado = detectarSugestoesPagamento({ resultado: { tipo: "a_pagar", valor: 600 } }, { ...contextoBase, mesesRestantes: 0 });
if (anoFechado.some((s) => s.tipo === "retencaoSuperior")) {
  console.error("FALHOU: com mesesRestantes=0 (ano fiscal já fechado), a sugestão de retenção superior não devia aparecer");
  process.exitCode = 1;
} else {
  console.log("OK: com mesesRestantes=0 (ano fechado, ex. simulação retrospetiva completa), a sugestão de retenção superior é omitida");
}

console.log("\n--- Ano fiscal 2025 (adicionado 04/09/2026, a pedido do Dani, para simulação retrospetiva) ---");
// Não repete a auditoria completa do ficheiro de legislação — só garante
// que 2025 tem tabela própria, distinta de 2026, e que o motor a usa sem
// rebentar (a mesma entrada de rubricas dá coleta diferente em 2025 vs
// 2026, porque as taxas dos escalões 2-5 baixaram 0,3pp de 2025 para
// 2026 — ver comentário em data/legislacao-2026.js).
const t2025 = obterTabelaFiscal(2025);
const t2026 = obterTabelaFiscal(2026);
assertIgual(t2025.escaloes[1].taxaMarginal, 0.16, "taxa marginal do 2º escalão em 2025 (antes da descida de 0,3pp em 2026)");
if (t2025.escaloes[1].taxaMarginal === t2026.escaloes[1].taxaMarginal) {
  console.error("FALHOU: tabela de 2025 não devia ser a mesma referência/valores que a de 2026");
  process.exitCode = 1;
} else {
  console.log("OK: 2025 e 2026 têm tabelas de escalões distintas");
}
const r2025 = calcularDeclaracao({ anoFiscal: 2025, regime: "individual", rubricasPorPessoa: [rubricasA], dependentes: [], deducoesColeta: {} });
if (!r2025?.resultado?.tipo) {
  console.error("FALHOU: calcularDeclaracao com anoFiscal 2025 não devolveu um resultado válido");
  process.exitCode = 1;
} else {
  console.log(`OK: calcularDeclaracao corre para o ano fiscal 2025 sem exceções (resultado: ${r2025.resultado.tipo}, ${r2025.resultado.valor}€)`);
}

console.log("\n--- Ascendentes, deficiência e trabalho doméstico (04/09/2026, a pedido do Dani a partir do folheto oficial de deduções da AT) ---");

function deducoesDe(extra) {
  return calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricasA],
    dependentes: [],
    pessoas: [],
    ascendentes: [],
    deducoesColeta: {},
    ...extra,
  }).linhas[8];
}

// Ascendentes: valor de SUBSTITUIÇÃO (não adicional) — 1 só ascendente dá
// 635€; 2 ou mais dão 525€ cada.
assertIgual(deducoesDe({ ascendentes: [{ nome: "Avó" }] }).porAscendentes, 635, "1 ascendente (só) = 635€ (valor 'único ascendente')");
assertIgual(
  deducoesDe({ ascendentes: [{ nome: "Avó" }, { nome: "Avô" }] }).porAscendentes,
  1050,
  "2 ascendentes = 525€ cada (1.050€ no total, não 635€ cada)"
);
assertIgual(
  deducoesDe({ ascendentes: [{ nome: "Avó", deficiencia: true }] }).porAscendentes,
  635 + 1342.83,
  "1 ascendente, único, com deficiência = 635€ + 1.342,83€ (extra do art.º 87º)"
);

// Deficiência do sujeito passivo, com e sem o acréscimo de incapacidade ≥90%.
assertIgual(deducoesDe({ pessoas: [{ id: "A", deficiencia: true }] }).deficiencia, 2148.52, "sujeito passivo deficiente = 2.148,52€ (4×IAS 2026)");
assertIgual(
  deducoesDe({ pessoas: [{ id: "A", deficiencia: true, incapacidadeIgualOuSuperior90: true }] }).deficiencia,
  2148.52 * 2,
  "sujeito passivo deficiente com incapacidade ≥90% = dobro (base + despesa de acompanhamento)"
);
assertIgual(deducoesDe({ pessoas: [{ id: "A", incapacidadeIgualOuSuperior90: true }] }).deficiencia, 0, "incapacidade ≥90% sem `deficiencia: true` não conta sozinha (evita dado incoerente)");

// Deficiência de um dependente: soma-se ao valor normal do dependente
// (porDependentes), não o substitui.
const comDependenteDeficiente = deducoesDe({ dependentes: [{ id: 1, nome: "Filho", deficiencia: true }] });
assertIgual(comDependenteDeficiente.porDependentes, 600, "dependente deficiente continua a ter o valor normal (600€) em porDependentes");
assertIgual(comDependenteDeficiente.deficiencia, 1342.83, "...e o extra de deficiência (1.342,83€) aparece à parte, em `deficiencia`");

// Trabalho doméstico (art.º 78º-H, novo desde 2025): 5% até 200€.
assertIgual(deducoesDe({ deducoesColeta: { trabalhoDomestico: 1000 } }).trabalhoDomestico, 50, "trabalho doméstico: 5% de 1.000€ = 50€ (dentro do teto)");
assertIgual(deducoesDe({ deducoesColeta: { trabalhoDomestico: 10000 } }).trabalhoDomestico, 200, "trabalho doméstico: 5% de 10.000€ = 500€, mas o teto é 200€");

console.log("\nTeste concluído" + (process.exitCode ? " COM FALHAS." : " sem exceções."));
