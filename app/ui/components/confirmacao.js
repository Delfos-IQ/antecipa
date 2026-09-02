// ui/components/confirmacao.js
// Ecrã de confirmação editável, obrigatório após qualquer parsing
// (secção 6.3) — protege contra erros de extração desde o v1 e é a base
// sobre a qual assentará a validação quando o parser passar a IA (v2).
//
// Talão de vencimento: mostra o documento original (PDF) ao lado dos
// valores lidos, em vez de só uma lista de campos às cegas — assim dá
// para conferir cada número contra o documento real. Os descontos que a
// app não conseguiu classificar com confiança aparecem numa lista à
// parte onde se pode corrigir a categoria; se pedir para "lembrar", essa
// correspondência fica guardada por entidade empregadora (NIF) e aplica-
// -se sozinha da próxima vez (ver storage/db.js, parsers/parser-talao.js
// — chaveDescricao/classificarDesconto). Cada pessoa com o seu próprio
// talão ensina a app a lê-lo, sem depender de um layout fixo.

import { chaveDescricao } from "../../parsers/parser-talao.js";
import { carregarPdfJs } from "../../parsers/pdf-text.js";

const ROTULOS_CATEGORIA = {
  irs: "IRS",
  ss: "Segurança Social",
  sindicato: "Sindicato",
  adse: "ADSE",
  outros: "Outros",
};

function campoResumo({ campo, rotulo, valor }) {
  return `
    <div class="field">
      <label>${rotulo} €</label>
      <input type="number" step="0.01" data-campo-resumo="${campo}" value="${valor ?? ""}" />
    </div>`;
}

function renderTalao(resultadoParsing, resumo, linhas) {
  const r = resumo ?? {};
  return `
    <p class="muted">
      ${
        resultadoParsing.confianca === "baixa"
          ? "Não conseguimos ler este documento com confiança — reveja os valores com atenção ou preencha-os manualmente."
          : "Confira estes valores com o documento ao lado. Pode corrigir qualquer um deles."
      }
    </p>
    <div class="stack">
      ${campoResumo({ campo: "bruto", rotulo: "Vencimento bruto", valor: r.bruto })}
      ${campoResumo({ campo: "irsRetido", rotulo: "IRS retido", valor: r.irsRetido })}
      ${campoResumo({ campo: "segurancaSocial", rotulo: "Segurança Social", valor: r.segurancaSocial })}
      ${campoResumo({ campo: "sindicato", rotulo: "Sindicato", valor: r.sindicato })}
      ${campoResumo({ campo: "adse", rotulo: "ADSE", valor: r.adse })}
      ${campoResumo({ campo: "liquido", rotulo: "Líquido", valor: r.liquido })}
    </div>
    ${
      linhas.length
        ? `
    <details class="linhas-classificadas" style="margin-top:var(--space-4)">
      <summary class="muted">Como classificámos cada desconto (toque para corrigir)</summary>
      <div class="stack" style="margin-top:var(--space-2)">
        ${linhas
          .map(
            (l, i) => `
          <div class="row" style="gap:var(--space-2);align-items:center;justify-content:space-between">
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.descricao} — ${l.valorComRedu.toFixed(2)}€</span>
            <select data-linha-categoria="${i}" style="flex-shrink:0;width:auto;min-height:auto;padding:6px 8px">
              ${Object.entries(ROTULOS_CATEGORIA)
                .map(([v, rotulo]) => `<option value="${v}" ${l.categoriaClassificada === v ? "selected" : ""}>${rotulo}</option>`)
                .join("")}
            </select>
          </div>`
          )
          .join("")}
      </div>
    </details>
    <label class="row" style="gap:var(--space-2);align-items:flex-start;margin-top:var(--space-3);">
      <input type="checkbox" data-action="lembrar" checked style="margin-top:3px" />
      <span class="muted">Se corrigir alguma classificação acima, lembrar para a próxima vez que carregar um talão desta entidade.</span>
    </label>`
        : ""
    }
  `;
}

