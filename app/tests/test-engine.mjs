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
  calcularDeducoesAColeta,
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

console.log("\n--- Mínimo garantido de 15% em Categoria B (art.º 31º/1 CIRS, regressão do fix 21/09/2026) ---");
// Regressão para o commit eb4d8f3: a dedução específica de Categoria B em
// regime simplificado nunca pode ser inferior a 15% do rendimento bruto,
// mesmo que o coeficiente da atividade dê uma dedução menor. "propriedade
// intelectual" tem coeficiente 0,95 → dedução normal de só 5% (500€ sobre
// 10.000€), abaixo do mínimo de 15% (1.500€) — o motor deve aplicar o maior
// dos dois.
const declaracaoMinimoGarantido = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasCategoriaB],
  dependentes: [],
  pessoas: [{ id: "A", atividadeCategoriaB: "propriedadeIntelectual" }],
  deducoesColeta: {},
});
assertIgual(
  declaracaoMinimoGarantido.linhas[2].categoriaB,
  1500,
  "coeficiente 0,95 daria só 500€ de dedução — o mínimo garantido de 15% (1.500€) prevalece por ser maior"
);
assertIgual(
  declaracaoMinimoGarantido.linhas[3].total,
  8500,
  "matéria coletável de Categoria B = 10.000€ − 1.500€ (mínimo garantido), não 10.000€ − 500€ (coeficiente 0,95)"
);

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

console.log("\n--- Projeção da Categoria A repete a remuneração base real (reportado pelo Dani, set/2026) ---");
{
  // A app real NUNCA produz uma rubrica com descrição "Remuneração base" —
  // ui/components/confirmacao.js (rubricasFinaisDoResumo) grava sempre o
  // bruto do talão como "Vencimento bruto". Este teste usa essa descrição
  // real, exatamente como sai do fluxo de confirmação, para garantir que a
  // regressão de 21/09/2026 (baseA nunca reconhecia "Vencimento bruto",
  // logo todo mês projetado ficava com 0€ de Categoria A) não volta.
  const { projetarAno } = await import("../engine/projecao.js");
  const docsReaisTalao = [
    { mes: 1, rubricas: [{ descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: 2000 }] },
    { mes: 2, rubricas: [{ descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: 2000 }] },
  ];
  const { mesAMes } = projetarAno({
    documentosReais: docsReaisTalao,
    ajustesManuais: [],
    anoFiscal: 2026,
  });
  const mesProjetadoMarco = mesAMes.find((m) => m.mes === 3);
  const baseProjetada = mesProjetadoMarco.rubricas.find((r) => r.categoria === "A" && r.tipo === "abono");
  assertIgual(baseProjetada?.valorComRedu ?? 0, 2000, "mês sem documento repete a última 'Vencimento bruto' real (2.000€), não fica a 0€");
  const mesProjetadoDezembro = mesAMes.find((m) => m.mes === 12);
  const subsidioNatal = mesProjetadoDezembro.rubricas.filter((r) => r.categoria === "A" && r.tipo === "abono");
  assertIgual(subsidioNatal.length, 2, "dezembro projetado tem 2 abonos de Categoria A: base + subsídio de Natal");
}

console.log("\n--- Projeção da Categoria A também estima IRS/SS/Sindicato/ADSE, não só o bruto (reportado pelo Dani, 21/09/2026) ---");
{
  // Dani, depois de ver o painel de detalhe mês a mês: "continuo sin saber
  // si estimas las diferentes rúbricas y las incluyes en el cálculo".
  // Resposta honesta na altura: não, só o bruto (remuneração base/recibo
  // verde) era projetado — IRS retido, Segurança Social, Sindicato e ADSE
  // ficavam a 0€ em qualquer mês sem documento, mesmo sabendo que a
  // entidade patronal continua a descontar esses valores todos os meses.
  // Este teste usa 2 meses reais com uma taxa de IRS/SS conhecida (20% e
  // 10% do bruto, respetivamente) e confirma que um mês projetado aplica
  // essa MESMA taxa efetiva ao seu próprio bruto projetado.
  const { projetarAno } = await import("../engine/projecao.js");
  const docComDescontos = (mes) => ({
    mes,
    rubricas: [
      { descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: 2000 },
      { descricao: "IRS retido", categoria: "A", tipo: "desconto", categoriaIRS: true, valorComRedu: 400 }, // 20%
      { descricao: "Segurança Social", categoria: "A", tipo: "desconto", categoriaSS: true, valorComRedu: 200 }, // 10%
    ],
  });
  const { mesAMes } = projetarAno({
    documentosReais: [docComDescontos(1), docComDescontos(2)],
    ajustesManuais: [],
    anoFiscal: 2026,
  });
  const mesProjetadoMarco = mesAMes.find((m) => m.mes === 3);
  const irsProjetado = mesProjetadoMarco.rubricas.find((r) => r.categoria === "A" && r.tipo === "desconto" && r.categoriaIRS);
  const ssProjetada = mesProjetadoMarco.rubricas.find((r) => r.categoria === "A" && r.tipo === "desconto" && r.categoriaSS);
  assertIgual(irsProjetado?.valorComRedu ?? 0, 400, "mês projetado aplica a taxa efetiva de IRS observada (20% de 2.000€ = 400€), não fica a 0€");
  assertIgual(ssProjetada?.valorComRedu ?? 0, 200, "mês projetado aplica a taxa efetiva de SS observada (10% de 2.000€ = 200€), não fica a 0€");

  // Sindicato/ADSE nunca apareceram nos documentos reais deste teste (0%
  // de taxa efetiva) — não deve inventar-se uma rubrica de valor 0€.
  const sindicatoProjetado = mesProjetadoMarco.rubricas.find((r) => r.categoria === "A" && r.tipo === "desconto" && r.categoriaSindicato);
  assertIgual(sindicatoProjetado ? 1 : 0, 0, "sem sindicato nos meses reais (0% de taxa efetiva) não projeta uma rubrica de sindicato");
}

