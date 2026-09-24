// ui/ventana-deducoes.js
// Ventana "Deduções e rendimentos" — extraída da Perfil (onde vivia como
// mais um cartão) para uma tab própria, por ser um input fiscal que
// alimenta diretamente a Simulação, não uma definição de conta. Ver
// discussão na auditoria de 02/09/2026 (Dani pediu opinião sobre isto).

import { pt } from "../data/i18n.js";
import { getDeducoesColeta, saveDeducoesColeta, getHousehold } from "../storage/db.js";
import { calcularDeducoesAColeta } from "../engine/calculo-irs.js";
import { obterTabelaFiscal } from "../data/legislacao-2026.js";

function formatarMoeda(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v ?? 0);
}

// Lista plana de todos os campos editáveis de deducoesColeta, agrupados só
// para efeitos de apresentação (o motor em engine/calculo-irs.js lê tudo
// do mesmo objeto plano, ver getDeducoesColeta em storage/db.js). Os
// grupos (título, hint, label/hint por campo) vivem em data/i18n.js —
// pt.perfil.deducoesGrupos — este array só define a ordem e que campos
// pertencem a cada grupo.
//
// `barras` (22/09/2026, pedido do Dani: replicar a barra de "dedução
// correspondente" do Portal das Finanças/e-Fatura): cada entrada injeta
// uma barra de progresso logo a seguir a um campo (`apos`), resumindo a
// dedução já calculada para uma `categoria` (chave do objeto devolvido
// por calcularDeducoesAColeta, em engine/calculo-irs.js — a MESMA função
// que a Simulação usa, sem duplicar aqui a lógica de percentagens/tetos).
// Quando dois campos partilham o mesmo teto (ex.: despesas próprias +
// despesas dos dependentes), a barra aparece só uma vez, depois do
// último dos dois — mostra a dedução conjunta, não uma por campo.
// `semContextoCompleto: true` marca categorias cujo teto real só se
// conhece com o rendimento todo carregado (habitação depende do escalão
// de IRS) — aqui usa-se o teto "geral" como estimativa, com uma nota a
// dizer que o valor definitivo fica confirmado na Simulação.
const GRUPOS_DEDUCOES = [
  {
    chave: "saudeEducacao",
    campos: ["saude", "saudeDependentes", "educacao", "educacaoDependentes", "ppr", "habitacao"],
    barras: [
      { apos: "saudeDependentes", categoria: "saude" },
      { apos: "educacaoDependentes", categoria: "educacao" },
      { apos: "ppr", categoria: "ppr" },
      { apos: "habitacao", categoria: "habitacao", semContextoCompleto: true },
    ],
  },
  {
    chave: "familia",
    campos: ["despesasGerais", "despesasGeraisDependentes"],
    barras: [{ apos: "despesasGeraisDependentes", categoria: "despesasGerais" }],
  },
  {
    chave: "exigenciaFatura",
    campos: ["exigenciaFaturaRestauracao", "exigenciaFaturaReparacaoAutomovel", "exigenciaFaturaPassesMensais", "exigenciaFaturaOutras"],
    barras: [{ apos: "exigenciaFaturaOutras", categoria: "exigenciaFatura" }],
  },
  { chave: "capital", campos: ["maisValias"] },
  {
    chave: "outras",
    campos: ["donativos", "duplaTributacao", "trabalhoDomestico"],
    barras: [{ apos: "trabalhoDomestico", categoria: "trabalhoDomestico" }],
    // donativos não tem barra — ver notaAposCampo abaixo, mostra-se uma
    // nota em vez de uma barra porque o teto (15% da coleta total) só
    // existe depois de calcular o ano inteiro.
    notaAposCampo: { donativos: "deducaoDonativosNota" },
  },
  { chave: "pagamentos", campos: ["pagamentosPorConta"] },
];

function renderBarra(categoria) {
  return `
    <div class="dedu-barra" data-barra-categoria="${categoria}">
      <div class="dedu-barra__linha">
        <span>${pt.perfil.deducaoBarraLabel}</span>
        <strong data-barra-valor class="num">—</strong>
      </div>
      <div class="dedu-barra__track"><div class="dedu-barra__fill" data-barra-fill style="width:0%"></div></div>
      <p class="dedu-barra__legenda" data-barra-legenda></p>
    </div>`;
}

