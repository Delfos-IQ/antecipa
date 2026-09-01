// ui/components/confirmacao.js
// Ecrã de confirmação editável, obrigatório após qualquer parsing
// (secção 6.3) — protege contra erros de extração desde o v1 e é a base
// sobre a qual assentará a validação quando o parser passar a IA (v2).
//
// Talão de vencimento: mostra só os 4 números que a app realmente usa
// (bruto, IRS retido, Segurança Social, líquido) em vez de cada rubrica
// do documento — o motor de cálculo só soma por categoria/tipo, nunca
// olha para rubricas individuais, e mostrar 15+ linhas editáveis para
// confirmar 4 números era fricção sem benefício. Recibo verde continua
// com a lista de linhas, que já é curta (só bruto e retenção).

function campoResumo({ campo, rotulo, valor }) {
  return `
    <div class="field">
      <label>${rotulo} €</label>
      <input type="number" step="0.01" data-campo-resumo="${campo}" value="${valor ?? ""}" />
    </div>`;
}

function renderTalao(resultadoParsing) {
  const r = resultadoParsing.resumo ?? {};
  return `
    <p class="muted">
      ${
        resultadoParsing.confianca === "baixa"
          ? "Não conseguimos ler este documento com confiança — reveja os valores com atenção ou preencha-os manualmente."
          : "Confira estes 4 valores com o documento original. Pode corrigir qualquer um deles."
      }
    </p>
    <div class="stack">
      ${campoResumo({ campo: "bruto", rotulo: "Vencimento bruto", valor: r.bruto })}
      ${campoResumo({ campo: "irsRetido", rotulo: "IRS retido", valor: r.irsRetido })}
      ${campoResumo({ campo: "segurancaSocial", rotulo: "Segurança Social", valor: r.segurancaSocial })}
      ${campoResumo({ campo: "liquido", rotulo: "Líquido", valor: r.liquido })}
    </div>
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

export function abrirConfirmacao({ resultadoParsing, tipo, onConfirmar, onCancelar }) {
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(20,26,43,.55);display:flex;align-items:flex-end;justify-content:center;z-index:50;";

  const ehTalao = tipo === "talao";
  // Cópia local editável do resumo (talão) ou da lista de rubricas (recibo verde).
  const resumo = ehTalao ? { ...(resultadoParsing.resumo ?? {}) } : null;
  const rubricas = !ehTalao ? (resultadoParsing.rubricas ?? []).map((r) => ({ ...r })) : null;

  const painel = document.createElement("div");
  painel.className = "card";
  painel.style.cssText =
    "width:100%;max-width:640px;max-height:88vh;overflow:auto;border-radius:16px 16px 0 0;padding:var(--space-5);";

  function render() {
    painel.innerHTML = `
      <h2>Confirme os valores extraídos</h2>
      ${ehTalao ? renderTalao(resultadoParsing) : renderListaRubricas(rubricas, tipo)}
      <div class="onboarding__nav">
        <button class="btn btn-ghost" data-action="cancelar">Cancelar</button>
        <button class="btn btn-primary" data-action="confirmar">Guardar</button>
      </div>
    `;
    ligar();
  }

  function ligar() {
    if (ehTalao) {
      painel.querySelectorAll("[data-campo-resumo]").forEach((el) =>
        el.addEventListener("input", (e) => {
          resumo[e.target.dataset.campoResumo] = e.target.value === "" ? null : Number(e.target.value);
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
      onConfirmar(ehTalao ? rubricasFinaisDoResumo(resumo) : rubricas.filter((r) => r.descricao && r.valorComRedu));
      fechar();
    });
  }

  function fechar() {
    overlay.remove();
    onCancelar?.();
  }

  overlay.appendChild(painel);
  document.body.appendChild(overlay);
  render();
}

// Reconstrói as rubricas internas (formato que engine/calculo-irs.js espera)
// a partir dos 4 números do resumo, já com os valores que o utilizador
// eventualmente corrigiu. "Outros descontos" é recalculado para que
// bruto - irs - ss - outros continue a bater certo com o líquido editado.
function rubricasFinaisDoResumo(resumo) {
  const bruto = resumo.bruto ?? 0;
  const irsRetido = resumo.irsRetido ?? 0;
  const segurancaSocial = resumo.segurancaSocial ?? 0;
  const liquido = resumo.liquido ?? bruto - irsRetido - segurancaSocial;
  const outrosDescontos = Math.max(Math.round((bruto - irsRetido - segurancaSocial - liquido) * 100) / 100, 0);

  const rubricas = [{ descricao: "Vencimento bruto", categoria: "A", tipo: "abono", valorComRedu: bruto }];
  if (irsRetido) {
    rubricas.push({ descricao: "IRS retido", categoria: "A", tipo: "desconto", valorComRedu: irsRetido, categoriaIRS: true });
  }
  if (segurancaSocial) {
    rubricas.push({ descricao: "Segurança Social", categoria: "A", tipo: "desconto", valorComRedu: segurancaSocial, categoriaSS: true });
  }
  if (outrosDescontos) {
    rubricas.push({ descricao: "Outros descontos", categoria: "A", tipo: "desconto", valorComRedu: outrosDescontos });
  }
  return rubricas;
}
