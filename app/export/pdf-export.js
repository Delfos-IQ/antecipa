// export/pdf-export.js
// Exportação em PDF, gerada localmente com jsPDF (secção 9). Duas
// variantes: pessoal (resumida, identidade Antecipa, estilo "nota de
// liquidação") e para contabilista (técnica, numeração oficial 1→11 com
// nota de mapeamento, nunca imita o layout da AT).

const NAVY_DEEP = [20, 26, 43];
const BRASS = [169, 132, 63];
const DEVOLVER = [47, 107, 82];
const DEVOLVER_BG = [227, 240, 233];
const PAGAR = [155, 61, 61];
const PAGAR_BG = [248, 228, 228];
const MUTED = [107, 114, 128];
const LINHA_HAIRLINE = [225, 227, 231];

// Mesmos rótulos amigáveis usados no desglose da Ventana 14
// (ui/ventana-14.js:LABELS_LINHA) — duplicados aqui porque pdf-export.js
// não pode importar de ventana-14.js (seria uma dependência circular, já
// que é a própria ventana-14.js que importa exportarPdfPessoal). Manter em
// sincronia manualmente se a numeração oficial mudar.
const LABELS_LINHA = {
  1: "Rendimento Global",
  2: "Deduções Específicas",
  3: "Rendimento Coletável",
  4: "Ajuste anos anteriores",
  5: "Quociente Familiar",
  6: "Importância Apurada",
  "6A": "Taxa Adicional de Solidariedade",
  7: "Coleta Total",
  8: "Deduções à Coleta",
  9: "Coleta Líquida",
  10: "Retenções na Fonte acumuladas",
  11: "Resultado",
};
const ORDEM_LINHAS = [1, 2, 3, 4, 5, 6, "6A", 7, 8, 9, 10, 11];
const LINHAS_NAO_MONETARIAS = new Set([5]);

// Badge do símbolo Antecipa sobre fundo escuro (assets/mark-badge.png) —
// ver BRAND.md secção 4: a variante "badge" é a única aprovada para uso
// sobre fundo escuro (o cabeçalho do PDF usa NAVY_DEEP). Caminho relativo
// à página que carrega este módulo (app/index.html), não ao próprio
// ficheiro — mesma convenção já usada em ui/index.html e
// ui/components/symbol.js.
const CAMINHO_BADGE = "../assets/mark-badge.png";
let promessaBadge = null;
function carregarBadge() {
  if (!promessaBadge) {
    promessaBadge = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      // Se a imagem falhar (offline sem cache, caminho inacessível, etc.),
      // não bloquear a exportação do PDF — só cai para o cabeçalho sem
      // símbolo gráfico.
      img.onerror = () => resolve(null);
      img.src = CAMINHO_BADGE;
    });
  }
  return promessaBadge;
}

function formatarMoeda(v) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v ?? 0);
}

function formatarDataHora(d) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeStyle: "short" }).format(d);
}

function novoDoc() {
  if (!window.jspdf) throw new Error("jsPDF não está carregado — verifique a tag <script> em index.html.");
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: "pt", format: "a4" });
}

