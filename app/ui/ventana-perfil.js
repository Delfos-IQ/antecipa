// ui/ventana-perfil.js
// Ventana "Perfil" — identidade do agregado, gestão multi-ano fiscal
// (trocar de exercício, exportar backup, limpar dados) e regresso ao
// ecrã de boas-vindas. Não fazia parte do desenho original (secção 8);
// adicionada na auditoria autónoma de set/2026 a pedido do utilizador.

import { pt } from "../data/i18n.js";
import {
  getHousehold,
  getPessoas,
  saveHousehold,
  getDependentes,
  saveDependente,
  removeDependente,
  getAnosFiscaisComDados,
  exportarTudo,
  limparAnoFiscal,
  limparTudo,
  definirAnoFiscalAtivo,
  getDeducoesColeta,
  saveDeducoesColeta,
} from "../storage/db.js";

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
  { chave: "outras", campos: ["duplaTributacao"] },
];

// Mesma lógica de idadeDoDependenteNoAno em engine/calculo-irs.js — aqui só
// para mostrar ao utilizador que escalão se aplica a cada dependente,
// nunca usada para o cálculo em si (esse continua a viver só no motor).
function idadeNoAno(dataNascimento, anoFiscal) {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;
  const referencia = new Date(`${anoFiscal}-12-31`);
  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAnos =
    referencia.getMonth() < nascimento.getMonth() ||
    (referencia.getMonth() === nascimento.getMonth() && referencia.getDate() < nascimento.getDate());
  if (aindaNaoFezAnos) idade -= 1;
  return idade;
}

