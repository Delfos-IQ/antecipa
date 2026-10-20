// assets/tema.js — botão de alternar entre modo claro/escuro (20/10/2026,
// pedido do Dani: "un botón para alternar entre el modo oscuro y claro
// en la app... el website tendria y la app tendria que estar en
// concordancia"). Usado tanto pela landing (index.html) como pela app
// (app/index.html) — mesma origem, por isso a MESMA chave de
// localStorage serve as duas: escolher "escuro" numa aparece já na
// outra da próxima vez que a abrir.
//
// A escolha inicial (antes deste módulo sequer carregar, para não haver
// um "flash" do tema errado) já foi feita por assets/tema-early.js, um
// <script> clássico no <head> — ver esse ficheiro para o motivo de ser
// um ficheiro à parte em vez de partilhar código com este. Este módulo
// trata só do botão (clique, aria-*) e de reagir a mudanças depois
// disso: o sistema a mudar de tema sozinho (enquanto não há escolha
// manual guardada) e outra aba/página a mudar o tema (evento "storage").
const CHAVE = "antecipa-tema";

function lerPreferenciaGuardada() {
  try {
    const valor = localStorage.getItem(CHAVE);
    return valor === "light" || valor === "dark" ? valor : null;
  } catch {
    return null;
  }
}

function sistemaPrefereEscuro() {
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function temaAtual() {
  return document.documentElement.dataset.tema === "dark" ? "dark" : "light";
}

function aplicar(tema) {
  document.documentElement.dataset.tema = tema;
  document.documentElement.style.colorScheme = tema;
  document.querySelectorAll("[data-toggle-tema]").forEach((botao) => {
    botao.setAttribute("aria-pressed", String(tema === "dark"));
    botao.setAttribute("aria-label", tema === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro");
  });
}

// Garante que o botão mostra o estado certo mesmo que, por algum motivo
// raro, tema-early.js não tenha corrido (ex.: cache antiga do ficheiro).
aplicar(temaAtual());

document.querySelectorAll("[data-toggle-tema]").forEach((botao) => {
  botao.addEventListener("click", () => {
    const novoTema = temaAtual() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(CHAVE, novoTema);
    } catch {
      // Sem localStorage (ex.: alguns modos de navegação privada): a
      // escolha só dura esta navegação — melhor do que o botão não
      // fazer nada.
    }
    aplicar(novoTema);
  });
});

// Segue o sistema operativo em tempo real, mas só enquanto não houver
// uma escolha manual guardada — depois de tocar no botão uma vez, deixa
// de seguir o sistema até a pessoa limpar os dados do site.
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (evento) => {
    if (!lerPreferenciaGuardada()) aplicar(evento.matches ? "dark" : "light");
  });
}

// Sincroniza entre páginas/abas abertas ao mesmo tempo (landing + app,
// ou duas abas da mesma) — localStorage já é partilhado por origem, o
// evento "storage" só serve para refletir a mudança sem precisar de
// recarregar a página aberta na outra aba.
window.addEventListener("storage", (evento) => {
  if (evento.key === CHAVE) aplicar(lerPreferenciaGuardada() ?? (sistemaPrefereEscuro() ? "dark" : "light"));
});
