// parsers/parser-recibo-verde.js
// Parser de recibo verde (secção 6.2). Extrai valor bruto, retenção na
// fonte (se houver), NIF do emissor, data, e descrição do serviço.

function paraNumero(valorTexto) {
  if (!valorTexto) return null;
  const limpo = valorTexto.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

export function parsearReciboVerde(texto) {
  const valorBruto = paraNumero(texto.match(/(?:Valor|Total)\s*(?:Bruto|Ilíquido)?[:\s]+([\d.,]+)\s*€?/i)?.[1]);
  const retencao = paraNumero(texto.match(/Reten[çc][ãa]o(?:\s*na\s*Fonte)?[:\s]+([\d.,]+)\s*€?/i)?.[1]);
  const taxaRetencao = paraNumero(texto.match(/Taxa\s*de\s*Reten[çc][ãa]o[:\s]+([\d.,]+)\s*%/i)?.[1]);
  const nifEmitente = texto.match(/NIF(?:\s*(?:do\s*)?(?:Emitente|Prestador))?[:\s]+(\d{9})/i)?.[1] ?? null;
  const data = texto.match(/Data(?:\s*de\s*Emiss[ãa]o)?[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i)?.[1] ?? null;
  const descricao = texto.match(/Descri[çc][ãa]o[:\s]+([^\n]{3,120})/i)?.[1]?.trim() ?? null;

  const rubricas = [];
  if (valorBruto !== null) {
    rubricas.push({
      codigo: null,
      descricao: descricao ?? "Serviço prestado",
      categoria: "B",
      tipo: "abono",
      valorSemRedu: valorBruto,
      valorComRedu: valorBruto,
    });
  }
  if (retencao !== null && retencao > 0) {
    rubricas.push({
      codigo: null,
      descricao: "Retenção na fonte (Cat. B)",
      categoria: "B",
      tipo: "desconto",
      valorSemRedu: retencao,
      valorComRedu: retencao,
      categoriaIRS: true,
    });
  }

  const confianca = valorBruto !== null ? (nifEmitente && data ? "alta" : "media") : "baixa";

  return {
    metadados: { nifEmitente, data, taxaRetencao: taxaRetencao ? taxaRetencao / 100 : null },
    totais: { bruto: valorBruto, retencao },
    rubricas,
    confianca,
  };
}