console.log("\n--- Ajuste manual de 0€ ao vencimento bruto continua a aparecer (reportado pelo Dani, 21/09/2026: 'las tarjetas proyectadas ya no estan expandidas') ---");
{
  // Depois da correção anterior (campo vazio grava 0€ em vez de ser
  // ignorado), um utilizador que apague o vencimento bruto de um mês
  // projetado (a dizer "não vou trabalhar esse mês") ficava com a rubrica
  // toda omitida — porque o código só empurrava a rubrica quando
  // valorBase > 0, e um ajuste explícito de 0€ falha esse teste tal como o
  // valor automático (ultimaBase) ficaria a 0€ sem nenhum documento real.
  // Isto escondia não só o valor mas o PRÓPRIO CAMPO editável e o botão
  // "repor estimativa automática", sem forma de desfazer pela interface.
  const { projetarAno } = await import("../engine/projecao.js");
  const docsReaisBase = [
    { mes: 1, rubricas: [{ descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: 2000 }] },
  ];
  const { mesAMes } = projetarAno({
    documentosReais: docsReaisBase,
    ajustesManuais: [{ mes: 3, anoFiscal: 2026, componente: "remuneracao_base", valorAjustado: 0 }],
    anoFiscal: 2026,
  });
  const mesAjustadoAZero = mesAMes.find((m) => m.mes === 3);
  const baseAjustada = mesAjustadoAZero.rubricas.find((r) => r.categoria === "A" && r.tipo === "abono" && /vencimento\s*bruto/i.test(r.descricao));
  assertIgual(baseAjustada ? 1 : 0, 1, "ajuste manual de 0€ ao vencimento bruto continua a produzir uma rubrica (visível e editável), não desaparece");
  assertIgual(baseAjustada?.valorComRedu ?? -1, 0, "...com o valor 0€ efetivamente aplicado");
  assertIgual(baseAjustada?.origem ?? "", "projetado_ajustado", "...marcada como 'projetado_ajustado', para mostrar o botão de repor automático");

  // Continua correto: SEM nenhum ajuste e sem nenhum mês real anterior
  // (ultimaBase = 0 por omissão), a rubrica não deve aparecer — não há
  // nada para projetar.
  const { mesAMes: semDadosNenhuns } = projetarAno({ documentosReais: [], ajustesManuais: [], anoFiscal: 2026 });
  const mesSemNada = semDadosNenhuns.find((m) => m.mes === 3);
  const baseSemNada = mesSemNada.rubricas.find((r) => r.categoria === "A" && r.tipo === "abono");
  assertIgual(baseSemNada ? 1 : 0, 0, "sem nenhum dado real nem ajuste, continua sem inventar uma rubrica de 0€");
}

