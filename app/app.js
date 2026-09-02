// app.js
// Bootstrap + router simples entre onboarding e as ventanas principais.

import { criarOnboarding, precisaOnboarding } from "./ui/onboarding.js";
import { renderVentanasMensais } from "./ui/ventanas-mensais.js";
import { renderVentana13 } from "./ui/ventana-13.js";
import { renderVentana14 } from "./ui/ventana-14.js";
import { renderVentanaDeducoes } from "./ui/ventana-deducoes.js";
import { renderVentanaPerfil } from "./ui/ventana-perfil.js";
import { getHousehold } from "./storage/db.js";
import { pt } from "./data/i18n.js";

const main = document.getElementById("main-view");
const bottomNav = document.getElementById("bottom-nav");
const bannerLegalTexto = document.getElementById("legal-banner-texto");
if (bannerLegalTexto) bannerLegalTexto.textContent = pt.bannerLegal.texto;

async function bootstrap() {
  if (await precisaOnboarding()) {
    bottomNav.hidden = true;
    criarOnboarding({
      container: main,
      onConcluido: async ({ abrirUpload }) => {
        bottomNav.hidden = false;
        await navegar("mensal", { abrirUpload });
      },
    });
  } else {
    bottomNav.hidden = false;
    await navegar("mensal");
  }
  registarServiceWorker();
}

async function navegar(rota, opcoes = {}) {
  const household = await getHousehold();
  const anoFiscal = household?.anoFiscalAtivo ?? new Date().getFullYear();

  bottomNav.querySelectorAll(".bottom-nav__item").forEach((btn) => {
    btn.setAttribute("aria-current", String(btn.dataset.rota === rota));
  });

  main.innerHTML = "";
  if (rota === "mensal") {
    await renderVentanasMensais({ container: main, anoFiscal, mesParaAbrir: opcoes.abrirUpload ? new Date().getMonth() + 1 : null });
  } else if (rota === "acumulado") {
    await renderVentana13({ container: main, anoFiscal });
  } else if (rota === "deducoes") {
    await renderVentanaDeducoes({ container: main, anoFiscal });
  } else if (rota === "simulacao") {
    await renderVentana14({ container: main, anoFiscal });
  } else if (rota === "perfil") {
    await renderVentanaPerfil({ container: main, anoFiscal, onAnoFiscalMudou: () => {} });
  }
}

bottomNav.querySelectorAll(".bottom-nav__item").forEach((btn) =>
  btn.addEventListener("click", () => navegar(btn.dataset.rota))
);

function registarServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("[Antecipa] Falha ao registar o service worker:", err);
    });
  }
}

bootstrap();
