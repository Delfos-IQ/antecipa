// engine/numero.js
// Helpers numéricos partilhados pelo motor de cálculo (engine/calculo-irs.js
// e os submódulos de engine/deducoes/) — extraídos para aqui (13/10/2026,
// split de calculo-irs.js) só para evitar duplicar `round2`/`sum` em cada
// submódulo de dedução sem criar um import circular com calculo-irs.js.
// Refatoração pura: o comportamento é byte-a-byte igual ao que já existia
// como consts privadas no topo de calculo-irs.js.

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// NOTA (herdada de calculo-irs.js): a versão anterior não passava o índice a
// `fn`, pelo que qualquer chamador que distinguisse "1º" de "2º e
// seguintes" por posição (ex.: calcularDeducoesAColeta/porDependentes)
// ficava sempre a tratar todos os itens como "2º e seguintes" — bug
// silencioso, nunca dava erro, só um valor errado.
export const sum = (arr, fn) => arr.reduce((acc, x, i) => acc + (fn ? fn(x, i) : x), 0);