console.log("\n--- Subsídio de férias/Natal projetado passa a ser editável (pedido do Dani, 22/09/2026: 'los subsidios prorrateados... tendrian que tener la oportunidad de editarlos') ---");
{
  // Duas razões reais dadas pelo Dani: quem tem o subsídio pago por
  // duodécimos (já embutido no vencimento mensal) precisa de o poder pôr
  // a 0€; quem sai da empresa antes do pagamento precisa de ajustar o
  // valor esperado. Antes desta correção, o subsídio era sempre
  // `ultimaBase` fixo, sem nenhum ajustePorComponente ligado à interface
  // (o motor já aceitava o ajuste, só a UI não o expunha).
  const { projetarAno } = await import("../engine/projecao.js");
  const docsReaisBase = [{ mes: 1, rubricas: [{ descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: 2000 }] }];

  // Sem ajuste: dezembro projetado usa ultimaBase (2.000€) para o subsídio de Natal.
  const { mesAMes: semAjusteSubsidio } = projetarAno({ documentosReais: docsReaisBase, ajustesManuais: [], anoFiscal: 2026 });
  const dezembroAuto = semAjusteSubsidio.find((m) => m.mes === 12);
  const subsidioAuto = dezembroAuto.rubricas.find((r) => /subs[íi]dio/i.test(r.descricao));
  assertIgual(subsidioAuto?.valorComRedu ?? -1, 2000, "sem ajuste, subsídio de Natal projetado = último vencimento bruto conhecido (2.000€)");

  // Com ajuste a 0€ (ex.: subsídio pago por duodécimos, já embutido no
  // vencimento mensal): a rubrica continua a aparecer, a 0€, em vez de
  // desaparecer ou de continuar a usar o valor automático.
  const { mesAMes: comAjusteZero } = projetarAno({
    documentosReais: docsReaisBase,
    ajustesManuais: [{ mes: 12, anoFiscal: 2026, componente: "subsidio_natal", valorAjustado: 0 }],
    anoFiscal: 2026,
  });
  const dezembroAjustado = comAjusteZero.find((m) => m.mes === 12);
  const subsidioAjustado = dezembroAjustado.rubricas.find((r) => /subs[íi]dio/i.test(r.descricao));
  assertIgual(subsidioAjustado ? 1 : 0, 1, "com ajuste explícito de 0€, a rubrica do subsídio de Natal continua a aparecer (visível e editável)");
  assertIgual(subsidioAjustado?.valorComRedu ?? -1, 0, "...com o valor 0€ efetivamente aplicado, não o automático (2.000€)");
  assertIgual(subsidioAjustado?.origem ?? "", "projetado_ajustado", "...marcada como 'projetado_ajustado'");

  // Verificação de fundo do pedido original do Dani: "com projeção", com
  // TUDO editável a 0€ (base + subsídio + Cat. B), deve ficar equivalente
  // a "só dados reais" (nenhuma rubrica extra nos meses projetados).
  const { mesAMes: tudoZerado } = projetarAno({
    documentosReais: docsReaisBase,
    ajustesManuais: [
      { mes: 12, anoFiscal: 2026, componente: "subsidio_natal", valorAjustado: 0 },
      { mes: 12, anoFiscal: 2026, componente: "remuneracao_base", valorAjustado: 0 },
    ],
    anoFiscal: 2026,
  });
  const dezembroTudoZerado = tudoZerado.find((m) => m.mes === 12);
  const totalAbonosDezembroZerado = dezembroTudoZerado.rubricas
    .filter((r) => r.tipo === "abono")
    .reduce((s, r) => s + r.valorComRedu, 0);
  assertIgual(totalAbonosDezembroZerado, 0, "com base E subsídio ambos a 0€, dezembro projetado não contribui rendimento nenhum — agora sim equivalente a 'só dados reais'");
}

console.log("\n--- PPR: limite por titular, ×2 em regime conjunta (auditoria 03/09/2026, 2ª ronda) ---");
// Corrigido: 400/350/300€ por sujeito passivo (art.º 21º EBF), não
// 800/700/600€ por declaração. Em regime individual o teto é 400€; em
// regime conjunta, 800€ no AGREGADO — mas (CORRIGIDO 24/09/2026, pedido
// real do Dani: "el PPR es por titular... somos dos sujetos pasivos, pero
// solo un espacio para poner el PPR") já não é um plafond partilhado: são
// dois tetos de 400€ independentes, um por titular, cada um só usado por
// quem realmente entregou esse PPR (`deducoesColeta.pprPorPessoa`).
const pessoasConjunta = [{ id: "pessoaA" }, { id: "pessoaB" }];
const oportunidadePprConjunta = detectarOportunidadePPR({
  anoFiscal: 2026,
  regime: "conjunta",
  rubricasPorPessoa: [rubricasA, rubricasB],
  dependentes: [],
  pessoas: pessoasConjunta,
  deducoesColeta: {},
});
if (!oportunidadePprConjunta) {
  console.error("FALHOU: devia detetar oportunidade de PPR em regime conjunta");
  process.exitCode = 1;
} else {
  // A sugestão aponta ao 1º titular com espaço, ao SEU próprio teto — não
  // ao teto do agregado (esse continua a ser 800€, mas só aparece somado
  // no resultado da declaração, não numa única "oportunidade").
  assertIgual(oportunidadePprConjunta.tetoAnual, 400, "teto anual sugerido é o de UM titular (400€), não o do agregado inteiro");
}

