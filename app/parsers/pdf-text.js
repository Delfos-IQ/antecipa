// parsers/pdf-text.js
// Extração de texto de um PDF usando pdf.js. A partir da v4, o pdf.js só
// publica builds ES module (.mjs) — já não há um "pdf.min.js" UMD para
// carregar via <script src="..."> global (era isso que index.html fazia
// antes, e por isso o parsing de documentos nunca chegou a funcionar).
// Em vez disso, importa-se o módulo diretamente aqui, uma única vez.
const PDF_JS_VERSAO = "4.0.379";
const PDF_JS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSAO}`;

let pdfjsLibPromise = null;
function carregarPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(/* webpackIgnore: true */ `${PDF_JS_BASE}/pdf.min.mjs`).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `${PDF_JS_BASE}/pdf.worker.min.mjs`;
      return mod;
    });
  }
  return pdfjsLibPromise;
}

// Pares de cabeçalhos de tabelas lado a lado conhecidos (ver secção 6.1).
// Um talão de vencimento português típico desenha "Abonos" e "Descontos"
// como duas tabelas na mesma linha visual — o texto extraído pelo pdf.js
// segue a ordem interna do stream de desenho, não a ordem de leitura, o
// que intercala as duas tabelas de forma imprevisível. Quando encontramos
// os dois rótulos de cabeçalho na mesma página, usamos a posição x do
// segundo para separar cada linha da zona da tabela em duas linhas
// independentes — uma por tabela — antes de qualquer parsing por regex.
const PARES_TABELA_DUPLA = [["Abonos", "Descontos"]];

// Marcador de linha pertencente à "coluna direita" de um par de tabelas
// (ex.: Descontos). Os parsers usam-no para saber a que tabela pertence
// cada linha sem terem de voltar a olhar para coordenadas.
export const MARCADOR_COLUNA_DIREITA = "»";

function agruparPorLinha(items, tolY = 2.5) {
  const ordenado = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const it of ordenado) {
    let linha = linhas.find((l) => Math.abs(l.y - it.y) <= tolY);
    if (!linha) {
      linha = { y: it.y, items: [] };
      linhas.push(linha);
    }
    linha.items.push(it);
  }
  linhas.sort((a, b) => b.y - a.y);
  for (const linha of linhas) linha.items.sort((a, b) => a.x - b.x);
  return linhas;
}

function reconstruirTextoPagina(items) {
  const linhas = agruparPorLinha(items);

  // Localizar um par de cabeçalhos de tabela dupla, se existir nesta página.
  let splitX = null;
  let splitYMax = null;
  let splitYMin = 0;
  for (const [rotuloEsq, rotuloDir] of PARES_TABELA_DUPLA) {
    const hdrEsq = items.find((i) => i.str.trim() === rotuloEsq);
    const hdrDir = items.find((i) => i.str.trim() === rotuloDir);
    if (hdrEsq && hdrDir) {
      // Um pequeno recuo (10pt) porque o rótulo do cabeçalho fica tipicamente
      // um pouco mais à direita do que o início real da coluna de dados.
      splitX = hdrDir.x - 10;
      splitYMax = Math.max(hdrEsq.y, hdrDir.y) + 2.5;
      // A zona de tabela termina na primeira linha "Total ..." encontrada
      // abaixo do cabeçalho — a partir daí o layout volta a ser um único
      // bloco (rodapé), onde dividir por esta mesma coordenada x só
      // introduziria ruído.
      const totalItem = items.find((i) => i.y < splitYMax && /^Total\b/.test(i.str.trim()));
      if (totalItem) splitYMin = totalItem.y - 1;
      break;
    }
  }

  const linhasTexto = [];
  for (const linha of linhas) {
    const dentroDaTabela = splitX !== null && linha.y < splitYMax && linha.y >= splitYMin;
    if (dentroDaTabela) {
      const esquerda = linha.items.filter((i) => i.x < splitX);
      const direita = linha.items.filter((i) => i.x >= splitX);
      if (esquerda.length) linhasTexto.push(esquerda.map((i) => i.str).join(" "));
      if (direita.length) linhasTexto.push(MARCADOR_COLUNA_DIREITA + direita.map((i) => i.str).join(" "));
    } else {
      linhasTexto.push(linha.items.map((i) => i.str).join(" "));
    }
  }
  return linhasTexto.join("\n");
}

// Devolve o texto do PDF reconstruído em ordem de leitura visual (linha a
// linha, esquerda para a direita dentro de cada linha), não na ordem
// interna do stream do PDF — que para documentos com colunas ou tabelas
// lado a lado (comum em talões portugueses) não coincide com a ordem de
// leitura. Isto é feito a partir das coordenadas x/y de cada fragmento de
// texto (posição relativa dentro do próprio documento, nunca coordenadas
// fixas de um layout específico — ver secção 6), por isso continua a
// tolerar variações de layout entre entidades empregadoras.
export async function extrairTextoPdf(arrayBuffer) {
  const pdfjsLib = await carregarPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const conteudo = await page.getTextContent();
    const items = conteudo.items
      .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }))
      .filter((item) => item.str.trim() !== "");
    paginas.push(reconstruirTextoPagina(items));
  }
  return paginas.join("\n");
}

export async function ficheiroParaArrayBuffer(file) {
  return file.arrayBuffer();
}
