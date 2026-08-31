// parsers/parser-talao.js
// Parser de talão de vencimento — regras específicas (secção 6.1).
//
// Formato de referência: rubricas numeradas tipo "101-001", "211-002",
// "700-009", cada uma com descrição, quantidade (opcional), valor sem
// redução e valor com redução. Extraído por regex sobre o texto do PDF
// (não por coordenadas), para tolerar pequenas variações de layout entre
// entidades empregadoras.
//
// O resultado NUNCA é gravado diretamente em `rubricas` — passa sempre
// pelo ecrã de confirmação editável (secção 6.3 / ui/confirmacao.js)
// antes de persistir.

const REGEX_RUBRICA = /(\d{3}[\s-]?\d{3})\s+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú0-9ºª/.,()\- ]{2,40}?)\s+([\d.,]+)?\s*€?\s*([\d.,]+)?\s*€?/g;

const CODIGOS_DESCONTO_IRS = /IRS|IMPOSTO SOBRE O RENDIMENTO/i;
const CODIGOS_DESCONTO_SS = /SEGURAN[ÇC]A SOCIAL|SS\b/i;

function paraNumero(valorTexto) {
  if (!valorTexto) return null;
  const limpo = valorTexto.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

function extrairMetadados(texto) {
  const nome = texto.match(/Nome[:\s]+([A-ZÀ-Úa-zà-ú\s]{5,60})/)?.[1]?.trim() ?? null;
  const nif = texto.match(/NIF[:\s]+(\d{9})/)?.[1] ?? null;
  const categoriaProfissional = texto.match(/Categoria[:\s]+([A-Za-zà-ú\s]{3,40})/)?.[1]?.trim() ?? null;
  const mesAno = texto.match(/(?:Mês|Refer[êe]ncia)[:\s]+(\d{1,2})[\/\-](\d{4})/i);
  const taxaIrsMensal = texto.match(/Taxa\s*IRS[:\s]+([\d.,]+)\s*%/i)?.[1] ?? null;
  const situacaoFamiliar = texto.match(/Situa[çc][ãa]o\s*Familiar[:\s]+([A-Za-zà-ú0-9\s]{2,30})/i)?.[1]?.trim() ?? null;

  return {
    nome,
    nif,
    categoriaProfissional,
    mes: mesAno ? Number(mesAno[1]) : null,
    ano: mesAno ? Number(mesAno[2]) : null,
    taxaIrsMensal: taxaIrsMensal ? paraNumero(taxaIrsMensal) / 100 : null,
    situacaoFamiliarDeclarada: situacaoFamiliar,
  };
}

function extrairTotais(texto) {
  const iliquido = paraNumero(texto.match(/Total\s*Il[íi]quido[:\s]+([\d.,]+)/i)?.[1]);
  const descontos = paraNumero(texto.match(/Total\s*Descontos[:\s]+([\d.,]+)/i)?.[1]);
  const liquido = paraNumero(texto.match(/Total\s*L[íi]quido[:\s]+([\d.,]+)/i)?.[1]);
  return { iliquido, descontos, liquido };
}

/**
 * @param {string} texto - texto extraído do PDF (parsers/pdf-text.js)
 * @returns {{metadados: Object, totais: Object, rubricas: Array, confianca: "alta"|"media"|"baixa"}}
 */
export function parsearTalao(texto) {
  const metadados = extrairMetadados(texto);
  const totais = extrairTotais(texto);
  const rubricas = [];

  let match;
  REGEX_RUBRICA.lastIndex = 0;
  while ((match = REGEX_RUBRICA.exec(texto)) !== null) {
    const [, codigo, descricaoBruta, valorA, valorB] = match;
    const descricao = descricaoBruta.trim();
    const valorSemRedu = paraNumero(valorA);
    const valorComRedu = paraNumero(valorB) ?? valorSemRedu;
    if (valorSemRedu === null && valorComRedu === null) continue;

    const isDesconto = /^7\d{2}/.test(codigo.replace(/\s/g, "")) || /desconto|retenç[ãa]o/i.test(descricao);

    rubricas.push({
      codigo: codigo.replace(/\s/g, "-"),
      descricao,
      categoria: "A",
      tipo: isDesconto ? "desconto" : "abono",
      valorSemRedu,
      valorComRedu,
      categoriaIRS: CODIGOS_DESCONTO_IRS.test(descricao),
      categoriaSS: CODIGOS_DESCONTO_SS.test(descricao),
    });
  }

  // Confiança baixa se não conseguimos achar nem metadados nem totais —
  // sinal para a UI insistir ainda mais no ecrã de confirmação.
  const confianca = rubricas.length >= 3 && totais.liquido !== null ? "alta" : rubricas.length > 0 ? "media" : "baixa";

  return { metadados, totais, rubricas, confianca };
}
