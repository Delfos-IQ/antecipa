// data/i18n.js
// Idioma único no v1: português europeu. Ficheiro isolado desde já para
// que uma futura expansão multi-idioma não implique reescrever a UI —
// todas as strings de interface devem vir daqui, nunca hardcoded.

export const pt = {
  app: { nome: "Antecipa", tagline: "O seu IRS, um ano antes da hora." },

  onboarding: {
    boasVindas: {
      titulo: "Antecipa",
      tagline: "O seu IRS, um ano antes da hora.",
      cta: "Começar",
    },
    privacidade: {
      titulo: "Os seus dados ficam aqui",
      corpo:
        "Tudo o que carregar — talões, recibos verdes, valores — fica guardado apenas neste dispositivo. Nada é enviado para servidores externos, exceto se decidir exportar um PDF e partilhá-lo você mesmo.",
      cta: "Entendido",
    },
    agregado: {
      titulo: "O seu agregado familiar",
      pergunta: "Qual é a sua situação?",
      opcoes: {
        solteiro: { titulo: "Sozinho(a)", desc: "Um sujeito passivo, com ou sem dependentes." },
        casal: { titulo: "Casado(a) ou em união de facto", desc: "Dois sujeitos passivos — escolhe depois o regime de tributação." },
        divorciado_dependentes: { titulo: "Divorciado(a), com dependentes", desc: "Um sujeito passivo, com dependentes em guarda exclusiva ou partilhada." },
      },
      regimeTitulo: "Regime de tributação",
      regimes: {
        conjunta: { titulo: "Declaração conjunta", desc: "Os dois sujeitos passivos numa só declaração." },
        separada: { titulo: "Declarações separadas", desc: "Cada sujeito passivo entrega a sua." },
        comparar_ambos: { titulo: "Comparar os dois", desc: "O Antecipa calcula ambos os cenários e mostra o mais vantajoso." },
      },
      quocienteLabel: "Quociente familiar estimado",
    },
    sujeitosPassivos: {
      titulo: "Quem são os sujeitos passivos",
      nome: "Nome",
      nif: "NIF",
      adicionarDepois: "Adicionar a segunda pessoa depois",
    },
    fontesRendimento: {
      titulo: "Fontes de rendimento",
      pergunta: "Que tipo de rendimento vai carregar?",
      opcoes: {
        trabalhoDependente: "Trabalho dependente (Categoria A)",
        recibosVerdes: "Recibos verdes (Categoria B)",
        capitaisMaisValias: "Capitais e mais-valias (Categoria E/G)",
      },
    },
    primeiroDocumento: {
      titulo: "O primeiro documento",
      corpo: "Carregue o primeiro talão ou recibo verde para começar a antecipar o seu IRS — ou explore a app sem carregar nada ainda.",
      ctaCarregar: "Carregar o primeiro talão",
      ctaExplorar: "Explorar sem carregar",
    },
    voltar: "Voltar",
    seguinte: "Seguinte",
  },

  meses: [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ],

  mensal: {
    semDocumentos: "Ainda sem documentos este mês. Carregue o primeiro para começar a antecipar.",
    adicionarDocumento: "Adicionar documento",
    tipoTalao: "Talão",
    tipoReciboVerde: "Recibo verde",
    origemReal: "Real",
    origemProjetado: "Projetado",
    origemProjetadoAjustado: "Projetado (ajustado)",
  },

  ventana13: {
    titulo: "Acumulado do ano",
    irsRetido: "IRS retido acumulado",
    segurancaSocial: "Segurança Social",
    taxaEfetiva: "Taxa de desconto efetiva",
    rendimentoIliquido: "Rendimento ilíquido acumulado",
  },

  ventana14: {
    titulo: "Simulação",
    aDevolver: "Com o que já sabemos, o Estado deve-lhe dinheiro.",
    aPagar: "Vai faltar pagar. Ainda tem tempo para se preparar.",
    confiancaPrefixo: "Baseado em",
    confiancaSufixo: "dos meses com dados reais",
    verCalculoCompleto: "Ver cálculo completo",
    fecharCalculoCompleto: "Fechar cálculo completo",
    maisVantajoso: "Mais vantajoso",
    diferenca: "Diferença",
    disclaimer:
      "Simulação orientativa com base nos documentos carregados. Não substitui a declaração oficial de IRS nem aconselhamento fiscal certificado.",
    exportarPdf: "Exportar PDF",
    exportarPessoal: "Versão pessoal",
    exportarContabilista: "Versão para contabilista",
  },

  nav: { mensal: "Meses", acumulado: "Acumulado", simulacao: "Simulação", definicoes: "Definições" },
};
