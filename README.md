# Antecipa

> "O seu IRS, um ano antes da hora."

PWA local-first (vanilla HTML/CSS/JS, ES modules) que simula o IRS português mês a mês, replicando a fórmula oficial da Autoridade Tributária, para antecipar se vai pagar ou receber antes da campanha de entrega.

## Como correr localmente

Não há build step. Basta servir a pasta com qualquer servidor estático (não abrir `index.html` diretamente com `file://`, porque os módulos ES e o service worker exigem `http(s)://`):

```bash
cd antecipa
python3 -m http.server 8080
# abrir http://localhost:8080
```

Para publicar no GitHub Pages: colocar esta pasta na raiz do repositório (ou em `/docs`) e ativar Pages nas definições do repositório.

## O que está feito nesta v1

- **Motor de cálculo** (`engine/calculo-irs.js`) — replica a cadeia oficial 1→11 da Demonstração de Liquidação: rendimento global, deduções específicas, rendimento coletável, quociente familiar, importância apurada, taxa adicional de solidariedade, coleta total, deduções à coleta, coleta líquida, retenções acumuladas, resultado. Inclui `compararRegimes()` para o modo conjunta vs. separada.
- **Sistema de projeção** (`engine/projecao.js`) — Real vs. Projetado por componente (nunca um multiplicador global), com ajustes manuais que são descartados automaticamente quando chega um documento real.
- **Modelo de dados completo em IndexedDB** (`storage/db.js`) — todas as entidades da secção 4 do prompt: household, pessoas, dependentes, documentos, rubricas, ajusteManual, deducoesColeta, declaracao, simulacaoAnual.
- **Onboarding de 5 passos**, **ventanas mensais 1–12** (acordeão, separação por pessoa em tabs/mega-cartões conforme o ecrã), **Ventana 13 (acumulado)** e **Ventana 14 (simulação)** com desglose linha a linha e modo comparação.
- **Parsers de talão e recibo verde** por regex sobre texto extraído via pdf.js, com **ecrã de confirmação editável obrigatório** antes de gravar qualquer rubrica.
- **Exportação em PDF** (jsPDF) — versão pessoal e versão técnica para contabilista, com marca de água e mapeamento à numeração oficial.
- **PWA**: manifest.json, ícones 72–512px a partir do símbolo de marca, service worker cache-first (`antecipa-v1.0`).
- Identidade visual aplicada tal como especificada: paleta navy/brass, Fraunces + IBM Plex Sans + IBM Plex Mono, símbolo do ponteiro que atravessa o círculo.

## O que precisa da sua atenção antes de usar a sério

1. **Escalões e limites fiscais não confirmados linha a linha contra o Diário da República.**
   `data/legislacao-2026.js` foi preenchido com valores compilados de fontes fiscais públicas (ver `fonte` em cada bloco) para o OE2026, mas **eu não tive acesso ao texto oficial da lei nesta sessão** para confirmar cada valor um a um — em particular os limites de deduções à coleta (saúde, educação, PPR, habitação, dependentes) e o mínimo de existência, marcados `confirmado: false`. O ficheiro está estruturado precisamente para que só precise de editar esse bloco quando confirmar os valores — o motor de cálculo não vai buscar números a mais lado nenhum.
2. **Parsing de PDF é best-effort, não testado contra talões reais.**
   Os parsers (`parsers/parser-talao.js`, `parser-recibo-verde.js`) usam regex genéricas baseadas no formato descrito no prompt (códigos `\d{3}-\d{3}`). Nunca testei contra um talão real — é muito provável que precisem de ajuste assim que carregar o primeiro documento verdadeiro. É por isso que o ecrã de confirmação editável está sempre no caminho, mesmo quando o parsing "correu bem".
3. **Critério de aceitação da secção 12 ainda por correr.**
   Só há um teste sintético (`tests/test-engine.mjs`, não faz parte do app) que confirma que o motor corre sem exceções e produz números plausíveis. Falta o teste real: introduzir os 12 meses de um ano fiscal já fechado seu e comparar com a Demonstração de Liquidação oficial desse ano, linha a linha.
4. **Simplificações assumidas no v1** (documentadas em comentários no código, para não ficarem escondidas):
   - PPR usa sempre o teto mais alto (idade <35) — falta diferenciar por escalão etário.
   - Dedução por dependente usa uma estimativa de valor por posição — falta confirmar os valores exatos do art.º 78º-A.
   - Coeficiente do regime simplificado B assume "serviços em geral" (0,75) por omissão — se a atividade for outra (ex.: alojamento local), tem de ser passado explicitamente.

## Fora do v1 (por desenho, ver secção 11 do prompt)

Parsing universal por IA, monetização/paywall, notificações, navegação multi-ano — a arquitetura já está pensada para não exigir refactor grande quando estas entrarem.

## Estrutura

```
antecipa/
├── index.html, manifest.json, sw.js, style.css, app.js
├── data/          — legislacao-2026.js, i18n.js
├── engine/        — calculo-irs.js, projecao.js, quociente.js
├── parsers/       — parser-talao.js, parser-recibo-verde.js, pdf-text.js
├── storage/       — db.js (IndexedDB)
├── export/        — pdf-export.js
├── ui/            — onboarding.js, ventanas-mensais.js, ventana-13.js, ventana-14.js, components/
├── icons/         — ícones PWA 72–512px + fonte SVG
└── tests/         — test-engine.mjs (sanity check, não faz parte do app)
```