function cabecalho(doc, subtitulo, badgeImg) {
  doc.setFillColor(...NAVY_DEEP);
  doc.rect(0, 0, 595, 90, "F");

  const textoX = badgeImg ? 100 : 40;
  if (badgeImg) {
    // Badge quadrado, centrado verticalmente no cabeçalho, com espaço
    // suficiente antes do texto para não sobrepor a wordmark.
    doc.addImage(badgeImg, "PNG", 40, 21, 48, 48);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("antecipa.", textoX, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(212, 184, 118);
  doc.text(subtitulo, textoX, 68);
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

// Faixa de resultado, estilo "nota de liquidação": fundo tingido a verde
// (a devolver) ou vermelho (a pagar), valor em destaque logo abaixo do
// cabeçalho — pedido do Dani (03/09/2026) para que o PDF pessoal comece
// pelo mesmo golpe de vista de cor que uma Demonstração de Liquidação real
// da AT, antes de qualquer desglose.
function faixaResultado(doc, { resultado, anoFiscal, percentagemMediaReal }) {
  const aDevolver = resultado.tipo === "a_devolver";
  const corTexto = aDevolver ? DEVOLVER : PAGAR;
  const corFundo = aDevolver ? DEVOLVER_BG : PAGAR_BG;

  doc.setFillColor(...corFundo);
  doc.roundedRect(40, 112, 515, 108, 6, 6, "F");

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    anoFiscal ? `Simulação do IRS — ano fiscal ${anoFiscal}` : "Simulação do IRS",
    64,
    136
  );

  doc.setTextColor(...corTexto);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(formatarMoeda(resultado.valor), 64, 178);

  doc.setFontSize(13);
  doc.text(aDevolver ? "a devolver pelo Estado" : "a pagar ao Estado", 64, 200);

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Baseado em ${Math.round((percentagemMediaReal ?? 0) * 100)}% dos meses com dados reais.`,
    64,
    214
  );
}

function linhaSujeitos(doc, pessoas, y) {
  doc.setTextColor(...NAVY_DEEP);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Sujeitos passivos", 40, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text((pessoas ?? []).map((p) => p.nome).filter(Boolean).join(" e ") || "—", 150, y);
}

// Desglose resumido, estilo Demonstração de Liquidação (número de linha +
// descrição + valor), mas com os rótulos amigáveis já usados na app em vez
// dos códigos técnicos — a versão completa com referências legais linha a
// linha continua reservada ao PDF para contabilista.
function desgloseResumido(doc, declaracao, yInicial) {
  if (!declaracao?.linhas) return yInicial;

  let y = yInicial;
  doc.setTextColor(...NAVY_DEEP);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Como chegámos a este valor", 40, y);
  y += 18;

  const linhas = declaracao.linhas;
  const numerosPresentes = ORDEM_LINHAS.filter((num) => linhas[num]);

  for (const num of numerosPresentes) {
    const linha = linhas[num];
    if (y > 760) {
      doc.addPage();
      y = 60;
    }
    const valor = linha.total ?? linha.valor ?? 0;
    const valorFormatado =
      typeof valor === "number"
        ? LINHAS_NAO_MONETARIAS.has(num)
          ? valor.toFixed(2)
          : formatarMoeda(valor)
        : String(valor);

    doc.setDrawColor(...LINHA_HAIRLINE);
    doc.line(40, y + 6, 555, y + 6);

    doc.setTextColor(...BRASS);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(String(num), 40, y);

    doc.setTextColor(...NAVY_DEEP);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(LABELS_LINHA[num] ?? "", 66, y);

    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.text(valorFormatado, 480, y, { align: "right" });

    y += 22;
  }

  return y;
}

function rodape(doc, y) {
  doc.setTextColor(...NAVY_DEEP);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const disclaimer =
    "Simulação orientativa com base nos documentos carregados. Não substitui a declaração oficial de IRS nem aconselhamento fiscal certificado.";
  doc.text(doc.splitTextToSize(disclaimer, 515), 40, y);

  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(`Gerado em ${formatarDataHora(new Date())}`, 40, y + 30);
}

export async function exportarPdfPessoal({ resultado, percentagemMediaReal, household, pessoas, declaracao, anoFiscal }) {
  const badgeImg = await carregarBadge();

  const doc = novoDoc();
  cabecalho(doc, "O seu IRS, um ano antes da hora.", badgeImg);
  faixaResultado(doc, { resultado, anoFiscal, percentagemMediaReal });

  linhaSujeitos(doc, pessoas, 250);

  const yAposDesglose = desgloseResumido(doc, declaracao, 280);

  rodape(doc, Math.max(yAposDesglose + 20, 700));

  doc.save(`antecipa-simulacao-pessoal-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportarPdfContabilista({ declaracao, anoFiscal, household, pessoas }) {
  const badgeImg = await carregarBadge();

  const doc = novoDoc();
  cabecalho(doc, `Simulação técnica — ano fiscal ${anoFiscal}`, badgeImg);

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