function renderListaRubricas(rubricas, tipo) {
  return `
    <p class="muted">
      Reveja cada campo ao lado do documento original antes de gravar. Pode editar qualquer valor.
    </p>
    <div class="stack">
      ${rubricas
        .map(
          (r, i) => `
        <div class="doc-card" data-idx="${i}">
          <div class="field">
            <label>Descrição</label>
            <input type="text" data-campo="descricao" data-idx="${i}" value="${r.descricao ?? ""}" />
          </div>
          <div class="row" style="gap:var(--space-3)">
            <div class="field" style="flex:1">
              <label>Tipo</label>
              <select data-campo="tipo" data-idx="${i}">
                <option value="abono" ${r.tipo === "abono" ? "selected" : ""}>Abono</option>
                <option value="desconto" ${r.tipo === "desconto" ? "selected" : ""}>Desconto</option>
              </select>
            </div>
            <div class="field" style="flex:1">
              <label>Categoria</label>
              <select data-campo="categoria" data-idx="${i}">
                <option value="A" ${r.categoria === "A" ? "selected" : ""}>A</option>
                <option value="B" ${r.categoria === "B" ? "selected" : ""}>B</option>
                <option value="E" ${r.categoria === "E" ? "selected" : ""}>E</option>
                <option value="G" ${r.categoria === "G" ? "selected" : ""}>G</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Valor (com redução) €</label>
            <input type="number" step="0.01" data-campo="valorComRedu" data-idx="${i}" value="${r.valorComRedu ?? ""}" />
          </div>
          <button class="btn btn-ghost" data-action="remover" data-idx="${i}">Remover esta linha</button>
        </div>`
        )
        .join("")}
    </div>
    <button class="btn btn-secondary btn-block" data-action="adicionar" style="margin-top:var(--space-3)">+ Adicionar linha manual</button>
  `;
}

// Desenha a primeira página do PDF original num <canvas>, para o
// utilizador conferir os valores lidos contra o documento real. Se o
// desenho falhar por algum motivo (ficheiro inválido, etc.), falha em
// silêncio — a confirmação continua a funcionar sem a pré-visualização.
// Níveis de zoom disponíveis (multiplicador sobre o "ajustar à largura"
// inicial). O utilizador queixou-se de que a pré-visualização vinha
// minúscula e ilegível dentro da coluna estreita do modal — o problema
// não era só a largura da coluna (ver painel.style.cssText mais abaixo,
// também alargada), mas o facto de o texto de um talão típico só fica
// legível bastante acima do "ajustar à largura". Por isso: arranca já
// num zoom 1.6× e permite ir até 3×, com o wrap a fazer scroll.
const ZOOM_NIVEIS = [1, 1.3, 1.6, 2, 2.5, 3];
const ZOOM_INICIAL = 1.6;

async function montarPreviaPdf(container, ficheiro) {
  if (!ficheiro) return;
  try {
    const pdfjsLib = await carregarPdfJs();
    const buffer = await ficheiro.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let paginaAtual = 1;
    let zoomAtual = ZOOM_INICIAL;

    container.innerHTML = `
      <div class="previa-pdf__toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-bottom:var(--space-2);flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:4px">
          <button class="btn btn-ghost" data-action="pagina-anterior" ${pdf.numPages <= 1 ? "disabled" : ""}>‹</button>
          <span class="muted previa-pdf__pagina">Página 1 / ${pdf.numPages}</span>
          <button class="btn btn-ghost" data-action="pagina-seguinte" ${pdf.numPages <= 1 ? "disabled" : ""}>›</button>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <button class="btn btn-ghost" data-action="zoom-menos" title="Diminuir zoom" style="padding:4px 12px">−</button>
          <span class="muted previa-pdf__zoom" style="min-width:44px;text-align:center;font-size:0.8rem"></span>
          <button class="btn btn-ghost" data-action="zoom-mais" title="Aumentar zoom" style="padding:4px 12px">+</button>
        </div>
      </div>
      <div class="previa-pdf__canvas-wrap" style="overflow:auto;border-radius:8px;border:1px solid var(--linha, #e2e5ea);max-height:70vh;background:#525659">
        <canvas class="previa-pdf__canvas" style="display:block"></canvas>
      </div>
      <p class="field-hint" style="margin-top:var(--space-2)">Deslize (scroll/gesto) dentro da pré-visualização para percorrer a página ampliada.</p>
    `;
    const canvas = container.querySelector(".previa-pdf__canvas");
    const wrap = container.querySelector(".previa-pdf__canvas-wrap");
    const rotulo = container.querySelector(".previa-pdf__pagina");
    const rotuloZoom = container.querySelector(".previa-pdf__zoom");

    // Renderiza a página inteira à resolução real do ecrã (devicePixelRatio)
    // multiplicada pelo zoom pedido, para o texto ficar nítido mesmo
    // ampliado — em vez de esticar por CSS um canvas de baixa resolução
    // (o que dava o efeito "ilegível" reportado).
    async function desenharPagina(numero) {
      const page = await pdf.getPage(numero);
      const dpr = window.devicePixelRatio || 1;
      // Largura base: a da coluna de pré-visualização, para que zoom=1
      // corresponda a "ajustar à largura" do painel.
      const larguraBase = wrap.clientWidth || 360;
      const viewportBase = page.getViewport({ scale: 1 });
      const escalaAjuste = larguraBase / viewportBase.width;
      const escalaFinal = escalaAjuste * zoomAtual * dpr;
      const viewport = page.getViewport({ scale: escalaFinal });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      rotulo.textContent = `Página ${numero} / ${pdf.numPages}`;
      rotuloZoom.textContent = `${Math.round(zoomAtual * 100)}%`;
    }

    container.querySelector('[data-action="pagina-anterior"]')?.addEventListener("click", () => {
      if (paginaAtual > 1) desenharPagina((paginaAtual -= 1));
    });
    container.querySelector('[data-action="pagina-seguinte"]')?.addEventListener("click", () => {
      if (paginaAtual < pdf.numPages) desenharPagina((paginaAtual += 1));
    });
    container.querySelector('[data-action="zoom-mais"]')?.addEventListener("click", () => {
      const proximo = ZOOM_NIVEIS.find((z) => z > zoomAtual + 0.001);
      if (proximo) {
        zoomAtual = proximo;
        desenharPagina(paginaAtual);
      }
    });
    container.querySelector('[data-action="zoom-menos"]')?.addEventListener("click", () => {
      const anteriores = ZOOM_NIVEIS.filter((z) => z < zoomAtual - 0.001);
      if (anteriores.length) {
        zoomAtual = anteriores[anteriores.length - 1];
        desenharPagina(paginaAtual);
      }
    });

    await desenharPagina(paginaAtual);
  } catch (err) {
    console.warn("[Antecipa] Não foi possível desenhar a pré-visualização do PDF:", err);
  }
}

