// engine/projecao.js
// Sistema Real/Projetado — secção 7 do prompt de build.
//
// Para cada pessoa e cada um dos 12 meses do ano fiscal, decide se o mês
// tem dados REAIS (documento carregado) ou se precisa de ser PROJETADO, e
// aplica a lógica de projeção por componente (nunca um multiplicador
// global). Um ajuste manual do utilizador substitui a projeção por defeito
// até que um documento real chegue para esse mês — nesse momento o ajuste
// é descartado automaticamente.

const MESES_SUBSIDIO = { ferias: 8, natal: 12 }; // meses legais de pagamento, ajustável por empresa/uso

function media(valores) {
  if (!valores.length) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/**
 * @param {Object} params
 * @param {Array<{mes:number, rubricas:Array}>} params.documentosReais - por mês, já ordenado
 * @param {Array<Object>} params.ajustesManuais - registos de storage/db.js
 * @param {number} params.anoFiscal
 * @returns {{mesAMes: Array, percentagemMesesReais: number, rubricasProjetadasTotais: Array}}
 */
export function projetarAno({ documentosReais, ajustesManuais, anoFiscal }) {
  const mesesComReal = new Set(documentosReais.map((d) => d.mes));
  const mesAMes = [];

  // Extrai série de remuneração base A por mês real, para repetir o último valor.
  const baseA = [];
  const variaveis = { trabalhoNoturno: [], trabalhoSuplementar: [], finsDeSemana: [] };
  const categoriaB = [];

  for (const doc of documentosReais) {
    for (const r of doc.rubricas) {
      if (r.tipo !== "abono") continue;
      if (r.categoria === "A" && /remunera[cç][aã]o base/i.test(r.descricao || "")) baseA.push({ mes: doc.mes, valor: r.valorComRedu ?? r.valorSemRedu });
      if (r.categoria === "A" && /noturno/i.test(r.descricao || "")) variaveis.trabalhoNoturno.push(r.valorComRedu ?? r.valorSemRedu);
      if (r.categoria === "A" && /suplementar|extra/i.test(r.descricao || "")) variaveis.trabalhoSuplementar.push(r.valorComRedu ?? r.valorSemRedu);
      if (r.categoria === "A" && /fim.?de.?semana/i.test(r.descricao || "")) variaveis.finsDeSemana.push(r.valorComRedu ?? r.valorSemRedu);
      if (r.categoria === "B") categoriaB.push(r.valorComRedu ?? r.valorSemRedu);
    }
  }

  const ultimaBase = baseA.length ? baseA[baseA.length - 1].valor : 0;
  const medias = {
    trabalhoNoturno: media(variaveis.trabalhoNoturno),
    trabalhoSuplementar: media(variaveis.trabalhoSuplementar),
    finsDeSemana: media(variaveis.finsDeSemana),
  };
  const catBStats = categoriaB.length
    ? { min: Math.min(...categoriaB), media: media(categoriaB), max: Math.max(...categoriaB) }
    : { min: 0, media: 0, max: 0 };

  for (let mes = 1; mes <= 12; mes++) {
    if (mesesComReal.has(mes)) {
      const doc = documentosReais.find((d) => d.mes === mes);
      mesAMes.push({ mes, origem: "real", rubricas: doc.rubricas });
      continue;
    }

    const ajuste = ajustesManuais.filter((a) => a.mes === mes && a.anoFiscal === anoFiscal);
    const ajustePorComponente = new Map(ajuste.map((a) => [a.componente, a]));

    const rubricasProjetadas = [];

    // Remuneração base — repete último valor conhecido.
    const compBase = "remuneracao_base";
    const valorBase = ajustePorComponente.has(compBase) ? ajustePorComponente.get(compBase).valorAjustado : ultimaBase;
    if (valorBase > 0) {
      rubricasProjetadas.push({
        categoria: "A",
        tipo: "abono",
        descricao: "Remuneração base (projetado)",
        valorComRedu: valorBase,
        origem: ajustePorComponente.has(compBase) ? "projetado_ajustado" : "projetado",
        origemDetalhe: `Repete o último valor conhecido: ${ultimaBase.toFixed(2)} €`,
      });
    }

    // Componentes variáveis — média dos meses já carregados.
    for (const [chave, label, descricao] of [
      ["trabalhoNoturno", "trabalho_noturno", "Trabalho noturno"],
      ["trabalhoSuplementar", "trabalho_suplementar", "Trabalho suplementar"],
      ["finsDeSemana", "fins_de_semana", "Fins de semana"],
    ]) {
      const valorDefeito = medias[chave];
      if (valorDefeito <= 0 && !ajustePorComponente.has(label)) continue;
      const valor = ajustePorComponente.has(label) ? ajustePorComponente.get(label).valorAjustado : valorDefeito;
      rubricasProjetadas.push({
        categoria: "A",
        tipo: "abono",
        descricao: `${descricao} (projetado)`,
        valorComRedu: valor,
        origem: ajustePorComponente.has(label) ? "projetado_ajustado" : "projetado",
        origemDetalhe: `Média dos meses já carregados: ${valorDefeito.toFixed(2)} €`,
      });
    }

    // Subsídios de férias/Natal — calculados a partir da base conhecida,
    // atribuídos apenas aos meses legais (não promediados pelos outros meses).
    if ((mes === MESES_SUBSIDIO.ferias || mes === MESES_SUBSIDIO.natal) && ultimaBase > 0) {
      const label = mes === MESES_SUBSIDIO.ferias ? "subsidio_ferias" : "subsidio_natal";
      const valor = ajustePorComponente.has(label) ? ajustePorComponente.get(label).valorAjustado : ultimaBase;
      rubricasProjetadas.push({
        categoria: "A",
        tipo: "abono",
        descricao: `${mes === MESES_SUBSIDIO.ferias ? "Subsídio de férias" : "Subsídio de Natal"} (projetado)`,
        valorComRedu: valor,
        origem: ajustePorComponente.has(label) ? "projetado_ajustado" : "projetado",
        origemDetalhe: `Igual à remuneração base conhecida: ${ultimaBase.toFixed(2)} €`,
      });
    }

    // Categoria B — mostrado como intervalo, usa a média como valor de cálculo.
    if (catBStats.media > 0) {
      const label = "categoria_b";
      const valor = ajustePorComponente.has(label) ? ajustePorComponente.get(label).valorAjustado : catBStats.media;
      rubricasProjetadas.push({
        categoria: "B",
        tipo: "abono",
        descricao: "Recibo verde (projetado — média)",
        valorComRedu: valor,
        origem: ajustePorComponente.has(label) ? "projetado_ajustado" : "projetado",
        origemDetalhe: `Intervalo observado: ${catBStats.min.toFixed(2)}–${catBStats.max.toFixed(2)} € (média ${catBStats.media.toFixed(2)} €)`,
        intervalo: catBStats,
      });
    }

    mesAMes.push({ mes, origem: "projetado", rubricas: rubricasProjetadas });
  }

  const percentagemMesesReais = round1(mesesComReal.size / 12);

  return { mesAMes, percentagemMesesReais, catBStats, medias, ultimaBase };
}

function round1(n) {
  return Math.round(n * 1000) / 1000;
}

/** Achata mesAMes num único array de rubricas, para alimentar o motor de cálculo. */
export function achatarRubricasDoAno(mesAMes) {
  return mesAMes.flatMap((m) => m.rubricas);
}
