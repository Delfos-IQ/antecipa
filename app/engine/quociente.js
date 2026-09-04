// engine/quociente.js
// Cálculo de quociente familiar fora do motor principal, para uso leve na
// UI (ex.: pré-visualização no onboarding, sem precisar de rubricas).
// A versão usada no cálculo oficial vive em calculo-irs.js e lê os
// mesmos parâmetros da tabela fiscal — mantém-se coerência às duas.

import { obterTabelaFiscal } from "../data/legislacao-2026.js";

export function quocienteEstimado({ regime, anoFiscal = new Date().getFullYear() }) {
  // BUG corrigido (04/09/2026, relatado pelo Dani — "el cuociente familiar
  // estimado aparece NaN"): esta função multiplicava numDependentes por
  // tabela.quociente.porDependente, um campo que nunca existiu em
  // legislacao-2026.js — e por boa razão: desde a Lei n.º 7-A/2016 (art.º
  // 69º CIRS) os dependentes NÃO alteram o quociente familiar, que é
  // sempre 1,00 (individual) ou 2,00 (conjunta), como já documentado e já
  // implementado corretamente em calculo-irs.js (calcularQuocienteFamiliar).
  // `numDependentes * undefined` dava sempre NaN (mesmo com 0 dependentes),
  // daí o "NaN" visível no onboarding assim que o utilizador chegava a este
  // ecrã. Esta versão leve passa a espelhar exatamente a regra oficial:
  // o quociente depende só do regime, nunca do número de dependentes.
  const tabela = obterTabelaFiscal(anoFiscal);
  return regime === "conjunta" ? tabela.quociente.base.conjunta : tabela.quociente.base.individual;
}