// Confirma o outro lado: cada titular só é limitado ao SEU próprio teto,
// mesmo quando um deles entrega tudo e o outro nada — a dedução do
// agregado é a SOMA de duas deduções independentemente capadas, não um
// único valor combinado capado a 800€ (era exatamente este o erro
// reportado: um único campo do agregado dava a mesma dedução quer as
// entregas fossem feitas por um só titular, quer repartidas pelos dois).
const declaracaoPprAssimetrico = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "conjunta",
  rubricasPorPessoa: [rubricasA, rubricasB],
  dependentes: [],
  pessoas: pessoasConjunta,
  // 3.120€ entregues só pela pessoaA (mesmo caso real do Dani) — a 20% dava
  // 624€, mas o teto de UM titular é 400€, não os 800€ do agregado.
  deducoesColeta: { pprPorPessoa: { pessoaA: 3120, pessoaB: 0 } },
});
assertIgual(
  declaracaoPprAssimetrico.linhas[8].ppr,
  400,
  "PPR de 3.120€ entregue só por um titular fica capado ao SEU teto (400€), não ao do agregado (800€)"
);

const declaracaoPprRepartido = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "conjunta",
  rubricasPorPessoa: [rubricasA, rubricasB],
  dependentes: [],
  pessoas: pessoasConjunta,
  // As mesmas entregas totais (3.120€), mas metade para cada titular —
  // cada metade (1.560€×20%=312€) fica dentro do teto individual de
  // 400€, por isso a dedução do agregado sobe para 624€ (312+312) —
  // exatamente o valor que o cálculo antigo (errado) dava sempre, mesmo
  // quando as entregas não estavam repartidas assim.
  deducoesColeta: { pprPorPessoa: { pessoaA: 1560, pessoaB: 1560 } },
});
assertIgual(
  declaracaoPprRepartido.linhas[8].ppr,
  624,
  "as mesmas 3.120€ entregues a meias pelos dois titulares deduzem 624€ (312€ cada, dentro do teto de cada um)"
);

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

// Regressão do bug corrigido 24/09/2026: a interpolação da alínea b) do
// n.º7 termina em 80.000€ (limiar do art.º 68º-A), NÃO no topo da tabela
// normal de escalões (86.634€ em 2026) — antes da correção, um rendimento
// coletável entre esses dois valores caía ainda na zona "a decrescer",
// dando um limite agregado ACIMA de 1.000€ (mais permissivo do que a lei
// permite). 86.800€ de bruto dá ≈81.413€ de rendimento coletável — já
// acima de 80.000€, logo o limite tem de ser exatamente 1.000€.
const zonaLimiteAntesDoBug = calcularDeclaracao({
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [[{ categoria: "A", tipo: "abono", descricao: "Vencimento bruto", valorComRedu: 86800 }]],
  dependentes: [],
  deducoesColeta: {},
});
assertIgual(
  zonaLimiteAntesDoBug.linhas[8].limiteAgregado,
  1000,
  "rendimento coletável ≈81.413€ (acima dos 80.000€ do art.º 68º-A) já dá o limite mínimo de 1.000€ — antes da correção dava ≈1.100€, porque a interpolação ia até 86.634€ em vez de 80.000€"
);

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

