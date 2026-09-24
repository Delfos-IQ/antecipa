// assets/landing-revisao.js — extraído de index.html (24/09/2026) para
// permitir uma Content-Security-Policy sem 'unsafe-inline' em script-src.
//
// Import direto do módulo de dados fiscais da app só para manter esta
// página estática sincronizada com uma única fonte de verdade (a data
// de revisão fiscal) — não carrega mais nada da app, e falha em
// silêncio (mantendo o texto estático já no HTML) se o módulo não
// carregar por algum motivo.
import { revisaoFiscal } from "../app/data/legislacao-2026.js";

const elRevisao = document.getElementById("revisao-fiscal-texto");
if (elRevisao) {
  elRevisao.textContent =
    `Dados fiscais revistos em ${revisaoFiscal.dataRevisao} · próxima revisão prevista: ${revisaoFiscal.proximaRevisaoPrevista}.`;
}
