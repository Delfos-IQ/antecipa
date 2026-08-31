// ui/ventana-13.js
// Ventana 13 — Acumulado do ano (secção 8.3).

import { pt } from "../data/i18n.js";
import { getTodasRubricas } from "../storage/db.js";

function formatarMoeda(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v ?? 0);
}

export async function renderVentana13({ container, anoFiscal }) {
  const { documentos, rubricas } = await getTodasRubricas(anoFiscal);

  let irsRetido = 0;
  let segurancaSocial = 0;
  let ilíquido = 0;

  for (const r of rubricas) {
    if (r.tipo === "abono") ilíquido += r.valorComRedu ?? 0;
    if (r.tipo === "desconto" && r.categoriaIRS) irsRetido += r.valorComRedu ?? 0;
    if (r.tipo === "desconto" && r.categoriaSS) segurancaSocial += r.valorComRedu ?? 0;
  }

  const taxaEfetiva = ilíquido > 0 ? (irsRetido / ilíquido) * 100 : 0;
  const mesesComDados = new Set(documentos.map((d) => d.mes));

  container.innerHTML = `
    <h2>${pt.ventana13.titulo}</h2>
    <div class="metrics-grid">
      <div class="metric-tile">
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
    </div>
    <div class="timeline" role="img" aria-label="Progresso de meses com dados reais">
      ${pt.meses
        .map((nome, i) => `<i data-real="${mesesComDados.has(i + 1)}" title="${nome}">${nome.slice(0, 3)}</i>`)
        .join("")}
    </div>
  `;
}
