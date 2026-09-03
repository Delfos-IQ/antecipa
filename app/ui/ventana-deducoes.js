// ui/ventana-deducoes.js
// Ventana "Deduções e rendimentos" — extraída da Perfil (onde vivia como
// mais um cartão) para uma tab própria, por ser um input fiscal que
// alimenta diretamente a Simulação, não uma definição de conta. Ver
// discussão na auditoria de 02/09/2026 (Dani pediu opinião sobre isto).

import { pt } from "../data/i18n.js";
import { getDeducoesColeta, saveDeducoesColeta } from "../storage/db.js";
import { getHousehold } from "../storage/db.js";

// Lista plana de todos os campos editáveis de deducoesColeta, agrupados só
// para efeitos de apresentação (o motor em engine/calculo-irs.js lê tudo
// do mesmo objeto plano, ver getDeducoesColeta em storage/db.js). Os
// grupos (título, hint, label/hint por campo) vivem em data/i18n.js —
// pt.perfil.deducoesGrupos — este array só define a ordem e que campos
// pertencem a cada grupo.
const GRUPOS_DEDUCOES = [
  { chave: "saudeEducacao", campos: ["saude", "educacao", "ppr", "habitacao"] },
  { chave: "familia", campos: ["despesasGerais"] },
  { chave: "exigenciaFatura", campos: ["exigenciaFaturaRestauracao", "exigenciaFaturaReparacaoAutomovel", "exigenciaFaturaPassesMensais", "exigenciaFaturaOutras"] },
  { chave: "capital", campos: ["maisValias"] },
  { chave: "outras", campos: ["donativos", "duplaTributacao"] },
];

function renderGrupoDeducao(grupo, valores) {
  const defsGrupo = pt.perfil.deducoesGrupos[grupo.chave];
  return `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <p class="section-title">${defsGrupo.titulo}</p>
      ${defsGrupo.corpoHint ? `<p class="field-hint" style="margin-bottom:var(--space-3)">${defsGrupo.corpoHint}</p>` : ""}
      <div class="stack" style="gap:var(--space-3)">
        ${grupo.campos
          .map((campo) => {
            const def = defsGrupo[campo];
            const valorAtual = valores?.[campo] ?? 0;
            return `
          <label style="display:block">
            <span style="font-size:0.86rem;font-weight:500">${def.label}</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-deducao-campo="${campo}"
              value="${valorAtual || ""}" placeholder="0,00" style="margin-top:4px" />
            <span class="field-hint" style="display:block;margin-top:2px">${def.hint}</span>
          </label>`;
          })
          .join("")}
      </div>
    </div>`;
}

export async function renderVentanaDeducoes({ container, anoFiscal }) {
  await montar();

  async function montar() {
    const household = await getHousehold();
    const anoAtivo = household?.anoFiscalAtivo ?? anoFiscal;
    const deducoesColeta = await getDeducoesColeta(anoAtivo, "household");

    container.innerHTML = `
      <h2>${pt.perfil.deducoesTitulo}</h2>
      <p class="field-hint" style="margin-bottom:var(--space-4)">${pt.perfil.deducoesCorpo}</p>
      ${GRUPOS_DEDUCOES.map((grupo) => renderGrupoDeducao(grupo, deducoesColeta)).join("")}
      <p class="muted" style="font-size:0.78rem;margin-top:var(--space-2)">${pt.perfil.deducoesGuardar}</p>
      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
      el.addEventListener("blur", async () => {
        const atual = await getDeducoesColeta(anoAtivo, "household");
        const valor = el.value === "" ? 0 : Number(el.value);
        atual[el.dataset.deducaoCampo] = Number.isFinite(valor) ? valor : 0;
        await saveDeducoesColeta(anoAtivo, "household", atual);
      });
    });
  }
}
