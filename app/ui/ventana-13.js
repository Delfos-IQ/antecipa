// ui/ventana-13.js
// Ventana 13 — Acumulado do ano (secção 8.3), com dashboard mais rico:
// repartição de descontos (IRS/SS/Sindicato/ADSE/Outros) com barras de
// cor, e rendimento líquido mês a mês — pedido explícito do utilizador
// na auditoria autónoma de set/2026 ("mais cores, sumatórios, análise
// detalhada").

import { pt } from "../data/i18n.js";
import { getTodasRubricas } from "../storage/db.js";

function formatarMoeda(v) {
  // ver nota em ui/ventana-14.js: substitui o nbsp antes do € por um
  // espaço reduzido (.moeda), para não parecer desalinhado em fonte mono.
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" })
    .format(v ?? 0)
    .replace(" €", '<span class="moeda">€</span>');
}

export async function renderVentana13({ container, anoFiscal }) {
  const { documentos, rubricas } = await getTodasRubricas(anoFiscal);

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
      <h2>${pt.ventana13.titulo}</h2>
      <p class="empty-state">${pt.ventana13.semDados}</p>
    `;
    return;
  }

  // Rendimento líquido por mês, para o mini-gráfico de barras — soma todos
  // os documentos (todas as pessoas) desse mês.
  const liquidoPorMes = Array.from({ length: 12 }, () => 0);
  for (const d of documentos) {
    const docRubricas = rubricas.filter((r) => r.documentoId === d.id);
    const abonos = docRubricas.filter((r) => r.tipo === "abono").reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
    const descontos = docRubricas.filter((r) => r.tipo === "desconto").reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
    liquidoPorMes[d.mes - 1] += abonos - descontos;
  }
  const maxMensal = Math.max(1, ...liquidoPorMes);

  const repartição = [
    { label: pt.ventana13.irsRetido, valor: irsRetido, cor: "var(--pagar)" },
    { label: pt.ventana13.segurancaSocial, valor: segurancaSocial, cor: "var(--navy-mid)" },
    { label: pt.ventana13.sindicato, valor: sindicato, cor: "var(--brass-light)" },
    { label: pt.ventana13.adse, valor: adse, cor: "#2f9b8f" },
    { label: "Outros", valor: outrosDescontos, cor: "var(--muted)" },
  ].filter((c) => c.valor > 0);

  container.innerHTML = `
    <h2>${pt.ventana13.titulo}</h2>
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
  `;
}