console.log("\n--- Encargos com lares (art.º 84º CIRS, 24/09/2026, a pedido do Dani) ---");
// 25% do valor suportado, com teto de 403,75€ POR BENEFICIÁRIO (não por
// quem paga nem pelo agregado) — ver texto legal citado em legislacao-2026.js.
assertIgual(
  deducoesDe({ pessoas: [{ id: "A", encargosLarAnual: 1000 }] }).lares,
  250,
  "sujeito passivo com 1.000€ de encargos: 25% = 250€ (dentro do teto de 403,75€)"
);
assertIgual(
  deducoesDe({ pessoas: [{ id: "A", encargosLarAnual: 5000 }] }).lares,
  403.75,
  "sujeito passivo com 5.000€ de encargos: 25% seria 1.250€, mas o teto por beneficiário é 403,75€"
);
assertIgual(deducoesDe({ pessoas: [{ id: "A" }] }).lares, 0, "sem encargosLarAnual preenchido, a dedução de lares é 0€");
// Dois beneficiários distintos (o próprio sujeito passivo E um ascendente)
// somam-se — cada um com o SEU teto de 403,75€, não um teto único partilhado.
// Ascendente: 25% de 1.200€ = 300€, dentro do teto (para testar a soma sem
// ambos ficarem capados, o que esconderia um bug de dupla contagem).
const laresDoisBeneficiarios = deducoesDe({
  pessoas: [{ id: "A", encargosLarAnual: 5000 }],
  ascendentes: [{ nome: "Mãe", encargosLarAnual: 1200 }],
});
assertIgual(
  laresDoisBeneficiarios.lares,
  403.75 + 300,
  "sujeito passivo (403,75€, capado) + ascendente (25% de 1.200€ = 300€, dentro do teto) = 703,75€ — tetos independentes por beneficiário"
);
assertIgual(laresDoisBeneficiarios.laresSujeitosPassivos, 403.75, "detalhe: parte do(s) sujeito(s) passivo(s) isolada para a UI");
assertIgual(laresDoisBeneficiarios.laresAscendentes, 300, "detalhe: parte dos ascendentes isolada para a UI");
// Lares é artigo à parte do 78º (art.º 84º) — não deve entrar no limite
// agregado do art.º 78º n.º7/8, tal como ascendentes/deficiência.
const laresForaDoLimite = deducoesDe({
  pessoas: [{ id: "A", encargosLarAnual: 5000 }],
  deducoesColeta: { saude: 100000 }, // força o limite agregado a aplicar-se a saúde
});
if (laresForaDoLimite.lares !== 403.75) {
  console.error("FALHOU: a dedução de lares não devia ser afetada pelo limite agregado do art.º 78º n.º7/8");
  process.exitCode = 1;
} else {
  console.log("OK: encargos com lares ficam fora do limite agregado do art.º 78º n.º7/8 (artigo à parte, art.º 84º)");
}

// compararRegimes: deduções à coleta "household" (saúde/educação/etc, sem
// NIF de quem pagou) não podem ser contadas em dobro quando se compara com
// separada — regressão do bug encontrado a 21/09/2026 a partir da pergunta
// do Dani "Por qué sale mejor hacer las declaraciones por separado?": cada
// declaração separada via a totalidade das despesas do casal, não metade.
// Rendimentos baixos de propósito (< 8.342€, 1º escalão) para que o teto
// agregado do art.º 78º n.º 7/8 fique em Infinity e não interfira no teste.
console.log("\n--- compararRegimes não duplica deduções partilhadas (saúde/educação) em separada ---");
const rubricasBaixaA = [{ categoria: "A", tipo: "abono", descricao: "Vencimento bruto", valorComRedu: 500 * 12 }];
const rubricasBaixaB = [{ categoria: "A", tipo: "abono", descricao: "Vencimento bruto", valorComRedu: 450 * 12 }];
const compPartilha = compararRegimes(
  { anoFiscal: 2026, deducoesColeta: { saude: 2000, educacao: 500 } },
  { rubricas: rubricasBaixaA, dependentesAtribuidos: [] },
  { rubricas: rubricasBaixaB, dependentesAtribuidos: [] },
  []
);
assertIgual(compPartilha.conjunta.linhas[8].saude, 300, "conjunta: saúde plena (15% de 2.000€) — não é dividida");
assertIgual(compPartilha.separada.A.linhas[8].saude, 150, "separada A: só metade da saúde do casal (15% de 1.000€)");
assertIgual(compPartilha.separada.B.linhas[8].saude, 150, "separada B: só metade da saúde do casal (15% de 1.000€)");
assertIgual(
  compPartilha.separada.A.linhas[8].saude + compPartilha.separada.B.linhas[8].saude,
  compPartilha.conjunta.linhas[8].saude,
  "separada A + separada B em saúde soma exatamente o mesmo que a conjunta (sem duplicar)"
);
assertIgual(compPartilha.conjunta.linhas[8].educacao, 150, "conjunta: educação plena (30% de 500€)");
assertIgual(compPartilha.separada.A.linhas[8].educacao + compPartilha.separada.B.linhas[8].educacao, 150, "separada A+B em educação soma o mesmo que a conjunta");

// ADSE do talão (categoriaADSE) soma-se à SS para a dedução específica de
// Categoria A — regressão do caso real do Dani (22/09/2026), confirmado
// reconstruindo os 12 talões reais de 2025 mês a mês: SS sozinha
// (6.559,41€) + ADSE sozinha (1.357,41€) = 7.916,82€, exatamente a coluna
// "Contribuições" da declaração real dele. Ou seja, essa coluna oficial já
// é SS+ADSE combinadas.
console.log("\n--- ADSE do talão soma-se à SS na dedução específica de Cat. A (art.º 25º/1-2) ---");
function deducaoEspecificaAComAdse(ssAnual, adseAnual) {
  const rubricas = [
    { categoria: "A", tipo: "abono", descricao: "Vencimento bruto", valorComRedu: 1200 * 14 },
    { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: ssAnual },
  ];
  if (adseAnual > 0) {
    rubricas.push({ categoria: "A", tipo: "desconto", descricao: "Adse", categoriaADSE: true, valorComRedu: adseAnual });
  }
  return calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas],
    dependentes: [],
    deducoesColeta: {},
  }).linhas[2].categoriaA;
}
assertIgual(deducaoEspecificaAComAdse(6559.41, 0), 6559.41, "só SS: dedução = SS (acima do valorFixo)");
assertIgual(deducaoEspecificaAComAdse(6559.41, 1357.41), 7916.82, "SS + ADSE somadas: dedução = 7.916,82€ (caso real do Dani, 2025)");

