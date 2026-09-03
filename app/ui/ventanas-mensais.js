// ui/ventanas-mensais.js
// Ventanas 1–12: acordeão mensal com separação por pessoa (secção 8.2).

import { pt } from "../data/i18n.js";
import {
  getPessoas,
  getDocumentosDoMes,
  saveDocumento,
  saveRubricas,
  getRubricasDoDocumento,
  getModeloEntidade,
  guardarCorrecoesEntidade,
  removeDocumento,
  reatribuirDocumento,
} from "../storage/db.js";
import { extrairTextoPdf } from "../parsers/pdf-text.js";
import { parsearTalao } from "../parsers/parser-talao.js";
import { parsearReciboVerde } from "../parsers/parser-recibo-verde.js";
import { abrirConfirmacao } from "./components/confirmacao.js";

function formatarMoeda(valor) {
  // ver nota em ui/ventana-14.js: substitui o nbsp antes do € por um
  // espaço reduzido (.moeda), para não parecer desalinhado em fonte mono.
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" })
    .format(valor ?? 0)
    .replace(" €", '<span class="moeda">€</span>');
}

function formatarDataHora(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export async function renderVentanasMensais({ container, anoFiscal, mesParaAbrir }) {
  const pessoas = await getPessoas();
  const duasPessoas = pessoas.length > 1;

  container.innerHTML = `<div class="mes-accordion"></div>`;
  const acordeao = container.querySelector(".mes-accordion");

  for (let mes = 1; mes <= 12; mes++) {
    const item = await renderMesItem({ mes, anoFiscal, pessoas, duasPessoas });
    acordeao.appendChild(item);
  }

  if (mesParaAbrir) {
    const alvo = acordeao.querySelector(`[data-mes="${mesParaAbrir}"]`);
    if (alvo) {
      alvo.dataset.open = "true";
      alvo.querySelector(".mes-item__header").setAttribute("aria-expanded", "true");
    }
  }
}

async function renderMesItem({ mes, anoFiscal, pessoas, duasPessoas }) {
  const docsPorPessoa = {};
  let temAlgum = false;
  for (const p of pessoas) {
    const docs = await getDocumentosDoMes(mes, anoFiscal, p.id);
    docsPorPessoa[p.id] = docs;
    if (docs.length) temAlgum = true;
  }

  const totalMes = Object.values(docsPorPessoa)
    .flat()
    .reduce((acc, d) => acc + (d.totalLiquido ?? 0), 0);

  const item = document.createElement("div");
  item.className = "mes-item";
  item.dataset.mes = String(mes);
  item.dataset.open = "false";

  item.innerHTML = `
    <button class="mes-item__header" aria-expanded="false">
      <span class="mes-item__dot" data-filled="${temAlgum}"></span>
      <span class="mes-item__nome">${pt.meses[mes - 1]}</span>
      ${temAlgum ? `<span class="mes-item__resumo">${formatarMoeda(totalMes)}</span>` : ""}
      <svg class="mes-item__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="mes-item__body"></div>
  `;

  const header = item.querySelector(".mes-item__header");
  const body = item.querySelector(".mes-item__body");

  header.addEventListener("click", async () => {
    const abrir = item.dataset.open !== "true";
    item.dataset.open = String(abrir);
    header.setAttribute("aria-expanded", String(abrir));
    if (abrir && !body.dataset.montado) {
      await montarCorpoMes({ body, mes, anoFiscal, pessoas, duasPessoas, docsPorPessoa });
      body.dataset.montado = "true";
    }
  });

  return item;
}

async function montarCorpoMes({ body, mes, anoFiscal, pessoas, duasPessoas, docsPorPessoa }) {
  let pessoaAtiva = pessoas[0]?.id;

  async function render() {
    const docs = docsPorPessoa[pessoaAtiva] ?? [];
    const docsComRubricas = await Promise.all(
      docs.map(async (d) => ({ ...d, rubricas: await getRubricasDoDocumento(d.id) }))
    );

    body.innerHTML = `
      ${
        duasPessoas
          ? `<div class="pessoa-tabs" role="tablist">
              ${pessoas.map((p) => `<button class="pessoa-tab" role="tab" aria-selected="${p.id === pessoaAtiva}" data-pessoa="${p.id}">${p.nome || p.id}</button>`).join("")}
            </div>`
          : ""
      }
      <div class="pessoa-split" data-duas="${duasPessoas}">
        ${duasPessoas ? pessoas.map((p) => `<div data-painel="${p.id}" ${p.id === pessoaAtiva ? "" : 'style="display:none"'}></div>`).join("") : `<div data-painel="${pessoaAtiva}"></div>`}
      </div>
    `;

    for (const p of pessoas) {
      const painel = body.querySelector(`[data-painel="${p.id}"]`);
      if (!painel) continue;
      const docsDaPessoa = p.id === pessoaAtiva ? docsComRubricas : [];
      const lista = p.id === pessoaAtiva ? docsComRubricas : await Promise.all(
        (docsPorPessoa[p.id] ?? []).map(async (d) => ({ ...d, rubricas: await getRubricasDoDocumento(d.id) }))
      );
      painel.innerHTML = renderPainelPessoa(lista);
      painel.querySelector('[data-action="adicionar-doc"]')?.addEventListener("click", () =>
        // pessoas + pessoaId: pessoaId é só o pré-selecionado (a tab onde o
        // botão foi clicado) — quando há 2 pessoas, abrirConfirmacao pede
        // confirmação explícita de quem é o documento antes de gravar, por
        // reporte real de um recibo ter ficado associado à pessoa errada
        // (03/09/2026). onGravado recebe o pessoaId FINAL confirmado, que
        // pode ser diferente do pré-selecionado.
        abrirSeletorFicheiro({
          mes,
          anoFiscal,
          pessoaId: p.id,
          pessoas,
          onGravado: async (pessoaIdFinal) => {
            docsPorPessoa[pessoaIdFinal] = await getDocumentosDoMes(mes, anoFiscal, pessoaIdFinal);
            if (pessoaIdFinal !== p.id) docsPorPessoa[p.id] = await getDocumentosDoMes(mes, anoFiscal, p.id);
            render();
          },
        })
      );

      // Corrigir/apagar um documento já gravado — pedido real (03/09/2026):
      // um documento carregado com a pessoa errada não tinha nenhuma forma
      // de correção, só era possível apagar TODOS os dados do ano. O painel
      // fica escondido por omissão (só um botão "Editar" discreto) — outro
      // pedido do utilizador, achou o seletor "É de:" sempre visível
      // confuso/desnecessário na maioria dos cartões.
      painel.querySelectorAll('[data-action="editar-documento"]').forEach((el) =>
        el.addEventListener("click", () => {
          const painelEdicao = painel.querySelector(`[data-doc-editar="${el.dataset.docId}"]`);
          if (painelEdicao) painelEdicao.hidden = !painelEdicao.hidden;
        })
      );
      painel.querySelectorAll('[data-action="remover-documento"]').forEach((el) =>
        el.addEventListener("click", async () => {
          const confirmar = window.confirm(pt.mensal.confirmarRemoverDocumento);
          if (!confirmar) return;
          const docId = Number(el.dataset.docId);
          await removeDocumento(docId);
          docsPorPessoa[p.id] = await getDocumentosDoMes(mes, anoFiscal, p.id);
          render();
        })
      );
      painel.querySelectorAll('[data-action="reatribuir-documento"]').forEach((el) =>
        el.addEventListener("change", async () => {
          const docId = Number(el.dataset.docId);
          const novaPessoaId = el.value;
          if (novaPessoaId === p.id) return;
          await reatribuirDocumento(docId, novaPessoaId);
          docsPorPessoa[p.id] = await getDocumentosDoMes(mes, anoFiscal, p.id);
          docsPorPessoa[novaPessoaId] = await getDocumentosDoMes(mes, anoFiscal, novaPessoaId);
          render();
        })
      );
    }

    if (!duasPessoas) {
      const painelUnico = body.querySelector(`[data-painel="${pessoaAtiva}"]`);
      // já tratado acima
    }

    body.querySelectorAll(".pessoa-tab").forEach((tab) =>
      tab.addEventListener("click", () => {
        pessoaAtiva = tab.dataset.pessoa;
        render();
      })
    );
  }

  function renderPainelPessoa(docs) {
    if (!docs.length) {
      return `
        <p class="empty-state">${pt.mensal.semDocumentos}</p>
        <button class="btn btn-secondary btn-block" data-action="adicionar-doc">${pt.mensal.adicionarDocumento}</button>`;
    }
    return `
      ${docs.map((d) => renderDocCard(d)).join("")}
      <button class="btn btn-secondary btn-block" data-action="adicionar-doc">${pt.mensal.adicionarDocumento}</button>`;
  }

  function renderDocCard(doc) {
    const totalLiquido = doc.rubricas
      .filter((r) => r.tipo === "abono")
      .reduce((a, r) => a + (r.valorComRedu ?? 0), 0);
    // Pedido do utilizador (02/09/2026): quando há dois sujeitos passivos
    // já identificados em Perfil (nome preenchido), mostrar de quem é cada
    // documento diretamente no cartão — não só pelo separador ativo — para
    // dar mais contexto ao relance (ex.: ao rever vários meses seguidos).
    // Quem não quiser isto basta não preencher o nome em Perfil: sem nome,
    // não aparece nada aqui (nunca cai para o id interno da pessoa).
    const pessoaDoDoc = duasPessoas ? pessoas.find((p) => p.id === doc.pessoaId) : null;
    return `
      <div class="doc-card">
        <div class="doc-card__row">
          <span class="tag" data-tipo="${doc.tipo}">${doc.tipo === "recibo_verde" ? pt.mensal.tipoReciboVerde : pt.mensal.tipoTalao}</span>
          ${pessoaDoDoc?.nome ? `<span class="doc-card__pessoa">${pessoaDoDoc.nome}</span>` : ""}
          <span class="doc-card__valor num">${formatarMoeda(totalLiquido)}</span>
        </div>
        ${doc.dataUpload ? `<p class="doc-card__data">Carregado a ${formatarDataHora(doc.dataUpload)}</p>` : ""}
        <details>
          <summary>${doc.rubricas.length} rubrica${doc.rubricas.length === 1 ? "" : "s"}</summary>
          ${doc.rubricas
            .map(
              (r) => `<div class="rubrica-linha"><span>${r.descricao}</span><span class="num">${r.tipo === "desconto" ? "− " : ""}${formatarMoeda(r.valorComRedu)}</span></div>`
            )
            .join("")}
        </details>
        <div class="row" style="gap:var(--space-2);align-items:center;margin-top:var(--space-2)">
          <button class="btn btn-ghost" data-action="editar-documento" data-doc-id="${doc.id}" style="padding:2px 8px;font-size:0.82rem">${pt.mensal.editarDocumento}</button>
        </div>
        <div data-doc-editar="${doc.id}" hidden style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--hairline)">
          ${
            duasPessoas
              ? `<label class="field-hint" style="display:flex;align-items:center;gap:4px;margin-bottom:var(--space-2)">
                  ${pt.mensal.reatribuirLabel}
                  <select data-action="reatribuir-documento" data-doc-id="${doc.id}">
                    ${pessoas.map((p) => `<option value="${p.id}" ${p.id === doc.pessoaId ? "selected" : ""}>${p.nome || p.id}</option>`).join("")}
                  </select>
                </label>`
              : ""
          }
          <button class="btn btn-ghost" data-action="remover-documento" data-doc-id="${doc.id}" style="color:var(--pagar)">${pt.mensal.removerDocumento}</button>
        </div>
      </div>`;
  }

  await render();
}

function abrirSeletorFicheiro({ mes, anoFiscal, pessoaId, pessoas, onGravado }) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";
  input.style.display = "none";
  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;

    let tipoEscolhido = null;
    tipoEscolhido = window.confirm(
      "Este documento é um recibo verde? (Cancelar = talão de vencimento)"
    )
      ? "recibo_verde"
      : "talao";

    try {
      const buffer = await file.arrayBuffer();
      const texto = await extrairTextoPdf(buffer);
      let resultado = tipoEscolhido === "recibo_verde" ? parsearReciboVerde(texto) : parsearTalao(texto);

      const nifEmpregador = resultado.metadados?.nif ?? null;
      if (tipoEscolhido === "talao" && nifEmpregador) {
        const modelo = await getModeloEntidade(nifEmpregador);
        if (modelo?.correcoes && Object.keys(modelo.correcoes).length) {
          resultado = parsearTalao(texto, modelo.correcoes);
        }
      }

      abrirConfirmacao({
        resultadoParsing: resultado,
        tipo: tipoEscolhido,
        ficheiro: file,
        pessoas,
        pessoaIdInicial: pessoaId,
        onConfirmar: async (rubricasConfirmadas, correcoesAprendidas, pessoaIdConfirmado) => {
          const documento = await saveDocumento({
            pessoaId: pessoaIdConfirmado ?? pessoaId,
            mes,
            anoFiscal,
            tipo: tipoEscolhido,
            dataUpload: new Date().toISOString(),
            status: "processado",
            nomeFicheiroOriginal: file.name,
          });
          await saveRubricas(documento.id, rubricasConfirmadas);
          if (nifEmpregador && correcoesAprendidas && Object.keys(correcoesAprendidas).length) {
            await guardarCorrecoesEntidade(nifEmpregador, correcoesAprendidas);
          }
          onGravado(pessoaIdConfirmado ?? pessoaId);
        },
      });
    } catch (err) {
      console.error("[Antecipa] Erro ao processar documento:", err);
      alert(
        "Não foi possível ler este PDF automaticamente. Pode gravá-lo na mesma e preencher os valores manualmente no ecrã seguinte."
      );
      abrirConfirmacao({
        resultadoParsing: { rubricas: [], confianca: "baixa" },
        tipo: tipoEscolhido,
        ficheiro: file,
        pessoas,
        pessoaIdInicial: pessoaId,
        onConfirmar: async (rubricasConfirmadas, _correcoes, pessoaIdConfirmado) => {
          const documento = await saveDocumento({
            pessoaId: pessoaIdConfirmado ?? pessoaId,
            mes,
            anoFiscal,
            tipo: tipoEscolhido,
            dataUpload: new Date().toISOString(),
            status: "erro_parsing",
            nomeFicheiroOriginal: file.name,
          });
          await saveRubricas(documento.id, rubricasConfirmadas);
          onGravado(pessoaIdConfirmado ?? pessoaId);
        },
      });
    }
  });

  input.click();
}
