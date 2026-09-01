// ui/components/confirmacao.js
// Ecrã de confirmação editável, obrigatório após qualquer parsing
// (secção 6.3) — protege contra erros de extração desde o v1 e é a base
// sobre a qual assentará a validação quando o parser passar a IA (v2).

export function abrirConfirmacao({ resultadoParsing, tipo, nifEmpregador, onConfirmar, onCancelar }) {
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(20,26,43,.55);display:flex;align-items:flex-end;justify-content:center;z-index:50;";

  const rubricas = resultadoParsing.rubricas.map((r) => ({ ...r }));
  // Guarda-se uma cópia do que foi extraído automaticamente para poder
  // comparar com o que o utilizador editar — é essa diferença que diz à
  // app o que ela devia ter lido, para lembrar da próxima vez (ver
  // storage/db.js: guardarCorrecoesEntidade).
  const rubricasOriginais = resultadoParsing.rubricas.map((r) => ({ ...r }));
  const podeAprender = tipo === "talao" && !!nifEmpregador;
  let lembrarCorrecoes = true;

  const painel = document.createElement("div");
  painel.className = "card";
  painel.style.cssText =
    "width:100%;max-width:640px;max-height:88vh;overflow:auto;border-radius:16px 16px 0 0;padding:var(--space-5);";

  function render() {
    painel.innerHTML = `
      <h2>Confirme os valores extraídos</h2>
      <p class="muted">
        ${
          resultadoParsing.confianca === "baixa"
            ? "Não conseguimos ler a maior parte deste documento com confiança — reveja com atenção ou carregue os valores manualmente."
            : "Reveja cada campo ao lado do documento original antes de gravar. Pode editar qualquer valor."
        }
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
      ${
        podeAprender
          ? `<label class="row" style="gap:var(--space-2);align-items:flex-start;margin-top:var(--space-4);">
              <input type="checkbox" data-action="lembrar" ${lembrarCorrecoes ? "checked" : ""} style="margin-top:3px" />
              <span class="muted">Se corrigir alguma coisa acima, lembrar destas correções da próxima vez que carregar um talão desta entidade.</span>
            </label>`
          : ""
      }
      <div class="onboarding__nav">
        <button class="btn btn-ghost" data-action="cancelar">Cancelar</button>
        <button class="btn btn-primary" data-action="confirmar">Guardar ${rubricas.length} rubrica${rubricas.length === 1 ? "" : "s"}</button>
      </div>
    `;
    ligar();
  }

  // Compara o que ficou depois da edição do utilizador com o que a app
  // tinha extraído sozinha — por código de rubrica — para saber o que
  // vale a pena lembrar da próxima vez.
  function detetarCorrecoes() {
    const correcoes = {};
    for (const original of rubricasOriginais) {
      if (!original.codigo) continue;
      const atual = rubricas.find((r) => r.codigo === original.codigo);
      if (!atual) continue;
      const diff = {};
      if (atual.descricao !== original.descricao) diff.descricao = atual.descricao;
      if (atual.tipo !== original.tipo) diff.tipo = atual.tipo;
      if (atual.categoria !== original.categoria) diff.categoria = atual.categoria;
      if (Object.keys(diff).length) correcoes[original.codigo] = diff;
    }
    return correcoes;
  }

  function ligar() {
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
    painel.querySelector('[data-action="adicionar"]').addEventListener("click", () => {
      rubricas.push({ descricao: "", tipo: "abono", categoria: tipo === "recibo_verde" ? "B" : "A", valorComRedu: 0 });
      render();
    });
    painel.querySelector('[data-action="lembrar"]')?.addEventListener("change", (e) => {
      lembrarCorrecoes = e.target.checked;
    });
    painel.querySelector('[data-action="cancelar"]').addEventListener("click", fechar);
    painel.querySelector('[data-action="confirmar"]').addEventListener("click", () => {
      const correcoes = podeAprender && lembrarCorrecoes ? detetarCorrecoes() : {};
      onConfirmar(rubricas.filter((r) => r.descricao && r.valorComRedu), correcoes);
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
