# Antecipa — identidade de marca

> "O seu IRS, um ano antes da hora."

Este documento é a referência única para qualquer decisão visual ou de
copy no Antecipa — landing e app. Segue a convenção de `BRAND.md` já
usada em Liberdade Fiscal: uma fonte de verdade curta, não um moodboard.

---

## 1. O que é esta marca

Antecipa não é uma calculadora de bolso — é um instrumento de precisão.
A pessoa que a usa já lida com números o ano inteiro (talões, recibos
verdes) e quer uma resposta que se comporte com o mesmo rigor: nada de
arredondamentos otimistas, nada de "estimativa aproximada". A marca
existe para comunicar essa exatidão sem soar burocrática ou fria.

*Nota de versão*: a identidade original (paleta tinteiro/latão, serifa
Fraunces, símbolo de círculo+ponteiro em torno do conceito "relojoeiro")
foi substituída a pedido do Dani por uma identidade azul mais direta —
documento fiscal "IRS" sobre uma calculadora, paleta azul, Inter como
única tipografia. Este documento descreve a versão atual.

---

## 2. Paleta

```css
--navy-deep:   #0B1D3A;  /* fundos escuros, cabeçalhos, calculadora do símbolo */
--navy-ink:    #142A52;  /* painéis de dados escuros (acumulado, desglose) */
--navy-mid:    #1F4E9E;  /* acento principal — CTAs, o azul da marca */
--paper:       #F1F3F6;  /* fundo geral */
--card:        #FFFFFF;
--hairline:    #DCE7F5;
--brass:       #1F4E9E;  /* mesmo azul de --navy-mid — nome do token ficou do sistema anterior */
--brass-light: #5B8DD9;  /* acento secundário, sobre fundo escuro */
--brass-soft:  #DCE7F5;  /* blocos de voz de marca, privacidade */
--devolver:    #2F6B52;  /* resultado positivo — nunca usar para outra coisa */
--devolver-bg: #E7F0EA;
--pagar:       #9B3D3D;  /* resultado negativo — idem */
--pagar-bg:    #F6E9E9;
--muted:       #6B7280;
--text:        #101B33;
```

**Regra**: o azul (`--brass`/`--navy-mid`, mesmo valor) é o único
acento de marca — CTAs, links, o símbolo. Devolver/pagar são
semânticos — reportam um resultado real, nunca são usados como
decoração. Os nomes das variáveis (`--brass`, `--navy-mid`) ficaram do
sistema de cores anterior para não obrigar a reescrever todo o CSS;
o que importa é o valor atual de cada uma, não o nome.

---

## 3. Tipografia

| Papel | Fonte | Uso |
|---|---|---|
| Tudo — títulos, corpo, UI, dados | `Inter` (400–800, itálico 400/500) | Única família tipográfica da marca |

Títulos e afirmações usam Inter a 700; corpo e labels a 400–600. Cifras
monetárias e percentagens usam `font-variant-numeric: tabular-nums`
(classe `.num`) para manter o alinhamento vertical das casas decimais
sem precisar de uma família separada — os tokens `--font-display`,
`--font-body` e `--font-mono` apontam todos para Inter.

---

## 4. O símbolo

Um documento fiscal com "IRS" sobre uma calculadora, ladeado por dois
arcos em azul — a ideia de "antecipação": o resultado já calculado
antes do documento oficial fechar. É o único elemento gráfico de
assinatura da marca — não se introduzem outros ícones decorativos ao
lado dele.

*Nota de versão*: a partir desta versão usa-se diretamente a arte
original fornecida pelo Dani (`Public/`), não uma recriação vetorial
— para máxima fidelidade ao logotipo desenhado, o símbolo é a imagem
recortada dessa arte, não um SVG redesenhado à mão.

Fonte: `assets/mark.png` (recorte de fundo transparente, para usar
sobre fundos claros — landing, onboarding) e `assets/mark-badge.png`
(o mesmo símbolo sobre um badge arredondado com fundo `--paper`,
usado sempre que o fundo é escuro ou é preciso um ícone autocontido —
cabeçalho da app, ícones PWA, favicon). Os ícones em `icons/` são
gerados a partir de `assets/mark.png` compondo o mesmo badge a cada
tamanho.

- **Cores fixas**: o símbolo não muda de cor consoante o contexto —
  para usar sobre fundo escuro, usa-se sempre a variante em badge
  (`mark-badge.png`), nunca uma recoloração do símbolo em si.
- **Uso**: cabeçalho da app (badge, 32px), landing (mark direto,
  28px, em lockup com a wordmark), onboarding (mark direto, 88px),
  ícones PWA (72–512px, badge), favicon (16/32px badge — a sigla
  "IRS" deixa de ser legível a este tamanho, o que é esperado).
- **Não fazer**: não duplicar o símbolo lado a lado como padrão
  decorativo; não o rodar; não o usar como marca de água exceto no PDF
  para contabilista (onde a marca de água é texto, não o símbolo); não
  recriar a arte à mão — qualquer atualização ao logotipo parte de
  novos ficheiros em `Public/`.

---

## 5. Voz

Direta, sem jargão fiscal desnecessário, nunca alarmista — mesmo
quando a notícia é "vai pagar".

- **Estado vazio**: *"Ainda sem documentos este mês. Carregue o
  primeiro para começar a antecipar."*
- **Resultado positivo**: *"Com o que já sabemos, o Estado deve-lhe
  dinheiro."*
- **Resultado a pagar**: *"Vai faltar pagar. Ainda tem tempo para se
  preparar."*

Estas três frases são a referência de tom para qualquer copy nova —
nunca as reescrever "para soar mais profissional"; é precisamente este
registo (curto, ativo, sem eufemismo mas sem alarme) que é a voz da
marca.

Regras de escrita:
- Verbos ativos, nunca passivos ("O Antecipa calcula" em vez de "é
  calculado").
- Nunca vago quando pode ser específico: "67% deste ano com números
  reais" em vez de "boa parte dos dados são reais".
- Um botão descreve exatamente o que acontece ao ser premido — nunca
  "Submeter" ou "Continuar" sem contexto.
- Sem CAPS-LOCK para labels, sem emojis, sem "→" no fim de CTAs.

---

## 6. Landing vs. app

São duas superfícies com o mesmo sistema de tokens mas propósitos
diferentes:

- **Landing** (`index.html` na raiz) — uma peça de apresentação, para
  alguém que ainda não conhece o Antecipa. Usa o produto real como
  hero (um mock fiel do selo de resultado, não uma ilustração
  genérica) porque a melhor forma de vender rigor é mostrar rigor.
- **App** (`app/`) — a ferramenta instalável, PWA, offline-first. Aqui
  a marca aparece só no cabeçalho e nos PDFs exportados; o resto do
  espaço visual pertence aos dados do utilizador.

Nunca replicar componentes de marketing (blocos de "prova social",
badges, etc.) dentro da app — o utilizador já está convencido, está lá
para ver os seus números.

---

## 7. Relação com outros produtos

Motor de cálculo fiscal partilhado com Liberdade Fiscal (código
reutilizável), mas produtos e marcas totalmente separados — sem
qualquer ligação comercial visível entre os dois em nenhuma das
superfícies (landing, app, PDFs exportados).
