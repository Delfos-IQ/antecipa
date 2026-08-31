// export/pdf-export.js
// Exportação em PDF, gerada localmente com jsPDF (secção 9). Duas
// variantes: pessoal (resumida, identidade Antecipa) e para contabilista
// (técnica, numeração oficial 1→11 com nota de mapeamento, nunca imita o
// layout da AT).

const NAVY_DEEP = [20, 26, 43];
const BRASS = [169, 132, 63];
const DEVOLVER = [47, 107, 82];
const PAGAR = [155, 61, 61];
const MUTED = [107, 114, 128];

function formatarMoeda(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v ?? 0);
}

function novoDoc() {
  if (!window.jspdf) throw new Error("jsPDF não está carregado — verifique a tag <script> em index.html.");
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: "pt", format: "a4" });
}

function cabecalho(doc, subtitulo) {
  doc.setFillColor(...NAVY_DEEP);
  doc.rect(0, 0, 595, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("antecipa.", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(212, 184, 118);
  doc.text(subtitulo, 40, 68);
}

function marcaDagua(doc) {
  doc.saveGraphicsState?.();
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(52);
  doc.setFont("helvetica", "bold");
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text("SIMULAÇÃO — ANTECIPA", 90, 500, { angle: 35 });
  }
  doc.restoreGraphicsState?.();
}

export function exportarPdfPessoal({ resultado, percentagemMediaReal, household, pessoas }) {
  const doc = novoDoc();
  cabecalho(doc, "O seu IRS, um ano antes da hora.");

  let y = 140;
  doc.setTextColor(...(resultado.tipo === "a_devolver" ? DEVOLVER : PAGAR));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(formatarMoeda(resultado.valor), 40, y);

  y += 24;
  doc.setFontSize(12);
  doc.text(resultado.tipo === "a_devolver" ? "a devolver pelo Estado" : "a pagar ao Estado", 40, y);

  y += 40;
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Baseado em ${Math.round((percentagemMediaReal ?? 0) * 100)}% dos meses com dados reais.`, 40, y);

  y += 16;
  doc.text(
    `Sujeitos passivos: ${(pessoas ?? []).map((p) => p.nome).filter(Boolean).join(" e ") || "—"}`,
    40,
    y
  );

  y += 40;
  doc.setTextColor(...NAVY_DEEP);
  doc.setFontSize(9);
  const disclaimer =
    "Simulação orientativa com base nos documentos carregados. Não substitui a declaração oficial de IRS nem aconselhamento fiscal certificado.";
  doc.text(doc.splitTextToSize(disclaimer, 500), 40, y);

  doc.save(`antecipa-simulacao-pessoal-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportarPdfContabilista({ declaracao, anoFiscal, household, pessoas }) {
  const doc = novoDoc();
  cabecalho(doc, `Simulação técnica — ano fiscal ${anoFiscal}`);

  let y = 120;
  doc.setTextColor(...NAVY_DEEP);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Desglose alinhado com a Demonstração de Liquidação de IRS (AT)", 40, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Cada linha indica a equivalência à numeração oficial da Demonstração.", 40, y);
  y += 24;

  const linhas = declaracao.linhas ?? declaracao.conjunta?.linhas;
  // Ordem explícita: Object.entries ordenaria "6A" fora de sequência (as
  // chaves numéricas do objeto sobem ao topo em JS, ficando "6A" no fim).
  const ordemLinhas = [1, 2, 3, 4, 5, 6, "6A", 7, 8, 9, 10, 11].filter((num) => linhas[num]);
  for (const num of ordemLinhas) {
    const linha = linhas[num];
    if (y > 760) {
      doc.addPage();
      y = 60;
    }
    const valor = linha.total ?? linha.valor ?? 0;
    doc.setTextColor(...BRASS);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(String(num), 40, y);

    doc.setTextColor(...NAVY_DEEP);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(linha.referenciaLegal ?? "", 70, y);

    doc.setFont("courier", "normal");
    doc.setTextColor(...NAVY_DEEP);
    doc.text(typeof valor === "number" ? formatarMoeda(valor) : String(valor), 430, y);

    y += 18;
  }

  y += 20;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    "Ajustes manuais aplicados a meses projetados estão assinalados na app (etiqueta \"Projetado (ajustado)\") e não são repetidos aqui por limitação de espaço — consultar Ventanas 1–12.",
    40,
    y,
    { maxWidth: 500 }
  );

  marcaDagua(doc);
  doc.save(`antecipa-simulacao-contabilista-${anoFiscal}.pdf`);
}
