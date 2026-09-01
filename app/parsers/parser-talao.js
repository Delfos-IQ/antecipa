// parsers/parser-talao.js
// Parser de talão de vencimento — regras específicas (secção 6.1).
//
// Formato de referência: rubricas numeradas tipo "101-001", "211-002",
// "700-009", cada uma com descrição, quantidade (opcional), data, e um
// ou dois valores. Trabalha sobre o texto já reconstruído em ordem de
// leitura por parsers/pdf-text.js — que separa tabelas lado a lado
// (Abonos / Descontos) em linhas independentes e marca as da coluna
// direita com "»" (ver MARCADOR_COLUNA_DIREITA).
//
// O que a app precisa de um talão, na prática, são só 4 números — bruto,
// IRS retido, Segurança Social, líquido (motor de cálculo em
// engine/calculo-irs.js só soma por categoria/tipo, nunca olha para
// rubricas individuais). Por isso o parsing linha a linha abaixo serve
// só para classificar cada desconto como IRS/SS/outro e somar — não é
// mostrado ao utilizador rubrica a rubrica (isso era fricção sem
// benefício real; ver ui/components/confirmacao.js). Os 4 totais também
// são lidos diretamente das linhas "Total Ilíquido/Descontos/Líquido"
// do documento sempre que existem, que são mais fiáveis do que somar
// linha a linha.
//
// O resultado NUNCA é gravado diretamente — passa sempre pelo ecrã de
// confirmação editável (secção 6.3 / ui/confirmacao.js) antes de persistir.

import { MARCADOR_COLUNA_DIREITA } from "./pdf-text.js";

// Uma linha de rubrica, já reconstruída em ordem de leitura, tem a forma:
//   [»]CÓD SUBCÓD DESCRIÇÃO... DD/MM [a)] NÚM [NÚM [NÚM]]
const REGEX_LINHA_RUBRICA =
  /^(»)?\s*(\d{3})[\s-]?(\d{3})\s+(.+?)\s+(\d{2}\/\d{2})\s*(?:[a-z]\)\s*)?((?:[\d.]+,\d{2}\s*){1,3})$/;

const CODIGOS_DESCONTO_IRS = /IRS|IMPOSTO SOBRE O RENDIMENTO/i;
const CODIGOS_DESCONTO_SS = /SEGURAN[ÇC]A SOCIAL|SS\b|S\.S\./i;

