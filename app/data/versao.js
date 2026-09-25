// data/versao.js — histórico de versões visível ao utilizador, em Perfil.
//
// Pedido do Dani (03/09/2026, inicialmente adiado a seu pedido — "Tarea
// pendiente (no lo tocamos aun)" — e retomado depois): "Algo simple, sin
// demasiados detalles. Que me ayude a saber en que version estamos y las
// que vamos colocando."
//
// MANUTENÇÃO: atualizar esta lista sempre que se faz um deploy, a par do
// bump de CACHE_NAME em sw.js — os dois números NÃO estão ligados
// automaticamente (sw.js não é um módulo ES, é registado como script
// clássico em app.js, por isso não pode importar daqui) — têm de ser
// mantidos em sincronia à mão, um a seguir ao outro. Manter cada resumo a
// uma linha curta, sem detalhes técnicos — isto é para o utilizador
// confirmar "estou na versão mais recente?", não um changelog técnico.
export const VERSAO_ATUAL = "2.63";

// Mais recente primeiro.
export const HISTORICO_VERSOES = [
  { versao: "2.63", resumo: "Mais espaço entre os cartões empilhados de Perfil e Deduções" },
  { versao: "2.62", resumo: "Unificadas as margens internas de todos os cartões principais da app (Perfil, Deduções, Simulação) — um único padding partilhado, em vez de cada ecrã ter o seu próprio valor" },
  { versao: "2.61", resumo: "Correção: os cartões de Perfil e Deduções passam a alinhar com o resto da app (antes acabavam numa borda diferente); mais margem à volta do texto dentro de cada cartão" },
  { versao: "2.60", resumo: "O cartão de Perfil e Deduções ficou bem mais largo em monitores grandes — menos margens brancas, mais espaço para o conteúdo" },
  { versao: "2.59", resumo: "O cartão único de Perfil e Deduções ficou mais largo — mais espaço à volta do texto, mais fácil de ler" },
  { versao: "2.58", resumo: "Perfil e Deduções voltam a uma única coluna (pedido do Dani — as tentativas de 2/3 colunas cortavam demasiado o texto); o resto da app continua a aproveitar o ecrã largo" },
  { versao: "2.57", resumo: "Correção importante: os gráficos de barras do Dashboard (rendimento por mês, IRS acumulado) ficavam invisíveis em Safari, mesmo com dados reais — bug de CSS específico do Safari, agora corrigido" },
  { versao: "2.56", resumo: "Correção: em monitores grandes (confirmado pelo Dani), a app ainda deixava quase metade do ecrã em margens brancas — o conteúdo agora usa muito mais largura, em todos os ecrãs" },
  { versao: "2.55", resumo: "Correção: a grelha de 2 colunas de Perfil/Deduções (v2.54) deixava vazios grandes quando um cartão era muito mais curto que o vizinho — agora é um mosaico que se ajusta à altura real de cada cartão" },
  { versao: "2.54", resumo: "Correção: em ecrãs de computador largos, Perfil e Deduções ficavam numa coluna estreita ao centro — agora os cartões usam melhor o espaço" },
  { versao: "2.53", resumo: "Novo: dedução de encargos com lares (art.º 84º CIRS), por pessoa, em Perfil; correção de um bug real no limite agregado de deduções" },
  { versao: "2.52", resumo: "Reforço de segurança (política de conteúdo mais estrita) e confirmação de valores fiscais contra fontes oficiais" },
  { versao: "2.51", resumo: "Novo: suporte ao regime IRS Jovem (até 35 anos) — data de nascimento e ano de início em Perfil, por titular" },
  { versao: "2.50", resumo: "Novo: ícones em cada categoria de deduções, na mesma linha visual da marca" },
  { versao: "2.49", resumo: "Correção importante: o PPR era um único campo do casal — agora cada titular tem o seu próprio campo e o seu próprio teto de dedução, como manda a lei" },
  { versao: "2.48", resumo: "Novo: barras de \"dedução correspondente\" em Deduções e na Simulação, tal como no Portal das Finanças — mostra logo quanto cada despesa vale em dedução e quão perto está do teto" },
  { versao: "2.47", resumo: "Correção: a ADSE do talão volta a somar-se à Segurança Social na dedução específica; novo campo em Perfil para a quotização da ordem profissional (ex.: Ordem dos Enfermeiros)" },
  { versao: "2.46", resumo: "Correção: quotizações para ordens profissionais (ex.: Ordem dos Enfermeiros) passam a aumentar corretamente a dedução específica de quem ganha menos" },
  { versao: "2.45", resumo: "Novo: o subsídio de férias/Natal projetado passa a ser editável — útil para quem o recebe por duodécimos ou sai da empresa antes do pagamento" },
  { versao: "2.44", resumo: "Correção: pôr o vencimento bruto projetado a 0€ (\"não vou trabalhar este mês\") fazia esse mês desaparecer do detalhe, sem forma de o repor" },
  { versao: "2.43", resumo: "Correção: apagar por completo o valor de um recibo verde projetado, no detalhe mês a mês, não atualizava o resultado" },
  { versao: "2.42", resumo: "Correção importante: ao comparar declaração conjunta vs. separadas, as despesas de saúde/educação/PPR do casal estavam a contar em dobro em cada declaração separada" },
  { versao: "2.41", resumo: "No detalhe da projeção, o salário estimado passa a chamar-se \"Vencimento bruto\" — o mesmo nome usado nos meses reais, para não confundir" },
  { versao: "2.40", resumo: "Correção importante: os meses projetados passam a estimar também IRS retido, Segurança Social, sindicato e ADSE — antes só o salário bruto entrava na conta" },
  { versao: "2.39", resumo: "Novo: na Simulação, pode escolher \"só dados reais\" (sem projeção) e ver/corrigir mês a mês o que estamos a assumir para o resto do ano" },
  { versao: "2.38", resumo: "Correção grave: os meses sem documento carregado ficavam sempre com 0€ de salário na projeção, mesmo tendo talões anteriores" },
  { versao: "2.37", resumo: "Correção importante: quando havia mais de um documento no mesmo mês (ex. talão e recibo verde), só o primeiro contava para o cálculo real" },
  { versao: "2.36", resumo: "Novo: na comparação conjunta vs. separadas, pode tocar em cada cartão para explorar o cálculo completo e os PDFs desse regime" },
  { versao: "2.35", resumo: "Novo: importar dados de um ficheiro de backup — útil para levar a sua simulação para outro navegador" },
  { versao: "2.34", resumo: "Correção: dedução mínima garantida de 15% da Categoria B (recibos verdes) não estava a ser aplicada em algumas atividades" },
  { versao: "2.33", resumo: "Correção: ao comparar declaração conjunta vs. separadas, o desglose e os PDFs podiam mostrar números de um regime diferente do valor em destaque" },
  { versao: "2.32", resumo: "Segurança: corrige uma falha que permitia que um PDF carregado injetasse código na app" },
  { versao: "2.31", resumo: "Correções de precisão validadas com uma declaração de IRS real (taxa adicional, deduções, despesas gerais)" },
  { versao: "2.30", resumo: "Novo: escolher a atividade dos recibos verdes acerta o coeficiente e a retenção estimada" },
  { versao: "2.29", resumo: "Novo: deduções de ascendentes a cargo, deficiência e trabalho doméstico" },
  { versao: "2.28", resumo: "A sugestão de pedir mais retenção agora diz quanto, em euros/mês" },
  { versao: "2.27", resumo: "Novo: pode simular o ano fiscal de 2025, retrospetivamente" },
  { versao: "2.26", resumo: "Correção: quociente familiar estimado aparecia \"NaN\" no onboarding" },
  { versao: "2.25", resumo: "Correção: resumo de cada mês mostrava sempre 0,00€" },
  { versao: "2.24", resumo: "Novo: histórico de versões, em Perfil" },
  { versao: "2.23", resumo: "Correção: comparação conjunta vs. separadas mostrava reembolso como \"a pagar\"" },
  { versao: "2.22", resumo: "Novo: sugestões para pagar menos, na Simulação" },
  { versao: "2.21", resumo: "PDF pessoal com identidade visual e faixa de resultado a cor" },
  { versao: "2.20", resumo: "Correção: painel do 2º titular inacessível em ecrãs de computador" },
  { versao: "2.19", resumo: "Upload de documentos: opções de edição escondidas por omissão" },
  { versao: "2.18", resumo: "Editar/remover documentos já carregados + correção ao gravar" },
  { versao: "2.17", resumo: "Correção: data de nascimento e navegação por Tab no Perfil" },
  { versao: "2.16", resumo: "Onboarding de dependentes, upload por titular, deduções dos filhos, PPR" },
];
