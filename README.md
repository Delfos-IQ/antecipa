# Antecipa

> "O seu IRS, um ano antes da hora."

PWA local-first (vanilla HTML/CSS/JS, ES modules) que simula o IRS português mês a mês, replicando a fórmula oficial da Autoridade Tributária, para antecipar se vai pagar ou receber antes da campanha de entrega.

## Como correr localmente

Não há build step. Basta servir a pasta raiz com qualquer servidor estático (não abrir os `index.html` diretamente com `file://`, porque os módulos ES e o service worker exigem `http(s)://`):

```bash
cd antecipa
python3 -m http.server 8080
# landing:  http://localhost:8080/
# app:      http://localhost:8080/app/
```

Publicado em produção via GitHub Pages, a partir da raiz do repositório: https://delfos-iq.github.io/antecipa/ (landing) e https://delfos-iq.github.io/antecipa/app/ (a app em si).

## O que está feito

- **Motor de cálculo** (`engine/calculo-irs.js`) — replica a cadeia oficial 1→11 da Demonstração de Liquidação: rendimento global, deduções específicas, rendimento coletável, quociente familiar, importância apurada, taxa adicional de solidariedade, coleta total, deduções à coleta, coleta líquida, retenções acumuladas, resultado. **Auditado linha a linha contra uma Demonstração de Liquidação de IRS real** (declaração entregue e liquidada pela AT), não só contra testes sintéticos — reconcilia ao cêntimo.
- **Categoria A (trabalho dependente) e Categoria B (recibos verdes, regime simplificado)** — coeficiente do regime simplificado escolhido por pessoa consoante a atividade declarada em Perfil (ex.: "serviços em geral" a 0,35 vs. atividades da tabela do art.º 151º, como enfermagem ou medicina, a 0,75), com o mínimo garantido de 15% sempre aplicado.
- **`compararRegimes()`** — compara automaticamente declaração conjunta vs. separada para um casal e mostra qual compensa mais, com o desglose completo de cada uma lado a lado (deduções partilhadas do agregado divididas corretamente, nunca duplicadas).
- **Simulação retrospetiva de anos fiscais anteriores já fechados**, além do ano corrente — não só "o que vou pagar este ano", também "quanto deveria ter pago no ano passado".
- **Dedução específica de Categoria A** (art.º 25º CIRS) — SS e ADSE somadas quando excedem o valor fixo (8,54×IAS), quotização sindical majorada a 100% até 1% do bruto, e quotização a uma ordem profissional (campo manual em Perfil, ex.: Ordem dos Enfermeiros) a elevar o teto até 9×IAS quando aplicável.
- **Deduções à coleta** modeladas linha a linha: dependentes, ascendentes a cargo, deficiência (sujeito passivo e dependentes), PPR, despesas gerais/saúde/educação/habitação, exigência de fatura, trabalho doméstico, donativos, dupla tributação internacional, mais-valias.
- **Sistema de projeção** (`engine/projecao.js`) — Real vs. Projetado por componente (nunca um multiplicador global), com cada componente (vencimento bruto, subsídios de férias/Natal, IRS/SS/sindicato/ADSE) editável mês a mês, e ajustes manuais que são descartados automaticamente quando chega um documento real.
- **Modelo de dados completo em IndexedDB** (`storage/db.js`) — household, pessoas, dependentes, documentos, rubricas, ajusteManual, deducoesColeta, declaracao, simulacaoAnual — tudo local ao dispositivo, sem servidor.
- **Onboarding**, **ventanas mensais 1–12** (acordeão, separação por pessoa em tabs/mega-cartões conforme o ecrã), **Ventana 13 (acumulado)** e **Ventana 14 (simulação)** com desglose linha a linha, referência legal ao lado de cada linha, e modo comparação.
- **Parsers de talão e recibo verde** por regex sobre texto extraído via pdf.js, testados contra talões reais (hospital público, regime CIT), com **ecrã de confirmação editável obrigatório** antes de gravar qualquer rubrica.
- **Exportação em PDF** (jsPDF) — versão pessoal e versão técnica para contabilista, com marca de água e mapeamento à numeração oficial.
- **Histórico de versões** visível em Perfil — cada deploy regista um resumo de uma linha do que mudou.
- **PWA**: manifest.json, ícones 72–512px a partir do símbolo de marca, service worker **network-first** (tenta sempre a rede antes do cache, para nunca deixar alguém preso numa versão antiga — crítico numa app de cálculo fiscal).
- **Landing pública** (`index.html` na raiz) — apresentação de marca separada da app instalável, com o mesmo sistema de tokens. Ver `BRAND.md` para a identidade completa.
- Identidade visual: paleta navy/azul, Inter como única tipografia, símbolo do documento fiscal sobre uma calculadora — ver `BRAND.md`.

## O que precisa da sua atenção antes de usar a sério

1. **Alguns valores da tabela fiscal ainda não confirmados linha a linha contra o Diário da República.**
   `app/data/legislacao-2026.js` documenta, em `fonte` de cada bloco, de onde veio cada valor e se está `confirmado: true`/`false`. A maioria dos valores centrais (escalões, dedução específica de Categoria A, quociente familiar, coeficientes de Categoria B) já foi confirmada por reconciliação direta contra uma Demonstração de Liquidação real; alguns valores mais periféricos (certos limites de deduções à coleta) continuam a aguardar essa confirmação.
2. **Parsing de PDF é best-effort.**
   Os parsers (`app/parsers/parser-talao.js`, `parser-recibo-verde.js`) usam regex sobre o texto extraído — já testados contra talões reais de um formato (hospital público português), mas outras entidades empregadoras podem ter formatos de talão diferentes que exijam ajuste. É por isso que o ecrã de confirmação editável está sempre no caminho, mesmo quando o parsing "correu bem".
3. **Simplificações conhecidas** (documentadas em comentários no código, para não ficarem escondidas):
   - Categoria E/G (rendimentos de capitais, mais-valias) não tem parser/importação automática — o utilizador introduz o total manualmente.
   - Dupla tributação internacional é um valor manual, sem cálculo automático do crédito limitado pela AT.
   - Regime fiscal claramente mais favorável (35%, jurisdições na lista negra) não é distinguido do regime normal de mais-valias (28%) — baixa materialidade, mas simplificação real.
   - IRS Jovem (art.º 12º-B CIRS) ainda não implementado.

## Fora do âmbito atual

Parsing universal por IA, monetização/paywall, notificações, IRS Jovem — a arquitetura já está pensada para não exigir refactor grande quando estas entrarem.

## Estrutura

```
antecipa/
├── index.html, landing.css          — landing pública (raiz do site)
├── icons/                            — ícones PWA + favicons, partilhados por landing e app
├── assets/mark.png, mark-badge.png     — logotipo (arte fornecida pelo Dani)
├── BRAND.md                          — identidade de marca (paleta, tipografia, voz, uso do símbolo)
└── app/                               — a PWA instalável
    ├── index.html, manifest.json, sw.js, style.css, app.js
    ├── data/          — legislacao-2026.js, i18n.js
    ├── engine/        — calculo-irs.js, projecao.js, quociente.js
    ├── parsers/       — parser-talao.js, parser-recibo-verde.js, pdf-text.js
    ├── storage/       — db.js (IndexedDB)
    ├── export/        — pdf-export.js
    ├── ui/            — onboarding.js, ventanas-mensais.js, ventana-13.js, ventana-14.js, components/
    └── tests/         — test-engine.mjs (sanity check, não faz parte do app)
```