// Quotização para ordem profissional (art.º 25º/4 CIRS) — campo MANUAL em
// Perfil (pessoas[i].quotizacaoOrdemProfissionalAnual), NÃO vem de
// rubricas do talão: os 108€/ano do Dani (Ordem dos Enfermeiros) não
// aparecem em nenhum dos 12 talões reais de 2025 — é um pagamento à
// parte. Eleva o teto da dedução específica de Categoria A até 9×IAS, só
// quando esse teto ainda não foi atingido por outra via.
console.log("\n--- Quotização de ordem profissional (campo de Perfil) eleva o teto da dedução específica de Cat. A (art.º 25º/4) ---");
function deducaoEspecificaAComOrdemPerfil(ssAnual, ordemAnual) {
  const rubricas = [
    { categoria: "A", tipo: "abono", descricao: "Vencimento bruto", valorComRedu: 1200 * 14 },
    { categoria: "A", tipo: "desconto", descricao: "Segurança Social", categoriaSS: true, valorComRedu: ssAnual },
  ];
  return calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas],
    dependentes: [],
    pessoas: [{ id: "A", quotizacaoOrdemProfissionalAnual: ordemAnual }],
    deducoesColeta: {},
  }).linhas[2].categoriaA;
}

// SS baixa (3.000€, abaixo do valorFixo 4.587,09€) — sem ordem, usa-se o
// valor fixo tal e qual.
assertIgual(deducaoEspecificaAComOrdemPerfil(3000, 0), 4587.09, "sem quotização de ordem: dedução = valorFixo (8,54×IAS), SS abaixo do fixo não conta");
// Com 200€ de ordem, o valorFixo sobe para 4.587,09+200=4.787,09€ (ainda
// abaixo do teto elevado de 4.834,17€).
assertIgual(deducaoEspecificaAComOrdemPerfil(3000, 200), 4787.09, "com 200€ de ordem: dedução = valorFixo + ordem (ainda dentro do teto elevado)");
// Com 500€ de ordem, valorFixo+ordem (5.087,09€) excede o teto elevado
// (4.834,17€) — fica capado no teto.
assertIgual(deducaoEspecificaAComOrdemPerfil(3000, 500), 4834.17, "com 500€ de ordem: dedução capada no teto elevado (9×IAS = 4.834,17€), não sobe mais");
// Caso real do Dani: SS+ADSE já excede o teto elevado sozinha — quotização
// de ordem (108€) não muda nada, tal como confirma a Demonstração de
// Liquidação real dele.
assertIgual(deducaoEspecificaAComOrdemPerfil(7916.82, 0), 7916.82, "SS alta (caso real do Dani) sem ordem: dedução = SS total");
assertIgual(deducaoEspecificaAComOrdemPerfil(7916.82, 108), 7916.82, "SS alta (caso real do Dani) com ordem: dedução inalterada — SS já excede o teto elevado sozinha");