export function abrirConfirmacao({ resultadoParsing, tipo, ficheiro, onConfirmar, onCancelar }) {
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(20,26,43,.55);display:flex;align-items:center;justify-content:center;z-index:50;padding:var(--space-3);";

  const ehTalao = tipo === "talao";
  // Cópia local editável do resumo (talão) ou da lista de rubricas (recibo verde).
  const resumo = ehTalao ? { ...(resultadoParsing.resumo ?? {}) } : null;
  const linhasDesconto = ehTalao ? (resultadoParsing.linhasDesconto ?? []).map((l) => ({ ...l })) : null;
  const rubricas = !ehTalao ? (resultadoParsing.rubricas ?? []).map((r) => ({ ...r })) : null;

  const painel = document.createElement("div");
  painel.className = "card";
  painel.style.cssText =
    "width:100%;max-width:min(1280px, 96vw);max-height:92vh;overflow:auto;border-radius:16px;padding:var(--space-5);display:flex;flex-wrap:wrap;gap:var(--space-5);";

  function render() {
    painel.innerHTML = `
      <div style="flex:1 1 360px;min-width:280px">
        <h2>Confirme os valores extraídos</h2>
        ${ehTalao ? renderTalao(resultadoParsing, resumo, linhasDesconto) : renderListaRubricas(rubricas, tipo)}
        <div class="onboarding__nav">
          <button class="btn btn-ghost" data-action="cancelar">Cancelar</button>
          <button class="btn btn-primary" data-action="confirmar">Guardar</button>
        </div>
      </div>
      <div class="previa-pdf" style="flex:2 1 480px;min-width:360px"></div>
    `;
    ligar();
    montarPreviaPdf(painel.querySelector(".previa-pdf"), ficheiro);
  }

  // Recalcula os 4 campos de desconto por categoria a partir da
  // classificação atual das linhas (o utilizador pode ter reclassificado
  // alguma). Bruto e Líquido continuam a vir dos totais do documento.
  function recalcularAPartirDasLinhas() {
    const somas = { irs: 0, ss: 0, sindicato: 0, adse: 0, outros: 0 };
    for (const l of linhasDesconto) somas[l.categoriaClassificada] += l.valorComRedu;
    resumo.irsRetido = Math.round(somas.irs * 100) / 100;
    resumo.segurancaSocial = Math.round(somas.ss * 100) / 100;
    resumo.sindicato = Math.round(somas.sindicato * 100) / 100;
    resumo.adse = Math.round(somas.adse * 100) / 100;
  }

  function ligar() {
    if (ehTalao) {
      painel.querySelectorAll("[data-campo-resumo]").forEach((el) =>
        el.addEventListener("input", (e) => {
          resumo[e.target.dataset.campoResumo] = e.target.value === "" ? null : Number(e.target.value);
        })
      );
      painel.querySelectorAll("[data-linha-categoria]").forEach((el) =>
        el.addEventListener("change", (e) => {
          const idx = Number(e.target.dataset.linhaCategoria);
          linhasDesconto[idx].categoriaClassificada = e.target.value;
          recalcularAPartirDasLinhas();
          render();
        })
      );
    } else {
      painel.querySelectorAll("[data-campo]").forEach((el) =>
        el.addEventListener("input", (e) => {
          const idx = Number(e.target.dataset.idx);
          const campo = e.target.dataset.campo;
          rubricas[idx][campo] = campo === "valorComRedu" ? Number(e.target.value) : e.target.value;
        })
      );
      painel.querySelectorAll('[data-action="remover"]').forEach((el) =>
        el.addEventListener("click", (e) => {
          rubricas.splice(Number(e.target.dataset.idx), 1);
          render();
        })
      );
      painel.querySelector('[data-action="adicionar"]')?.addEventListener("click", () => {
        rubricas.push({ descricao: "", tipo: "abono", categoria: tipo === "recibo_verde" ? "B" : "A", valorComRedu: 0 });
        render();
      });
    }
    painel.querySelector('[data-action="cancelar"]').addEventListener("click", fechar);
    painel.querySelector('[data-action="confirmar"]').addEventListener("click", () => {
      if (ehTalao) {
        const lembrar = painel.querySelector('[data-action="lembrar"]')?.checked ?? false;
        const correcoes = lembrar ? detetarCorrecoes() : {};
        onConfirmar(rubricasFinaisDoResumo(resumo), correcoes);
      } else {
        onConfirmar(rubricas.filter((r) => r.descricao && r.valorComRedu));
      }
      fechar();
    });
  }

  // Compara a categoria final de cada linha (depois de eventuais correções
  // do utilizador) com a que a app tinha classificado sozinha — só o que
  // mudou vale a pena lembrar para a próxima vez.
  function detetarCorrecoes() {
    const correcoes = {};
    for (const original of resultadoParsing.linhasDesconto ?? []) {
      const atual = linhasDesconto.find((l) => l.descricao === original.descricao && l.valorComRedu === original.valorComRedu);
      if (atual && atual.categoriaClassificada !== original.categoriaClassificada) {
        correcoes[chaveDescricao(original.descricao)] = atual.categoriaClassificada;
      }
    }
    return correcoes;
  }

  function fechar() {
    overlay.remove();
    onCancelar?.();
  }

  overlay.appendChild(painel);
  document.body.appendChild(overlay);
  render();
}

