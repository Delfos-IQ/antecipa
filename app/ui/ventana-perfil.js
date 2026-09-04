// ui/ventana-perfil.js
// Ventana "Perfil" — identidade do agregado, gestão multi-ano fiscal
// (trocar de exercício, exportar backup, limpar dados) e regresso ao
// ecrã de boas-vindas. Não fazia parte do desenho original (secção 8);
// adicionada na auditoria autónoma de set/2026 a pedido do utilizador.
//
// Nota (02/09/2026): o cartão "Deduções e outros rendimentos" que vivia
// aqui foi promovido a tab própria — ver ui/ventana-deducoes.js — por ser
// um input fiscal que alimenta diretamente a Simulação, não uma
// definição de conta como o resto desta ventana.

import { pt } from "../data/i18n.js";
import { revisaoFiscal, obterTabelaFiscal } from "../data/legislacao-2026.js";
import { VERSAO_ATUAL, HISTORICO_VERSOES } from "../data/versao.js";
import { valorDeducaoPorDependente, valorDeducaoAscendente } from "../engine/calculo-irs.js";
import {
  getHousehold,
  getPessoas,
  saveHousehold,
  savePessoa,
  removePessoa,
  getDependentes,
  saveDependente,
  removeDependente,
  getAscendentes,
  saveAscendente,
  removeAscendente,
  getAnosFiscaisComDados,
  exportarTudo,
  limparAnoFiscal,
  limparTudo,
  definirAnoFiscalAtivo,
} from "../storage/db.js";

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

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" })
    .format(valor ?? 0)
    .replace(" €", '<span class="moeda">€</span>');
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
  // Estado transitório dia/mês/ano por dependente (id → { dia, mes, ano }),
  // vive fora de montar() para sobreviver aos re-renders que cada blur
  // dispara. Sem isto: preencher "dia" grava dataNascimento="" (porque
  // mês/ano ainda faltam) e o re-render seguinte voltava a mostrar os 3
  // campos vazios — perdendo o "dia" já escrito antes de chegar a "mês".
  // Bug apanhado no teste automático desta sessão (03/09/2026).
  const dataNascPendente = new Map();

  await montar();

  async function montar() {
    const household = await getHousehold();
    const pessoas = await getPessoas();
    const dependentes = (await getDependentes()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const ascendentes = (await getAscendentes()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const anos = await getAnosFiscaisComDados();
    const anoAtivo = household?.anoFiscalAtivo ?? anoFiscal;

    // Garante que o ano ativo aparece sempre na lista de anos disponíveis,
    // mesmo que ainda não tenha nenhum documento carregado.
    const anosDisponiveis = [...new Set([...anos, anoAtivo, new Date().getFullYear()])].sort((a, b) => a - b);

    // Mesmos limites usados pelo motor (engine/calculo-irs.js) — reutiliza
    // valorDeducaoPorDependente diretamente em vez de duplicar a fórmula
    // aqui, para nunca divergir do valor que a Simulação acaba por mostrar.
    const limitesDeducoes = obterTabelaFiscal(anoAtivo).limitesDeducoes;

    container.innerHTML = `
      <h2>${pt.perfil.titulo}</h2>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.agregadoTitulo}</p>
        <div class="field" style="margin-top:var(--space-2)">
          <label for="agregado-situacao">${pt.perfil.situacaoLabel}</label>
          <select id="agregado-situacao" data-action="mudar-situacao">
            ${Object.entries(pt.onboarding.agregado.opcoes)
              .map(([valor, o]) => `<option value="${valor}" ${household?.situacao === valor ? "selected" : ""}>${o.titulo}</option>`)
              .join("")}
          </select>
        </div>
        ${
          household?.situacao === "casal"
            ? `<div class="field">
                <label for="agregado-regime">${pt.onboarding.agregado.regimeTitulo}</label>
                <select id="agregado-regime" data-action="mudar-regime">
                  ${Object.entries(pt.onboarding.agregado.regimes)
                    .map(([valor, o]) => `<option value="${valor}" ${household?.regimeTributacao === valor ? "selected" : ""}>${o.titulo}</option>`)
                    .join("")}
                </select>
              </div>`
            : ""
        }
        ${pessoas
          .map(
            (p, i) => `
          <div class="doc-card" style="margin-top:var(--space-2)">
            <div class="row" style="gap:var(--space-2);flex-wrap:wrap;align-items:center">
              <input type="text" data-pessoa-campo="nome" data-pessoa-id="${p.id}" value="${p.nome ?? ""}" placeholder="${pt.perfil.agregadoNomePlaceholder}" style="flex:1 1 140px" />
              <input type="text" data-pessoa-campo="nif" data-pessoa-id="${p.id}" value="${p.nif ?? ""}" placeholder="${pt.perfil.agregadoNifPlaceholder}" inputmode="numeric" maxlength="9" style="flex:1 1 110px" />
              ${i > 0 ? `<button class="btn btn-ghost" data-action="remover-pessoa" data-pessoa-id="${p.id}" style="color:var(--pagar)">${pt.perfil.removerPessoa}</button>` : ""}
            </div>
            <div class="row" style="gap:var(--space-2);flex-wrap:wrap;align-items:center;margin-top:var(--space-2)">
              <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem">
                <input type="checkbox" data-pessoa-campo="deficiencia" data-pessoa-id="${p.id}" ${p.deficiencia ? "checked" : ""} />
                ${pt.perfil.deficienciaLabel}
              </label>
              ${
                p.deficiencia
                  ? `<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem">
                      <input type="checkbox" data-pessoa-campo="incapacidadeIgualOuSuperior90" data-pessoa-id="${p.id}" ${p.incapacidadeIgualOuSuperior90 ? "checked" : ""} />
                      ${pt.perfil.incapacidade90Label}
                    </label>`
                  : ""
              }
            </div>
            ${p.deficiencia ? `<p class="field-hint" style="margin-top:var(--space-1)">${pt.perfil.deficienciaAjuda}</p>` : ""}
          </div>`
          )
          .join("")}
        ${
          pessoas.length < 2
            ? `<button class="btn btn-secondary btn-block" data-action="adicionar-pessoa" style="margin-top:var(--space-2)">${pt.perfil.adicionarConjuge}</button>`
            : ""
        }
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.dependentesTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.dependentesCorpo}</p>
        ${
          dependentes.length
            ? dependentes
                .map((d, i) => {
                  const idade = idadeNoAno(d.dataNascimento, anoAtivo);
                  const deducao = valorDeducaoPorDependente(d, i, anoAtivo, limitesDeducoes);
                  const [anoSalvo = "", mesSalvo = "", diaSalvo = ""] = (d.dataNascimento || "").split("-");
                  const pendente = dataNascPendente.get(d.id) ?? {};
                  const diaNasc = pendente.dia ?? diaSalvo;
                  const mesNasc = pendente.mes ?? mesSalvo;
                  const anoNasc = pendente.ano ?? anoSalvo;
                  return `
              <div class="doc-card" style="margin-bottom:var(--space-2)" data-dep-card="${d.id}">
                <input type="text" data-dep-campo="nome" data-dep-id="${d.id}" value="${d.nome ?? ""}" placeholder="${pt.perfil.dependenteNomePlaceholder}" style="width:100%;margin-bottom:var(--space-2)" />
                <div class="row" style="gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:var(--space-2)">
                  <span class="field-hint" style="white-space:nowrap">${pt.perfil.dataNascimentoLabel}</span>
                  <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="DD" data-dep-data-campo="dia" data-dep-id="${d.id}" value="${diaNasc}" style="width:52px;text-align:center;flex:none" />
                  <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="MM" data-dep-data-campo="mes" data-dep-id="${d.id}" value="${mesNasc}" style="width:52px;text-align:center;flex:none" />
                  <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="AAAA" data-dep-data-campo="ano" data-dep-id="${d.id}" value="${anoNasc}" style="width:72px;text-align:center;flex:none" />
                </div>
                <div class="row" style="gap:var(--space-2);flex-wrap:wrap;align-items:center">
                  <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;white-space:nowrap">
                    <input type="checkbox" data-dep-campo="guarda" data-dep-id="${d.id}" ${d.guarda === "partilhada" ? "checked" : ""} />
                    ${pt.perfil.guardaPartilhada}
                  </label>
                  <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;white-space:nowrap">
                    <input type="checkbox" data-dep-campo="deficiencia" data-dep-id="${d.id}" ${d.deficiencia ? "checked" : ""} />
                    ${pt.perfil.deficienciaLabel}
                  </label>
                  ${
                    d.deficiencia
                      ? `<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;white-space:nowrap">
                          <input type="checkbox" data-dep-campo="incapacidadeIgualOuSuperior90" data-dep-id="${d.id}" ${d.incapacidadeIgualOuSuperior90 ? "checked" : ""} />
                          ${pt.perfil.incapacidade90Label}
                        </label>`
                      : ""
                  }
                  <button class="btn btn-ghost" data-action="remover-dependente" data-dep-id="${d.id}" style="color:var(--pagar)">${pt.perfil.remover}</button>
                </div>
                <div data-dep-guarda-ajuda>${d.guarda === "partilhada" ? `<p class="field-hint" style="margin-top:var(--space-2)">${pt.perfil.guardaPartilhadaAjuda}</p>` : ""}</div>
                <p class="muted" style="margin-top:var(--space-2);font-size:0.8rem" data-dep-resumo>
                  ${idade !== null ? `${pt.perfil.idadeEm} ${anoAtivo}: ${idade} ${pt.perfil.anos}` : pt.perfil.semDataNascimento}
                  · ${pt.perfil.deducaoDependenteLabel}: ${formatarMoeda(deducao)}${d.guarda === "partilhada" ? ` (${pt.perfil.guardaPartilhada.toLowerCase()})` : ""}
                </p>
              </div>`;
                })
                .join("")
            : `<p class="empty-state">${pt.perfil.semDependentes}</p>`
        }
        <button class="btn btn-secondary btn-block" data-action="adicionar-dependente" style="margin-top:var(--space-2)">${pt.perfil.adicionarDependente}</button>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.ascendentesTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.ascendentesCorpo}</p>
        ${
          ascendentes.length
            ? ascendentes
                .map(
                  (a) => `
              <div class="doc-card" style="margin-bottom:var(--space-2)" data-asc-card="${a.id}">
                <input type="text" data-asc-campo="nome" data-asc-id="${a.id}" value="${a.nome ?? ""}" placeholder="${pt.perfil.ascendenteNomePlaceholder}" style="width:100%;margin-bottom:var(--space-2)" />
                <div class="row" style="gap:var(--space-2);flex-wrap:wrap;align-items:center">
                  <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;white-space:nowrap">
                    <input type="checkbox" data-asc-campo="deficiencia" data-asc-id="${a.id}" ${a.deficiencia ? "checked" : ""} />
                    ${pt.perfil.deficienciaLabel}
                  </label>
                  <button class="btn btn-ghost" data-action="remover-ascendente" data-asc-id="${a.id}" style="color:var(--pagar)">${pt.perfil.removerAscendente}</button>
                </div>
                <p class="muted" style="margin-top:var(--space-2);font-size:0.8rem">
                  ${pt.perfil.deducaoAscendenteLabel}: ${formatarMoeda(valorDeducaoAscendente(a, ascendentes.length, limitesDeducoes))}
                </p>
              </div>`
                )
                .join("")
            : `<p class="empty-state">${pt.perfil.semAscendentes}</p>`
        }
        <button class="btn btn-secondary btn-block" data-action="adicionar-ascendente" style="margin-top:var(--space-2)">${pt.perfil.adicionarAscendente}</button>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.anoFiscalTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.anoFiscalCorpo}</p>
        <div class="stack" style="gap:var(--space-2)">
          ${anosDisponiveis
            .map((a) => {
              const ativo = a === anoAtivo;
              return `
              <div class="row" data-ano-linha="${a}" style="gap:var(--space-2);align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid ${ativo ? "var(--brass)" : "var(--hairline)"};border-radius:8px">
                <button class="btn btn-ghost" data-action="usar-ano" data-ano="${a}" ${ativo ? "disabled" : ""} style="padding:4px 8px;font-weight:${ativo ? 700 : 400};flex:1;text-align:left">
                  ${a}${ativo ? ` · ${pt.perfil.anoAtivoLabel}` : ""}
                </button>
                ${ativo ? "" : `<button class="btn btn-ghost" data-action="remover-ano" data-ano="${a}" style="color:var(--pagar);flex:none">${pt.perfil.removerAno}</button>`}
              </div>`;
            })
            .join("")}
          <button class="btn btn-secondary" data-action="novo-ano" style="margin-top:var(--space-1)">${pt.perfil.novoAno}</button>
          <div style="margin-top:var(--space-2)">
            <p class="field-hint" style="margin-bottom:var(--space-1)">${pt.perfil.adicionarAnoAnteriorLabel}</p>
            <div class="row" style="gap:var(--space-2)">
              <input type="number" data-campo="ano-anterior" placeholder="${pt.perfil.adicionarAnoAnteriorPlaceholder}" style="flex:1 1 90px" />
              <button class="btn btn-secondary" data-action="adicionar-ano-anterior" style="flex:none">${pt.perfil.adicionarAnoAnteriorBotao}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
        <p class="section-title">${pt.perfil.higieneTitulo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.higieneCorpo}</p>
        <p class="field-hint" style="margin-bottom:var(--space-3)">
          ${pt.perfil.revisaoFiscalPrefixo} ${revisaoFiscal.dataRevisao} · ${pt.perfil.revisaoFiscalProxima}: ${revisaoFiscal.proximaRevisaoPrevista}.
        </p>
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
      <p class="copyright-line">© ${new Date().getFullYear()} ${pt.perfil.copyrightTexto}</p>
      <p class="copyright-line" style="margin-top:var(--space-1)">
        ${pt.perfil.versaoAtualPrefixo} ${VERSAO_ATUAL} ·
        <button data-action="toggle-historico-versoes" style="font:inherit;color:inherit;text-decoration:underline;background:none;border:none;padding:0;cursor:pointer">${pt.perfil.historicoVersoesMostrar}</button>
      </p>
      <ul data-historico-versoes hidden style="list-style:none;padding:0;margin:var(--space-1) 0 0;font-size:.8rem;color:var(--muted)">
        ${HISTORICO_VERSOES.map((v) => `<li style="padding:2px 0">${v.versao} — ${v.resumo}</li>`).join("")}
      </ul>
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
      const getAtual = (id) => {
        const dependenteOriginal = dependentes.find((d) => d.id === id) ?? { id };
        if (!porId.has(id)) porId.set(id, { ...dependenteOriginal });
        return porId.get(id);
      };
      container.querySelectorAll("[data-dep-campo]").forEach((el) => {
        const id = Number(el.dataset.depId);
        const atual = getAtual(id);
        const campo = el.dataset.depCampo;
        if (campo === "guarda") atual[campo] = el.checked ? "partilhada" : "exclusiva";
        else if (el.type === "checkbox") atual[campo] = el.checked;
        else atual[campo] = el.value;
      });
      // "incapacidade ≥90%" sem "deficiência" marcado não faz sentido —
      // mesma limpeza já feita para pessoas, acima.
      for (const atual of porId.values()) {
        if (!atual.deficiencia) atual.incapacidadeIgualOuSuperior90 = false;
      }
      // Dia/mês/ano separados (ver comentário mais abaixo, mesmo motivo do
      // date input nativo no onboarding) — recompõe a data ISO a partir dos
      // três campos, lendo os que não mudaram diretamente do dependente
      // original para não perder valor já gravado.
      container.querySelectorAll("[data-dep-data-campo]").forEach((el) => {
        const id = Number(el.dataset.depId);
        const atual = getAtual(id);
        const pendente = dataNascPendente.get(id) ?? {};
        const campo = el.dataset.depDataCampo;
        const valor = el.value ? String(el.value).padStart(campo === "ano" ? 4 : 2, "0") : "";
        pendente[campo] = valor;
        dataNascPendente.set(id, pendente);
        atual.dataNascimento = pendente.ano && pendente.mes && pendente.dia ? `${pendente.ano}-${pendente.mes}-${pendente.dia}` : "";
      });
      for (const dependente of porId.values()) await saveDependente(dependente);
    }

    // Grava e atualiza SÓ o resumo de cada dependente (idade/dedução + a
    // frase de guarda partilhada), sem tocar nos <input> — nunca chama
    // montar() (que reconstrói tudo via innerHTML). Isto porque montar()
    // no blur destruía o próprio campo para onde o Tab estava a avançar
    // (o browser já tinha decidido focar o campo seguinte, mas esse campo
    // deixava de existir um instante depois, quando o DOM era todo
    // reconstruído) — era essa a causa real do "o tabulador não funciona"
    // reportado (03/09/2026), não o Tab em si. Atualizar só o texto do
    // resumo evita o problema completamente, em vez de tentar adivinhar
    // para onde devolver o foco depois.
    async function gravarEAtualizarResumo() {
      await gravarTodosOsCamposVisiveis();
      const dependentesAtuais = (await getDependentes()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      dependentesAtuais.forEach((d, i) => {
        const cartao = container.querySelector(`[data-dep-card="${d.id}"]`);
        if (!cartao) return;
        const idade = idadeNoAno(d.dataNascimento, anoAtivo);
        const deducao = valorDeducaoPorDependente(d, i, anoAtivo, limitesDeducoes);
        const resumo = cartao.querySelector("[data-dep-resumo]");
        if (resumo) {
          resumo.innerHTML = `
            ${idade !== null ? `${pt.perfil.idadeEm} ${anoAtivo}: ${idade} ${pt.perfil.anos}` : pt.perfil.semDataNascimento}
            · ${pt.perfil.deducaoDependenteLabel}: ${formatarMoeda(deducao)}${d.guarda === "partilhada" ? ` (${pt.perfil.guardaPartilhada.toLowerCase()})` : ""}
          `;
        }
        const ajuda = cartao.querySelector("[data-dep-guarda-ajuda]");
        if (ajuda) {
          ajuda.innerHTML =
            d.guarda === "partilhada" ? `<p class="field-hint" style="margin-top:var(--space-2)">${pt.perfil.guardaPartilhadaAjuda}</p>` : "";
        }
      });
    }

    container.querySelectorAll("[data-dep-campo]").forEach((el) => {
      // "deficiencia" precisa de um re-render completo (montar()), não só
      // do resumo — é o que decide se o checkbox "incapacidade ≥90%"
      // aparece ou não. Os restantes campos continuam a usar
      // gravarEAtualizarResumo (mais leve, preserva o foco em edição).
      if (el.dataset.depCampo === "deficiencia") {
        el.addEventListener("change", async () => {
          await gravarTodosOsCamposVisiveis();
          await montar();
        });
        return;
      }
      const evento = el.type === "checkbox" ? "change" : "blur";
      el.addEventListener(evento, gravarEAtualizarResumo);
    });

    container.querySelectorAll("[data-dep-data-campo]").forEach((el) => {
      // Campos de texto (não number) para não perder largura com as setas do
      // spinner nativo (era essa a causa dos dígitos aparecerem cortados) —
      // por isso filtra só dígitos manualmente em vez de depender de
      // type="number".
      el.addEventListener("input", () => {
        el.value = el.value.replace(/\D/g, "");
      });
      el.addEventListener("blur", gravarEAtualizarResumo);
    });

    container.querySelector("#agregado-situacao")?.addEventListener("change", async (e) => {
      const situacao = e.target.value;
      const novoHousehold = { ...household, situacao };
      // "casal" precisa de um regime de tributação definido — mesmo default
      // do onboarding (comparar_ambos) se ainda não houver nenhum guardado.
      if (situacao === "casal" && !novoHousehold.regimeTributacao) {
        novoHousehold.regimeTributacao = "comparar_ambos";
      }
      await saveHousehold(novoHousehold);
      await montar();
    });

    container.querySelector("#agregado-regime")?.addEventListener("change", async (e) => {
      await saveHousehold({ ...household, regimeTributacao: e.target.value });
      await montar();
    });

    // gravarPessoa: lê TODOS os campos data-pessoa-campo desta pessoa (não
    // só o que disparou o evento) — mesmo padrão já usado para
    // dependentes/ascendentes, para nunca gravar um campo com um valor
    // desatualizado. Checkboxes (deficiencia/incapacidadeIgualOuSuperior90)
    // lêem `.checked`, os restantes `.value`. reRenderizar=true (usado nos
    // checkboxes) chama montar() no fim, para o checkbox de incapacidade
    // ≥90% aparecer/desaparecer consoante "deficiência" — os campos de
    // texto (nome/NIF) usam só "blur" e não precisam de reRenderizar,
    // porque nada na UI depende deles condicionalmente.
    async function gravarPessoa(id, { reRenderizar = false } = {}) {
      const pessoaOriginal = pessoas.find((p) => p.id === id) ?? { id };
      const atual = { ...pessoaOriginal };
      container.querySelectorAll(`[data-pessoa-id="${id}"]`).forEach((campoEl) => {
        const campo = campoEl.dataset.pessoaCampo;
        atual[campo] = campoEl.type === "checkbox" ? campoEl.checked : campoEl.value;
      });
      // "incapacidade ≥90%" sem "deficiência" marcado não faz sentido —
      // limpa-o se a deficiência for desmarcada, em vez de deixar um valor
      // órfão na base de dados que o motor ignoraria de qualquer forma.
      if (!atual.deficiencia) atual.incapacidadeIgualOuSuperior90 = false;
      await savePessoa(atual);
      if (reRenderizar) await montar();
    }

    container.querySelectorAll('[data-pessoa-campo="nome"], [data-pessoa-campo="nif"]').forEach((el) => {
      el.addEventListener("blur", () => gravarPessoa(el.dataset.pessoaId));
    });
    container.querySelectorAll('[data-pessoa-campo="deficiencia"], [data-pessoa-campo="incapacidadeIgualOuSuperior90"]').forEach((el) => {
      el.addEventListener("change", () => gravarPessoa(el.dataset.pessoaId, { reRenderizar: true }));
    });

    container.querySelector('[data-action="adicionar-pessoa"]')?.addEventListener("click", async () => {
      const novoId = pessoas.some((p) => p.id === "A") ? "B" : "A";
      await savePessoa({ id: novoId, nome: "", nif: "" });
      if (household?.situacao !== "casal") {
        await saveHousehold({ ...household, situacao: "casal", regimeTributacao: household?.regimeTributacao ?? "comparar_ambos" });
      }
      await montar();
    });

    container.querySelectorAll('[data-action="remover-pessoa"]').forEach((el) =>
      el.addEventListener("click", async () => {
        const confirmar = window.confirm(pt.perfil.confirmarRemoverPessoa);
        if (!confirmar) return;
        await removePessoa(el.dataset.pessoaId);
        await montar();
      })
    );

    container.querySelectorAll('[data-action="remover-dependente"]').forEach((el) =>
      el.addEventListener("click", async () => {
        const id = Number(el.dataset.depId);
        dataNascPendente.delete(id);
        await removeDependente(id);
        await montar();
      })
    );

    container.querySelector('[data-action="adicionar-dependente"]')?.addEventListener("click", async () => {
      await saveDependente({ nome: "", dataNascimento: "", guarda: "exclusiva" });
      await montar();
    });

    // Ascendentes a cargo — NOVO (04/09/2026). Bem mais simples que
    // dependentes (sem data de nascimento/guarda partilhada), por isso não
    // precisa do padrão "gravarTodosOsCamposVisiveis" + resumo separado:
    // grava tudo e volta a montar() de cada vez, já que não há um campo de
    // texto onde perder o foco no Tab seja um problema real (só 1 campo
    // de texto por linha, "nome").
    async function gravarAscendente(id) {
      const original = ascendentes.find((a) => a.id === id) ?? { id };
      const atual = { ...original };
      container.querySelectorAll(`[data-asc-id="${id}"]`).forEach((el) => {
        atual[el.dataset.ascCampo] = el.type === "checkbox" ? el.checked : el.value;
      });
      await saveAscendente(atual);
    }

    container.querySelectorAll('[data-asc-campo="nome"]').forEach((el) => {
      el.addEventListener("blur", () => gravarAscendente(Number(el.dataset.ascId)));
    });
    container.querySelectorAll('[data-asc-campo="deficiencia"]').forEach((el) => {
      el.addEventListener("change", async () => {
        await gravarAscendente(Number(el.dataset.ascId));
        await montar();
      });
    });

    container.querySelectorAll('[data-action="remover-ascendente"]').forEach((el) =>
      el.addEventListener("click", async () => {
        await removeAscendente(Number(el.dataset.ascId));
        await montar();
      })
    );

    container.querySelector('[data-action="adicionar-ascendente"]')?.addEventListener("click", async () => {
      await saveAscendente({ nome: "", deficiencia: false });
      await montar();
    });

    container.querySelectorAll('[data-action="usar-ano"]').forEach((el) =>
      el.addEventListener("click", async () => {
        const novoAno = Number(el.dataset.ano);
        await definirAnoFiscalAtivo(novoAno);
        onAnoFiscalMudou?.(novoAno);
        await montar();
      })
    );

    container.querySelectorAll('[data-action="remover-ano"]').forEach((el) =>
      el.addEventListener("click", async () => {
        const ano = Number(el.dataset.ano);
        const confirmar = window.confirm(
          `${pt.perfil.confirmarRemoverAno} ${ano}?\n\n${pt.perfil.confirmarRemoverAnoCorpo}\n${pt.perfil.confirmarLimparAvisoBackup}`
        );
        if (!confirmar) return;
        await limparAnoFiscal(ano);
        // O ano removido nunca é o ativo (o botão não aparece nesse caso),
        // por isso não é preciso escolher um ano de recurso aqui — o ano
        // ativo mantém-se o que já estava.
        await montar();
      })
    );

    container.querySelector('[data-action="novo-ano"]')?.addEventListener("click", async () => {
      const proximo = Math.max(...anosDisponiveis, anoAtivo) + 1;
      await definirAnoFiscalAtivo(proximo);
      onAnoFiscalMudou?.(proximo);
      await montar();
    });

    // Pedido do Dani (04/09/2026): "Podemos colocar o ano fiscal a partir
    // de 2025 [...] fazer uma simulação retrospetiva e ver se coincide."
    // O botão "novo-ano" acima só avança (max+1) — pensado para começar o
    // exercício seguinte. Este segundo caminho deixa escolher QUALQUER
    // ano, incluindo anos anteriores ao atual, desde que exista tabela
    // fiscal (data/legislacao-2026.js) para esse ano — obterTabelaFiscal
    // lança um erro claro com a lista de anos disponíveis quando não há,
    // e é esse erro que aproveitamos para a mensagem de aviso ao
    // utilizador, em vez de duplicar a lista aqui.
    container.querySelector('[data-action="adicionar-ano-anterior"]')?.addEventListener("click", async () => {
      const campo = container.querySelector('[data-campo="ano-anterior"]');
      const ano = Number(campo?.value);
      if (!ano || !Number.isInteger(ano)) return;
      try {
        obterTabelaFiscal(ano);
      } catch (err) {
        const anosSuportados = err.message.match(/Anos disponíveis: (.+)\)?$/)?.[1] ?? "";
        window.alert(`${pt.perfil.anoFiscalSemSuporte}: ${anosSuportados}`);
        return;
      }
      await definirAnoFiscalAtivo(ano);
      onAnoFiscalMudou?.(ano);
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

    container.querySelector('[data-action="toggle-historico-versoes"]')?.addEventListener("click", (e) => {
      const lista = container.querySelector("[data-historico-versoes]");
      const aberto = lista.hidden;
      lista.hidden = !aberto;
      e.currentTarget.textContent = aberto ? pt.perfil.historicoVersoesEsconder : pt.perfil.historicoVersoesMostrar;
    });
  }
}
