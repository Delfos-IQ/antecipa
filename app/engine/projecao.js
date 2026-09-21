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

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * @param {Object} params
 * @param {Array<{mes:number, rubricas:Array}>} params.documentosReais - por mês, já ordenado
 * @param {Array<Object>} params.ajustesManuais - registos de storage/db.js
 * @param {number} params.anoFiscal
 * @param {string} [params.atividadeCategoriaB] - chave escolhida em Perfil (ver data/i18n.js
 *   atividadeCategoriaBOpcoes) — usada só para projetar a retenção na fonte estimada dos
 *   meses de Categoria B ainda sem documento real (ver bloco "Categoria B" abaixo).
 * @param {Object} [params.taxasRetencaoCategoriaB] - tabela.taxasRetencaoCategoriaB do ano
 *   fiscal em causa (data/legislacao-2026.js) — omitido = nenhuma retenção projetada
 *   (comportamento anterior a 04/09/2026, preservado para chamadores antigos).
 * @returns {{mesAMes: Array, percentagemMesesReais: number, rubricasProjetadasTotais: Array}}
 */
export function projetarAno({ documentosReais, ajustesManuais, anoFiscal, atividadeCategoriaB, taxasRetencaoCategoriaB }) {
  const mesesComReal = new Set(documentosReais.map((d) => d.mes));
  const mesAMes = [];

  // Extrai série de remuneração base A por mês real, para repetir o último valor.
  //
  // Correção crítica (reportado pelo Dani, set/2026): o regex abaixo só
  // reconhecia "Remuneração base" — mas ui/components/confirmacao.js
  // (rubricasFinaisDoResumo) grava SEMPRE o bruto do talão com a descrição
  // "Vencimento bruto" (é a única forma como a app real produz esta
  // rubrica; "Remuneração base" só existia nos fixtures de
  // tests/test-engine.mjs, nunca nos dados reais). Resultado: baseA nunca
  // tinha nenhum valor, ultimaBase ficava sempre 0, e TODOS os meses
  // projetados (sem documento carregado) ficavam com 0€ de Categoria A —
  // mesmo para quem trabalha os 12 meses do ano. Isto subestimava
  // drasticamente o rendimento anual projetado de qualquer utilizador com
  // menos de 12 meses de talões carregados.
  const baseA = [];
  const variaveis = { trabalhoNoturno: [], trabalhoSuplementar: [], finsDeSemana: [] };
  const categoriaB = [];
  // Bruto e descontos reais de Categoria A, para calcular uma TAXA EFETIVA
  // MÉDIA (desconto ÷ bruto) por tipo de desconto — ver bloco "Descontos de
  // Categoria A" abaixo (21/09/2026, reportado pelo Dani: "continuo sin
  // saber si estimas las diferentes rúbricas [IRS retido, SS, sindicato,
  // ADSE] y las incluyes en el cálculo" — resposta honesta na altura foi
  // que NÃO, só o bruto era projetado).
  let brutoCategoriaAReal = 0;
  const descontosCategoriaAReais = { irs: 0, ss: 0, sindicato: 0, adse: 0 };

  for (const doc of documentosReais) {
    const brutoDoDoc = doc.rubricas
      .filter((r) => r.tipo === "abono" && r.categoria === "A")
      .reduce((s, r) => s + (r.valorComRedu ?? r.valorSemRedu ?? 0), 0);
    brutoCategoriaAReal += brutoDoDoc;
    for (const r of doc.rubricas) {
      if (r.categoria === "A" && r.tipo === "desconto") {
        if (r.categoriaIRS) descontosCategoriaAReais.irs += r.valorComRedu ?? 0;
        else if (r.categoriaSS) descontosCategoriaAReais.ss += r.valorComRedu ?? 0;
        else if (r.categoriaSindicato) descontosCategoriaAReais.sindicato += r.valorComRedu ?? 0;
        else if (r.categoriaADSE) descontosCategoriaAReais.adse += r.valorComRedu ?? 0;
      }
      if (r.tipo !== "abono") continue;
      if (r.categoria === "A" && /vencimento\s*bruto|remunera[cç][aã]o base/i.test(r.descricao || "")) baseA.push({ mes: doc.mes, valor: r.valorComRedu ?? r.valorSemRedu });
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

  // Taxa efetiva média de cada desconto de Categoria A sobre o bruto real
  // (ex.: se em 9 meses reais o IRS retido somou 14% do bruto total, cada
  // mês projetado aplica 14% ao SEU bruto projetado). É a mesma lógica de
  // "repetir o padrão já conhecido" usada no resto deste ficheiro — não
  // tenta replicar as tabelas de retenção oficiais (essas variam por
  // escalão/situação familiar e não estão modeladas para Categoria A), mas
  // é claramente melhor do que 0€, que era o comportamento anterior e
  // subestimava sistematicamente as retenções acumuladas (linha 10) e a
  // base de Segurança Social usada nas deduções específicas (art.º 25º
  // CIRS) para qualquer mês ainda sem documento.
  const taxasEfetivasCategoriaA =
    brutoCategoriaAReal > 0
      ? {
          irs: descontosCategoriaAReais.irs / brutoCategoriaAReal,
          ss: descontosCategoriaAReais.ss / brutoCategoriaAReal,
          sindicato: descontosCategoriaAReais.sindicato / brutoCategoriaAReal,
          adse: descontosCategoriaAReais.adse / brutoCategoriaAReal,
        }
      : { irs: 0, ss: 0, sindicato: 0, adse: 0 };

  // Retenção na fonte estimada para os meses de Categoria B ainda SEM
  // documento real (04/09/2026, a pedido do Dani). Antes desta alteração,
  // meses projetados de Categoria B só recebiam o rendimento bruto
  // (abono), nunca uma retenção — o que subestimava sistematicamente as
  // "Retenções na Fonte acumuladas" (linha 10) para quem tem recibos
  // verdes ainda por documentar, mesmo quando não está isento. Documentos
  // REAIS continuam a usar sempre a retenção que consta do próprio
  // documento, seja qual for a taxa aplicada pelo cliente — isto só afeta
  // a PROJEÇÃO dos meses em falta.
  //
  // Estimativa aproximada (não é uma exigência de rigor absoluto, é uma
  // projeção): total anual de Categoria B ≈ soma dos meses reais + média
  // desses meses × meses projetados. Comparado com o limite de isenção do
  // art.º 101º-B (15.000€/ano) para decidir se há retenção a projetar.
  const totalCategoriaBReal = categoriaB.reduce((a, b) => a + b, 0);
  const mesesProjetadosCount = 12 - mesesComReal.size;
  const estimativaAnualCategoriaB = totalCategoriaBReal + catBStats.media * mesesProjetadosCount;
  const taxaRetencaoAplicavel = taxasRetencaoCategoriaB
    ? taxasRetencaoCategoriaB[atividadeCategoriaB] ?? taxasRetencaoCategoriaB.servicosGeral
    : null;
  const isentoPorLimiteAnual = !!taxasRetencaoCategoriaB && estimativaAnualCategoriaB < taxasRetencaoCategoriaB.limiteIsencaoAnual;

  for (let mes = 1; mes <= 12; mes++) {
    if (mesesComReal.has(mes)) {
      // Correção (reportado pelo Dani, set/2026): quando uma pessoa tem MAIS DE
      // UM documento no mesmo mês (ex.: talão + recibo verde, ou dois recibos
      // verdes), usar apenas .find() pegava só o primeiro documento desse mês e
      // descartava silenciosamente os restantes do cálculo real — mesmo esses
      // valores sendo corretamente somados acima para estimar a média dos meses
      // projetados. Agora juntamos as rubricas de TODOS os documentos desse mês.
      const rubricasDoMes = documentosReais.filter((d) => d.mes === mes).flatMap((d) => d.rubricas);
      mesAMes.push({ mes, origem: "real", rubricas: rubricasDoMes });
      continue;
    }

    const ajuste = ajustesManuais.filter((a) => a.mes === mes && a.anoFiscal === anoFiscal);
    const ajustePorComponente = new Map(ajuste.map((a) => [a.componente, a]));

    const rubricasProjetadas = [];

    // Vencimento bruto — repete o último valor real conhecido. A
    // descrição diz "Vencimento bruto", não "Remuneração base" (21/09/2026,
    // pergunta direta do Dani: "en la proyección sería 'remuneracion base'
    // o 'vencimento bruto'?") — porque é EXATAMENTE isso que está a
    // repetir: o bruto agregado de um mês real inteiro (ver
    // ui/components/confirmacao.js, rubricasFinaisDoResumo, que é quem
    // produz "Vencimento bruto" nos meses reais), não uma "remuneração
    // base" no sentido estrito de excluir horas extra/prémios desse mês —
    // essa distinção nem é modelada, o parser já agrega tudo num só valor.
    // O nome do componente (`remuneracao_base`, usado por ajustesManuais)
    // mantém-se por estabilidade de dados já gravados; só o texto mostrado
    // ao utilizador mudou.
    const compBase = "remuneracao_base";
    const temAjusteBase = ajustePorComponente.has(compBase);
    const valorBase = temAjusteBase ? ajustePorComponente.get(compBase).valorAjustado : ultimaBase;
    // CORRIGIDO 21/09/2026 (relatado pelo Dani: "las tarjetas proyectadas ya
    // no estan expandidas"): a condição era `valorBase > 0`, o que fazia
    // sentido enquanto só existia o valor automático (ultimaBase) — sem
    // nenhum documento real ainda, não há nada para mostrar. Mas agora que
    // o campo aceita 0,00€ como ajuste manual explícito (correção anterior,
    // "al eliminar los valores... el total no se mueve"), um utilizador que
    // apague o vencimento bruto de um mês (a dizer "não vou trabalhar esse
    // mês") ficava com a rubrica toda omitida da app — incluindo o próprio
    // campo editável e o botão "repor estimativa automática" — sem forma
    // de voltar atrás pela interface. Agora, um ajuste manual explícito
    // (mesmo que seja 0€) continua sempre a aparecer, só o valor automático
    // (sem ajuste nenhum) é que precisa de ser positivo para aparecer.
    if (valorBase > 0 || temAjusteBase) {
      rubricasProjetadas.push({
        categoria: "A",
        tipo: "abono",
        descricao: "Vencimento bruto (projetado)",
        valorComRedu: valorBase,
        origem: temAjusteBase ? "projetado_ajustado" : "projetado",
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
        origemDetalhe: `Igual ao vencimento bruto conhecido: ${ultimaBase.toFixed(2)} €`,
      });
    }

    // Descontos de Categoria A (IRS retido, Segurança Social, Sindicato,
    // ADSE) — aplicados à taxa efetiva média (ver acima) sobre o bruto
    // projetado deste mês (base + variáveis + subsídio, se aplicável).
    // Sem isto, um mês projetado só tinha o valor ILÍQUIDO, nunca nenhum
    // desconto — o que inflacionava artificialmente tanto o Rendimento
    // Global (ainda que corretamente bruto) como, mais grave, subestimava
    // as Retenções na Fonte acumuladas (linha 10): na realidade a entidade
    // patronal continua a reter IRS/SS todos os meses, incluindo os ainda
    // sem talão carregado — só não sabíamos ainda o valor exato.
    const brutoProjetadoMesA = rubricasProjetadas
      .filter((r) => r.categoria === "A" && r.tipo === "abono")
      .reduce((s, r) => s + r.valorComRedu, 0);
    if (brutoProjetadoMesA > 0) {
      for (const [chave, descricao, flag] of [
        ["irs", "IRS retido (projetado)", "categoriaIRS"],
        ["ss", "Segurança Social (projetado)", "categoriaSS"],
        ["sindicato", "Sindicato (projetado)", "categoriaSindicato"],
        ["adse", "ADSE (projetado)", "categoriaADSE"],
      ]) {
        const taxa = taxasEfetivasCategoriaA[chave];
        if (taxa <= 0) continue;
        rubricasProjetadas.push({
          categoria: "A",
          tipo: "desconto",
          [flag]: true,
          descricao,
          valorComRedu: round2(brutoProjetadoMesA * taxa),
          origem: "projetado",
          origemDetalhe: `Taxa efetiva média observada nos meses reais: ${(taxa * 100).toFixed(1)}% do bruto`,
        });
      }
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

      // Retenção na fonte estimada sobre este valor projetado (ver nota
      // acima) — só se houver uma tabela de taxas para o ano fiscal, o
      // limite de isenção anual não for atingido, e a retenção calculada
      // não ficar abaixo do limite de dispensa por retenção (25€, art.º
      // 101º-B).
      if (taxaRetencaoAplicavel != null && !isentoPorLimiteAnual) {
        const retencaoEstimada = round2(valor * taxaRetencaoAplicavel);
        if (retencaoEstimada >= taxasRetencaoCategoriaB.limiteIsencaoPorRetencao) {
          rubricasProjetadas.push({
            categoria: "B",
            tipo: "desconto",
            categoriaIRS: true,
            descricao: "Retenção na fonte estimada (projetado)",
            valorComRedu: retencaoEstimada,
            origem: "projetado",
            origemDetalhe:
              `${(taxaRetencaoAplicavel * 100).toFixed(1)}% sobre ${valor.toFixed(2)} € — estimativa anual de ` +
              `Categoria B: ${estimativaAnualCategoriaB.toFixed(2)} € (acima do limite de isenção de ` +
              `${taxasRetencaoCategoriaB.limiteIsencaoAnual}€, art.º 101º-B CIRS)`,
          });
        }
      }
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
