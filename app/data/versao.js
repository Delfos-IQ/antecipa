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
export const VERSAO_ATUAL = "2.42";

// Mais recente primeiro.
export const HISTORICO_VERSOES = [
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
