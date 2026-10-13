// ui/utils/escape-html.js
// Escapa texto de origem não confiável (extraído de um PDF, digitado pelo
// utilizador, etc.) antes de o injetar via innerHTML/template string — sem
// isto, um nome ou descrição fabricados (ex.: `"><img src=x onerror=...>`)
// corriam como HTML/JS no ecrã. Helper único partilhado por todos os
// ecrãs que fazem interpolação de texto livre em HTML (ver
// ui/components/confirmacao.js, ui/ventanas-mensais.js, ui/ventana-perfil.js,
// ui/ventana-14.js, ui/onboarding.js) — antes desta extração cada ficheiro
// tinha a sua própria cópia local, o que permitia que um novo campo de
// texto livre escapasse ao escaping por inconsistência.
export function escapeHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
