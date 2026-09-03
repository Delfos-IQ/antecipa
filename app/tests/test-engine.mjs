// Teste sintético rápido do motor de cálculo — NÃO faz parte do app,
// serve apenas para verificar nesta sessão que engine/calculo-irs.js
// corre sem erros e produz números plausíveis. Critério de aceitação
// real (secção 12) exige testar contra uma Demonstração de Liquidação
// verdadeira, o que só o utilizador pode fornecer.

import { calcularDeclaracao, compararRegimes } from "../engine/calculo-irs.js";

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

console.log("\nTeste concluído" + (process.exitCode ? " COM FALHAS." : " sem exceções."));
