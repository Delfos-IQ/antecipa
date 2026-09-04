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
export const VERSAO_ATUAL = "2.31";

// Mais recente primeiro.
export const HISTORICO_VERSOES = [
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
