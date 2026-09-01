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
// O que a app precisa de um talão, na prática, é um pequeno conjunto de
// números agregados — bruto, IRS retido, Segurança Social, quotização
// sindical, ADSE, líquido (ver ui/components/confirmacao.js e
// engine/calculo-irs.js, que usam a quotização sindical para ativar a
// dedução específica mais alta, e a ADSE como despesa de saúde nas
// deduções à coleta — esta última ainda não confirmada linha a linha
// contra fonte oficial, ver data/legislacao-2026.js). O parsing linha a
// linha abaixo classifica cada desconto numa destas categorias e soma;
// os totais impressos no documento ("Total Ilíquido/Descontos/Líquido")
// têm prioridade sobre a soma quando existem, por serem uma leitura
// direta em vez de somar dezenas de linhas.
//
// `correcoes` (opcional): mapa chaveDescricao(descrição) → categoria,
// aprendido no ecrã de confirmação quando o utilizador reclassifica uma
// linha (ver storage/db.js: getModeloEntidade/guardarCorrecoesEntidade).
// Sobrepõe-se à classificação automática por regex.
//
// O resultado NUNCA é gravado diretamente — passa sempre pelo ecrã de
// confirmação editável (secção 6.3 / ui/confirmacao.js) antes de persistir.

import { MARCADOR_COLUNA_DIREITA } from "./pdf-text.js";

// Uma linha de rubrica, já reconstruída em ordem de leitura, tem a forma:
//   [»]CÓD SUBCÓD DESCRIÇÃO... DD/MM [a)] NÚM [NÚM [NÚM]]
const REGEX_LINHA_RUBRICA =
  /^(»)?\s*(\d{3})[\s-]?(\d{3})\s+(.+?)\s+(\d{2}\/\d{2})\s*(?:[a-z]\)\s*)?((?:[\d.]+,\d{2}\s*){1,3})$/;

const CATEGORIAS_DESCONTO = ["irs", "ss", "sindicato", "adse", "outros"];

const PADROES_DESCONTO = [
  ["irs", /IRS|IMPOSTO SOBRE O RENDIMENTO/i],
  ["ss", /SEGURAN[ÇC]A SOCIAL|SS\b|S\.S\./i],
  ["sindicato", /\bSIND[A-ZÀ-Ú.]*|QUOTIZA[ÇC][ÃA]O SINDICAL/i],
  ["adse", /\bADSE\b/i],
];

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

// Chave estável para uma descrição de rubrica — usada para aprender/aplicar
// correções por entidade empregadora. Remove parênteses (ex.: "(1%)", que
// muda de mês para mês) e dígitos/pontuação, para que a mesma rubrica
// continue a corresponder mesmo com um valor percentual diferente.
export function chaveDescricao(descricao) {
  return (descricao ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[0-9.,%]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function classificarDesconto(descricao, correcoes) {
  const correcao = correcoes?.[chaveDescricao(descricao)];
  if (correcao && CATEGORIAS_DESCONTO.includes(correcao)) return correcao;
  for (const [categoria, regex] of PADROES_DESCONTO) {
    if (regex.test(descricao)) return categoria;
  }
  return "outros";
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

function parsearLinhaRubrica(linha, correcoes) {
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

  if (!ehDesconto) {
    return { descricao, tipo: "abono", valorComRedu };
  }
  return { descricao, tipo: "desconto", valorComRedu, categoriaClassificada: classificarDesconto(descricao, correcoes) };
}

// Reduz as rubricas individuais aos números que a app usa: um total por
// categoria de desconto, mais bruto/líquido. Os totais impressos no
// documento (quando existem) têm prioridade sobre a soma das linhas.
function calcularResumo(rubricas, totais) {
  const somaAbonos = rubricas.filter((r) => r.tipo === "abono").reduce((s, r) => s + r.valorComRedu, 0);
  const somaPorCategoria = Object.fromEntries(CATEGORIAS_DESCONTO.map((c) => [c, 0]));
  for (const r of rubricas) {
    if (r.tipo === "desconto") somaPorCategoria[r.categoriaClassificada] += r.valorComRedu;
  }

  const bruto = totais.iliquido ?? (rubricas.length ? arredondar(somaAbonos) : null);
  const irsRetido = arredondar(somaPorCategoria.irs);
  const segurancaSocial = arredondar(somaPorCategoria.ss);
  const sindicato = arredondar(somaPorCategoria.sindicato);
  const adse = arredondar(somaPorCategoria.adse);
  const somaClassificados = irsRetido + segurancaSocial + sindicato + adse;
  const descontosTotal =
    totais.descontos ?? (rubricas.length ? arredondar(somaClassificados + somaPorCategoria.outros) : null);
  const outrosDescontos =
    descontosTotal !== null ? arredondar(Math.max(descontosTotal - somaClassificados, 0)) : arredondar(somaPorCategoria.outros);
  const liquido =
    totais.liquido ?? (bruto !== null && descontosTotal !== null ? arredondar(bruto - descontosTotal) : null);

  return { bruto, irsRetido, segurancaSocial, sindicato, adse, outrosDescontos, liquido };
}

/**
 * @param {string} texto - texto extraído do PDF (parsers/pdf-text.js)
 * @param {Object} [correcoes] - mapa chaveDescricao(descrição) → categoria, aprendido para esta entidade
 * @returns {{metadados: Object, resumo: Object, linhasDesconto: Array, confianca: "alta"|"media"|"baixa"}}
 */
export function parsearTalao(texto, correcoes = {}) {
  const metadados = extrairMetadados(texto);
  const totais = extrairTotais(texto);

  const rubricas = [];
  for (const linha of texto.split("\n")) {
    const rubrica = parsearLinhaRubrica(linha, correcoes);
    if (rubrica) rubricas.push(rubrica);
  }

  const resumo = calcularResumo(rubricas, totais);
  // Linhas de desconto classificadas, para o ecrã de confirmação mostrar a
  // correspondência ao lado do documento e permitir corrigi-la.
  const linhasDesconto = rubricas.filter((r) => r.tipo === "desconto");

  const somaDescontos = arredondar(
    resumo.irsRetido + resumo.segurancaSocial + resumo.sindicato + resumo.adse + resumo.outrosDescontos
  );
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

  return { metadados, resumo, linhasDesconto, confianca };
}
