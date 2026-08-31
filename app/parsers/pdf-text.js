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

// Devolve o texto simples, página a página concatenada — os parsers de
// talão/recibo verde trabalham sobre este texto com regex, tolerantes a
// pequenas variações de layout (nunca por coordenadas fixas, secção 6).
export async function extrairTextoPdf(arrayBuffer) {
  const pdfjsLib = await carregarPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textoCompleto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const conteudo = await page.getTextContent();
    const linha = conteudo.items.map((item) => item.str).join(" ");
    textoCompleto += linha + "\n";
  }
  return textoCompleto;
}

export async function ficheiroParaArrayBuffer(file) {
  return file.arrayBuffer();
}
