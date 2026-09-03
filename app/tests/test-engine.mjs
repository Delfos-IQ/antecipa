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
} from "../engine/calculo-irs.js";

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

console.log("\n--- Guarda partilhada: quociente e dedução divididos a meio ---");
// Pedido real de um validador ("Faltam os dependentes em guarda
// partilhada Dani") — a lógica já existia no motor (calcularQuocienteFamiliar
// e valorDeducaoPorDependente, ambas em engine/calculo-irs.js) mas nunca
// tinha sido verificada por nenhum teste. Compara o mesmo cenário
// (sujeito passivo individual, 1 dependente adulto sem data de nascimento,
// para não entrar nas majorações por idade) só variando guarda exclusiva
// vs. partilhada.
const baseIndividual = {
  anoFiscal: 2026,
  regime: "individual",
  rubricasPorPessoa: [rubricasA],
  deducoesColeta: {},
};

const rExclusiva = calcularDeclaracao({ ...baseIndividual, dependentes: [{ id: 1, nome: "Filho", guarda: "exclusiva" }] });
const rPartilhada = calcularDeclaracao({ ...baseIndividual, dependentes: [{ id: 1, nome: "Filho", guarda: "partilhada" }] });

// Quociente (linha 5): individual base 1,00 + 0,50 (exclusiva) ou + 0,25 (partilhada).
assertIgual(rExclusiva.linhas[5].total, 1.5, "quociente familiar com 1 dependente em guarda exclusiva = 1,00 + 0,50");
assertIgual(rPartilhada.linhas[5].total, 1.25, "quociente familiar com 1 dependente em guarda partilhada = 1,00 + 0,25");

// Dedução por dependente (linha 8, art.º 78º-A): 600€ base, metade (300€) se partilhada.
assertIgual(rExclusiva.linhas[8].porDependentes, 600, "dedução por dependente em guarda exclusiva = 600€ (valor base)");
assertIgual(rPartilhada.linhas[8].porDependentes, 300, "dedução por dependente em guarda partilhada = 300€ (metade do valor base)");

// A guarda partilhada nunca deve resultar num quociente ou dedução MAIOR
// do que a exclusiva — proteção contra uma futura regressão que inverta a
// condição por engano.
if (rPartilhada.linhas[5].total >= rExclusiva.linhas[5].total) {
  console.error("FALHOU: guarda partilhada devia dar um quociente familiar menor do que guarda exclusiva");
  process.exitCode = 1;
}
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
  assertIgual(oportunidadeSemPpr.tetoAnual, 800, "teto anual de dedução do PPR (simplificação v1, sem idade) = 800€");
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
  deducoesColeta: { ppr: 4000 }, // 4000 * 20% = 800€ = teto
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

console.log("\nTeste concluído" + (process.exitCode ? " COM FALHAS." : " sem exceções."));
