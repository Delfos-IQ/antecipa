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
    adicionarDocumento: "Carregar talão ou recibo verde",
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
    sindicato: "Quotização sindical",
    adse: "ADSE",
    liquidoAcumulado: "Líquido acumulado",
    descontosTitulo: "Como se reparte o que foi descontado",
    porMesTitulo: "Rendimento líquido por mês",
    semDados: "Ainda sem dados este ano. Carregue documentos nos Meses para ver o acumulado.",
    mesesComDados: "meses com dados reais",
    coberturaLabel: "Cobertura do ano",
    de12: "de 12",
  },

  ventana14: {
    titulo: "Simulação",
    aDevolver: "Com o que já sabemos, o Estado deve-lhe dinheiro.",
    aPagar: "Vai faltar pagar. Ainda tem tempo para se preparar.",
    confiancaPrefixo: "Já sabemos",
    confiancaSufixo: "deste ano com números reais — o resto é a nossa melhor projeção.",
    vazioTitulo: "Ainda não há nada para simular",
    vazioCorpo: "Carregue o primeiro talão ou recibo verde num dos meses para o Antecipa começar a calcular o seu IRS.",
    vazioCta: "Carregar o primeiro documento",
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

  nav: { mensal: "Meses", acumulado: "Acumulado", simulacao: "Simulação", perfil: "Perfil", definicoes: "Definições" },

  bannerLegal: {
    texto:
      "O Antecipa é uma ferramenta de simulação e apoio à decisão. Não é aconselhamento fiscal certificado e não substitui a declaração oficial de IRS entregue no Portal das Finanças.",
  },

  perfil: {
    titulo: "Perfil",
    agregadoTitulo: "O seu agregado",
    situacaoLabel: "Situação",
    dependentesTitulo: "Dependentes",
    dependentesCorpo:
      "Cada dependente conta para o quociente familiar e para a dedução à coleta (art.º 78º-A CIRS) — o valor exato depende da idade a 31 de dezembro e de ser o 1º dependente ou não.",
    dependenteNomePlaceholder: "Nome",
    guardaPartilhada: "Guarda partilhada",
    remover: "Remover",
    idadeEm: "Idade em",
    anos: "anos",
    semDataNascimento: "Sem data de nascimento — aplicado o valor base, sem majoração por idade.",
    semDependentes: "Ainda sem dependentes registados.",
    adicionarDependente: "+ Adicionar dependente",
    anoFiscalTitulo: "Ano fiscal ativo",
    anoFiscalCorpo:
      "Os documentos, ajustes e simulações ficam sempre associados a um ano fiscal. Mude aqui o ano ativo para começar um novo exercício (ex.: 2027) sem perder o histórico do anterior.",
    novoAno: "+ Começar novo ano",
    higieneTitulo: "Dados guardados neste dispositivo",
    higieneCorpo:
      "Todos os dados ficam só no seu dispositivo. Recomendamos exportar um backup antes de limpar qualquer coisa.",
    exportarTudo: "Exportar todos os dados (JSON)",
    limparAno: "Limpar dados do ano ",
    limparTudo: "Limpar tudo e recomeçar do zero",
    confirmarLimparAno: "Tem a certeza que quer apagar todos os documentos, ajustes e simulações do ano",
    confirmarLimparTudo:
      "Tem a certeza que quer apagar TODOS os dados da app, incluindo o agregado e as pessoas? Vai ser pedido para configurar tudo de novo.",
    confirmarLimparAvisoBackup: "Esta ação não pode ser desfeita. Considere exportar um backup primeiro.",
    navegacaoTitulo: "Navegação",
    voltarBoasVindas: "Voltar ao ecrã de boas-vindas",
  },

  // Copy da landing pública (index.html na raiz do site — ver secção
  // "Landing pública" do BRAND.md). Vive aqui por coerência, ainda que a
  // landing seja HTML estático e não carregue este módulo diretamente.
  landing: {
    heroEyebrow: "Para quem já quer saber, não adivinhar",
    heroTitulo: "O seu IRS, um ano antes da hora.",
    heroCorpo:
      "Acompanhe o ano fiscal mês a mês: carregue cada talão e recibo verde assim que chega, e o Antecipa vai apurando o resultado — cada vez mais preciso — até ao que vai realmente pagar ou receber a 31 de dezembro.",
    heroCtaPrimario: "Começar a antecipar",
    heroCtaSecundario: "Ver como funciona",
    heroLegenda: "Simulação real de um agregado com 8 meses carregados",

    confiancaTitulo: "Não é uma estimativa. É a fórmula oficial, linha a linha.",
    confiancaCorpo:
      "A maioria das calculadoras de IRS adivinha um valor redondo a partir do seu salário. O Antecipa faz o oposto: segue a mesma cadeia de cálculo da Demonstração de Liquidação da AT — rendimento global, deduções específicas, quociente familiar, deduções à coleta — e mostra-lhe cada linha, com a referência legal ao lado.",

    passos: [
      {
        numero: "1",
        titulo: "Carregue o que já tem",
        corpo: "Um talão de vencimento, um recibo verde — o que for chegando, mês a mês. Cada valor fica guardado só no seu dispositivo.",
      },
      {
        numero: "2",
        titulo: "O Antecipa preenche o resto",
        corpo: "Os meses que ainda não chegaram são projetados a partir do que já sabe de si — nunca inventados, sempre etiquetados como projeção.",
      },
      {
        numero: "3",
        titulo: "Veja o resultado, com a conta aberta",
        corpo: "Um valor a pagar ou a devolver, com o desglose completo por trás — e a % do ano que já é real, não projeção.",
      },
    ],

    privacidadeTitulo: "Os seus dados não saem do seu telemóvel",
    privacidadeCorpo:
      "Sem contas, sem servidor, sem terceiros. Tudo o que carregar fica no seu dispositivo — só sai de lá se for você a exportar um PDF e a decidir partilhá-lo.",

    vozTitulo: "Dois cenários. Uma resposta simples.",
    vozDevolver: "Com o que já sabemos, o Estado deve-lhe dinheiro.",
    vozPagar: "Vai faltar pagar. Ainda tem tempo para se preparar.",

    rodapeCta: "Comece a antecipar o seu IRS",
    rodapeCtaBotao: "Abrir o Antecipa",
    rodapeDisclaimer:
      "Simulação orientativa com base nos documentos carregados. Não substitui a declaração oficial de IRS nem aconselhamento fiscal certificado.",
  },
};
