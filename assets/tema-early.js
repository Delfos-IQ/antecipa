// assets/tema-early.js — aplica o tema (claro/escuro) ANTES da primeira
// pintura da página (20/10/2026, pedido do Dani: botão de alternar tema).
//
// Propositadamente um <script> CLÁSSICO (sem type="module", sem defer
// nem async), carregado no <head> logo a seguir à CSP — scripts
// clássicos sem defer/async bloqueiam o parsing e correm JÁ, na ordem em
// que aparecem, antes de qualquer conteúdo do <body> ser processado.
// Um <script type="module"> (como assets/tema.js, mais abaixo) é sempre
// adiado até o HTML terminar de ser interpretado — tarde demais para
// evitar um "flash" do tema errado ao carregar a página. E já agora: a
// CSP desta app (script-src 'self', sem 'unsafe-inline') nem deixaria
// escrever este código diretamente no HTML, por isso tem mesmo de ser um
// ficheiro próprio, não um <script> inline no <head>.
//
// Duplica um bocado da lógica de assets/tema.js de propósito — os dois
// não podem partilhar um import aqui (ver acima), e o que este ficheiro
// faz é propositadamente mínimo: ler a preferência guardada (ou a do
// sistema, na falta dela) e escrevê-la no atributo de que o CSS depende.
// Tudo o resto (o botão, reagir a mudanças depois disto) fica em
// assets/tema.js.
(function () {
  var CHAVE = "antecipa-tema";
  var tema = null;
  try {
    var guardado = localStorage.getItem(CHAVE);
    if (guardado === "light" || guardado === "dark") tema = guardado;
  } catch (erro) {
    // localStorage pode falhar (ex.: alguns modos de navegação privada) —
    // sem problema, cai-se para a preferência do sistema operativo abaixo.
  }
  if (!tema) {
    tema = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.tema = tema;
  document.documentElement.style.colorScheme = tema;
})();