function formatarDataHora(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function renderGrupoDeducao(grupo, valores) {
  const defsGrupo = pt.perfil.deducoesGrupos[grupo.chave];
  return `
    <div style="margin-bottom:var(--space-3)">
      <p style="font-weight:600;font-size:0.88rem;margin-bottom:var(--space-1)">${defsGrupo.titulo}</p>
      ${defsGrupo.corpoHint ? `<p class="field-hint" style="margin-bottom:var(--space-2)">${defsGrupo.corpoHint}</p>` : ""}
      <div class="stack" style="gap:var(--space-2)">
        ${grupo.campos
          .map((campo) => {
            const def = defsGrupo[campo];
            const valorAtual = valores?.[campo] ?? 0;
            return `
          <label style="display:block">
            <span style="font-size:0.82rem">${def.label}</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-deducao-campo="${campo}"
              value="${valorAtual || ""}" placeholder="0,00" style="margin-top:2px" />
            <span class="field-hint" style="display:block;margin-top:2px">${def.hint}</span>
          </label>`;
          })
          .join("")}
      </div>
    </div>`;
}

function descarregarJSON(objeto, nomeFicheiro) {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeFicheiro;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function renderVentanaPerfil({ container, anoFiscal, onAnoFiscalMudou }) {
  await montar();

  async function montar() {
    const household = await getHousehold();
    const pessoas = await getPessoas();
    const dependentes = (await getDependentes()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const anos = await getAnosFiscaisComDados();
    const anoAtivo = household?.anoFiscalAtivo ?? anoFiscal;
    const deducoesColeta = await getDeducoesColeta(anoAtivo, "household");

    // Garante que o ano ativo aparece sempre na lista de anos disponíveis,
    // mesmo que ainda não tenha nenhum documento carregado.
    const anosDisponiveis = [...new Set([...anos, anoAtivo, new Date().getFullYear()])].sort((a, b) => a - b);

    container.innerHTML = `
      <h2>${pt.perfil.titulo}</h2>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.agregadoTitulo}</p>
        <p class="muted" style="margin-top:var(--space-1)">
          ${pt.perfil.situacaoLabel}: <strong>${pt.onboarding.agregado.opcoes[household?.situacao]?.titulo ?? "—"}</strong>
        </p>
        ${pessoas
          .map((p) => `<p class="muted" style="margin-top:2px">${p.nome || p.id}${p.nif ? ` · NIF ${p.nif}` : ""}</p>`)
          .join("")}
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.dependentesTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.dependentesCorpo}</p>
        ${
          dependentes.length
            ? dependentes
                .map((d) => {
                  const idade = idadeNoAno(d.dataNascimento, anoAtivo);
                  return `
              <div class="doc-card" style="margin-bottom:var(--space-2)">
                <div class="row" style="gap:var(--space-2);flex-wrap:wrap;align-items:center">
                  <input type="text" data-dep-campo="nome" data-dep-id="${d.id}" value="${d.nome ?? ""}" placeholder="${pt.perfil.dependenteNomePlaceholder}" style="flex:1 1 140px" />
                  <input type="date" data-dep-campo="dataNascimento" data-dep-id="${d.id}" value="${d.dataNascimento ?? ""}" style="flex:1 1 150px;width:auto" />
                  <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;white-space:nowrap">
                    <input type="checkbox" data-dep-campo="guarda" data-dep-id="${d.id}" ${d.guarda === "partilhada" ? "checked" : ""} />
                    ${pt.perfil.guardaPartilhada}
                  </label>
                  <button class="btn btn-ghost" data-action="remover-dependente" data-dep-id="${d.id}" style="color:var(--pagar)">${pt.perfil.remover}</button>
                </div>
                <p class="muted" style="margin-top:var(--space-2);font-size:0.8rem">
                  ${idade !== null ? `${pt.perfil.idadeEm} ${anoAtivo}: ${idade} ${pt.perfil.anos}` : pt.perfil.semDataNascimento}
                </p>
              </div>`;
                })
                .join("")
            : `<p class="empty-state">${pt.perfil.semDependentes}</p>`
        }
        <button class="btn btn-secondary btn-block" data-action="adicionar-dependente" style="margin-top:var(--space-2)">${pt.perfil.adicionarDependente}</button>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.anoFiscalTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.anoFiscalCorpo}</p>
        <div class="row" style="gap:var(--space-2);flex-wrap:wrap;align-items:center">
          <select id="perfil-ano-select" style="width:auto;min-height:auto;padding:8px 10px">
            ${anosDisponiveis.map((a) => `<option value="${a}" ${a === anoAtivo ? "selected" : ""}>${a}</option>`).join("")}
          </select>
          <button class="btn btn-secondary" data-action="novo-ano">${pt.perfil.novoAno}</button>
        </div>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.deducoesTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.deducoesCorpo}</p>
        ${GRUPOS_DEDUCOES.map((grupo) => renderGrupoDeducao(grupo, deducoesColeta)).join("")}
        <p class="muted" style="margin-top:var(--space-2);font-size:0.78rem">${pt.perfil.deducoesGuardar}</p>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.higieneTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.higieneCorpo}</p>
        <div class="stack" style="gap:var(--space-2)">
          <button class="btn btn-secondary btn-block" data-action="exportar-tudo">${pt.perfil.exportarTudo}</button>
          <button class="btn btn-ghost btn-block" data-action="limpar-ano" style="color:var(--pagar)">
            ${pt.perfil.limparAno}${anoAtivo}
          </button>
          <button class="btn btn-ghost btn-block" data-action="limpar-tudo" style="color:var(--pagar)">
            ${pt.perfil.limparTudo}
          </button>
        </div>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.navegacaoTitulo}</p>
        <a class="btn btn-secondary btn-block" href="../" style="margin-top:var(--space-3)">${pt.perfil.voltarBoasVindas}</a>
      </div>

      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    // Guarda todos os campos de todas as linhas de dependente antes de
    // voltar a desenhar o painel (montar() reconstrói tudo do zero a
    // partir do que está gravado). Sem isto, editar a data de nascimento
    // de uma linha provocava um re-render que perdia qualquer alteração
    // ainda não confirmada (blur) no campo "Nome" da mesma linha — mesma
    // classe de bug já vista no ecrã de confirmação (ver
    // ui/components/confirmacao.js): nunca ler/gravar a partir de uma
    // cópia desatualizada quando há mais do que um caminho de edição.
    async function gravarTodosOsCamposVisiveis() {
      const porId = new Map();
      container.querySelectorAll("[data-dep-campo]").forEach((el) => {
        const id = Number(el.dataset.depId);
        const dependenteOriginal = dependentes.find((d) => d.id === id) ?? { id };
        const atual = porId.get(id) ?? { ...dependenteOriginal };
        const campo = el.dataset.depCampo;
        atual[campo] = campo === "guarda" ? (el.checked ? "partilhada" : "exclusiva") : el.value;
        porId.set(id, atual);
      });
      for (const dependente of porId.values()) await saveDependente(dependente);
    }

    container.querySelectorAll("[data-dep-campo]").forEach((el) => {
      const evento = el.type === "checkbox" || el.type === "date" ? "change" : "blur";
      el.addEventListener(evento, async () => {
        await gravarTodosOsCamposVisiveis();
        await montar();
      });
    });

    container.querySelectorAll('[data-action="remover-dependente"]').forEach((el) =>
      el.addEventListener("click", async () => {
        await removeDependente(Number(el.dataset.depId));
        await montar();
      })
    );

    container.querySelector('[data-action="adicionar-dependente"]')?.addEventListener("click", async () => {
      await saveDependente({ nome: "", dataNascimento: "", guarda: "exclusiva" });
      await montar();
    });

    // Campos de deduções: gravados no blur, sem forçar um re-render de
    // todo o painel (evitaria perder o foco enquanto o utilizador navega
    // entre campos com Tab) — cada campo já guarda o valor mais recente
    // de deducoesColeta, lido de novo do storage a cada gravação para
    // nunca sobrepor alterações concorrentes de outro campo.
    container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
      el.addEventListener("blur", async () => {
        const atual = await getDeducoesColeta(anoAtivo, "household");
        const valor = el.value === "" ? 0 : Number(el.value);
        atual[el.dataset.deducaoCampo] = Number.isFinite(valor) ? valor : 0;
        await saveDeducoesColeta(anoAtivo, "household", atual);
      });
    });

    container.querySelector("#perfil-ano-select")?.addEventListener("change", async (e) => {
      const novoAno = Number(e.target.value);
      await definirAnoFiscalAtivo(novoAno);
      onAnoFiscalMudou?.(novoAno);
      await montar();
    });

    container.querySelector('[data-action="novo-ano"]')?.addEventListener("click", async () => {
      const proximo = Math.max(...anosDisponiveis, anoAtivo) + 1;
      await definirAnoFiscalAtivo(proximo);
      onAnoFiscalMudou?.(proximo);
      await montar();
    });

    container.querySelector('[data-action="exportar-tudo"]')?.addEventListener("click", async () => {
      const dump = await exportarTudo();
      descarregarJSON(dump, `antecipa-backup-${new Date().toISOString().slice(0, 10)}.json`);
    });

    container.querySelector('[data-action="limpar-ano"]')?.addEventListener("click", async () => {
      const confirmar = window.confirm(
        `${pt.perfil.confirmarLimparAno} ${anoAtivo}?\n\n${pt.perfil.confirmarLimparAvisoBackup}`
      );
      if (!confirmar) return;
      await limparAnoFiscal(anoAtivo);
      onAnoFiscalMudou?.(anoAtivo);
      await montar();
    });

    container.querySelector('[data-action="limpar-tudo"]')?.addEventListener("click", async () => {
      const confirmar = window.confirm(`${pt.perfil.confirmarLimparTudo}\n\n${pt.perfil.confirmarLimparAvisoBackup}`);
      if (!confirmar) return;
      await limparTudo();
      window.location.reload();
    });
  }
}
