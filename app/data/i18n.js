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
      // Missão, visão e valores tecidos numa única frase — nunca uma
      // secção "Missão/Visão/Valores" à parte (ver BRAND.md §5, voz da
      // marca: direta, específica, sem eufemismo). Missão: ninguém
      // descobrir o que deve só em abril. Valor: a fórmula oficial linha
      // a linha, não uma média redonda. Valor: os dados nunca saem do
      // dispositivo.
      promessa:
        "Achamos que ninguém devia descobrir o que deve ao Estado só em abril. Por isso replicamos a fórmula oficial do IRS, linha a linha — nunca uma média — e os seus dados nunca saem deste dispositivo.",
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
    titulo: "Dashboard",
    irsRetido: "IRS retido acumulado",
    segurancaSocial: "Segurança Social",
    taxaEfetiva: "Taxa de desconto efetiva",
    rendimentoIliquido: "Rendimento ilíquido acumulado",
    sindicato: "Quotização sindical",
    adse: "ADSE",
    liquidoAcumulado: "Líquido acumulado",
    descontosTitulo: "Como se reparte o que foi descontado",
    porMesTitulo: "Rendimento líquido por mês",
    evolucaoIrsTitulo: "IRS retido acumulado, mês a mês",
    semDados: "Ainda sem dados este ano. Carregue documentos nos Meses para ver o acumulado.",
    mesesComDados: "meses com dados reais",
    coberturaLabel: "Cobertura do ano",
    de12: "de 12",
    plafondsTitulo: "Uso dos tetos de dedução",
    plafondsCorpo: "Com base no que já preencheu em Deduções. Ajuste lá os valores para ver isto mudar.",
    plafondsVazio: "Ainda sem valores em Deduções — os tetos aparecem aqui assim que preencher algo lá.",
    plafondSaude: "Saúde",
    plafondEducacao: "Educação",
    plafondExigenciaFatura: "Exigência de fatura",
    plafondDespesasGerais: "Despesas gerais familiares",
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
    oportunidadesTitulo: "Oportunidades de poupança",
    oportunidadesAviso: "Isto é uma simulação com os seus próprios dados, não é aconselhamento financeiro.",
    oportunidadePprTitulo: "Ainda não tem PPR registado",
    oportunidadePprCorpo:
      "Um Plano Poupança-Reforma dá direito a deduzir 20% do valor entregue, até um teto anual (art.º 78º CIRS). " +
      "Com os seus números atuais, entregar",
    oportunidadePprLigacao: "este ano pouparia até",
    oportunidadePprIrParaPerfil: "Registar entrega de PPR",
  },

  nav: { mensal: "Meses", acumulado: "Dashboard", deducoes: "Deduções", simulacao: "Simulação", perfil: "Perfil", definicoes: "Definições" },

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
    guardaPartilhadaAjuda: "O quociente familiar e a dedução deste dependente ficam divididos a meio entre os dois sujeitos passivos (art.º 69º e 78º-A CIRS).",
    deducaoDependenteLabel: "Dedução deste dependente",
    remover: "Remover",
    idadeEm: "Idade em",
    anos: "anos",
    semDataNascimento: "Sem data de nascimento — aplicado o valor base, sem majoração por idade.",
    semDependentes: "Ainda sem dependentes registados.",
    adicionarDependente: "+ Adicionar dependente",
    anoFiscalTitulo: "Ano fiscal ativo",
    anoFiscalCorpo:
      "Os documentos, ajustes e simulações ficam sempre associados a um ano fiscal. Toque num ano para o tornar ativo, comece um novo exercício, ou remova um ano criado por engano.",
    anoAtivoLabel: "ativo",
    usarAno: "Usar",
    removerAno: "Remover",
    novoAno: "+ Começar novo ano",
    confirmarRemoverAno: "Tem a certeza que quer remover o ano",
    confirmarRemoverAnoCorpo: "Isto apaga todos os documentos, ajustes e simulações desse ano.",
    higieneTitulo: "Dados guardados neste dispositivo",
    higieneCorpo:
      "Todos os dados ficam só no seu dispositivo. Recomendamos exportar um backup antes de limpar qualquer coisa.",
    revisaoFiscalPrefixo: "Dados fiscais revistos em",
    revisaoFiscalProxima: "próxima revisão prevista",
    copyrightTexto: "Daniel Lanzas — Antecipa, simulador de IRS — todos os direitos reservados.",
    exportarTudo: "Exportar todos os dados (JSON)",
    limparAno: "Limpar dados do ano ",
    limparTudo: "Limpar tudo e recomeçar do zero",
    confirmarLimparAno: "Tem a certeza que quer apagar todos os documentos, ajustes e simulações do ano",
    confirmarLimparTudo:
      "Tem a certeza que quer apagar TODOS os dados da app, incluindo o agregado e as pessoas? Vai ser pedido para configurar tudo de novo.",
    confirmarLimparAvisoBackup: "Esta ação não pode ser desfeita. Considere exportar um backup primeiro.",
    navegacaoTitulo: "Navegação",
    voltarBoasVindas: "Voltar ao ecrã de boas-vindas",

    deducoesTitulo: "Deduções e outros rendimentos",
    deducoesCorpo:
      "Valores anuais do agregado que aproximam a simulação da Demonstração de Liquidação real. Pode deixar em branco o que não se aplicar — não é preciso preencher tudo.",
    deducoesGuardar: "Os valores ficam gravados automaticamente ao sair de cada campo.",
    deducoesGrupos: {
      saudeEducacao: {
        titulo: "Saúde, educação e PPR",
        saude: { label: "Despesas de saúde", hint: "Total anual em faturas de saúde (consultas, farmácia). Dedução de 15%, até 1.000€." },
        educacao: { label: "Despesas de educação", hint: "Propinas, livros, material escolar. Dedução de 30%, até 800€ (mais nas regiões do interior)." },
        ppr: { label: "Entregas para PPR", hint: "Valor entregue no ano para um Plano Poupança-Reforma. Dedução de 20%, até 400-800€ conforme a idade." },
        habitacao: { label: "Renda ou juros de crédito habitação", hint: "Renda de casa própria e permanente, ou juros de crédito à habitação contraído até 2011. Dedução de 15%." },
      },
      familia: {
        titulo: "Despesas gerais familiares",
        despesasGerais: { label: "Despesas gerais familiares", hint: "Base de incidência (35%) das despesas gerais do agregado (roupa, combustível, etc.) — o valor que consta do Portal das Finanças, não já a dedução calculada. Até 250€ (500€ em casal)." },
      },
      exigenciaFatura: {
        titulo: "Exigência de fatura (categorias do e-Fatura)",
        corpoHint:
          "Introduza o valor anual gasto em cada categoria (com IVA incluído), tal como aparece no Portal e-Fatura. O Antecipa aplica a percentagem legal e o teto de 250€/agregado (partilhado entre estas categorias).",
        exigenciaFaturaRestauracao: { label: "Restauração", hint: "Refeições em restaurantes, cafés. Dedução de 15% do IVA." },
        exigenciaFaturaReparacaoAutomovel: { label: "Reparação automóvel", hint: "Oficinas e reparação de veículos. Dedução de 15% do IVA." },
        exigenciaFaturaPassesMensais: { label: "Passes mensais / transportes públicos", hint: "Passes e bilhetes de transportes públicos. Dedução de 100% do IVA (mesmo teto de 250€)." },
        exigenciaFaturaOutras: { label: "Outras (cabeleireiros, veterinários, hotelaria, ginásios...)", hint: "Restantes categorias do e-Fatura sujeitas a esta dedução. Dedução de 15% do IVA." },
      },
      capital: {
        titulo: "Ganhos de capital",
        maisValias: { label: "Mais-valias e rendimentos de capitais não englobados", hint: "Ganhos de capital (ex.: venda de ações) e rendimentos de capitais (juros, dividendos) que não engloba no rendimento global. Tributados à parte, a 28%." },
      },
      outras: {
        titulo: "Outras deduções",
        duplaTributacao: { label: "Crédito por dupla tributação internacional", hint: "Imposto pago no estrangeiro sobre rendimento também tributado em Portugal, dedutível nos termos de acordo ou convenção." },
      },
    },
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

    privacidadeTitulo: "Os seus dados não saem do telemóvel ou do computador",
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
