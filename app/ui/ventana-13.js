// ui/ventana-13.js
// Ventana "Dashboard" (era "Acumulado", secção 8.3) — repartição de
// descontos (IRS/SS/Sindicato/ADSE/Outros), rendimento líquido mês a mês,
// IRS retido acumulado, e o uso dos tetos de dedução (saúde, educação,
// exigência de fatura, despesas gerais) face aos valores já preenchidos
// em Deduções — pedido explícito do utilizador na auditoria de 02/09/2026
// ("transformar acumulado em dashboard... colocar gráficos de evolução").

import { pt } from "../data/i18n.js";
import { getTodasRubricas, getDeducoesColeta, getHousehold } from "../storage/db.js";
import { obterTabelaFiscal } from "../data/legislacao-2026.js";

function formatarMoeda(v) {
  // ver nota em ui/ventana-14.js: substitui o nbsp antes do € por um
  // espaço reduzido (.moeda), para não parecer desalinhado em fonte mono.
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" })
    .format(v ?? 0)
    .replace(" €", '<span class="moeda">€</span>');
}

// Progresso de cada teto de dedução face ao que já foi preenchido em
// Deduções (ver ui/ventana-deducoes.js). Duplica deliberadamente só a
// aritmética de percentagem+teto de engine/calculo-irs.js
// (calcularDeducoesAColeta) — não a lógica fiscal completa — porque essa
// função não está exportada e o dashboard só precisa de "quanto já usei
// do teto", não de recalcular a declaração inteira.
function calcularPlafonds(deducoesColeta, tabela, regime) {
  const limites = tabela.limitesDeducoes;
  const clamp = (v, l) => Math.max(0, Math.min(v, l));

  const saudeUsado = clamp((deducoesColeta.saude || 0) * limites.saude.percentagem, limites.saude.limite);
  const educacaoUsado = clamp((deducoesColeta.educacao || 0) * limites.educacao.percentagem, limites.educacao.limite);

  const baseExigencia15 =
    (deducoesColeta.exigenciaFaturaRestauracao || 0) +
    (deducoesColeta.exigenciaFaturaReparacaoAutomovel || 0) +
    (deducoesColeta.exigenciaFaturaOutras || 0);
  const baseTransportes = deducoesColeta.exigenciaFaturaPassesMensais || 0;
  const exigenciaUsado = clamp(
    baseExigencia15 * (limites.exigenciaFatura.percentagem ?? 0.15) +
      baseTransportes * (limites.exigenciaFatura.percentagemTransportesPublicos ?? 1) +
      (deducoesColeta.exigenciaFatura || 0),
    limites.exigenciaFatura.limite
  );

  const limiteDespesasGerais =
    regime === "conjunta" ? limites.despesasGeraisFamiliares.limiteCasal : limites.despesasGeraisFamiliares.limiteSolteiro;
  const despesasGeraisUsado = clamp(
    (deducoesColeta.despesasGerais || 0) * limites.despesasGeraisFamiliares.percentagem,
    limiteDespesasGerais
  );

  return [
    { label: pt.ventana13.plafondSaude, usado: saudeUsado, teto: limites.saude.limite },
    { label: pt.ventana13.plafondEducacao, usado: educacaoUsado, teto: limites.educacao.limite },
    { label: pt.ventana13.plafondExigenciaFatura, usado: exigenciaUsado, teto: limites.exigenciaFatura.limite },
    { label: pt.ventana13.plafondDespesasGerais, usado: despesasGeraisUsado, teto: limiteDespesasGerais },
  ];
}

// Relógio "vidro" no cabeçalho do Dashboard — pedido explícito do
// utilizador (02/09/2026): "fecha e hora en grande, arriba a la derecha,
// como en apple mac... en modo cristal". Formato de 24h e data curta
// pt-PT; a hora é a informação mais lida à distância por isso tem
// destaque tipográfico maior do que a data.
function formatarRelogio(agora) {
  const hora = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(agora);
  const data = new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "2-digit", month: "short" }).format(agora);
  return { hora, data };
}

function renderGlassClock() {
  const { hora, data } = formatarRelogio(new Date());
  return `
    <div class="glass-clock" id="glass-clock" role="status" aria-label="Data e hora atuais">
      <span class="glass-clock__hora" id="glass-clock-hora">${hora}</span>
      <span class="glass-clock__data" id="glass-clock-data">${data}</span>
    </div>`;
}

// Sem lifecycle de "destroy" explícito no router (app.js só faz
// main.innerHTML = "" ao navegar) — o próprio tick verifica se o widget
// ainda está ligado ao documento antes de se reagendar, e se não estiver
// (o utilizador saiu do Dashboard) simplesmente para, sem deixar
// temporizadores a acumular em navegações repetidas.
function iniciarRelogioVivo(container) {
  const tick = () => {
    const elClock = container.querySelector("#glass-clock");
    if (!elClock || !elClock.isConnected) return;
    const { hora, data } = formatarRelogio(new Date());
    const elHora = container.querySelector("#glass-clock-hora");
    const elData = container.querySelector("#glass-clock-data");
    if (elHora) elHora.textContent = hora;
    if (elData) elData.textContent = data;
    setTimeout(tick, 15000);
  };
  setTimeout(tick, 15000);
}

