// engine/deducoes/dependentes.js
// Dedução por dependente a cargo (art.º 78º-A CIRS).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). `valorDeducaoPorDependente` continua exportada
// com o mesmo nome e assinatura a partir de calculo-irs.js (re-exportada
// daqui), por ser usada diretamente em ui/ventana-perfil.js. Refatoração
// pura: nenhum cálculo foi alterado.

import { round2, sum } from "../numero.js";
import { idadeNoAno } from "../idade.js";

function idadeDoDependenteNoAno(dependente, anoFiscal) {
  return idadeNoAno(dependente?.dataNascimento, anoFiscal);
}

// Dedução por dependente (art.º 78º-A CIRS) — modelo real de 3 escalões,
// confirmado nesta sessão contra 3 fontes independentes (pwc.pt,
// doutorfinancas.pt, info.portaldasfinancas.gov.pt): 600€ base por
// dependente; 726€ para o 1º dependente com menos de 3 anos (majoração de
// 126€); 900€ para o 2º dependente em diante com até 6 anos. Se a guarda
// for partilhada, o valor de cada dependente é dividido a meio (cada
// sujeito passivo só pode deduzir metade) — mesmo critério já usado no
// quociente familiar (calcularQuocienteFamiliar, em calculo-irs.js).
export function valorDeducaoPorDependente(dependente, posicao, anoFiscal, limites) {
  const idade = idadeDoDependenteNoAno(dependente, anoFiscal);
  let valor;
  if (posicao === 0) {
    valor = idade !== null && idade < 3 ? limites.dependentes.primeiroComMajoracaoAte3Anos : limites.dependentes.primeiro;
  } else {
    valor = idade !== null && idade <= 6 ? limites.dependentes.segundoEmDianteAte6Anos : limites.dependentes.primeiro;
  }
  return dependente?.guarda === "partilhada" ? round2(valor / 2) : valor;
}

// NOTA de fidelidade numérica: `total` é devolvido SEM arredondar (tal como
// a variável `porDependentes` original em calcularDeducoesAColeta), porque
// o chamador soma-o ao total geral ainda por arredondar antes de um único
// round2 final — arredondar aqui também mudaria (por centavos, em casos de
// borda) o resultado final face ao comportamento anterior.
export function calcularDeducaoDependentes({ dependentes = [], anoFiscal, limites }) {
  const total = sum(dependentes, (d, i) => valorDeducaoPorDependente(d, i, anoFiscal, limites));
  return { total, referenciaLegal: "art.º 78º-A CIRS" };
}
