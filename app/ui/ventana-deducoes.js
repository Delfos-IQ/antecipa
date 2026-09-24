// ui/ventana-deducoes.js
// Ventana "Deduções e rendimentos" — extraída da Perfil (onde vivia como
// mais um cartão) para uma tab própria, por ser um input fiscal que
// alimenta diretamente a Simulação, não uma definição de conta. Ver
// discussão na auditoria de 02/09/2026 (Dani pediu opinião sobre isto).

import { pt } from "../data/i18n.js";
import { getDeducoesColeta, saveDeducoesColeta, getHousehold, getPessoas } from "../storage/db.js";
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
// PPR (24/09/2026, pedido do Dani: "el PPR es por titular, pero aqui solo
// hay espaço para um titular"): deixou de ser um campo simples da lista
// abaixo — o teto legal é por sujeito passivo (art.º 21º EBF), não do
// agregado, por isso ganha um input + barra POR TITULAR (renderCampoPPR),
// lido dinamicamente a partir de getPessoas() em vez de um único
// `data-deducao-campo="ppr"`. Fica de fora de `campos`/`barras` deste
// array — a posição dele no ecrã (entre educação e habitação) é fixa em
// renderGrupoDeducao.
const GRUPOS_DEDUCOES = [
  {
    chave: "saudeEducacao",
    campos: ["saude", "saudeDependentes", "educacao", "educacaoDependentes", "habitacao"],
    barras: [
      { apos: "saudeDependentes", categoria: "saude" },
      { apos: "educacaoDependentes", categoria: "educacao" },
      { apos: "habitacao", categoria: "habitacao", semContextoCompleto: true },
    ],
    // Renderizado à parte, sempre logo a seguir a educacaoDependentes
    // (mesma posição que tinha na lista de campos antes desta correção).
    campoEspecialApos: { educacaoDependentes: "ppr" },
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

// PPR por titular (24/09/2026) — ver comentário junto a GRUPOS_DEDUCOES.
// Um input + uma barra por pessoa em `pessoas` (1 ou 2, conforme o
// agregado), cada uma identificada por `data-deducao-ppr-pessoa` (em vez
// de `data-deducao-campo`, lido à parte em lerValoresDoFormulario) e por
// uma barra `ppr:<pessoaId>` (lida à parte em atualizarBarras, a partir
// de `resultado.pprDetalhePorPessoa`, não de `resultado.limites`).
function renderCampoPPR(pessoas, valores) {
  const def = pt.perfil.deducoesGrupos.saudeEducacao.ppr;
  const pprPorPessoa = valores?.pprPorPessoa || {};
  const titulares = pessoas.length ? pessoas : [];
  return `
    <div>
      <span style="font-size:0.86rem;font-weight:500">${def.label}</span>
      <p class="field-hint" style="margin:2px 0 0">${def.hint}</p>
      <div class="stack" style="gap:var(--space-3);margin-top:var(--space-2)">
        ${titulares
          .map((p, i) => {
            const nomeTitular = p.nome?.trim() || (i === 0 ? pt.perfil.pprTitular1 : pt.perfil.pprTitular2);
            const valorAtual = pprPorPessoa[p.id] ?? 0;
            return `
          <label style="display:block">
            <span style="font-size:0.8rem;color:var(--muted)">${nomeTitular}</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-deducao-ppr-pessoa="${p.id}"
              value="${valorAtual || ""}" placeholder="0,00" style="margin-top:4px" />
            ${renderBarra(`ppr:${p.id}`)}
          </label>`;
          })
          .join("")}
      </div>
    </div>`;
}

function renderGrupoDeducao(grupo, valores, pessoas) {
  const defsGrupo = pt.perfil.deducoesGrupos[grupo.chave];
  const barraApos = Object.fromEntries((grupo.barras ?? []).map((b) => [b.apos, b]));
  const notaApos = grupo.notaAposCampo ?? {};
  const campoEspecialApos = grupo.campoEspecialApos ?? {};
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
            const especial = campoEspecialApos[campo];
            return `
          <label style="display:block">
            <span style="font-size:0.86rem;font-weight:500">${def.label}</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-deducao-campo="${campo}"
              value="${valorAtual || ""}" placeholder="0,00" style="margin-top:4px" />
            <span class="field-hint" style="display:block;margin-top:2px">${def.hint}</span>
            ${barra ? renderBarra(barra.categoria) : ""}
            ${notaChave ? `<p class="dedu-nota-simulacao">${pt.perfil[notaChave]}</p>` : ""}
          </label>
          ${especial === "ppr" ? renderCampoPPR(pessoas, valores) : ""}`;
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
    const pessoas = await getPessoas();
    const tabela = obterTabelaFiscal(anoAtivo);
    const regime = household?.regime;

    // Migração (24/09/2026): quem já tinha um valor no antigo campo único
    // `ppr` (do agregado) e ainda não tem nada no novo `pprPorPessoa`
    // passa a tê-lo atribuído ao 1º titular — não há forma de saber
    // retroativamente como as entregas se repartiram entre os dois, por
    // isso não se assume uma divisão 50/50. O utilizador pode corrigir
    // manualmente logo a seguir, aqui mesmo. Idempotente: corre uma única
    // vez, porque zera o campo antigo depois de migrar.
    if ((!deducoesColeta.pprPorPessoa || Object.keys(deducoesColeta.pprPorPessoa).length === 0) && (deducoesColeta.ppr || 0) > 0 && pessoas[0]) {
      deducoesColeta.pprPorPessoa = { [pessoas[0].id]: deducoesColeta.ppr };
      deducoesColeta.ppr = 0;
      await saveDeducoesColeta(anoAtivo, "household", deducoesColeta);
    }

    // Mapa categoria → { semContextoCompleto } para saber, ao atualizar as
    // barras, quais delas devem mostrar a nota "estimativa" (habitação).
    const infoCategoria = Object.fromEntries(
      GRUPOS_DEDUCOES.flatMap((g) => g.barras ?? []).map((b) => [b.categoria, b])
    );

    container.innerHTML = `
      <h2>${pt.perfil.deducoesTitulo}</h2>
      <p class="field-hint" style="margin-bottom:var(--space-4)">${pt.perfil.deducoesCorpo}</p>
      ${GRUPOS_DEDUCOES.map((grupo) => renderGrupoDeducao(grupo, deducoesColeta, pessoas)).join("")}
      <p class="muted" style="font-size:0.78rem;margin-top:var(--space-2)">${pt.perfil.deducoesGuardar}</p>
      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    // Lê os valores atuais diretamente do DOM (não do storage) para que a
    // barra reaja de imediato ao que se está a escrever, antes de sair do
    // campo (que é só quando se grava — ver listener "blur" abaixo).
    function lerValoresDoFormulario() {
      const valores = { ...deducoesColeta, pprPorPessoa: { ...(deducoesColeta.pprPorPessoa || {}) } };
      container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
        const n = el.value === "" ? 0 : Number(el.value);
        valores[el.dataset.deducaoCampo] = Number.isFinite(n) ? n : 0;
      });
      container.querySelectorAll("[data-deducao-ppr-pessoa]").forEach((el) => {
        const n = el.value === "" ? 0 : Number(el.value);
        valores.pprPorPessoa[el.dataset.deducaoPprPessoa] = Number.isFinite(n) ? n : 0;
      });
      return valores;
    }

    function atualizarBarras() {
      const valores = lerValoresDoFormulario();
      // Contexto parcial de propósito (sem rubricas/rendimento) — ver o
      // comentário junto a calcularDeducoesAColeta em calculo-irs.js
      // sobre quais categorias ficam exatas mesmo assim (saúde, educação,
      // exigência de fatura, trabalho doméstico, despesas gerais e PPR,
      // este último já correto por titular, desde que `pessoas` seja
      // passado) e quais ficam como estimativa (habitação) ou sem teto
      // ainda (donativos, sem barra aqui).
      const resultado = calcularDeducoesAColeta({ deducoesColeta: valores, pessoas, tabela, regime, anoFiscal: anoAtivo });

      container.querySelectorAll("[data-barra-categoria]").forEach((barraEl) => {
        const categoria = barraEl.dataset.barraCategoria;
        let valor;
        let limite;
        if (categoria.startsWith("ppr:")) {
          const pessoaId = categoria.slice(4);
          const detalhe = resultado.pprDetalhePorPessoa?.[pessoaId];
          valor = detalhe?.deducao ?? 0;
          limite = detalhe?.teto ?? 0;
        } else {
          valor = resultado[categoria] ?? 0;
          limite = resultado.limites?.[categoria];
        }
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

    container.querySelectorAll("[data-deducao-ppr-pessoa]").forEach((el) => {
      el.addEventListener("input", atualizarBarras);
      el.addEventListener("blur", async () => {
        const atual = await getDeducoesColeta(anoAtivo, "household");
        const valor = el.value === "" ? 0 : Number(el.value);
        atual.pprPorPessoa = { ...(atual.pprPorPessoa || {}), [el.dataset.deducaoPprPessoa]: Number.isFinite(valor) ? valor : 0 };
        await saveDeducoesColeta(anoAtivo, "household", atual);
      });
    });
  }
}
