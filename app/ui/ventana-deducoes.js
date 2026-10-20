// ui/ventana-deducoes.js
// Ventana "Deduções e rendimentos" — extraída da Perfil (onde vivia como
// mais um cartão) para uma tab própria, por ser um input fiscal que
// alimenta diretamente a Simulação, não uma definição de conta. Ver
// discussão na auditoria de 02/09/2026 (Dani pediu opinião sobre isto).
//
// REDESENHO (20/10/2026, pedido do Dani depois de comparar com o Portal
// das Finanças/e-Fatura: "me pierdo... había pensado en que tendriamos un
// desplegable por persona"). Em vez de uma lista plana de campos do
// agregado, o ecrã passa a ter uma tab por pessoa (titulares +
// dependentes, tal como cada um tem o seu próprio espaço no e-Fatura real
// — "yo tengo mi e-factura y vera el suyo... luego los niños el suyo"),
// com cartões por categoria (Despesas Gerais, Saúde, Educação, e PPR só
// para titulares) + um cartão de Exigência de Fatura com as 4
// subcategorias, todos por pessoa. Uma secção "Do agregado" reúne as
// categorias que continuam a ser do agregado como um todo (habitação,
// donativos, dupla tributação, trabalho doméstico, mais-valias,
// pagamentos por conta) — essas não têm "dono" individual no e-Fatura.
//
// Os TETOS legais continuam a ser do agregado (não por pessoa) — por
// isso a barra de progresso de cada categoria soma sempre TODAS as
// pessoas "por detrás" (pedido do Dani: "luego me imagino que suma por
// detras"), independentemente de qual tab está ativa, e fica sempre
// visível por baixo do cartão (não só ao expandir — pedido explícito do
// Dani: "la barra de progreso podria estar justo debajo de cada
// categoria"). A soma é feita pelo próprio motor (engine/deducoes/*.js,
// via somaMapa em engine/numero.js), não duplicada aqui.
import { pt } from "../data/i18n.js";
import { getDeducoesColeta, saveDeducoesColeta, getHousehold, getPessoas, getDependentes } from "../storage/db.js";
import { calcularDeducoesAColeta } from "../engine/calculo-irs.js";
import { obterTabelaFiscal } from "../data/legislacao-2026.js";
import { escapeHtml } from "./utils/escape-html.js";

function formatarMoeda(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v ?? 0);
}

// Chave de pessoa usada em todos os `*PorPessoa` (20/10/2026): prefixo
// obrigatório porque `pessoas` e `dependentes` são dois object stores
// separados do IndexedDB, cada um com o seu próprio contador
// autoIncrement — sem o prefixo, um titular id=1 e um dependente id=1
// colidiriam na mesma chave do mapa. Ver o mesmo comentário em
// engine/numero.js (somaMapa).
const chaveTitular = (p) => `p:${p.id}`;
const chaveDependente = (d) => `d:${d.id}`;

// Categorias com um valor por pessoa (titulares E dependentes — pedido
// do Dani: "ellos ni tienen exigencia de factura o otras cosas, pero
// igualmente aparece", confirmado com um ecrã real de um dependente no
// e-Fatura mostrando Despesas Gerais, Saúde, Educação e até Ginásios).
const CATEGORIAS_PESSOA = [
  { chave: "despesasGerais", mapa: "despesasGeraisPorPessoa", icone: "despesasGerais" },
  { chave: "saude", mapa: "saudePorPessoa", icone: "saude" },
  { chave: "educacao", mapa: "educacaoPorPessoa", icone: "educacao" },
];

// Subcategorias de exigência de fatura, também por pessoa (mesmo pedido
// acima) — partilham todas o mesmo teto de 250€/agregado, por isso uma
// única barra agregada no fim do cartão (categoria "exigenciaFatura"),
// não uma por subcategoria.
const EXIGENCIA_FATURA_SUBCATEGORIAS = [
  { chave: "exigenciaFaturaRestauracao", mapa: "exigenciaFaturaRestauracaoPorPessoa", icone: "restauracao" },
  { chave: "exigenciaFaturaReparacaoAutomovel", mapa: "exigenciaFaturaReparacaoAutomovelPorPessoa", icone: "reparacaoAutomovel" },
  { chave: "exigenciaFaturaPassesMensais", mapa: "exigenciaFaturaPassesMensaisPorPessoa", icone: "passesMensais" },
  { chave: "exigenciaFaturaOutras", mapa: "exigenciaFaturaOutrasPorPessoa", icone: "outras" },
];