// Reconstrói as rubricas internas (formato que engine/calculo-irs.js
// espera) a partir dos números confirmados. "Outros descontos" é
// recalculado para que bruto - descontos continue a bater certo com o
// líquido editado.
function rubricasFinaisDoResumo(resumo) {
  const bruto = resumo.bruto ?? 0;
  const irsRetido = resumo.irsRetido ?? 0;
  const segurancaSocial = resumo.segurancaSocial ?? 0;
  const sindicato = resumo.sindicato ?? 0;
  const adse = resumo.adse ?? 0;
  const liquido = resumo.liquido ?? bruto - irsRetido - segurancaSocial - sindicato - adse;
  const outrosDescontos = Math.max(
    Math.round((bruto - irsRetido - segurancaSocial - sindicato - adse - liquido) * 100) / 100,
    0
  );

  const rubricas = [{ descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: bruto }];
  if (irsRetido) {
    rubricas.push({ descricao: "IRS retido", categoria: "A", tipo: "desconto", valorComRedu: irsRetido, categoriaIRS: true });
  }
  if (segurancaSocial) {
    rubricas.push({ descricao: "Segurança Social", categoria: "A", tipo: "desconto", valorComRedu: segurancaSocial, categoriaSS: true });
  }
  if (sindicato) {
    rubricas.push({ descricao: "Sindicato", categoria: "A", tipo: "desconto", valorComRedu: sindicato, categoriaSindicato: true });
  }
  if (adse) {
    rubricas.push({ descricao: "ADSE", categoria: "A", tipo: "desconto", valorComRedu: adse, categoriaADSE: true });
  }
  if (outrosDescontos) {
    rubricas.push({ descricao: "Outros descontos", categoria: "A", tipo: "desconto", valorComRedu: outrosDescontos });
  }
  return rubricas;
}
