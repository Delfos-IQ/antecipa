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
const legalBanner = document.querySelector(".legal-banner");
const bannerLegalTexto = document.getElementById("legal-banner-texto");
if (bannerLegalTexto) bannerLegalTexto.textContent = pt.bannerLegal.texto;

const updateToast = document.getElementById("update-toast");
const updateToastTexto = document.getElementById("update-toast-texto");
const updateToastBtn = document.getElementById("update-toast-btn");
if (updateToastTexto) updateToastTexto.textContent = pt.updateToast.texto;
if (updateToastBtn) updateToastBtn.textContent = pt.updateToast.botao;

async function bootstrap() {
  if (await precisaOnboarding()) {
    bottomNav.hidden = true;
    // O passo "privacidade" do onboarding já mostra este aviso legal
    // dentro do próprio fluxo (mesmo destaque visual que o aviso de
    // privacidade) — o banner amarelo global fica escondido durante todo
    // o onboarding para não duplicar a mensagem, e volta a aparecer
    // assim que a app "normal" arranca.
    if (legalBanner) legalBanner.hidden = true;
    criarOnboarding({
      container: main,
      onConcluido: async ({ abrirUpload }) => {
        bottomNav.hidden = false;
        if (legalBanner) legalBanner.hidden = false;
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

// Aviso de nova versão (25/09/2026, pedido do Dani: "que podemos hacer
// para que el service worker se actualize sin tanto esfuerzo... un botón
// de actualizar"). Até aqui, sw.js já fazia skipWaiting()+clients.claim()
// sozinho assim que uma nova versão instalava — ou seja, o service worker
// novo já ficava ativo em segundo plano sem qualquer ação do utilizador.
// O problema real era outro: a PÁGINA já aberta continua com o HTML/CSS/JS
// antigo em memória até recarregar — e nada avisava que havia uma versão
// nova pronta, nem forçava essa recarga. Esta função:
//   1. mostra um aviso discreto assim que um service worker novo instala
//      (nunca na primeira instalação — só quando já havia um a controlar
//      a página antes, ou seja, é mesmo uma atualização);
//   2. o botão do aviso limita-se a recarregar a página — o service worker
//      novo já está ativo nessa altura, só falta o browser voltar a pedir
//      os ficheiros;
//   3. força uma verificação de sw.js sempre que a pessoa volta à aba,
//      porque alguns browsers (Safari em particular) só verificam sozinhos
//      de vez em quando — sem isto, dava para passar o dia todo sem ver
//      uma versão nova, mesmo com a aba aberta.
function mostrarAvisoAtualizacao() {
  if (!updateToast || updateToast.dataset.mostrado === "true") return;
  updateToast.dataset.mostrado = "true";
  updateToast.hidden = false;
}

function registarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => {
      // Já podia haver um worker à espera (ex.: a aba ficou aberta desde
      // antes do deploy mais recente).
      if (registration.waiting && navigator.serviceWorker.controller) {
        mostrarAvisoAtualizacao();
      }

      registration.addEventListener("updatefound", () => {
        const novoWorker = registration.installing;
        if (!novoWorker) return;
        novoWorker.addEventListener("statechange", () => {
          if (novoWorker.state === "installed" && navigator.serviceWorker.controller) {
            mostrarAvisoAtualizacao();
          }
        });
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      });
    })
    .catch((err) => {
      console.warn("[Antecipa] Falha ao registar o service worker:", err);
    });

  if (updateToastBtn) {
    updateToastBtn.addEventListener("click", () => window.location.reload());
  }
}

bootstrap();