function renderPlafonds(plafonds, temAlgumaDeducao) {
  return `
    <p class="section-title" style="margin-top:var(--space-6)">${pt.ventana13.plafondsTitulo}</p>
    <p class="field-hint" style="margin-bottom:var(--space-3)">${pt.ventana13.plafondsCorpo}</p>
    ${
      temAlgumaDeducao
        ? `<div class="stack" style="gap:var(--space-3)">
      ${plafonds
        .map((p) => {
          const percent = p.teto > 0 ? Math.min(100, Math.round((p.usado / p.teto) * 100)) : 0;
          return `
        <div>
          <div class="row-between" style="font-size:0.85rem;margin-bottom:4px">
            <span>${p.label}</span>
            <span class="num muted">${formatarMoeda(p.usado)} / ${formatarMoeda(p.teto)}</span>
          </div>
          <div class="plafond-track"><div class="plafond-fill" data-cheio="${percent >= 100}" style="width:${percent}%"></div></div>
        </div>`;
        })
        .join("")}
    </div>`
        : `<p class="empty-state">${pt.ventana13.plafondsVazio}</p>`
    }
  `;
}

export async function renderVentana13({ container, anoFiscal }) {
  const { documentos, rubricas } = await getTodasRubricas(anoFiscal);
  const household = await getHousehold();
  const deducoesColeta = await getDeducoesColeta(anoFiscal, "household");
  const tabela = obterTabelaFiscal(anoFiscal);
  const plafonds = calcularPlafonds(deducoesColeta, tabela, household?.regimeTributacao);
  const temAlgumaDeducao = plafonds.some((p) => p.usado > 0);

  let irsRetido = 0;
  let segurancaSocial = 0;
  let sindicato = 0;
  let adse = 0;
  let outrosDescontos = 0;
  let ilíquido = 0;
  let liquidoAcumulado = 0;

  for (const r of rubricas) {
    const valor = r.valorComRedu ?? 0;
    if (r.tipo === "abono") ilíquido += valor;
    if (r.tipo === "desconto") {
      if (r.categoriaIRS) irsRetido += valor;
      else if (r.categoriaSS) segurancaSocial += valor;
      else if (r.categoriaSindicato) sindicato += valor;
      else if (r.categoriaADSE) adse += valor;
      else outrosDescontos += valor;
    }
  }

  const totalDescontos = irsRetido + segurancaSocial + sindicato + adse + outrosDescontos;
  liquidoAcumulado = ilíquido - totalDescontos;
  const taxaEfetiva = ilíquido > 0 ? (irsRetido / ilíquido) * 100 : 0;
  const mesesComDados = new Set(documentos.map((d) => d.mes));

  if (documentos.length === 0) {
    container.innerHTML = `
      <div class="ventana13-header">
        <h2>${pt.ventana13.titulo}</h2>
        ${renderGlassClock()}
      </div>
      <p class="empty-state">${pt.ventana13.semDados}</p>
      ${renderPlafonds(plafonds, temAlgumaDeducao)}
    `;
    iniciarRelogioVivo(container);
    return;
  }

  // Rendimento líquido por mês, para o mini-gráfico de barras — soma todos
  // os documentos (todas as pessoas) desse mês.
  const liquidoPorMes = Array.from({ length: 12 }, () => 0);
  const irsRetidoPorMes = Array.from({ length: 12 }, () => 0);
  for (const d of documentos) {
    const docRubricas = rubricas.filter((r) => r.documentoId === d.id);
    const abonos = docRubricas.filter((r) => r.tipo === "abono").reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
    const descontos = docRubricas.filter((r) => r.tipo === "desconto").reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
    liquidoPorMes[d.mes - 1] += abonos - descontos;
    irsRetidoPorMes[d.mes - 1] += docRubricas
      .filter((r) => r.tipo === "desconto" && r.categoriaIRS)
      .reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
  }
  const maxMensal = Math.max(1, ...liquidoPorMes);

  // IRS retido ACUMULADO mês a mês (soma corrida) — a curva de evolução
  // pedida pelo utilizador, distinta do gráfico de rendimento líquido por
  // mês (que é um valor pontual por mês, não uma soma corrida).
  let corrida = 0;
  const irsAcumuladoPorMes = irsRetidoPorMes.map((v) => (corrida += v));
  const maxIrsAcumulado = Math.max(1, ...irsAcumuladoPorMes);

  const repartição = [
    { label: pt.ventana13.irsRetido, valor: irsRetido, cor: "var(--pagar)" },
    { label: pt.ventana13.segurancaSocial, valor: segurancaSocial, cor: "var(--navy-mid)" },
    { label: pt.ventana13.sindicato, valor: sindicato, cor: "var(--brass-light)" },
    { label: pt.ventana13.adse, valor: adse, cor: "#2f9b8f" },
    { label: "Outros", valor: outrosDescontos, cor: "var(--muted)" },
  ].filter((c) => c.valor > 0);

  container.innerHTML = `
    <div class="ventana13-header">
      <h2>${pt.ventana13.titulo}</h2>
      ${renderGlassClock()}
    </div>
    <div class="metrics-grid">
      <div class="metric-tile" data-cor="devolver">
        <div class="metric-tile__label">${pt.ventana13.liquidoAcumulado}</div>
        <div class="metric-tile__valor num">${formatarMoeda(liquidoAcumulado)}</div>
      </div>
      <div class="metric-tile" data-cor="pagar">
        <div class="metric-tile__label">${pt.ventana13.irsRetido}</div>
        <div class="metric-tile__valor num">${formatarMoeda(irsRetido)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile__label">${pt.ventana13.segurancaSocial}</div>
        <div class="metric-tile__valor num">${formatarMoeda(segurancaSocial)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile__label">${pt.ventana13.taxaEfetiva}</div>
        <div class="metric-tile__valor num">${taxaEfetiva.toFixed(1)}%</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile__label">${pt.ventana13.rendimentoIliquido}</div>
        <div class="metric-tile__valor num">${formatarMoeda(ilíquido)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile__label">${pt.ventana13.sindicato}</div>
        <div class="metric-tile__valor num">${formatarMoeda(sindicato)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile__label">${pt.ventana13.adse}</div>
        <div class="metric-tile__valor num">${formatarMoeda(adse)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-tile__label">${pt.ventana13.coberturaLabel}</div>
        <div class="metric-tile__valor num">${mesesComDados.size} ${pt.ventana13.de12}</div>
      </div>
    </div>

    ${
      repartição.length
        ? `
    <p class="section-title" style="margin-top:var(--space-6)">${pt.ventana13.descontosTitulo}</p>
    <div class="descontos-barra" role="img" aria-label="Repartição dos descontos">
      ${repartição
        .map((c) => `<span style="flex:${Math.max(c.valor, 0.01)};background:${c.cor}" title="${c.label}: ${c.valor.toFixed(2)}€"></span>`)
        .join("")}
    </div>
    <div class="descontos-legenda">
      ${repartição
        .map(
          (c) => `
        <div class="descontos-legenda__item">
          <i style="background:${c.cor}"></i>
          <span>${c.label}</span>
          <strong class="num">${formatarMoeda(c.valor)}</strong>
        </div>`
        )
        .join("")}
    </div>`
        : ""
    }

    <p class="section-title" style="margin-top:var(--space-6)">${pt.ventana13.porMesTitulo}</p>
    <div class="mes-barras">
      ${pt.meses
        .map((nome, i) => {
          const v = liquidoPorMes[i];
          const alturaPercent = v > 0 ? Math.max(6, Math.round((v / maxMensal) * 100)) : 0;
          return `
          <div class="mes-barras__col" title="${nome}: ${v.toFixed(2)}€">
            <div class="mes-barras__track"><div class="mes-barras__fill" data-real="${mesesComDados.has(i + 1)}" style="height:${alturaPercent}%"></div></div>
            <span class="mes-barras__label">${nome.slice(0, 3)}</span>
          </div>`;
        })
        .join("")}
    </div>

    <div class="timeline" role="img" aria-label="Progresso de meses com dados reais">
      ${pt.meses
        .map((nome, i) => `<i data-real="${mesesComDados.has(i + 1)}" title="${nome}">${nome.slice(0, 3)}</i>`)
        .join("")}
    </div>

    <p class="section-title" style="margin-top:var(--space-6)">${pt.ventana13.evolucaoIrsTitulo}</p>
    <div class="mes-barras">
      ${pt.meses
        .map((nome, i) => {
          const v = irsAcumuladoPorMes[i];
          const alturaPercent = v > 0 ? Math.max(6, Math.round((v / maxIrsAcumulado) * 100)) : 0;
          return `
          <div class="mes-barras__col" title="${nome}: ${v.toFixed(2)}€ acumulado">
            <div class="mes-barras__track"><div class="mes-barras__fill" data-cor="pagar" data-real="${mesesComDados.has(i + 1)}" style="height:${alturaPercent}%"></div></div>
            <span class="mes-barras__label">${nome.slice(0, 3)}</span>
          </div>`;
        })
        .join("")}
    </div>

    ${renderPlafonds(plafonds, temAlgumaDeducao)}
  `;
  iniciarRelogioVivo(container);
}