console.log("\n--- calcularDeducoesAColeta exportada com contexto parcial (barras de progresso, ui/ventana-deducoes.js) ---");
// Contexto parcial (sem regime/escalão/coletaTotal) — as categorias com
// teto fixo (saúde, educação, exigência de fatura, trabalho doméstico)
// têm de ficar exatas mesmo assim; regime ainda define corretamente o
// teto de despesasGerais e PPR mesmo sem o resto do contexto.
{
  const tabela2026 = obterTabelaFiscal(2026);
  const parcial = calcularDeducoesAColeta({
    deducoesColeta: { saude: 1000, educacao: 2000, despesasGerais: 10000, exigenciaFaturaOutras: 300, trabalhoDomestico: 5000, ppr: 2000 },
    tabela: tabela2026,
    regime: "conjunta",
    anoFiscal: 2026,
  });
  assertIgual(parcial.saude, 150, "barra saúde: 1.000€ × 15% = 150€ (teto 1.000€ não atingido)");
  assertIgual(parcial.limites.saude, 1000, "barra saúde: teto devolvido corretamente (1.000€)");
  assertIgual(parcial.despesasGerais, 500, "barra despesas gerais: 10.000€×35% capado no teto de casal (500€)");
  assertIgual(parcial.limites.despesasGerais, 500, "barra despesas gerais: teto de casal devolvido corretamente (500€, regime conjunta)");
  assertIgual(parcial.trabalhoDomestico, 200, "barra trabalho doméstico: 5.000€×5%=250€ capado no teto (200€)");
  assertIgual(parcial.limiteAgregado, null, "sem rendimentoPorQuociente conhecido, limite agregado fica por aplicar (null = Infinity) — evita um aviso falso no ecrã de Deduções");

  // PPR por titular (24/09/2026) — mesmo teste de contexto parcial, agora
  // com `pessoas` (2 titulares) e `pprPorPessoa` em vez do campo legado
  // `ppr`, tal como ui/ventana-deducoes.js passa depois da migração.
  const pessoasBarras = [{ id: "p1" }, { id: "p2" }];
  const parcialPprPorTitular = calcularDeducoesAColeta({
    deducoesColeta: { pprPorPessoa: { p1: 3120, p2: 500 } },
    pessoas: pessoasBarras,
    tabela: tabela2026,
    regime: "conjunta",
    anoFiscal: 2026,
  });
  assertIgual(parcialPprPorTitular.pprDetalhePorPessoa.p1.deducao, 400, "barra PPR do 1º titular: 3.120€×20%=624€, capado ao SEU teto (400€)");
  assertIgual(parcialPprPorTitular.pprDetalhePorPessoa.p2.deducao, 100, "barra PPR do 2º titular: 500€×20%=100€, dentro do seu próprio teto (400€)");
  assertIgual(parcialPprPorTitular.ppr, 500, "PPR total do agregado = soma das duas deduções por titular (400€+100€)");
  assertIgual(parcialPprPorTitular.limites.ppr, 800, "teto do agregado devolvido continua a ser a soma dos dois tetos (800€), para a linha 8 do desglose");
}
// Contexto completo (via calcularDeclaracao, como a Simulação faz) — a
// mesma função tem de devolver os mesmos `limites` para alimentar o
// detalhe da linha 8 em ui/ventana-14.js.
{
  const comContexto = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricasA],
    dependentes: [],
    deducoesColeta: { saude: 1200, educacao: 500 },
  }).linhas[8];
  assertIgual(comContexto.limites.saude, 1000, "detalhe linha 8 (Simulação): teto de saúde presente no resultado completo");
  assertIgual(comContexto.saude, 180, "detalhe linha 8 (Simulação): 1.200€×15%=180€, dentro do teto de 1.000€");
}

console.log("\n--- IRS Jovem (art.º 12º-B CIRS) — isenção com progressividade (24/09/2026) ---");
// Texto legal citado em data/legislacao-2026.js. `pessoas`/`rubricasPorPessoa`
// já vêm alinhados por índice em todos os chamadores existentes.
{
  const rubricasJovem20mil = [
    { categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 20000 },
  ];
  // 1º ano do regime (100% isento): a isenção (20.000€, bem abaixo do teto
  // de 29.542,15€) excede o próprio rendimento líquido depois da dedução
  // específica — imposto tem de ficar a 0€, seja qual for o valor exato
  // da dedução específica.
  const ano1 = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricasJovem20mil],
    dependentes: [],
    pessoas: [{ id: "jovem", dataNascimento: "2000-06-15", irsJovemAnoInicio: 2026 }],
    deducoesColeta: {},
  });
  assertIgual(ano1.linhas["5B"].total, 20000, "IRS Jovem, 1º ano: isenção = 100% de 20.000€ (sem clamping, abaixo do teto)");
  assertIgual(ano1.linhas[6].total, 0, "IRS Jovem, 1º ano: importância apurada = 0€ (isenção excede o rendimento líquido)");
}

