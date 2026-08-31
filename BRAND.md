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
existe para comunicar essa exatidão sem soar burocrática ou fria — o
tom é o de um relojoeiro, não o de um funcionário de finanças.

Isso determina todas as escolhas abaixo: a paleta (tinteiro/latão, não
SaaS azul-genérico), a tipografia (uma serifa editorial para as
afirmações, uma monoespaçada para cada número), e o símbolo (um
mecanismo, não um ícone decorativo).

---

## 2. Paleta

```css
--navy-deep:   #141A2B;  /* fundos escuros, cabeçalhos, o próprio símbolo */
--navy-ink:    #1E2740;  /* painéis de dados escuros (acumulado, desglose) */
--navy-mid:    #2B3555;  /* aro do símbolo, acentos secundários */
--paper:       #F3F4F7;  /* fundo geral */
--card:        #FFFFFF;
--hairline:    #DCDFE6;
--brass:       #A9843F;  /* ÚNICO acento quente — CTAs, a ponta do símbolo */
--brass-light: #D4B876;
--brass-soft:  #F1E8D6;  /* blocos de voz de marca, privacidade */
--devolver:    #2F6B52;  /* resultado positivo — nunca usar para outra coisa */
--devolver-bg: #E7F0EA;
--pagar:       #9B3D3D;  /* resultado negativo — idem */
--pagar-bg:    #F6E9E9;
--muted:       #6B7280;
--text:        #1B1F2A;
```

**Regra inegociável**: um único acento quente (brass). Devolver/pagar
são semânticos — reportam um resultado real, nunca são usados como
decoração ou para chamar atenção para outra coisa. Se precisar de mais
um acento algum dia, é sinal de que a composição está a falhar noutro
sítio (hierarquia, espaço), não de que falta cor.

---

## 3. Tipografia

| Papel | Fonte | Uso |
|---|---|---|
| Display / afirmações | `Fraunces` (opsz 9–144, peso 400–600) | Títulos, a tagline, headlines da landing |
| Corpo / UI | `IBM Plex Sans` (400/500/600) | Texto de interface, botões, labels |
| Dados | `IBM Plex Mono` (400–600) | **Toda** cifra monetária, percentagem, código de rubrica, referência legal — sem exceção |

A regra da monoespaçada para números não é estética — é o que faz o
Antecipa "parecer um extrato": alinhamento vertical de casas decimais,
leitura rápida de várias linhas de valores. Nunca formatar um número em
`IBM Plex Sans`.

---

## 4. O símbolo

Um círculo — o ciclo fiscal anual — atravessado por um ponteiro que já
ultrapassa o seu limite. A app já sabe o resultado antes de o ciclo
terminar; o ponteiro "chegou antes da hora". É o único elemento gráfico
de assinatura da marca — não se introduzem outros ícones decorativos
ao lado dele.

A versão refinada (`assets/mark.svg`) acrescenta um único detalhe de
precisão: um anel fino à volta da ponta do ponteiro, como a joia de um
mecanismo de relógio. É a única complexidade extra que o símbolo tem —
resiste a ficar pequeno (favicon 16px) e a ficar grande (hero da
landing) sem parecer nem vazio nem carregado.

- **Aro**: `currentColor` ou `--navy-mid` — pode adaptar-se a fundo
  claro ou escuro.
- **Ponteiro e ponta**: sempre `--brass` / `--brass-light` — isto
  nunca muda, é a assinatura cromática da marca.
- **Uso**: cabeçalho da app (32px), landing (28px, em lockup com a
  wordmark), ícones PWA (72–512px, sobre fundo `--navy-deep` com
  cantos arredondados), favicon (16/32px, versão simplificada
  automática por via do tamanho).
- **Não fazer**: não duplicar o símbolo lado a lado como padrão
  decorativo; não o rodar; não o usar como marca de água exceto no PDF
  para contabilista (onde a marca de água é texto, não o símbolo).

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
