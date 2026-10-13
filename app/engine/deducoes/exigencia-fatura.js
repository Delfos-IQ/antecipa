// engine/deducoes/exigencia-fatura.js
// Dedução de exigência de fatura / IVAucher (art.º 78º-F CIRS).
//
// Extraído de calcularDeducoesAColeta em engine/calculo-irs.js (13/10/2026,
// split do motor em submódulos por categoria). Refatoração pura.

import { round2 } from "../numero.js";

const clamp = (valor, limite) => round2(Math.min(Math.max(valor, 0), limite));

// Exigência de fatura (IVAucher, art.º 78º-F CIRS): 15% do IVA suportado
// nas categorias "normais" (restauração, reparação automóvel, e outras —
// cabeleireiros, veterinários, hotelaria, ginásios) + 100% nos transportes
// públicos (passes mensais/bilhetes), todos a partilhar o MESMO teto de
// 250€/agregado (ver nota em legislacao-2026.js). Mantém-se também o
// campo legado `exigenciaFatura` (valor já pré-calculado, para quem
// preferir inserir diretamente o total que o e-Fatura mostra) — soma-se
// aos restantes antes do teto.
export function calcularExigenciaFatura({ deducoesColeta, limites }) {
  const baseNormal =
    (deducoesColeta.exigenciaFaturaRestauracao || 0) +
    (deducoesColeta.exigenciaFaturaReparacaoAutomovel || 0) +
    (deducoesColeta.exigenciaFaturaOutras || 0);
  const baseTransportes = deducoesColeta.exigenciaFaturaPassesMensais || 0;
  const exigenciaFaturaCalculada =
    baseNormal * (limites.exigenciaFatura.percentagem ?? 0.15) +
    baseTransportes * (limites.exigenciaFatura.percentagemTransportesPublicos ?? 1);
  const valor = clamp(
    exigenciaFaturaCalculada + (deducoesColeta.exigenciaFatura || 0),
    limites.exigenciaFatura.limite
  );
  return { valor, teto: limites.exigenciaFatura.limite, referenciaLegal: "art.º 78º-F CIRS" };
}