{
  // Mecanismo "isenção com progressividade" (art.º 12º-B n.º 4 + art.º 22º
  // n.º 4 CIRS): corre-se a MESMA declaração com e sem o benefício, e
  // deriva-se o valor esperado a partir da própria taxa média que o motor
  // já calculou no cenário SEM benefício — sem repetir aqui a lógica de
  // procura do escalão, só a fórmula da isenção em si. Rendimento alto de
  // propósito (30.000€) para cair num escalão intermédio, onde a
  // diferença entre "taxa média sobre o rendimento total" e "taxa
  // marginal sobre a parte tributável" é claramente visível se a fórmula
  // estiver errada.
  const rubricas30mil = [{ categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 30000 }];
  const semBeneficio = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas30mil],
    dependentes: [],
    pessoas: [{ id: "jovem" }],
    deducoesColeta: {},
  });
  const rendimentoParaTaxa = semBeneficio.linhas[3].total; // sem ajuste de anos anteriores neste caso
  const taxaMedia = rendimentoParaTaxa > 0 ? semBeneficio.linhas[6].total / rendimentoParaTaxa : 0;

  // 2º ano do regime (75%): irsJovemAnoInicio = 2025 → anoDoRegime = 2026-2025+1 = 2.
  const comBeneficioAno2 = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas30mil],
    dependentes: [],
    pessoas: [{ id: "jovem", dataNascimento: "1998-01-01", irsJovemAnoInicio: 2025 }],
    deducoesColeta: {},
  });
  const isencaoEsperada = 0.75 * 30000; // 22.500€, abaixo do teto de 29.542,15€
  const rendimentoTributavelEsperado = Math.max(0, rendimentoParaTaxa - isencaoEsperada);
  const importanciaEsperada = Math.round(taxaMedia * rendimentoTributavelEsperado * 100) / 100;

  assertIgual(comBeneficioAno2.linhas["5B"].total, isencaoEsperada, "IRS Jovem, 2º ano (75%): isenção = 75% de 30.000€ = 22.500€");
  assertIgual(
    comBeneficioAno2.linhas[6].total,
    importanciaEsperada,
    "IRS Jovem, 2º ano: importância apurada = taxa média do rendimento TOTAL (sem benefício) aplicada à base já reduzida pela isenção"
  );
  // A isenção nunca pode reduzir o imposto para MENOS do que zero, nem
  // pode "poupar" mais do que o imposto total sem benefício.
  if (comBeneficioAno2.linhas[6].total >= semBeneficio.linhas[6].total) {
    console.error("FALHOU: o benefício do IRS Jovem devia reduzir o imposto face ao cenário sem benefício");
    process.exitCode = 1;
  } else {
    console.log("OK: IRS Jovem reduz o imposto face ao mesmo rendimento sem o benefício");
  }
}

{
  // Elegibilidade: fora da idade (>35 a 31/dez do ano fiscal) não tem
  // direito a isenção nenhuma, mesmo com irsJovemAnoInicio preenchido.
  const rubricas25mil = [{ categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 25000 }];
  const foraDaIdade = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas25mil],
    dependentes: [],
    pessoas: [{ id: "maisVelho", dataNascimento: "1988-01-01", irsJovemAnoInicio: 2020 }], // 38 anos em 2026
    deducoesColeta: {},
  });
  assertIgual(foraDaIdade.linhas["5B"].total, 0, "IRS Jovem: sem isenção para quem já passou dos 35 anos, mesmo com ano de início preenchido");

  // Regime esgotado (11º ano de rendimentos) — já não há isenção.
  const regimeEsgotado = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas25mil],
    dependentes: [],
    pessoas: [{ id: "esgotado", dataNascimento: "2000-01-01", irsJovemAnoInicio: 2015 }], // ano do regime = 12
    deducoesColeta: {},
  });
  assertIgual(regimeEsgotado.linhas["5B"].total, 0, "IRS Jovem: sem isenção depois de esgotados os 10 anos do regime");

  // Quem não ativou o regime (sem irsJovemAnoInicio) não é afetado, mesmo
  // sendo jovem — mesmo comportamento de sempre (regressão).
  const semRegimeAtivo = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricas25mil],
    dependentes: [],
    pessoas: [{ id: "naoAtivou", dataNascimento: "2000-01-01" }],
    deducoesColeta: {},
  });
  assertIgual(semRegimeAtivo.linhas["5B"].total, 0, "IRS Jovem: quem não ativou o regime em Perfil não recebe isenção nenhuma");
}

{
  // Teto de 55×IAS: rendimento alto o suficiente para a isenção calculada
  // exceder o teto — tem de ficar capada, não anulada.
  const rubricasAlto = [{ categoria: "A", tipo: "abono", descricao: "Remuneração base", valorComRedu: 50000 }];
  const comTeto = calcularDeclaracao({
    anoFiscal: 2026,
    regime: "individual",
    rubricasPorPessoa: [rubricasAlto],
    dependentes: [],
    pessoas: [{ id: "altoRendimento", dataNascimento: "2000-01-01", irsJovemAnoInicio: 2026 }], // 1º ano, 100%
    deducoesColeta: {},
  });
  assertIgual(comTeto.linhas["5B"].total, 29542.15, "IRS Jovem: isenção capada a 55×IAS (29.542,15€) quando 100% do rendimento excederia o teto");
}

console.log("\nTeste concluído" + (process.exitCode ? " COM FALHAS." : " sem exceções."));
