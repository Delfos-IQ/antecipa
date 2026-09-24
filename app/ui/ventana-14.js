// ui/ventana-14.js
// Ventana 14 — Simulação (secção 8.4): selo + desglose 1→25 (adaptado às
// 11 etapas do motor, cada uma referenciando a linha oficial equivalente)
// + modo comparação + disclaimer + exportação PDF.

import { pt } from "../data/i18n.js";
import {
  getHousehold,
  getPessoas,
  getDependentes,
  getAscendentes,
  getTodasRubricas,
  getAjustesManuais,
  getDeducoesColeta,
  saveAjusteManual,
  removeAjusteManual,
} from "../storage/db.js";
import { projetarAno, achatarRubricasDoAno } from "../engine/projecao.js";
import { calcularDeclaracao, compararRegimes, detectarOportunidadePPR, detectarOportunidadeMaisValias, detectarSugestoesPagamento } from "../engine/calculo-irs.js";
import { obterTabelaFiscal } from "../data/legislacao-2026.js";
import { exportarPdfPessoal, exportarPdfContabilista } from "../export/pdf-export.js";

function formatarMoeda(v) {
  // O espaço que o Intl insere antes do símbolo é um nbsp (U+00A0) — numa
  // fonte monoespaçada isso ocupa a largura de um caractere inteiro e o
  // "€" fica visualmente desligado do valor. Substitui-se por um espaço
  // reduzido via CSS (ver .moeda em style.css).
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" })
    .format(v ?? 0)
    .replace(" €", '<span class="moeda">€</span>');
}

const LABELS_LINHA = {
  1: "Rendimento Global",
  2: "Deduções Específicas",
  3: "Rendimento Coletável",
  4: "Ajuste anos anteriores",
  5: "Quociente Familiar",
  6: "Importância Apurada",
  "6A": "Taxa Adicional de Solidariedade",
  7: "Coleta Total",
  8: "Deduções à Coleta",
  9: "Coleta Líquida",
  10: "Retenções na Fonte acumuladas",
  11: "Resultado",
};