const MESES_PT = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function paraNumero(valorTexto) {
  if (!valorTexto) return null;
  const limpo = String(valorTexto).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

function arredondar(n) {
  return Math.round(n * 100) / 100;
}

function extrairMetadados(texto) {
  const nome =
    texto.match(/\bNome\s+([^\n]{3,60}?)(?:\s{2,}[A-ZÀ-Ú][a-zà-ú]|\n|$)/)?.[1]?.trim() ??
    texto.match(/\bNome\s+([^\n]{3,60})/)?.[1]?.trim() ??
    null;
  const nif =
    texto.match(/N[rú°.]*\.?\s*Contribuinte\s+(\d{9})/i)?.[1] ??
    texto.match(/\bNIF\s*[:\s]\s*(\d{9})/i)?.[1] ??
    null;
  const categoriaProfissional = texto.match(/\bCategoria\s+([^\n]{3,50})/i)?.[1]?.trim() ?? null;
  const relativoA = texto.match(/Relativo a\s+(\d{4})\s*\/\s*([A-Za-zà-ú]+)/i);
  const taxaIrsMensal = texto.match(/Taxa\s*IRS\s*Mensal\s+([\d.,]+)/i)?.[1] ?? null;
  const situacaoFamiliar = texto.match(/SITUA[ÇC][ÃA]O\s*:\s*([A-Za-zà-ú]+)/i)?.[1]?.trim() ?? null;

  const mesNome = relativoA ? relativoA[2].toLowerCase() : null;
  const mes = mesNome ? MESES_PT[mesNome] ?? null : null;

  return {
    nome,
    nif,
    categoriaProfissional,
    mes,
    ano: relativoA ? Number(relativoA[1]) : null,
    taxaIrsMensal: taxaIrsMensal ? paraNumero(taxaIrsMensal) / 100 : null,
    situacaoFamiliarDeclarada: situacaoFamiliar,
  };
}

function extrairTotais(texto) {
  const iliquido = paraNumero(texto.match(/Total\s*Il[íi]quido\s+([\d.,]+)/i)?.[1]);
  const descontos = paraNumero(texto.match(/Total\s*Descontos\s+([\d.,]+)/i)?.[1]);
  const liquido = paraNumero(texto.match(/Total\s*L[íi]quido\s+([\d.,]+)/i)?.[1]);
  return { iliquido, descontos, liquido };
}

function parsearLinhaRubrica(linha) {
  const match = linha.match(REGEX_LINHA_RUBRICA);
  if (!match) return null;
  const [, marcador, , , descricaoBruta, , numerosTexto] = match;
  const descricao = descricaoBruta.trim();
  const numeros = numerosTexto
    .trim()
    .split(/\s+/)
    .map(paraNumero)
    .filter((n) => n !== null);
  if (numeros.length < 2) return null;

  const ehDesconto = marcador === MARCADOR_COLUNA_DIREITA;
  const valorComRedu = numeros[numeros.length - 1];

  return {
    descricao,
    tipo: ehDesconto ? "desconto" : "abono",
    valorComRedu,
    categoriaIRS: ehDesconto && CODIGOS_DESCONTO_IRS.test(descricao),
    categoriaSS: ehDesconto && CODIGOS_DESCONTO_SS.test(descricao),
  };
}

// Reduz as rubricas individuais aos 4 números que a app realmente usa.
// Os totais impressos no documento (quando existem) têm prioridade sobre
// a soma das rubricas — são uma única leitura direta, menos sujeita a uma
// linha mal reconhecida do que somar dezenas de linhas.
function calcularResumo(rubricas, totais) {
  const somaAbonos = rubricas.filter((r) => r.tipo === "abono").reduce((s, r) => s + r.valorComRedu, 0);
  const somaDescIRS = rubricas.filter((r) => r.tipo === "desconto" && r.categoriaIRS).reduce((s, r) => s + r.valorComRedu, 0);
  const somaDescSS = rubricas.filter((r) => r.tipo === "desconto" && r.categoriaSS).reduce((s, r) => s + r.valorComRedu, 0);
  const somaDescOutros = rubricas
    .filter((r) => r.tipo === "desconto" && !r.categoriaIRS && !r.categoriaSS)
    .reduce((s, r) => s + r.valorComRedu, 0);

  const bruto = totais.iliquido ?? (rubricas.length ? arredondar(somaAbonos) : null);
  const irsRetido = arredondar(somaDescIRS);
  const segurancaSocial = arredondar(somaDescSS);
  const descontosTotal = totais.descontos ?? (rubricas.length ? arredondar(somaDescIRS + somaDescSS + somaDescOutros) : null);
  const outrosDescontos = descontosTotal !== null ? arredondar(Math.max(descontosTotal - irsRetido - segurancaSocial, 0)) : arredondar(somaDescOutros);
  const liquido =
    totais.liquido ??
    (bruto !== null && descontosTotal !== null ? arredondar(bruto - descontosTotal) : null);

  return { bruto, irsRetido, segurancaSocial, outrosDescontos, liquido };
}

/**
 * @param {string} texto - texto extraído do PDF (parsers/pdf-text.js)
 * @returns {{metadados: Object, resumo: Object, confianca: "alta"|"media"|"baixa"}}
 */
export function parsearTalao(texto) {
  const metadados = extrairMetadados(texto);
  const totais = extrairTotais(texto);

  const rubricas = [];
  for (const linha of texto.split("\n")) {
    const rubrica = parsearLinhaRubrica(linha);
    if (rubrica) rubricas.push(rubrica);
  }

  const resumo = calcularResumo(rubricas, totais);

  // Confiança: os 3 totais impressos foram encontrados e batem certo entre
  // si (bruto - descontos ≈ líquido), ou pelo menos bruto e líquido foram
  // encontrados de alguma forma.
  const somaDescontos = arredondar(resumo.irsRetido + resumo.segurancaSocial + resumo.outrosDescontos);
  const bateCerto =
    resumo.bruto !== null && resumo.liquido !== null && Math.abs(resumo.bruto - somaDescontos - resumo.liquido) < 0.02;

  let confianca;
  if (totais.iliquido !== null && totais.descontos !== null && totais.liquido !== null && bateCerto) {
    confianca = "alta";
  } else if (resumo.bruto !== null && resumo.liquido !== null) {
    confianca = "media";
  } else {
    confianca = "baixa";
  }

  return { metadados, resumo, confianca };
}
