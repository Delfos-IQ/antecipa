// ui/ventana-14.js
// Ventana 14 — Simulação (secção 8.4): selo + desglose 1→25 (adaptado às
// 11 etapas do motor, cada uma referenciando a linha oficial equivalente)
// + modo comparação + disclaimer + exportação PDF.

import { pt } from "../data/i18n.js";
import { getHousehold, getPessoas, getDependentes, getTodasRubricas, getAjustesManuais, getDeducoesColeta } from "../storage/db.js";
import { projetarAno, achatarRubricasDoAno } from "../engine/projecao.js";
import { calcularDeclaracao, compararRegimes, detectarOportunidadePPR, detectarOportunidadeMaisValias, detectarSugestoesPagamento } from "../engine/calculo-irs.js";
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
  const { documentos, rubricas } = await getTodasRubricas(anoFiscal);
  const ajustes = await getAjustesManuais(anoFiscal);
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
    });
    rubricasPorPessoa.push({ pessoaId: p.id, rubricas: achatarRubricasDoAno(mesAMes), percentagemMesesReais });
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

  const regime = household?.regimeTributacao ?? "individual";

  if (regime === "comparar_ambos" && pessoas.length === 2) {
    comparacao = compararRegimes(
      inputBase,
      { rubricas: rubricasPorPessoa[0].rubricas, dependentesAtribuidos: dependentes },
      { rubricas: rubricasPorPessoa[1].rubricas, dependentesAtribuidos: [] },
      dependentes
    );
  } else {
    const inputResultadoUnico = {
      ...inputBase,
      regime: regime === "conjunta" ? "conjunta" : "individual",
      rubricasPorPessoa: rubricasPorPessoa.map((p) => p.rubricas),
      dependentes,
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

  render({ resultadoUnico, comparacao, oportunidades, percentagemMediaReal, household, pessoas, dependentes, deducoesColeta, ajustes });

  function render(estado) {
    const { resultadoUnico, comparacao, oportunidades } = estado;
    const resultadoParaSelo = comparacao
      ? melhorResultado(comparacao)
      : resultadoUnico.resultado;

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
    const mesesRestantes = Math.round((1 - percentagemMediaReal) * 12);
    const sugestoesPagamento = detectarSugestoesPagamento(
      { resultado: resultadoParaSelo },
      { household: estado.household, deducoesColeta: estado.deducoesColeta, mesesRestantes }
    );

    container.innerHTML = `
      <h2>${pt.ventana14.titulo}</h2>
      <div class="resultado-selo" data-tipo="${resultadoParaSelo.tipo}">
        <div class="resultado-selo__label">${resultadoParaSelo.tipo === "a_devolver" ? pt.ventana14.aDevolver : pt.ventana14.aPagar}</div>
        <div class="resultado-selo__valor num">${formatarMoeda(resultadoParaSelo.valor)}</div>
        <div class="resultado-selo__confianca">${pt.ventana14.confiancaPrefixo} ${Math.round(percentagemMediaReal * 100)}% ${pt.ventana14.confiancaSufixo}</div>
      </div>

      ${comparacao ? renderComparacao(comparacao) : ""}

      ${sugestoesPagamento.length > 0 ? renderSugestoesPagamento(sugestoesPagamento) : ""}

      ${oportunidades.length > 0 ? renderOportunidades(oportunidades) : ""}

      <div class="row-between" style="margin-top:var(--space-5)">
        <button class="btn btn-secondary" data-action="toggle-desglose">${pt.ventana14.verCalculoCompleto}</button>
        <div class="row" style="gap:var(--space-2)">
          <button class="btn btn-ghost" data-action="pdf-pessoal">${pt.ventana14.exportarPessoal}</button>
          <button class="btn btn-ghost" data-action="pdf-contabilista">${pt.ventana14.exportarContabilista}</button>
        </div>
      </div>
      <div class="simulacao-layout" data-desglose-aberto="false"></div>

      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    const layout = container.querySelector(".simulacao-layout");
    container.querySelector('[data-action="toggle-desglose"]').addEventListener("click", () => {
      const aberto = layout.dataset.desgloseAberto !== "true";
      layout.dataset.desgloseAberto = String(aberto);
      layout.innerHTML = aberto
        ? renderDesglose(resultadoUnico ?? comparacao.conjunta)
        : "";
      container.querySelector('[data-action="toggle-desglose"]').textContent = aberto
        ? pt.ventana14.fecharCalculoCompleto
        : pt.ventana14.verCalculoCompleto;
    });

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
          declaracao: resultadoUnico ?? comparacao?.conjunta,
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
          declaracao: resultadoUnico ?? comparacao.conjunta,
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
}

function iconeSimulacaoVazia() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
}

function melhorResultado(comparacao) {
  return comparacao.maisVantajoso === "conjunta" ? comparacao.conjunta.resultado : melhorSeparado(comparacao.separada);
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

function renderComparacao(comparacao) {
  const totalA = comparacao.separada.A.resultado;
  const totalB = comparacao.separada.B.resultado;
  return `
    <div class="comparacao-grid">
      <div class="comparacao-card" data-vantajoso="${comparacao.maisVantajoso === "conjunta"}">
        <div class="comparacao-card__titulo">
          Declaração conjunta
          ${comparacao.maisVantajoso === "conjunta" ? `<span class="comparacao-card__badge">${pt.ventana14.maisVantajoso}</span>` : ""}
        </div>
        <p class="num" style="font-size:1.4rem;margin-top:var(--space-2)">${formatarMoeda(comparacao.conjunta.resultado.valor)} <span class="muted" style="font-size:.85rem">${comparacao.conjunta.resultado.tipo === "a_devolver" ? "a devolver" : "a pagar"}</span></p>
      </div>
      <div class="comparacao-card" data-vantajoso="${comparacao.maisVantajoso === "separada"}">
        <div class="comparacao-card__titulo">
          Declarações separadas
          ${comparacao.maisVantajoso === "separada" ? `<span class="comparacao-card__badge">${pt.ventana14.maisVantajoso}</span>` : ""}
        </div>
        <p class="num" style="font-size:1.4rem;margin-top:var(--space-2)">${formatarMoeda(Math.abs(comparacao.separada.total))} <span class="muted" style="font-size:.85rem">${comparacao.separada.total >= 0 ? "a devolver" : "a pagar"} (A+B)</span></p>
        <p class="muted" style="font-size:.82rem">A: ${formatarMoeda(totalA.valor)} ${totalA.tipo === "a_devolver" ? "↩" : "↪"} · B: ${formatarMoeda(totalB.valor)} ${totalB.tipo === "a_devolver" ? "↩" : "↪"}</p>
      </div>
    </div>
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
        ${temPprRegistado ? `Já entregou ${formatarMoeda(oportunidade.pprAtual)}. ` : ""}${corpo}
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

function renderDesglose(declaracao) {
  const linhas = declaracao.linhas;
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
        </div>`;
    })
    .join("");
  return `<div class="desglose card" style="padding:var(--space-2)">${html}</div>`;
}