export async function renderVentana14({ container, anoFiscal }) {
  container.innerHTML = `<p class="muted">A calcular…</p>`;

  const household = await getHousehold();
  const pessoas = await getPessoas();
  const dependentes = await getDependentes();
  const ascendentes = await getAscendentes();
  const { documentos, rubricas } = await getTodasRubricas(anoFiscal);
  let ajustes = await getAjustesManuais(anoFiscal);
  const deducoesColeta = await getDeducoesColeta(anoFiscal, "household");

  if (documentos.length === 0 && ajustes.length === 0) {
    container.innerHTML = `
      <h2>${pt.ventana14.titulo}</h2>
      <div class="empty-state-card">
        ${iconeSimulacaoVazia()}
        <h3>${pt.ventana14.vazioTitulo}</h3>
        <p>${pt.ventana14.vazioCorpo}</p>
        <button class="btn btn-primary" data-action="ir-mensal">${pt.ventana14.vazioCta}</button>
      </div>
    `;
    container.querySelector('[data-action="ir-mensal"]')?.addEventListener("click", () => {
      document.querySelector('[data-rota="mensal"]')?.click();
    });
    return;
  }

  // taxasRetencaoCategoriaB (04/09/2026): só existe para projetar a
  // retenção estimada dos meses de Categoria B ainda sem documento real —
  // ver engine/projecao.js. Se o ano fiscal não tiver este bloco (ex.:
  // legislação de um ano futuro ainda não atualizada), fica undefined e
  // projetarAno simplesmente não projeta nenhuma retenção (mesmo
  // comportamento de antes desta funcionalidade).
  const tabelaFiscal = obterTabelaFiscal(anoFiscal);
  const regime = household?.regimeTributacao ?? "individual";

  // modoCalculo (21/09/2026, pedido do Dani: "como sé que es la mejor
  // proyección si yo no participo, no puedo editarla ni validarla"): até
  // aqui a simulação incluía SEMPRE a projeção dos meses em falta, sem
  // forma de a desligar nem de ver o que ela assume. Agora o utilizador
  // escolhe entre "projetado" (comportamento anterior, projeta os meses
  // sem documento) e "somenteReal" (ignora-os por completo — só conta o
  // que já está confirmado por documento). `calcular()` reconstrói tudo a
  // partir do zero sempre que este modo muda, ou sempre que um ajuste
  // manual é gravado/removido no painel de detalhe (ver
  // renderDetalheProjecao mais abaixo).
  let modoCalculo = "projetado";

  function calcular() {
    const rubricasPorPessoa = [];
    for (const p of pessoas) {
      const docsDaPessoa = documentos
        .filter((d) => d.pessoaId === p.id)
        .map((d) => ({ mes: d.mes, rubricas: rubricas.filter((r) => r.documentoId === d.id) }))
        .sort((a, b) => a.mes - b.mes);
      const { mesAMes, percentagemMesesReais } = projetarAno({
        documentosReais: docsDaPessoa,
        ajustesManuais: ajustes.filter((a) => a.pessoaId === p.id),
        anoFiscal,
        atividadeCategoriaB: p.atividadeCategoriaB,
        taxasRetencaoCategoriaB: tabelaFiscal.taxasRetencaoCategoriaB,
      });
      const mesesConsiderados = modoCalculo === "somenteReal" ? mesAMes.filter((m) => m.origem === "real") : mesAMes;
      rubricasPorPessoa.push({
        pessoaId: p.id,
        rubricas: achatarRubricasDoAno(mesesConsiderados),
        percentagemMesesReais,
        // Sempre o ano completo (real + projetado), independentemente do
        // modoCalculo — é o que alimenta o painel de detalhe mês a mês,
        // que continua a mostrar a projeção mesmo quando ela não está a
        // ser usada no cálculo, para o utilizador poder rever/validar.
        mesAMes,
      });
    }

    const percentagemMediaReal =
      rubricasPorPessoa.reduce((a, p) => a + p.percentagemMesesReais, 0) / (rubricasPorPessoa.length || 1);

    // ADSE descontada no talão é tratada como despesa de saúde/seguro de
    // saúde para efeitos de dedução à coleta (art.º 78º-C CIRS) — ainda não
    // confirmado linha a linha contra fonte oficial (ver data/legislacao-2026.js),
    // por isso soma-se ao valor de despesas de saúde já indicado manualmente
    // pelo utilizador em vez de o substituir.
    const totalAdseAno = rubricasPorPessoa.reduce(
      (acc, p) => acc + p.rubricas.filter((r) => r.tipo === "desconto" && r.categoriaADSE).reduce((s, r) => s + (r.valorComRedu ?? 0), 0),
      0
    );
    const deducoesColetaComAdse = { ...deducoesColeta, saude: (deducoesColeta.saude ?? 0) + totalAdseAno };

    // pagamentosPorConta: adiantamentos de IRS já feitos durante o ano
    // (comuns em Categoria B/recibos verdes) — campo em falta até à
    // auditoria de 03/09/2026, confirmado como linha própria (23) numa
    // Demonstração de Liquidação real, subtraído junto com as retenções na
    // fonte (linha 24) para chegar ao resultado final (linha 25).
    const inputBase = {
      anoFiscal,
      deducoesColeta: deducoesColetaComAdse,
      pagamentosPorConta: deducoesColeta.pagamentosPorConta || 0,
      percentagemMesesReais: percentagemMediaReal,
    };

    let resultadoUnico = null;
    let comparacao = null;
    let oportunidades = [];

    if (regime === "comparar_ambos" && pessoas.length === 2) {
      // ascendentesAtribuidos segue a MESMA simplificação já existente para
      // dependentesAtribuidos: tudo atribuído a A por omissão, B fica sem
      // nenhum — atribuição por pessoa ainda não modelada nesta ventana em
      // modo comparação (04/09/2026, mesmo padrão pré-existente).
      comparacao = compararRegimes(
        inputBase,
        { rubricas: rubricasPorPessoa[0].rubricas, dependentesAtribuidos: dependentes, pessoa: pessoas[0], ascendentesAtribuidos: ascendentes },
        { rubricas: rubricasPorPessoa[1].rubricas, dependentesAtribuidos: [], pessoa: pessoas[1], ascendentesAtribuidos: [] },
        dependentes,
        ascendentes
      );
    } else {
      const inputResultadoUnico = {
        ...inputBase,
        regime: regime === "conjunta" ? "conjunta" : "individual",
        rubricasPorPessoa: rubricasPorPessoa.map((p) => p.rubricas),
        dependentes,
        pessoas,
        ascendentes,
      };
      resultadoUnico = calcularDeclaracao(inputResultadoUnico);
      // Oportunidades de poupança fiscal — só para o modo "resultado único"
      // por agora; em modo comparação (conjunta vs. separadas) fica por
      // implementar, pois o PPR/mais-valias podem ser atribuídos a qualquer
      // um dos dois sujeitos passivos e essa atribuição ainda não está
      // modelada.
      oportunidades = [
        detectarOportunidadePPR(inputResultadoUnico, resultadoUnico),
        detectarOportunidadeMaisValias(inputResultadoUnico, resultadoUnico),
      ].filter(Boolean);
    }

    return { resultadoUnico, comparacao, oportunidades, percentagemMediaReal, rubricasPorPessoa };
  }

  let { resultadoUnico, comparacao, oportunidades, percentagemMediaReal, rubricasPorPessoa } = calcular();

  // Regime que o utilizador está a explorar no ecrã de comparação
  // (conjunta vs. separada) — NOVO (21/09/2026, pedido do Dani): até aqui
  // o selo, o desglose e os PDFs seguiam sempre `comparacao.maisVantajoso`
  // (o regime objetivamente melhor), sem forma de ver os números do outro
  // regime lado a lado. Agora os dois cartões são clicáveis: tocar num
  // deles "seleciona-o" (anel azul, distinto do selo dourado "Mais
  // vantajoso", que continua a indicar qual é objetivamente melhor) e
  // tudo o resto do ecrã — selo, desglose, PDFs — passa a refletir o
  // regime selecionado, não necessariamente o mais vantajoso. Começa
  // sempre no mais vantajoso, tal como o comportamento anterior.
  let regimeSelecionado = comparacao?.maisVantajoso ?? null;
  // Preserva se o desglose estava aberto ao trocar de regime, para o
  // utilizador não ter de o reabrir a cada clique — só reinicia (fechado)
  // na primeira renderização.
  let desgloseAberto = false;
  // Painel "Ver detalhe mês a mês" (21/09/2026, ver comentário junto a
  // `modoCalculo` acima) — igual ao desglose, preserva-se aberto entre
  // re-renderizações (troca de modo, edição de um ajuste) para o
  // utilizador não perder o sítio onde estava a rever/corrigir.
  let detalheAberto = false;

  let estado = { resultadoUnico, comparacao, oportunidades, percentagemMediaReal, household, pessoas, dependentes, deducoesColeta, ajustes, rubricasPorPessoa };

  // Reexecuta calcular() do zero — chamado sempre que modoCalculo muda ou
  // um ajuste manual é gravado/removido no painel de detalhe — e volta a
  // renderizar tudo com o resultado novo. Se o regime selecionado no
  // ecrã de comparação deixar de fazer sentido (não deveria acontecer,
  // "conjunta"/"separada" são sempre as duas opções, mas por segurança)
  // recai no mais vantajoso.
  async function recalcular() {
    ajustes = await getAjustesManuais(anoFiscal);
    const novo = calcular();
    estado = { ...estado, ...novo, ajustes };
    if (estado.comparacao) {
      if (regimeSelecionado !== "conjunta" && regimeSelecionado !== "separada") regimeSelecionado = estado.comparacao.maisVantajoso;
    } else {
      regimeSelecionado = null;
    }
    render(estado);
  }

  render(estado);

  function render(estado) {
    const { resultadoUnico, comparacao, oportunidades } = estado;
    const resultadoParaSelo = comparacao
      ? regimeSelecionado === "conjunta"
        ? comparacao.conjunta.resultado
        : melhorSeparado(comparacao.separada)
      : resultadoUnico.resultado;

    // Desglose (toggle "ver cálculo completo" + os dois PDFs) tem de
    // corresponder SEMPRE ao mesmo regime mostrado no selo — bug corrigido
    // em 21/09/2026, reportado pelo Dani ("subi recibos e a simulação
    // continua igual"): em modo comparação, o desglose (e ambos os PDFs)
    // mostravam sempre `comparacao.conjunta`, um valor DIFERENTE do selo.
    // Agora segue `regimeSelecionado` (ver comentário acima): se
    // "separada" está selecionada, o desglose mostra as DUAS declarações
    // separadas (A e B), cada uma etiquetada com o nome do titular —
    // nunca a conjunta.
    const declaracoesParaDesglose = comparacao
      ? regimeSelecionado === "conjunta"
        ? [{ titulo: null, declaracao: comparacao.conjunta }]
        : [
            { titulo: estado.pessoas?.[0]?.nome, declaracao: comparacao.separada.A },
            { titulo: estado.pessoas?.[1]?.nome, declaracao: comparacao.separada.B },
          ]
      : [{ titulo: null, declaracao: resultadoUnico }];

    // Painel "Sugestões para pagar menos" (03/09/2026) — independente do
    // modo resultadoUnico/comparação, ao contrário de "oportunidades"
    // acima: só precisa do tipo do resultado final, do household e das
    // deduções já registadas, todos já disponíveis aqui.
    // mesesRestantes (04/09/2026): quantos meses do ano fiscal ainda NÃO
    // têm documento real — percentagemMediaReal já traz essa fração
    // (engine/projecao.js). Um ano totalmente carregado (ex.: simulação
    // retrospetiva de um ano fiscal já fechado) dá 0 meses restantes, e
    // detectarSugestoesPagamento sabe omitir a sugestão de retenção
    // superior nesse caso — não faz sentido pedir mais retenção a um ano
    // que já acabou.
    const percentagemMediaReal = estado.percentagemMediaReal;
    const mesesRestantes = Math.round((1 - percentagemMediaReal) * 12);
    const sugestoesPagamento = detectarSugestoesPagamento(
      { resultado: resultadoParaSelo },
      { household: estado.household, deducoesColeta: estado.deducoesColeta, mesesRestantes }
    );

    const confiancaTexto =
      modoCalculo === "somenteReal"
        ? `${pt.ventana14.confiancaSomenteRealPrefixo} ${Math.round(percentagemMediaReal * 100)}% ${pt.ventana14.confiancaSomenteRealSufixo}`
        : `${pt.ventana14.confiancaPrefixo} ${Math.round(percentagemMediaReal * 100)}% ${pt.ventana14.confiancaSufixo}`;

    container.innerHTML = `
      <h2>${pt.ventana14.titulo}</h2>

      <p class="section-title" style="margin-top:0">${pt.ventana14.modoCalculoTitulo}</p>
      <div class="modo-calculo-toggle" role="tablist">
        <button type="button" class="modo-calculo-toggle__btn" data-action="modo-calculo" data-modo="projetado" aria-pressed="${modoCalculo === "projetado"}">${pt.ventana14.modoCalculoProjetado}</button>
        <button type="button" class="modo-calculo-toggle__btn" data-action="modo-calculo" data-modo="somenteReal" aria-pressed="${modoCalculo === "somenteReal"}">${pt.ventana14.modoCalculoSomenteReal}</button>
      </div>
      <p class="field-hint">${modoCalculo === "somenteReal" ? pt.ventana14.modoCalculoAjudaSomenteReal : pt.ventana14.modoCalculoAjudaProjetado}</p>

      <div class="resultado-selo" data-tipo="${resultadoParaSelo.tipo}" style="margin-top:var(--space-4)">
        <div class="resultado-selo__label">${resultadoParaSelo.tipo === "a_devolver" ? pt.ventana14.aDevolver : pt.ventana14.aPagar}</div>
        <div class="resultado-selo__valor num">${formatarMoeda(resultadoParaSelo.valor)}</div>
        <div class="resultado-selo__confianca">${confiancaTexto}</div>
      </div>

      ${comparacao ? renderComparacao(comparacao, regimeSelecionado) : ""}

      ${sugestoesPagamento.length > 0 ? renderSugestoesPagamento(sugestoesPagamento) : ""}

      ${oportunidades.length > 0 ? renderOportunidades(oportunidades) : ""}

      <div class="row-between" style="margin-top:var(--space-5)">
        <button class="btn btn-secondary" data-action="toggle-desglose">${pt.ventana14.verCalculoCompleto}</button>
        <div class="row" style="gap:var(--space-2)">
          <button class="btn btn-ghost" data-action="pdf-pessoal">${pt.ventana14.exportarPessoal}</button>
          <button class="btn btn-ghost" data-action="pdf-contabilista">${pt.ventana14.exportarContabilista}</button>
        </div>
      </div>
      <div class="simulacao-layout" data-desglose-aberto="${desgloseAberto}">${desgloseAberto ? renderDesglose(declaracoesParaDesglose) : ""}</div>

      <div class="row-between" style="margin-top:var(--space-4)">
        <button class="btn btn-secondary" data-action="toggle-detalhe">${detalheAberto ? pt.ventana14.fecharDetalheProjecao : pt.ventana14.verDetalheProjecao}</button>
      </div>
      <div class="detalhe-projecao-wrap" style="margin-top:var(--space-3)">${detalheAberto ? renderDetalheProjecaoWrap(estado) : ""}</div>

      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    const layout = container.querySelector(".simulacao-layout");
    container.querySelector('[data-action="toggle-desglose"]').textContent = desgloseAberto
      ? pt.ventana14.fecharCalculoCompleto
      : pt.ventana14.verCalculoCompleto;
    container.querySelector('[data-action="toggle-desglose"]').addEventListener("click", () => {
      desgloseAberto = layout.dataset.desgloseAberto !== "true";
      layout.dataset.desgloseAberto = String(desgloseAberto);
      layout.innerHTML = desgloseAberto ? renderDesglose(declaracoesParaDesglose) : "";
      container.querySelector('[data-action="toggle-desglose"]').textContent = desgloseAberto
        ? pt.ventana14.fecharCalculoCompleto
        : pt.ventana14.verCalculoCompleto;
    });

    container.querySelectorAll('[data-action="modo-calculo"]').forEach((botao) => {
      botao.addEventListener("click", () => {
        const novoModo = botao.dataset.modo;
        if (novoModo === modoCalculo) return;
        modoCalculo = novoModo;
        recalcular();
      });
    });

    const detalheWrap = container.querySelector(".detalhe-projecao-wrap");
    container.querySelector('[data-action="toggle-detalhe"]').addEventListener("click", () => {
      detalheAberto = !detalheAberto;
      container.querySelector('[data-action="toggle-detalhe"]').textContent = detalheAberto
        ? pt.ventana14.fecharDetalheProjecao
        : pt.ventana14.verDetalheProjecao;
      detalheWrap.innerHTML = detalheAberto ? renderDetalheProjecaoWrap(estado) : "";
      if (detalheAberto) ligarEditoresDetalhe(detalheWrap);
    });
    if (detalheAberto) ligarEditoresDetalhe(detalheWrap);

    // Cartões de comparação clicáveis — trocar de regime explorado (ver
    // comentário junto a `regimeSelecionado` acima). Reexecuta render()
    // por completo para que selo, desglose (se estava aberto) e PDFs
    // fiquem todos consistentes com o novo regime selecionado.
    if (comparacao) {
      container.querySelectorAll("[data-action='selecionar-regime']").forEach((el) => {
        el.addEventListener("click", () => {
          const regime = el.dataset.regime;
          if (regime === regimeSelecionado) return;
          regimeSelecionado = regime;
          render(estado);
        });
      });
    }

    // Exportação em PDF é async (o cabeçalho carrega o badge da marca) —
    // envolvida em try/catch com alerta ao utilizador em caso de falha,
    // para não repetir o padrão de "falha assíncrona silenciosa" já
    // corrigido noutro sítio da app (confirmacao.js, 03/09/2026).
    container.querySelector('[data-action="pdf-pessoal"]').addEventListener("click", async (e) => {
      const botao = e.currentTarget;
      botao.disabled = true;
      try {
        await exportarPdfPessoal({
          resultado: resultadoParaSelo,
          percentagemMediaReal,
          household: estado.household,
          pessoas: estado.pessoas,
          declaracoes: declaracoesParaDesglose,
          anoFiscal,
        });
      } catch (err) {
        console.error("Falha ao exportar PDF pessoal:", err);
        alert("Não foi possível gerar o PDF. Tente novamente.");
      } finally {
        botao.disabled = false;
      }
    });
    container.querySelector('[data-action="pdf-contabilista"]').addEventListener("click", async (e) => {
      const botao = e.currentTarget;
      botao.disabled = true;
      try {
        await exportarPdfContabilista({
          declaracoes: declaracoesParaDesglose,
          documentos: [], // ver export/pdf-export.js — versão contabilista lê diretamente da BD
          anoFiscal,
          household: estado.household,
          pessoas: estado.pessoas,
        });
      } catch (err) {
        console.error("Falha ao exportar PDF contabilista:", err);
        alert("Não foi possível gerar o PDF. Tente novamente.");
      } finally {
        botao.disabled = false;
      }
    });

    // querySelectorAll porque "ir-deducoes" pode aparecer em mais do que
    // um sítio (oportunidade de PPR + sugestão de donativos, por exemplo)
    // — querySelector só ligaria o primeiro, deixando os restantes mudos.
    container.querySelectorAll('[data-action="ir-deducoes"]').forEach((botao) => {
      botao.addEventListener("click", () => document.querySelector('[data-rota="deducoes"]')?.click());
    });
    container.querySelectorAll('[data-action="ir-perfil"]').forEach((botao) => {
      botao.addEventListener("click", () => document.querySelector('[data-rota="perfil"]')?.click());
    });
  }

  // Liga os inputs editáveis do painel "Ver detalhe mês a mês" (21/09/2026)
  // — cada input representa um componente projetado (vencimento bruto ou
  // Categoria B) de um mês/pessoa. Gravar cria/atualiza um ajusteManual
  // (storage/db.js) e "Repor estimativa automática" apaga-o; os dois casos
  // acabam em recalcular(), que volta a correr projetarAno() com os
  // ajustes atualizados e re-renderiza tudo — selo, comparação, desglose e
  // este mesmo painel incluídos. Nested dentro de renderVentana14 (não é
  // uma função de topo, como renderDetalheProjecaoWrap) precisamente para
  // ter acesso direto a `anoFiscal` e `recalcular` por closure.
  function ligarEditoresDetalhe(escopo) {
    if (!escopo) return;
    escopo.querySelectorAll("[data-editor-componente]").forEach((input) => {
      input.addEventListener("change", async () => {
        const { pessoaId, componente } = input.dataset;
        const mes = Number(input.dataset.mes);
        // CORRIGIDO 21/09/2026 (relatado pelo Dani: "al eliminar los valores
        // de los recibos verdes, el total no se mueve"): apagar o campo por
        // completo (para dizer "este mês não vou ter recibo verde nenhum")
        // dava um input.value === "" → parseFloat("") = NaN →
        // !Number.isFinite(NaN) era true → a função saía sem gravar nada e
        // sem recalcular, como se a edição nunca tivesse acontecido. Um
        // campo vazio passa agora a valer 0 explicitamente (gravado como
        // ajuste manual, tal como qualquer outro valor) — só um número
        // negativo ou algo não numérico continua a ser ignorado.
        const textoValor = input.value.trim();
        const valor = textoValor === "" ? 0 : parseFloat(textoValor);
        if (!Number.isFinite(valor) || valor < 0) return;
        // Reutiliza o id do ajuste já existente para este mês/componente,
        // se houver — sem isto, db.put (keyPath "id", autoIncrement) criava
        // um registo NOVO a cada edição em vez de atualizar o mesmo, e
        // ajustePorComponente (engine/projecao.js, um Map por componente)
        // acabava só a ver o último — mas o storage ficava com duplicados.
        const existente = (estado.ajustes || []).find(
          (a) => a.pessoaId === pessoaId && a.mes === mes && a.componente === componente
        );
        await saveAjusteManual({
          ...(existente ? { id: existente.id } : {}),
          pessoaId,
          mes,
          anoFiscal,
          componente,
          valorAjustado: valor,
        });
        await recalcular();
      });
    });
    escopo.querySelectorAll("[data-repor-ajuste]").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const ajusteId = Number(botao.dataset.reporAjuste);
        await removeAjusteManual(ajusteId);
        await recalcular();
      });
    });
  }
}

function iconeSimulacaoVazia() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
}

function melhorSeparado(separada) {
  const valor = Math.abs(separada.total);
  // BUG corrigido (03/09/2026, relatado pelo Dani): esta condição estava
  // invertida. `separada.total` segue a convenção "sinal" definida em
  // engine/calculo-irs.js:compararRegimes — sinal(r) = +valor quando
  // a_devolver, -valor quando a_pagar — logo total POSITIVO significa
  // reembolso combinado (A+B), não pagamento. A versão anterior
  // (`total <= 0 ? "a_devolver" : "a_pagar"`) fazia o oposto: um casal a
  // quem ambos os titulares tinham reembolso (A e B a_devolver, logo total
  // positivo) via a app dizer "a pagar" com o valor do reembolso — e a
  // "diferença" mostrada por baixo (|totalConjunto - totalSeparado|) ficava
  // sem sentido aparente porque um dos dois lados tinha o sinal trocado.
  return { tipo: separada.total >= 0 ? "a_devolver" : "a_pagar", valor };
}

// `regimeSelecionado` (21/09/2026, pedido do Dani): os cartões passam a
// ser botões clicáveis — tocar num deles muda qual regime o resto do ecrã
// (selo, desglose, PDFs) mostra. O anel de seleção (data-selecionado) é
// visualmente distinto do selo "Mais vantajoso" (data-vantajoso, que nunca
// muda com o clique — indica sempre qual É objetivamente melhor); por
// omissão os dois coincidem, porque `regimeSelecionado` começa sempre no
// mais vantajoso.
function renderComparacao(comparacao, regimeSelecionado) {
  const totalA = comparacao.separada.A.resultado;
  const totalB = comparacao.separada.B.resultado;
  return `
    <div class="comparacao-grid">
      <button type="button" class="comparacao-card" data-action="selecionar-regime" data-regime="conjunta" data-vantajoso="${comparacao.maisVantajoso === "conjunta"}" data-selecionado="${regimeSelecionado === "conjunta"}" aria-pressed="${regimeSelecionado === "conjunta"}">
        <div class="comparacao-card__titulo">
          Declaração conjunta
          <span class="row" style="gap:6px">
            ${comparacao.maisVantajoso === "conjunta" ? `<span class="comparacao-card__badge">${pt.ventana14.maisVantajoso}</span>` : ""}
            ${regimeSelecionado === "conjunta" ? `<span class="comparacao-card__selecionada">✓ ${pt.ventana14.selecionada}</span>` : ""}
          </span>
        </div>
        <p class="num" style="font-size:1.4rem;margin-top:var(--space-2)">${formatarMoeda(comparacao.conjunta.resultado.valor)} <span class="muted" style="font-size:.85rem">${comparacao.conjunta.resultado.tipo === "a_devolver" ? "a devolver" : "a pagar"}</span></p>
      </button>
      <button type="button" class="comparacao-card" data-action="selecionar-regime" data-regime="separada" data-vantajoso="${comparacao.maisVantajoso === "separada"}" data-selecionado="${regimeSelecionado === "separada"}" aria-pressed="${regimeSelecionado === "separada"}">
        <div class="comparacao-card__titulo">
          Declarações separadas
          <span class="row" style="gap:6px">
            ${comparacao.maisVantajoso === "separada" ? `<span class="comparacao-card__badge">${pt.ventana14.maisVantajoso}</span>` : ""}
            ${regimeSelecionado === "separada" ? `<span class="comparacao-card__selecionada">✓ ${pt.ventana14.selecionada}</span>` : ""}
          </span>
        </div>
        <p class="num" style="font-size:1.4rem;margin-top:var(--space-2)">${formatarMoeda(Math.abs(comparacao.separada.total))} <span class="muted" style="font-size:.85rem">${comparacao.separada.total >= 0 ? "a devolver" : "a pagar"} (A+B)</span></p>
        <p class="muted" style="font-size:.82rem">A: ${formatarMoeda(totalA.valor)} ${totalA.tipo === "a_devolver" ? "↩" : "↪"} · B: ${formatarMoeda(totalB.valor)} ${totalB.tipo === "a_devolver" ? "↩" : "↪"}</p>
      </button>
    </div>
    <p class="field-hint" style="margin-top:var(--space-2)">${pt.ventana14.escolherComparacaoDica}</p>
    <p class="muted" style="margin-top:var(--space-3)">${pt.ventana14.diferenca}: <strong class="num">${formatarMoeda(comparacao.diferenca)}</strong></p>
  `;
}

// Painel "Sugestões para pagar menos" — pedido do utilizador (03/09/2026),
// só aparece quando o resultado final é "a pagar". Reaproveita o mesmo
// esqueleto visual do painel "Oportunidades" logo abaixo (.oportunidade-item),
// mas com o seu próprio aviso — a maioria destas sugestões não tem um
// valor de poupança calculado (ver comentário em
// engine/calculo-irs.js:detectarSugestoesPagamento sobre porquê).
function renderSugestoesPagamento(sugestoes) {
  const RENDERERS = {
    // 04/09/2026: quando o motor conseguiu calcular um valor mensal
    // sugerido (ver detectarSugestoesPagamento/mesesRestantes), usa-se a
    // variante de texto com o valor preenchido em vez da genérica.
    retencaoSuperior: (s) =>
      renderSugestaoSimples(
        "sugestaoRetencaoSuperiorTitulo",
        typeof s.valorMensalSugerido === "number"
          ? { texto: pt.ventana14.sugestaoRetencaoSuperiorCorpoComValor.replace("{valor}", formatarMoeda(s.valorMensalSugerido)) }
          : "sugestaoRetencaoSuperiorCorpo"
      ),
    compararRegimes: () =>
      renderSugestaoSimples("sugestaoCompararRegimesTitulo", "sugestaoCompararRegimesCorpo", {
        action: "ir-perfil",
        label: pt.ventana14.sugestaoCompararRegimesIrParaPerfil,
      }),
    donativos: () =>
      renderSugestaoSimples("sugestaoDonativosTitulo", "sugestaoDonativosCorpo", {
        action: "ir-deducoes",
        label: pt.ventana14.sugestaoDonativosIrParaDeducoes,
      }),
    duplaRenda: () => renderSugestaoSimples("sugestaoDuplaRendaTitulo", "sugestaoDuplaRendaCorpo"),
    horasExtra: () => renderSugestaoSimples("sugestaoHorasExtraTitulo", "sugestaoHorasExtraCorpo"),
  };
  return `
    <div class="oportunidades card" style="margin-top:var(--space-5)" data-tipo="sugestoes-pagamento">
      <p class="section-title" style="margin-top:0">${pt.ventana14.sugestoesPagamentoTitulo}</p>
      ${sugestoes.map((s) => RENDERERS[s.tipo]?.(s) ?? "").join("")}
      <p class="field-hint" style="margin-top:var(--space-3)">${pt.ventana14.sugestoesPagamentoAviso}</p>
    </div>
  `;
}

// chaveCorpo aceita a chave de i18n habitual (string) OU, quando o corpo
// já foi montado com um valor calculado em runtime (ex.: valor mensal
// sugerido de retenção, 04/09/2026), um objeto { texto } com o texto já
// pronto — evita ter de inventar uma chave de i18n só para um texto que
// nunca é estático.
function renderSugestaoSimples(chaveTitulo, chaveCorpo, botao) {
  const corpo = typeof chaveCorpo === "string" ? pt.ventana14[chaveCorpo] : chaveCorpo.texto;
  return `
    <div class="oportunidade-item">
      <p class="oportunidade-item__titulo">${pt.ventana14[chaveTitulo]}</p>
      <p class="field-hint">${corpo}</p>
      ${botao ? `<button class="btn btn-ghost" style="margin-top:var(--space-2)" data-action="${botao.action}">${botao.label}</button>` : ""}
    </div>
  `;
}

// Painel "Oportunidades de poupança fiscal" — pedido do utilizador
// (02/09/2026): mostrar, junto ao resultado da simulação, benefícios
// fiscais que o sujeito passivo ainda não está a aproveitar. Recebe a
// lista já filtrada (sem nulos) devolvida por cada detectarOportunidade*
// do motor — um `.oportunidade-item` por entrada, na ordem em que vêm.
function renderOportunidades(oportunidades) {
  const RENDERERS = { ppr: renderOportunidadePPR, maisValias: renderOportunidadeMaisValias };
  return `
    <div class="oportunidades card" style="margin-top:var(--space-5)">
      <p class="section-title" style="margin-top:0">${pt.ventana14.oportunidadesTitulo}</p>
      ${oportunidades.map((op) => RENDERERS[op.tipo]?.(op) ?? "").join("")}
      <p class="field-hint" style="margin-top:var(--space-3)">${pt.ventana14.oportunidadesAviso}</p>
    </div>
  `;
}

function renderOportunidadePPR(oportunidade) {
  // Já tem PPR registado (>0) → título/corpo dizem "tem margem", não "ainda
  // não tem" — ver comentário em data/i18n.js sobre este bug (03/09/2026).
  const temPprRegistado = (oportunidade.pprAtual || 0) > 0;
  const titulo = temPprRegistado ? pt.ventana14.oportunidadePprTituloComPpr : pt.ventana14.oportunidadePprTitulo;
  const corpo = temPprRegistado ? pt.ventana14.oportunidadePprCorpoComPpr : pt.ventana14.oportunidadePprCorpo;
  return `
    <div class="oportunidade-item">
      <p class="oportunidade-item__titulo">${titulo}</p>
      <p class="field-hint">
        ${oportunidade.titularNome ? `${oportunidade.titularNome}: ` : ""}${temPprRegistado ? `Já entregou ${formatarMoeda(oportunidade.pprAtual)}. ` : ""}${corpo}
        <strong class="num">${formatarMoeda(oportunidade.entregaNecessaria)}</strong>
        ${pt.ventana14.oportunidadePprLigacao}
        <strong class="num">${formatarMoeda(oportunidade.poupancaEstimada)}</strong>.
      </p>
      <button class="btn btn-ghost" style="margin-top:var(--space-2)" data-action="ir-deducoes">${pt.ventana14.oportunidadePprIrParaPerfil}</button>
    </div>
  `;
}

function renderOportunidadeMaisValias(oportunidade) {
  return `
    <div class="oportunidade-item">
      <p class="oportunidade-item__titulo">${pt.ventana14.oportunidadeMaisValiasTitulo}</p>
      <p class="field-hint">
        ${pt.ventana14.oportunidadeMaisValiasCorpo}
        <strong class="num">${formatarMoeda(oportunidade.valorMaisValias)}</strong>
        ${pt.ventana14.oportunidadeMaisValiasLigacao}
        <strong class="num">${formatarMoeda(oportunidade.poupancaEstimada)}</strong>.
      </p>
      <p class="field-hint" style="margin-top:var(--space-2)">${pt.ventana14.oportunidadeMaisValiasAviso}</p>
    </div>
  `;
}

// Ordem de apresentação explícita — Object.entries ordenaria "6A" antes de
// "7" mas depois de "11" (chaves numéricas sobem ao topo em JS, "6A" fica
// no fim por ser string), o que não corresponde à sequência oficial.
const ORDEM_LINHAS = [1, 2, 3, 4, 5, 6, "6A", 7, 8, 9, 10, 11];

// Linhas cujo valor não é uma cifra monetária (quociente é um rácio).
const LINHAS_NAO_MONETARIAS = new Set([5]);

// Detalhe por categoria da linha 8 (22/09/2026, pedido do Dani: replicar
// as barras de "dedução correspondente" do Portal das Finanças/e-Fatura,
// desta vez com os valores DEFINITIVOS — ao contrário da pré-visualização
// em ui/ventana-deducoes.js, aqui já corre depois de calcularDeclaracao,
// por isso o regime, o escalão e a coleta total já são reais, não
// estimativas). `linha.limites` vem pronto de calcularDeducoesAColeta em
// engine/calculo-irs.js — não se recalcula nada aqui, só se apresenta.
const CATEGORIAS_COM_TETO_LINHA8 = [
  { chave: "despesasGerais", label: "Despesas gerais familiares" },
  { chave: "saude", label: "Saúde" },
  { chave: "educacao", label: "Educação" },
  { chave: "habitacao", label: "Habitação" },
  { chave: "ppr", label: "PPR" },
  { chave: "exigenciaFatura", label: "Exigência de fatura" },
  { chave: "trabalhoDomestico", label: "Trabalho doméstico" },
  { chave: "donativos", label: "Donativos" },
];
const CATEGORIAS_SEM_TETO_LINHA8 = [
  { chave: "porDependentes", label: "Dependentes" },
  { chave: "porAscendentes", label: "Ascendentes a cargo" },
  { chave: "deficiencia", label: "Deficiência" },
  { chave: "lares", label: "Encargos com lares" },
  { chave: "duplaTributacao", label: "Dupla tributação internacional" },
];

function renderDetalheLinha8(linha) {
  const barras = CATEGORIAS_COM_TETO_LINHA8.filter(({ chave }) => (linha[chave] ?? 0) > 0 || (linha.limites?.[chave] ?? 0) > 0)
    .map(({ chave, label }) => {
      const valor = linha[chave] ?? 0;
      const limite = linha.limites?.[chave];
      const pct = limite ? Math.max(0, Math.min(100, Math.round((valor / limite) * 100))) : null;
      return `
        <div class="dedu-barra" style="margin-top:var(--space-3)">
          <div class="dedu-barra__linha">
            <span>${label}</span>
            <strong class="num">${formatarMoeda(valor)}</strong>
          </div>
          ${
            limite
              ? `<div class="dedu-barra__track"><div class="dedu-barra__fill" data-cheio="${pct >= 100}" style="width:${pct}%"></div></div>
                 <p class="dedu-barra__legenda">${pct}% do teto de ${formatarMoeda(limite)}</p>`
              : ""
          }
        </div>`;
    })
    .join("");

  const linhasSemTeto = CATEGORIAS_SEM_TETO_LINHA8.filter(({ chave }) => (linha[chave] ?? 0) > 0)
    .map(
      ({ chave, label }) => `
        <div class="desglose-linha" style="padding-left:var(--space-4)">
          <span></span>
          <span>${label}</span>
          <span class="desglose-linha__valor num">${formatarMoeda(linha[chave])}</span>
        </div>`
    )
    .join("");

  const notaLimiteAgregado = linha.limiteAgregadoAplicado
    ? `<p class="dedu-nota-simulacao">O limite agregado do art.º 78º n.º 7/8 CIRS (saúde + educação + habitação + PPR + exigência de fatura + trabalho doméstico) foi atingido: ${formatarMoeda(linha.limiteAgregado)}.</p>`
    : "";

  if (!barras && !linhasSemTeto && !notaLimiteAgregado) return "";
  return `<div class="desglose-detalhe">${barras}${linhasSemTeto}${notaLimiteAgregado}</div>`;
}

// Aceita uma lista de { titulo, declaracao } — normalmente 1 elemento
// (individual/conjunta), ou 2 quando o regime "separada" é o mais
// vantajoso (ver nota em render(), 21/09/2026) e é preciso mostrar as
// declarações de cada titular em vez de uma conjunta que não corresponde
// ao valor do selo. O título de cada secção só aparece quando há mais do
// que uma declaração — no caso normal (1 só), mantém o visual de sempre.
function renderDesglose(declaracoes) {
  return declaracoes
    .map(({ titulo, declaracao }) => {
      const linhas = declaracao.linhas;
      const cabecalho =
        declaracoes.length > 1
          ? `<p class="desglose-titular" style="font-weight:600;margin:var(--space-3) 0 var(--space-2)">${titulo ?? ""}</p>`
          : "";
      const html = ORDEM_LINHAS.filter((num) => linhas[num])
        .map((num) => {
          const linha = linhas[num];
          const valor = linha.total ?? linha.valor ?? 0;
          const valorFormatado =
            typeof valor === "number"
              ? LINHAS_NAO_MONETARIAS.has(num)
                ? valor.toFixed(2)
                : formatarMoeda(valor)
              : valor;
          return `
            <div class="desglose-linha">
              <span class="desglose-linha__num">${num}</span>
              <span>
                <span class="desglose-linha__desc">${LABELS_LINHA[num] ?? ""}</span><br/>
                <span class="desglose-linha__legal">${linha.referenciaLegal ?? ""}</span>
              </span>
              <span class="desglose-linha__valor num">${valorFormatado}</span>
            </div>
            ${num === 8 ? renderDetalheLinha8(linha) : ""}`;
        })
        .join("");
      return `${cabecalho}<div class="desglose card" style="padding:var(--space-2)">${html}</div>`;
    })
    .join("");
}

// ---------------------------------------------------------------------
// Painel "Ver detalhe mês a mês" (21/09/2026, pedido do Dani: "como sé
// que es la mejor proyección si yo no participo, no puedo editarla ni
// validarla"). Mostra, para cada pessoa e cada um dos 12 meses do ano
// fiscal, se é um mês REAL (documento carregado — só leitura, edita-se em
// "Meses") ou PROJETADO (estimativa — editável aqui). A edição grava um
// ajusteManual (storage/db.js) por componente; ligarEditoresDetalhe, em
// renderVentana14, trata dos listeners e do recálculo.
// ---------------------------------------------------------------------

const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function totalPorCategoria(rubricasDoMes, categoria) {
  return rubricasDoMes
    .filter((r) => r.categoria === categoria && r.tipo === "abono")
    .reduce((s, r) => s + (r.valorComRedu ?? r.valorSemRedu ?? 0), 0);
}

function rubricaPorDescricao(rubricasDoMes, regex, categoria) {
  return rubricasDoMes.find((r) => r.categoria === categoria && r.tipo === "abono" && regex.test(r.descricao || ""));
}

function ajusteExistente(ajustes, pessoaId, mes, componente) {
  return ajustes.find((a) => a.pessoaId === pessoaId && a.mes === mes && a.componente === componente);
}

function renderDetalheProjecaoWrap(estado) {
  const { pessoas, rubricasPorPessoa, ajustes } = estado;
  return `
    <div class="card" style="padding:var(--space-4)">
      <p class="field-hint" style="margin-top:0">${pt.ventana14.detalheProjecaoIntro}</p>
      <div class="detalhe-projecao">
        ${pessoas
          .map((p) => {
            const dados = rubricasPorPessoa.find((r) => r.pessoaId === p.id);
            if (!dados) return "";
            return renderDetalhePessoa(p, dados, ajustes.filter((a) => a.pessoaId === p.id));
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderDetalhePessoa(pessoa, dados, ajustesDaPessoa) {
  const temCategoriaB = dados.mesAMes.some((m) => m.rubricas.some((r) => r.categoria === "B" && r.tipo === "abono"));
  return `
    <div>
      <p class="detalhe-pessoa__nome">${pessoa.nome ?? ""}</p>
      ${dados.mesAMes.map((m) => renderDetalheMes(pessoa.id, m, temCategoriaB, ajustesDaPessoa)).join("")}
    </div>
  `;
}

function renderDetalheMes(pessoaId, mes, temCategoriaB, ajustesDaPessoa) {
  const nomeMes = NOMES_MESES[mes.mes - 1];

  if (mes.origem === "real") {
    const catA = totalPorCategoria(mes.rubricas, "A");
    const catB = totalPorCategoria(mes.rubricas, "B");
    return `
      <div class="detalhe-mes-row">
        <div class="detalhe-mes-row__cabecalho">
          <span class="detalhe-mes-row__mes">${nomeMes}</span>
          <span class="tag" data-origem="real">${pt.ventana14.detalheMesTagReal}</span>
        </div>
        <div class="detalhe-campo">
          <span class="detalhe-campo__label">${pt.ventana14.detalheCampoVencimentoBrutoReal} (Cat. A)</span>
          <span class="detalhe-campo__valor num">${formatarMoeda(catA)}</span>
        </div>
        ${
          temCategoriaB
            ? `<div class="detalhe-campo">
                 <span class="detalhe-campo__label">${pt.ventana14.detalheCampoCategoriaB}</span>
                 <span class="detalhe-campo__valor num">${formatarMoeda(catB)}</span>
               </div>`
            : ""
        }
      </div>
    `;
  }

  // Mês projetado — até três linhas editáveis (base, subsídio de
  // férias/Natal quando aplicável, e Categoria B).
  // Descrição "Vencimento bruto (projetado)", não "Remuneração base" —
  // ver engine/projecao.js para o porquê (21/09/2026, pergunta do Dani).
  const rubricaBase = rubricaPorDescricao(mes.rubricas, /vencimento\s*bruto/i, "A");
  const rubricaSubsidio = rubricaPorDescricao(mes.rubricas, /subs[íi]dio/i, "A");
  // Subsídio editável (22/09/2026, pedido do Dani): "hay personas que
  // tienen los subsidios de vacaciones y navidad prorrateados" — nesse
  // caso o valor certo é 0€ (já embutido no vencimento mensal). O
  // componente muda consoante o mês (só existe em agosto/dezembro — ver
  // MESES_SUBSIDIO em engine/projecao.js).
  const componenteSubsidio = mes.mes === 8 ? "subsidio_ferias" : mes.mes === 12 ? "subsidio_natal" : null;
  const labelSubsidio = mes.mes === 8 ? pt.ventana14.detalheCampoSubsidioFerias : pt.ventana14.detalheCampoSubsidioNatal;
  const rubricaCatB = rubricaPorDescricao(mes.rubricas, /recibo verde/i, "B");
  // Descontos de Categoria A projetados (IRS/SS/Sindicato/ADSE) — NOVO
  // (21/09/2026, reportado pelo Dani: "continuo sin saber si estimas las
  // diferentes rúbricas... y las incluyes en el cálculo"). São sempre
  // automáticos (taxa efetiva média sobre o bruto, ver engine/projecao.js)
  // — não editáveis individualmente aqui, só informativos, para o
  // utilizador poder confirmar que ENTRAM no cálculo e não ficam a 0€.
  const descontosCatA = mes.rubricas.filter((r) => r.categoria === "A" && r.tipo === "desconto");

  const algumEditado = [rubricaBase, rubricaSubsidio, rubricaCatB].some((r) => r?.origem === "projetado_ajustado");

  return `
    <div class="detalhe-mes-row">
      <div class="detalhe-mes-row__cabecalho">
        <span class="detalhe-mes-row__mes">${nomeMes}</span>
        <span class="tag" data-origem="${algumEditado ? "projetado_ajustado" : "projetado"}">${algumEditado ? pt.ventana14.detalheMesTagProjetadoEditado : pt.ventana14.detalheMesTagProjetado}</span>
      </div>
      ${renderCampoEditavel({
        label: pt.ventana14.detalheCampoBase,
        pessoaId,
        mes: mes.mes,
        componente: "remuneracao_base",
        rubrica: rubricaBase,
        ajustesDaPessoa,
      })}
      ${
        componenteSubsidio
          ? renderCampoEditavel({
              label: labelSubsidio,
              pessoaId,
              mes: mes.mes,
              componente: componenteSubsidio,
              rubrica: rubricaSubsidio,
              ajustesDaPessoa,
            })
          : ""
      }
      ${
        rubricaBase || rubricaSubsidio
          ? descontosCatA.length
            ? descontosCatA
                .map(
                  (d) => `
             <div class="detalhe-campo">
               <span class="detalhe-campo__label">${d.descricao}</span>
               <span class="detalhe-campo__valor num">− ${formatarMoeda(d.valorComRedu)}</span>
             </div>`
                )
                .join("")
            : `<div class="detalhe-campo"><span class="field-hint" style="margin:0">${pt.ventana14.detalheSemDescontosCatA}</span></div>`
          : ""
      }
      ${
        temCategoriaB
          ? renderCampoEditavel({
              label: pt.ventana14.detalheCampoCategoriaB,
              pessoaId,
              mes: mes.mes,
              componente: "categoria_b",
              rubrica: rubricaCatB,
              ajustesDaPessoa,
              semValorTexto: pt.ventana14.detalheSemCategoriaBEsteMes,
            })
          : ""
      }
    </div>
  `;
}

function renderCampoEditavel({ label, pessoaId, mes, componente, rubrica, ajustesDaPessoa, semValorTexto }) {
  if (!rubrica) {
    // Sem rubrica (ex.: Categoria B ainda sem nenhum recibo carregado, logo
    // sem média nenhuma para projetar) — sem valor para editar.
    return semValorTexto
      ? `<div class="detalhe-campo"><span class="detalhe-campo__label">${label}</span><span class="field-hint" style="margin:0">${semValorTexto}</span></div>`
      : "";
  }
  const ajuste = ajusteExistente(ajustesDaPessoa, pessoaId, mes, componente);
  return `
    <div class="detalhe-campo">
      <span class="detalhe-campo__label">${label}</span>
      <input
        type="number" step="0.01" min="0"
        value="${rubrica.valorComRedu.toFixed(2)}"
        data-editor-componente
        data-pessoa-id="${pessoaId}"
        data-mes="${mes}"
        data-componente="${componente}"
      />
      ${ajuste ? `<button type="button" class="detalhe-campo__repor" data-repor-ajuste="${ajuste.id}">${pt.ventana14.detalheReporAutomatico}</button>` : ""}
    </div>
  `;
}