function renderGrupoDeducao(grupo, valores) {
  const defsGrupo = pt.perfil.deducoesGrupos[grupo.chave];
  const barraApos = Object.fromEntries((grupo.barras ?? []).map((b) => [b.apos, b]));
  const notaApos = grupo.notaAposCampo ?? {};
  return `
    <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-4)">
      <p class="section-title">${defsGrupo.titulo}</p>
      ${defsGrupo.corpoHint ? `<p class="field-hint" style="margin-bottom:var(--space-3)">${defsGrupo.corpoHint}</p>` : ""}
      <div class="stack" style="gap:var(--space-3)">
        ${grupo.campos
          .map((campo) => {
            const def = defsGrupo[campo];
            const valorAtual = valores?.[campo] ?? 0;
            const barra = barraApos[campo];
            const notaChave = notaApos[campo];
            return `
          <label style="display:block">
            <span style="font-size:0.86rem;font-weight:500">${def.label}</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-deducao-campo="${campo}"
              value="${valorAtual || ""}" placeholder="0,00" style="margin-top:4px" />
            <span class="field-hint" style="display:block;margin-top:2px">${def.hint}</span>
            ${barra ? renderBarra(barra.categoria) : ""}
            ${notaChave ? `<p class="dedu-nota-simulacao">${pt.perfil[notaChave]}</p>` : ""}
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
    const tabela = obterTabelaFiscal(anoAtivo);
    const regime = household?.regime;

    // Mapa categoria → { semContextoCompleto } para saber, ao atualizar as
    // barras, quais delas devem mostrar a nota "estimativa" (habitação).
    const infoCategoria = Object.fromEntries(
      GRUPOS_DEDUCOES.flatMap((g) => g.barras ?? []).map((b) => [b.categoria, b])
    );

    container.innerHTML = `
      <h2>${pt.perfil.deducoesTitulo}</h2>
      <p class="field-hint" style="margin-bottom:var(--space-4)">${pt.perfil.deducoesCorpo}</p>
      ${GRUPOS_DEDUCOES.map((grupo) => renderGrupoDeducao(grupo, deducoesColeta)).join("")}
      <p class="muted" style="font-size:0.78rem;margin-top:var(--space-2)">${pt.perfil.deducoesGuardar}</p>
      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    // Lê os valores atuais diretamente do DOM (não do storage) para que a
    // barra reaja de imediato ao que se está a escrever, antes de sair do
    // campo (que é só quando se grava — ver listener "blur" abaixo).
    function lerValoresDoFormulario() {
      const valores = { ...deducoesColeta };
      container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
        const n = el.value === "" ? 0 : Number(el.value);
        valores[el.dataset.deducaoCampo] = Number.isFinite(n) ? n : 0;
      });
      return valores;
    }

    function atualizarBarras() {
      const valores = lerValoresDoFormulario();
      // Contexto parcial de propósito (sem rubricas/rendimento) — ver o
      // comentário junto a calcularDeducoesAColeta em calculo-irs.js
      // sobre quais categorias ficam exatas mesmo assim (saúde, educação,
      // exigência de fatura, trabalho doméstico, despesas gerais e PPR,
      // este último já correto por regime) e quais ficam como estimativa
      // (habitação) ou sem teto ainda (donativos, sem barra aqui).
      const resultado = calcularDeducoesAColeta({ deducoesColeta: valores, tabela, regime, anoFiscal: anoAtivo });

      container.querySelectorAll("[data-barra-categoria]").forEach((barraEl) => {
        const categoria = barraEl.dataset.barraCategoria;
        const valor = resultado[categoria] ?? 0;
        const limite = resultado.limites?.[categoria];
        const pct = limite ? Math.max(0, Math.min(100, Math.round((valor / limite) * 100))) : 0;
        const fillEl = barraEl.querySelector("[data-barra-fill]");
        fillEl.style.width = `${pct}%`;
        fillEl.dataset.cheio = String(pct >= 100);
        barraEl.querySelector("[data-barra-valor]").textContent = formatarMoeda(valor);
        const legendaEl = barraEl.querySelector("[data-barra-legenda]");
        const legendaBase = limite ? `${pct}% do teto de ${formatarMoeda(limite)}` : "";
        const nota = infoCategoria[categoria]?.semContextoCompleto ? ` ${pt.perfil.deducaoBarraSemContexto}` : "";
        legendaEl.textContent = `${legendaBase}${nota}`;
      });
    }

    atualizarBarras();

    container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
      el.addEventListener("input", atualizarBarras);
      el.addEventListener("blur", async () => {
        const atual = await getDeducoesColeta(anoAtivo, "household");
        const valor = el.value === "" ? 0 : Number(el.value);
        atual[el.dataset.deducaoCampo] = Number.isFinite(valor) ? valor : 0;
        await saveDeducoesColeta(anoAtivo, "household", atual);
      });
    });
  }
}
