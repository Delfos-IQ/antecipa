// ui/onboarding.js
// Fluxo de 5 passos com barra de progresso (secção 8.1 do prompt de build).

import { pt } from "../data/i18n.js";
import { simboloSVG } from "./components/symbol.js";
import { saveHousehold, savePessoa, getHousehold } from "../storage/db.js";
import { quocienteEstimado } from "../engine/quociente.js";

const TOTAL_PASSOS = 5; // 1..5, passo 0 é boas-vindas sem barra

export function criarOnboarding({ container, onConcluido }) {
  const estado = {
    passo: 0,
    situacao: null,
    regimeTributacao: "comparar_ambos",
    numDependentesEstimado: 0,
    pessoas: [{ id: "A", nome: "", nif: "" }],
    fontes: new Set(),
    // Confirmação obrigatória do aviso legal (passo 1) — só avança depois
    // de marcada. Ver comentário em data/i18n.js, onboarding.privacidade.
    confirmouAviso: false,
  };

  function render() {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "onboarding";

    if (estado.passo > 0) {
      const barra = document.createElement("div");
      barra.className = "onboarding__progress";
      for (let i = 1; i <= TOTAL_PASSOS; i++) {
        const seg = document.createElement("i");
        seg.dataset.done = String(i <= estado.passo);
        barra.appendChild(seg);
      }
      wrap.appendChild(barra);
    }

    const passoEl = document.createElement("div");
    passoEl.className = "onboarding__step";
    passoEl.innerHTML = renderPasso();
    wrap.appendChild(passoEl);

    container.appendChild(wrap);
    ligarEventos(wrap);
  }

  function renderPasso() {
    switch (estado.passo) {
      case 0:
        // Marca maior que em qualquer outro ecrã (150px) — este é o único
        // sítio onde ela é mesmo protagonista, a pedido do Dani.
        return `
          <div class="onboarding__welcome">
            ${simboloSVG({ size: 150 })}
            <h1>${pt.onboarding.boasVindas.titulo}</h1>
            <p class="tagline">${pt.onboarding.boasVindas.tagline}</p>
            <p class="onboarding__promessa">${pt.onboarding.boasVindas.promessa}</p>
            <button class="btn btn-primary" data-action="seguinte">${pt.onboarding.boasVindas.cta}</button>
          </div>`;

      case 1:
        // O aviso legal vem primeiro, com o mesmo destaque visual (mesma
        // caixa escura) do aviso de privacidade — pedido do Dani para não
        // ficar como um texto secundário. O banner amarelo global
        // (legal-banner, sempre visível no resto da app) é escondido só
        // durante o onboarding para não duplicar esta mensagem — ver
        // toggleBannerLegal() em app.js.
        return `
          <h2>${pt.onboarding.privacidade.titulo}</h2>
          <div class="privacy-note privacy-note--aviso">
            ${iconeAviso()}
            <p>${pt.bannerLegal.texto}</p>
          </div>
          <div class="privacy-note">
            ${iconeCadeado()}
            <p>${pt.onboarding.privacidade.corpo}</p>
          </div>
          <label class="choice-card choice-card--confirmacao" data-selected="${estado.confirmouAviso}">
            <input type="checkbox" id="confirmar-aviso" ${estado.confirmouAviso ? "checked" : ""} />
            <span class="choice-card__title">${pt.onboarding.privacidade.confirmacao}</span>
          </label>
          ${navegacao(estado.confirmouAviso, pt.onboarding.privacidade.cta)}`;

      case 2:
        return `
          <h2>${pt.onboarding.agregado.titulo}</h2>
          <p class="muted">${pt.onboarding.agregado.pergunta}</p>
          <div class="choice-group" role="radiogroup">
            ${Object.entries(pt.onboarding.agregado.opcoes)
              .map(
                ([valor, o]) => `
              <label class="choice-card" data-selected="${estado.situacao === valor}">
                <input type="radio" name="situacao" value="${valor}" ${estado.situacao === valor ? "checked" : ""} />
                <span><span class="choice-card__title">${o.titulo}</span><br/><span class="choice-card__desc">${o.desc}</span></span>
              </label>`
              )
              .join("")}
          </div>
          ${estado.situacao === "casal" ? renderRegime() : ""}
          ${estado.situacao ? renderQuociente() : ""}
          ${navegacao(!!estado.situacao)}`;

      case 3:
        return `
          <h2>${pt.onboarding.sujeitosPassivos.titulo}</h2>
          <div class="stack">
            ${estado.pessoas.map((p, i) => renderCampoPessoa(p, i)).join("")}
            ${estado.situacao === "casal" && estado.pessoas.length === 1 ? `<button class="btn btn-secondary" data-action="adicionar-pessoa">+ Adicionar segunda pessoa</button>` : ""}
          </div>
          ${navegacao(!!estado.pessoas[0].nome)}`;

      case 4:
        return `
          <h2>${pt.onboarding.fontesRendimento.titulo}</h2>
          <p class="muted">${pt.onboarding.fontesRendimento.pergunta}</p>
          <div class="choice-group">
            ${Object.entries(pt.onboarding.fontesRendimento.opcoes)
              .map(
                ([valor, label]) => `
              <label class="choice-card" data-selected="${estado.fontes.has(valor)}">
                <input type="checkbox" name="fonte" value="${valor}" ${estado.fontes.has(valor) ? "checked" : ""} />
                <span class="choice-card__title">${label}</span>
              </label>`
              )
              .join("")}
          </div>
          ${navegacao(estado.fontes.size > 0)}`;

      case 5:
        return `
          <h2>${pt.onboarding.primeiroDocumento.titulo}</h2>
          <p>${pt.onboarding.primeiroDocumento.corpo}</p>
          <div class="stack">
            <button class="btn btn-primary btn-block" data-action="carregar-primeiro">${pt.onboarding.primeiroDocumento.ctaCarregar}</button>
            <button class="btn btn-secondary btn-block" data-action="explorar">${pt.onboarding.primeiroDocumento.ctaExplorar}</button>
          </div>
          <div class="onboarding__nav"><button class="btn btn-ghost" data-action="voltar">${pt.onboarding.voltar}</button><span></span></div>`;

      default:
        return "";
    }
  }

  function renderRegime() {
    return `
      <p class="section-title" style="margin-top:var(--space-4)">${pt.onboarding.agregado.regimeTitulo}</p>
      <div class="choice-group">
        ${Object.entries(pt.onboarding.agregado.regimes)
          .map(
            ([valor, o]) => `
          <label class="choice-card" data-selected="${estado.regimeTributacao === valor}">
            <input type="radio" name="regime" value="${valor}" ${estado.regimeTributacao === valor ? "checked" : ""} />
            <span><span class="choice-card__title">${o.titulo}</span><br/><span class="choice-card__desc">${o.desc}</span></span>
          </label>`
          )
          .join("")}
      </div>`;
  }

  function renderQuociente() {
    const q = quocienteEstimado({
      regime: estado.situacao === "casal" && estado.regimeTributacao !== "separada" ? "conjunta" : "individual",
      numDependentes: estado.numDependentesEstimado,
    });
    return `
      <div class="field" style="margin-top:var(--space-4)">
        <label for="num-dependentes">Número de dependentes (estimativa)</label>
        <input type="number" id="num-dependentes" min="0" max="10" value="${estado.numDependentesEstimado}" />
        <p class="field-hint">${pt.onboarding.agregado.quocienteLabel}: <strong class="num">${q.toFixed(2)}</strong></p>
      </div>`;
  }

  function renderCampoPessoa(p, i) {
    return `
      <div class="card" style="padding:var(--space-4)">
        <p class="row-between"><strong>Pessoa ${p.id}</strong>${i === 1 ? `<button class="btn btn-ghost" data-action="remover-pessoa" data-id="${p.id}">Remover</button>` : ""}</p>
        <div class="field">
          <label for="nome-${p.id}">${pt.onboarding.sujeitosPassivos.nome}</label>
          <input type="text" id="nome-${p.id}" data-campo="nome" data-id="${p.id}" value="${p.nome}" />
        </div>
        <div class="field">
          <label for="nif-${p.id}">${pt.onboarding.sujeitosPassivos.nif}</label>
          <input type="text" id="nif-${p.id}" data-campo="nif" data-id="${p.id}" value="${p.nif}" inputmode="numeric" maxlength="9" />
        </div>
      </div>`;
  }

  function navegacao(podeAvancar, labelCta) {
    return `
      <div class="onboarding__nav">
        <button class="btn btn-ghost" data-action="voltar">${pt.onboarding.voltar}</button>
        <button class="btn btn-primary" data-action="seguinte" ${podeAvancar ? "" : "disabled"}>${labelCta ?? pt.onboarding.seguinte}</button>
      </div>`;
  }

  function iconeCadeado() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M7 10V7a5 5 0 0110 0v3"/></svg>`;
  }

  // Mesmo ícone do banner legal global (index.html) — para o aviso ficar
  // reconhecível como "a mesma mensagem", só que aqui dentro da caixa
  // escura em vez do banner amarelo.
  function iconeAviso() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`;
  }

  function ligarEventos(wrap) {
    wrap.querySelectorAll('[data-action="seguinte"]').forEach((el) => el.addEventListener("click", avancar));
    wrap.querySelectorAll('[data-action="voltar"]').forEach((el) => el.addEventListener("click", recuar));
    const chkAviso = wrap.querySelector("#confirmar-aviso");
    if (chkAviso) chkAviso.addEventListener("change", (e) => {
      estado.confirmouAviso = e.target.checked;
      render();
    });
    wrap.querySelectorAll('input[name="situacao"]').forEach((el) =>
      el.addEventListener("change", (e) => {
        estado.situacao = e.target.value;
        if (estado.situacao === "casal" && estado.pessoas.length === 1) {
          estado.pessoas.push({ id: "B", nome: "", nif: "" });
        } else if (estado.situacao !== "casal" && estado.pessoas.length > 1) {
          // Só "casal/união de facto" tem dois sujeitos passivos — ao voltar
          // para uma situação de um só sujeito passivo, a 2ª pessoa
          // (adicionada automaticamente acima ou manualmente, ver
          // data-action="adicionar-pessoa") tem de ser descartada. Sem
          // isto, escolher "casal" e depois voltar a "sozinho(a)" deixava
          // sempre 2 pessoas por preencher, sem nenhuma forma de remover a
          // segunda.
          estado.pessoas = [estado.pessoas[0]];
        }
        render();
      })
    );
    wrap.querySelectorAll('input[name="regime"]').forEach((el) =>
      el.addEventListener("change", (e) => {
        estado.regimeTributacao = e.target.value;
        render();
      })
    );
    wrap.querySelectorAll('input[name="fonte"]').forEach((el) =>
      el.addEventListener("change", (e) => {
        if (e.target.checked) estado.fontes.add(e.target.value);
        else estado.fontes.delete(e.target.value);
        render();
      })
    );
    const numDep = wrap.querySelector("#num-dependentes");
    if (numDep) numDep.addEventListener("input", (e) => {
      estado.numDependentesEstimado = Number(e.target.value) || 0;
      render();
    });
    wrap.querySelectorAll("[data-campo]").forEach((el) =>
      el.addEventListener("input", (e) => {
        const pessoa = estado.pessoas.find((p) => p.id === e.target.dataset.id);
        if (pessoa) pessoa[e.target.dataset.campo] = e.target.value;
        const btnSeguinte = wrap.querySelector('[data-action="seguinte"]');
        if (btnSeguinte) btnSeguinte.disabled = !estado.pessoas[0].nome;
      })
    );
    const btnAdd = wrap.querySelector('[data-action="adicionar-pessoa"]');
    if (btnAdd) btnAdd.addEventListener("click", () => {
      estado.pessoas.push({ id: "B", nome: "", nif: "" });
      render();
    });
    const btnCarregar = wrap.querySelector('[data-action="carregar-primeiro"]');
    if (btnCarregar) btnCarregar.addEventListener("click", () => concluir({ abrirUpload: true }));
    const btnExplorar = wrap.querySelector('[data-action="explorar"]');
    if (btnExplorar) btnExplorar.addEventListener("click", () => concluir({ abrirUpload: false }));
  }

  function avancar() {
    if (estado.passo === TOTAL_PASSOS) return;
    estado.passo += 1;
    render();
  }
  function recuar() {
    if (estado.passo === 0) return;
    estado.passo -= 1;
    render();
  }

  async function concluir({ abrirUpload }) {
    await saveHousehold({
      situacao: estado.situacao,
      regimeTributacao: estado.situacao === "casal" ? estado.regimeTributacao : "individual",
      anoFiscalAtivo: new Date().getFullYear(),
      fontesRendimento: [...estado.fontes],
      onboardingConcluido: true,
    });
    for (const p of estado.pessoas) {
      if (p.nome) await savePessoa(p);
    }
    onConcluido({ abrirUpload });
  }

  render();
  return { render };
}

export async function precisaOnboarding() {
  const household = await getHousehold();
  return !household || !household.onboardingConcluido;
}
