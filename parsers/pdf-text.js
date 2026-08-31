// parsers/pdf-text.js
// Extração de texto de um PDF usando pdf.js (carregado globalmente via
// <script> em index.html, ver secção "PWA / libs externas"). Devolve o
// texto simples, página a página concatenada — os parsers de talão/recibo
// verde trabalham sobre este texto com regex, tolerantes a pequenas
// variações de layout (nunca por coordenadas fixas, conforme secção 6).

export async function extrairTextoPdf(arrayBuffer) {
  if (!window.pdfjsLib) {
    throw new Error("pdf.js não está carregado — verifique a tag <script> em index.html.");
  }
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
