// parsers/parser-talao.js
// Parser de talão de vencimento — regras específicas (secção 6.1).
//
// Formato de referência: rubricas numeradas tipo "101-001", "211-002",
// "700-009", cada uma com descrição, quantidade (opcional), data, e um
// ou dois valores. Trabalha sobre o texto já reconstruído em ordem de
// leitura por parsers/pdf-text.js — que separa tabelas lado a lado
// (Abonos / Descontos) em linhas independentes e marca as da coluna
// direita com "»" (ver MARCADOR_COLUNA_DIREITA). Isto continua a ser
// parsing por regex tolerante a variações de layout, não por
// coordenadas fixas — a única coisa "posicional" é a reconstrução da
// ordem de leitura, feita uma vez em pdf-text.js.
//
// O resultado NUNCA é gravado diretamente em `rubricas` — passa sempre
// pelo ecrã de confirmação editável (secção 6.3 / ui/confirmacao.js)
// antes de persistir.

import { MARCADOR_COLUNA_DIREITA } from "./pdf-text.js";

// Uma linha de rubrica, já reconstruída em ordem de leitura, tem a forma:
//   [»]CÓD SUBCÓD DESCRIÇÃO... DD/MM [a)] NÚM [NÚM [NÚM]]
// - 3 números do lado esquerdo (abono) = quantidade, valor s/ redução, valor c/ redução
// - 2 números do lado esquerdo (abono) = valor s/ redução, valor c/ redução (sem quantidade)
// - 2 números do lado direito (desconto, marcado com ») = incidência, desconto
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
  const [, marcador, codigo, subcodigo, descricaoBruta, data, numerosTexto] = match;
  const descricao = descricaoBruta.trim();
  const numeros = numerosTexto
    .trim()
    .split(/\s+/)
    .map(paraNumero)
    .filter((n) => n !== null);
  if (numeros.length < 2) return null;

  const ehDesconto = marcador === MARCADOR_COLUNA_DIREITA;

  const base = {
    codigo: `${codigo}-${subcodigo}`,
    descricao,
    data,
    categoria: "A",
    categoriaIRS: CODIGOS_DESCONTO_IRS.test(descricao),
    categoriaSS: CODIGOS_DESCONTO_SS.test(descricao),
  };

  if (ehDesconto) {
    // Coluna direita: incidência, desconto (sempre 2 números).
    const [incidencia, desconto] = numeros;
    return {
      ...base,
      tipo: "desconto",
      valorSemRedu: incidencia,
      valorComRedu: desconto,
    };
  }

  // Coluna esquerda (abono): 3 números = quantidade + 2 valores;
  // 2 números = só os 2 valores (rubricas fixas, sem quantidade).
  const [quantidade, valorSemRedu, valorComRedu] =
    numeros.length === 3 ? numeros : [null, numeros[0], numeros[1]];

  return {
    ...base,
    tipo: "abono",
    quantidade,
    valorSemRedu,
    valorComRedu,
  };
}

/**
 * @param {string} texto - texto extraído do PDF (parsers/pdf-text.js)
 * @returns {{metadados: Object, totais: Object, rubricas: Array, confianca: "alta"|"media"|"baixa"}}
 */
export function parsearTalao(texto) {
  const metadados = extrairMetadados(texto);
  const totais = extrairTotais(texto);
  const rubricas = [];

  for (const linha of texto.split("\n")) {
    const rubrica = parsearLinhaRubrica(linha);
    if (rubrica) rubricas.push(rubrica);
  }

  // Confere a soma das rubricas com os totais impressos no documento —
  // sinal forte de que a leitura está correta (ou não).
  const somaAbonos = rubricas.filter((r) => r.tipo === "abono").reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
  const somaDescontos = rubricas.filter((r) => r.tipo === "desconto").reduce((s, r) => s + (r.valorComRedu ?? 0), 0);
  const iliquidoConfere = totais.iliquido !== null && Math.abs(somaAbonos - totais.iliquido) < 0.02;
  const descontosConferem = totais.descontos !== null && Math.abs(somaDescontos - totais.descontos) < 0.02;

  let confianca;
  if (rubricas.length >= 3 && iliquidoConfere && descontosConferem) {
    confianca = "alta";
  } else if (rubricas.length > 0 && (totais.liquido !== null || iliquidoConfere || descontosConferem)) {
    confianca = "media";
  } else {
    confianca = "baixa";
  }

  return { metadados, totais, rubricas, confianca };
}

/**
 * Aplica correções que o utilizador já ensinou para esta entidade
 * empregadora (ver storage/db.js — getModeloEntidade/guardarCorrecoesEntidade)
 * ao resultado de parsearTalao, antes de mostrar o ecrã de confirmação.
 * `correcoes` é um mapa código de rubrica → { descricao?, tipo?, categoria? }.
 */
export function aplicarCorrecoesAprendidas(resultado, correcoes) {
  if (!correcoes || !Object.keys(correcoes).length) return resultado;
  const rubricas = resultado.rubricas.map((r) => {
    const correcao = r.codigo ? correcoes[r.codigo] : null;
    return correcao ? { ...r, ...correcao } : r;
  });
  return { ...resultado, rubricas };
}
