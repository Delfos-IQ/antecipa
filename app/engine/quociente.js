// engine/quociente.js
// Cálculo de quociente familiar fora do motor principal, para uso leve na
// UI (ex.: pré-visualização no onboarding, sem precisar de rubricas).
// A versão usada no cálculo oficial vive em calculo-irs.js e lê os
// mesmos parâmetros da tabela fiscal — mantém-se coerência às duas.

import { obterTabelaFiscal } from "../data/legislacao-2026.js";

export function quocienteEstimado({ regime, numDependentes, guardaPartilhada = false, anoFiscal = new Date().getFullYear() }) {
  const tabela = obterTabelaFiscal(anoFiscal);
  const base = regime === "conjunta" ? tabela.quociente.base.conjunta : tabela.quociente.base.individual;
  const porDependente = guardaPartilhada ? tabela.quociente.porDependenteGuardaPartilhada : tabela.quociente.porDependente;
  return base + numDependentes * porDependente;
}