// Categorias que continuam a ser só do agregado — sem "dono" individual
// no e-Fatura real (habitação é uma renda/crédito só da casa, donativos
// e dupla tributação não têm NIF específico de um membro, trabalho
// doméstico é um encargo da casa, mais-valias são do titular que vendeu
// mas sem relevância prática de separar aqui, pagamentos por conta são
// adiantamentos de imposto, não despesas). Mesma estrutura de
// `campos`/`barras` que o ecrã já usava antes do redesenho.
const GRUPOS_AGREGADO = [
  {
    chave: "saudeEducacao",
    tituloChave: "deducoesAgregadoTitulo",
    campos: ["habitacao"],
    barras: [{ apos: "habitacao", categoria: "habitacao", semContextoCompleto: true }],
  },
  {
    chave: "outras",
    campos: ["donativos", "duplaTributacao", "trabalhoDomestico"],
    barras: [{ apos: "trabalhoDomestico", categoria: "trabalhoDomestico" }],
    notaAposCampo: { donativos: "deducaoDonativosNota" },
  },
  { chave: "capital", campos: ["maisValias"] },
  { chave: "pagamentos", campos: ["pagamentosPorConta"] },
];

// Ícones "duotone" (20/10/2026, pedido do Dani: "le ponemos imagenes SVG
// propias de la app y con aspecto premium"). Continua a regra existente
// de um único acento de marca para todos os ícones (ver BRAND.md §2 e o
// comentário que isto substitui) — a diferença agora é só de TRAÇADO,
// nunca de cor, mesmo entre categorias diferentes. O tratamento "duotone"
// em si é novo: cada ícone é um par de paths — uma silhueta preenchida a
// `currentColor` com opacidade baixa (0.14) por trás, e o traçado de
// linha fino (`currentColor`, sem preenchimento) por cima — dá
// profundidade sem introduzir uma segunda cor, mantendo a identidade
// mono-acento do Antecipa.
const ICONES = {
  // Pessoa (tab de um titular)
  pessoa: {
    silhueta: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    linha: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  },
  // Dependente (tab de uma criança/dependente) — figura mais pequena.
  dependente: {
    silhueta: '<circle cx="12" cy="7" r="3.2"/><path d="M6 20c0-3.6 2.7-6.4 6-6.4s6 2.8 6 6.4"/>',
    linha: '<circle cx="12" cy="7" r="3.2"/><path d="M6 20c0-3.6 2.7-6.4 6-6.4s6 2.8 6 6.4"/>',
  },
  despesasGerais: {
    silhueta: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2z"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87z"/><path d="M16 3.13a4 4 0 0 1 0 7.75z"/>',
    linha: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  },
  saude: {
    silhueta: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    linha: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  },
  educacao: {
    silhueta: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
    linha: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 10v6"/>',
  },
  ppr: {
    silhueta: '<circle cx="12" cy="12" r="9"/>',
    linha: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  },
  exigenciaFatura: {
    silhueta: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',
    linha: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  },
  restauracao: {
    silhueta: '<path d="M6 2v8a3 3 0 0 0 6 0V2"/><path d="M18 2v20"/>',
    linha: '<path d="M6 2v6a3 3 0 0 0 6 0V2"/><path d="M9 11v11"/><path d="M18 2c-1.7 0-3 2.2-3 5s1.3 5 3 5v10"/>',
  },
  reparacaoAutomovel: {
    silhueta: '<rect x="2" y="12" width="20" height="6" rx="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
    linha: '<path d="M3 12 5 6h14l2 6"/><rect x="2" y="12" width="20" height="6" rx="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  },
  passesMensais: {
    silhueta: '<rect x="4" y="3" width="16" height="16" rx="2"/><circle cx="8" cy="21" r="1.2"/><circle cx="16" cy="21" r="1.2"/>',
    linha: '<rect x="4" y="3" width="16" height="16" rx="2"/><line x1="4" y1="13" x2="20" y2="13"/><circle cx="8" cy="21" r="1.2"/><circle cx="16" cy="21" r="1.2"/>',
  },
  outras: {
    silhueta: '<path d="M6 7h12l1.5 14h-15z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    linha: '<path d="M6 7h12l1.5 14h-15z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  },
  habitacao: {
    silhueta: '<path d="M3 11 12 3l9 8v10H3z"/>',
    linha: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  },
  capital: {
    silhueta: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>',
    linha: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  },
  outrasDeducoes: {
    silhueta: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="M12 7V4a2.5 2.5 0 0 1 5 0c0 1.7-2.2 3-5 3Z"/><path d="M12 7V4a2.5 2.5 0 0 0-5 0c0 1.7 2.2 3 5 3Z"/>',
    linha: '<rect x="2" y="7" width="20" height="15" rx="2"/><line x1="12" y1="7" x2="12" y2="22"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  },
  pagamentos: {
    silhueta: '<rect x="1" y="4" width="22" height="16" rx="2"/>',
    linha: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  },
};

function renderIcone(chave, { pequeno = false } = {}) {
  const def = ICONES[chave];
  if (!def) return "";
  const classe = pequeno ? "dedu-icone dedu-icone--pequeno" : "dedu-icone";
  return `<span class="${classe}">
    <svg viewBox="0 0 24 24">
      <g fill="currentColor" fill-opacity="0.14" stroke="none">${def.silhueta}</g>
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${def.linha}</g>
    </svg>
  </span>`;
}

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

// Lista unificada de "pessoas" do ecrã (titulares + dependentes), cada
// uma com uma chave única (ver chaveTitular/chaveDependente acima), um
// nome a mostrar na tab, e se é titular (só os titulares têm PPR — ver
// AskUserQuestion de 20/10/2026, "Fuera de los dependientes").
function construirListaPessoas(pessoas, dependentes) {
  const titulares = pessoas.map((p, i) => ({
    chave: chaveTitular(p),
    pessoa: p,
    isTitular: true,
    nome: p.nome?.trim() || (i === 0 ? pt.perfil.pprTitular1 : pt.perfil.pprTitular2),
  }));
  const filhos = dependentes.map((d, i) => ({
    chave: chaveDependente(d),
    pessoa: d,
    isTitular: false,
    nome: d.nome?.trim() || `${pt.perfil.deducoesDependenteGenerico} ${i + 1}`,
  }));
  return [...titulares, ...filhos];
}

// Cartão de uma categoria por pessoa (Despesas Gerais / Saúde /
// Educação). O input é só da pessoa ativa; a barra por baixo é sempre a
// soma do agregado inteiro (ver nota no topo do ficheiro).
function renderCartaoCategoriaPessoa(categoria, pessoaAtiva, valores) {
  const def = pt.perfil.deducoesGrupos.pessoa[categoria.chave];
  const mapa = valores?.[categoria.mapa] || {};
  const valorAtual = mapa[pessoaAtiva.chave] ?? 0;
  return `
    <div class="card">
      <p class="section-title dedu-grupo__titulo">${renderIcone(categoria.icone)}${def.label}</p>
      <p class="field-hint" style="margin-bottom:var(--space-3)">${def.hint}</p>
      <label style="display:block">
        <input type="number" min="0" step="0.01" inputmode="decimal"
          data-deducao-pessoa-mapa="${categoria.mapa}" data-deducao-pessoa-chave="${pessoaAtiva.chave}"
          value="${valorAtual || ""}" placeholder="0,00" />
      </label>
      ${renderBarra(categoria.chave)}
    </div>`;
}

// Cartão de PPR — só aparece na tab de um titular (decisão do Dani,
// 20/10/2026: "Fuera de los dependientes"). Mantém a mesma barra por
// titular já existente (pprDetalhePorPessoa), não a soma do agregado.
function renderCartaoPPR(pessoaAtiva, valores) {
  const def = pt.perfil.deducoesGrupos.saudeEducacao.ppr;
  const pprPorPessoa = valores?.pprPorPessoa || {};
  const valorAtual = pprPorPessoa[pessoaAtiva.pessoa.id] ?? 0;
  return `
    <div class="card">
      <p class="section-title dedu-grupo__titulo">${renderIcone("ppr")}${def.label}</p>
      <p class="field-hint" style="margin-bottom:var(--space-3)">${def.hint}</p>
      <label style="display:block">
        <input type="number" min="0" step="0.01" inputmode="decimal" data-deducao-ppr-pessoa="${pessoaAtiva.pessoa.id}"
          value="${valorAtual || ""}" placeholder="0,00" />
      </label>
      ${renderBarra(`ppr:${pessoaAtiva.pessoa.id}`)}
    </div>`;
}

// Cartão de Exigência de Fatura — uma subcategoria por linha, todas da
// pessoa ativa (incluindo dependentes, pedido do Dani com o exemplo real
// de um dependente com Ginásios no e-Fatura). Uma única barra agregada
// no fim, porque as 4 subcategorias partilham o mesmo teto de 250€.
function renderCartaoExigenciaFatura(pessoaAtiva, valores) {
  const defsGrupo = pt.perfil.deducoesGrupos.exigenciaFatura;
  return `
    <div class="card">
      <p class="section-title dedu-grupo__titulo">${renderIcone("exigenciaFatura")}${defsGrupo.titulo}</p>
      <p class="field-hint" style="margin-bottom:var(--space-3)">${defsGrupo.corpoHint}</p>
      <div class="stack" style="gap:var(--space-3)">
        ${EXIGENCIA_FATURA_SUBCATEGORIAS.map((sub) => {
          const def = defsGrupo[sub.chave];
          const mapa = valores?.[sub.mapa] || {};
          const valorAtual = mapa[pessoaAtiva.chave] ?? 0;
          return `
          <label style="display:block">
            <span style="font-size:0.86rem;font-weight:500">${renderIcone(sub.icone, { pequeno: true })}${def.label}</span>
            <input type="number" min="0" step="0.01" inputmode="decimal"
              data-deducao-pessoa-mapa="${sub.mapa}" data-deducao-pessoa-chave="${pessoaAtiva.chave}"
              value="${valorAtual || ""}" placeholder="0,00" style="margin-top:4px" />
            <span class="field-hint" style="display:block;margin-top:2px">${def.hint}</span>
          </label>`;
        }).join("")}
      </div>
      ${renderBarra("exigenciaFatura")}
    </div>`;
}

// Secção "Do agregado" — igual ao renderGrupoDeducao de antes do
// redesenho, só que agora restrita às categorias sem dono individual.
function renderGrupoAgregado(grupo, valores) {
  const defsGrupo = pt.perfil.deducoesGrupos[grupo.chave];
  const barraApos = Object.fromEntries((grupo.barras ?? []).map((b) => [b.apos, b]));
  const notaApos = grupo.notaAposCampo ?? {};
  return `
    <div class="card">
      <p class="section-title dedu-grupo__titulo">${renderIcone(grupo.chave === "saudeEducacao" ? "habitacao" : grupo.chave === "outras" ? "outrasDeducoes" : grupo.chave)}${defsGrupo.titulo}</p>
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
  let pessoaAtivaChave = null;

  await montar();

  async function montar() {
    const household = await getHousehold();
    const anoAtivo = household?.anoFiscalAtivo ?? anoFiscal;
    const deducoesColeta = await getDeducoesColeta(anoAtivo, "household");
    const pessoas = await getPessoas();
    const dependentes = await getDependentes();
    const tabela = obterTabelaFiscal(anoAtivo);
    const regime = household?.regime;

    const listaPessoas = construirListaPessoas(pessoas, dependentes);

    // Migração (20/10/2026): converte os campos legados "lump" (própria +
    // dependentes, ou um único valor do agregado no caso de exigência de
    // fatura) para os novos mapas `*PorPessoa`, seguindo exatamente o
    // mesmo padrão já usado para o PPR em 24/09/2026 — idempotente (só
    // corre se o mapa de destino ainda estiver vazio e houver valor
    // legado > 0), e sem assumir divisões 50/50: atribui-se o valor
    // "próprio" ao 1º titular e o valor "dependentes" ao 1º dependente,
    // porque não há forma de saber retroativamente como se repartiu entre
    // várias pessoas. O utilizador pode logo a seguir corrigir à mão,
    // aqui mesmo, movendo valores entre tabs. Os campos legados ficam a
    // zero depois de migrados, para não contar a dobrar (o motor soma os
    // dois — ver engine/deducoes/*.js — por isso a conta final nunca fica
    // errada mesmo antes desta migração correr).
    let migrado = false;
    const primeiroTitular = pessoas[0];
    const primeiroDependente = dependentes[0];

    // Guarda de idempotência: verifica-se se a CHAVE concreta (não o
    // mapa inteiro) já tem entrada — bug real apanhado em teste (20/10/2026):
    // com um guard "mapa vazio", a 1ª chamada (própria) já deixava o mapa
    // não-vazio, e a 2ª chamada (dependentes), para o MESMO mapa, via o
    // mapa já não-vazio e desistia sem migrar o seu próprio valor legado
    // — perdia-se a parte "dependentes" sempre que a "própria" também
    // precisasse de migrar no mesmo arranque. Verificar só a chave evita
    // isto, e continua idempotente porque o valor legado fica a 0 (e por
    // isso falha a condição `valorLegado > 0`) assim que migra uma vez.
    const migrarParaPrimeiraPessoa = (mapaChave, legadoChave, pessoaAlvo, chaveAlvo) => {
      const mapaAtual = deducoesColeta[mapaChave] || {};
      const valorLegado = deducoesColeta[legadoChave] || 0;
      if (!(chaveAlvo in mapaAtual) && valorLegado > 0 && pessoaAlvo) {
        deducoesColeta[mapaChave] = { ...mapaAtual, [chaveAlvo]: valorLegado };
        deducoesColeta[legadoChave] = 0;
        migrado = true;
      }
    };

    migrarParaPrimeiraPessoa("saudePorPessoa", "saude", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    migrarParaPrimeiraPessoa("saudePorPessoa", "saudeDependentes", primeiroDependente, primeiroDependente && chaveDependente(primeiroDependente));
    migrarParaPrimeiraPessoa("educacaoPorPessoa", "educacao", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    migrarParaPrimeiraPessoa("educacaoPorPessoa", "educacaoDependentes", primeiroDependente, primeiroDependente && chaveDependente(primeiroDependente));
    migrarParaPrimeiraPessoa("despesasGeraisPorPessoa", "despesasGerais", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    migrarParaPrimeiraPessoa("despesasGeraisPorPessoa", "despesasGeraisDependentes", primeiroDependente, primeiroDependente && chaveDependente(primeiroDependente));
    // Exigência de fatura era só do agregado (um único valor, sem par
    // "própria"/"dependentes") — atribui-se ao 1º titular, normalmente
    // quem gere o e-Fatura da família.
    migrarParaPrimeiraPessoa("exigenciaFaturaRestauracaoPorPessoa", "exigenciaFaturaRestauracao", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    migrarParaPrimeiraPessoa("exigenciaFaturaReparacaoAutomovelPorPessoa", "exigenciaFaturaReparacaoAutomovel", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    migrarParaPrimeiraPessoa("exigenciaFaturaPassesMensaisPorPessoa", "exigenciaFaturaPassesMensais", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    migrarParaPrimeiraPessoa("exigenciaFaturaOutrasPorPessoa", "exigenciaFaturaOutras", primeiroTitular, primeiroTitular && chaveTitular(primeiroTitular));
    // PPR (migração já existente, 24/09/2026 — mantida tal e qual).
    if ((!deducoesColeta.pprPorPessoa || Object.keys(deducoesColeta.pprPorPessoa).length === 0) && (deducoesColeta.ppr || 0) > 0 && pessoas[0]) {
      deducoesColeta.pprPorPessoa = { [pessoas[0].id]: deducoesColeta.ppr };
      deducoesColeta.ppr = 0;
      migrado = true;
    }
    if (migrado) {
      await saveDeducoesColeta(anoAtivo, "household", deducoesColeta);
    }

    if (!pessoaAtivaChave || !listaPessoas.some((p) => p.chave === pessoaAtivaChave)) {
      pessoaAtivaChave = listaPessoas[0]?.chave ?? null;
    }
    const pessoaAtiva = listaPessoas.find((p) => p.chave === pessoaAtivaChave);

    // Mapa categoria → { semContextoCompleto }, igual ao ecrã anterior.
    const infoCategoria = Object.fromEntries(
      GRUPOS_AGREGADO.flatMap((g) => g.barras ?? []).map((b) => [b.categoria, b])
    );

    container.innerHTML = `
      <h2>${pt.perfil.deducoesTitulo}</h2>
      <p class="field-hint" style="margin-bottom:var(--space-4)">${pt.perfil.deducoesCorpo}</p>

      <div class="dedu-pessoa-tabs" role="tablist">
        ${listaPessoas
          .map(
            (p) => `
          <button type="button" class="dedu-pessoa-tab" data-dedu-pessoa-tab="${p.chave}" role="tab" aria-selected="${p.chave === pessoaAtivaChave}">
            ${renderIcone(p.isTitular ? "pessoa" : "dependente", { pequeno: true })}
            <span>${escapeHtml(p.nome)}</span>
          </button>`
          )
          .join("")}
      </div>

      ${
        pessoaAtiva
          ? `
      <div class="cartoes-grid" data-dedu-painel-pessoa>
        ${CATEGORIAS_PESSOA.map((categoria) => renderCartaoCategoriaPessoa(categoria, pessoaAtiva, deducoesColeta)).join("")}
        ${pessoaAtiva.isTitular ? renderCartaoPPR(pessoaAtiva, deducoesColeta) : ""}
        ${renderCartaoExigenciaFatura(pessoaAtiva, deducoesColeta)}
      </div>`
          : `<p class="field-hint">${pt.perfil.deducoesSemPessoas}</p>`
      }

      <p class="section-title dedu-agregado-titulo" style="margin-top:var(--space-6)">${pt.perfil.deducoesAgregadoTitulo}</p>
      <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.perfil.deducoesAgregadoCorpo}</p>
      <div class="cartoes-grid">
        ${GRUPOS_AGREGADO.map((grupo) => renderGrupoAgregado(grupo, deducoesColeta)).join("")}
      </div>

      <p class="muted" style="font-size:0.78rem;margin-top:var(--space-2)">${pt.perfil.deducoesGuardar}</p>
      <p class="disclaimer">${pt.ventana14.disclaimer}</p>
    `;

    // Lê os valores atuais diretamente do DOM (não do storage) para que a
    // barra reaja de imediato ao que se está a escrever, antes de sair do
    // campo (que é só quando se grava — ver listener "blur" abaixo).
    // Inclui os mapas `*PorPessoa` inteiros (não só a pessoa ativa) para
    // que a barra continue a mostrar a soma do agregado mesmo com o resto
    // das pessoas fora do ecrã.
    function lerValoresDoFormulario() {
      const mapasAClonar = [
        "saudePorPessoa",
        "educacaoPorPessoa",
        "despesasGeraisPorPessoa",
        "exigenciaFaturaRestauracaoPorPessoa",
        "exigenciaFaturaReparacaoAutomovelPorPessoa",
        "exigenciaFaturaPassesMensaisPorPessoa",
        "exigenciaFaturaOutrasPorPessoa",
        "pprPorPessoa",
      ];
      const valores = { ...deducoesColeta };
      mapasAClonar.forEach((chave) => {
        valores[chave] = { ...(deducoesColeta[chave] || {}) };
      });
      container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
        const n = el.value === "" ? 0 : Number(el.value);
        valores[el.dataset.deducaoCampo] = Number.isFinite(n) ? n : 0;
      });
      container.querySelectorAll("[data-deducao-pessoa-mapa]").forEach((el) => {
        const n = el.value === "" ? 0 : Number(el.value);
        const mapa = el.dataset.deducaoPessoaMapa;
        valores[mapa] = { ...(valores[mapa] || {}), [el.dataset.deducaoPessoaChave]: Number.isFinite(n) ? n : 0 };
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
      // comentário junto a calcularDeducoesAColeta em calculo-irs.js.
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

    container.querySelectorAll("[data-dedu-pessoa-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        pessoaAtivaChave = el.dataset.deduPessoaTab;
        montar();
      });
    });

    container.querySelectorAll("[data-deducao-campo]").forEach((el) => {
      el.addEventListener("input", atualizarBarras);
      el.addEventListener("blur", async () => {
        const atual = await getDeducoesColeta(anoAtivo, "household");
        const valor = el.value === "" ? 0 : Number(el.value);
        atual[el.dataset.deducaoCampo] = Number.isFinite(valor) ? valor : 0;
        await saveDeducoesColeta(anoAtivo, "household", atual);
      });
    });

    container.querySelectorAll("[data-deducao-pessoa-mapa]").forEach((el) => {
      el.addEventListener("input", atualizarBarras);
      el.addEventListener("blur", async () => {
        const atual = await getDeducoesColeta(anoAtivo, "household");
        const valor = el.value === "" ? 0 : Number(el.value);
        const mapa = el.dataset.deducaoPessoaMapa;
        atual[mapa] = { ...(atual[mapa] || {}), [el.dataset.deducaoPessoaChave]: Number.isFinite(valor) ? valor : 0 };
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
