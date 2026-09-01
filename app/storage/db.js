// storage/db.js
// Wrapper fino sobre IndexedDB — cobre exatamente o modelo de dados da
// secção 4 do prompt de build. Sem dependências externas. Tudo local-first:
// nada daqui é enviado para nenhum servidor.

const DB_NAME = "antecipa";
const DB_VERSION = 2;

const STORES = {
  household: { keyPath: "id" },
  pessoas: { keyPath: "id" },
  dependentes: { keyPath: "id", autoIncrement: true },
  documentos: { keyPath: "id", autoIncrement: true, indexes: [["mes_ano_pessoa", ["mes", "anoFiscal", "pessoaId"]]] },
  rubricas: { keyPath: "id", autoIncrement: true, indexes: [["documentoId", "documentoId"]] },
  ajusteManual: { keyPath: "id", autoIncrement: true, indexes: [["mes_ano_pessoa", ["mes", "anoFiscal", "pessoaId"]]] },
  deducoesColeta: { keyPath: "id" }, // id = `${anoFiscal}:${pessoaId||'household'}`
  declaracao: { keyPath: "id", autoIncrement: true },
  simulacaoAnual: { keyPath: "declaracaoId" },
  // Correções que o utilizador ensinou à app para uma entidade empregadora
  // específica (identificada pelo NIF), quando a leitura automática de um
  // talão sai errada — ver ui/components/confirmacao.js. Aplicadas antes do
  // ecrã de confirmação em uploads seguintes da mesma entidade.
  modelosEntidade: { keyPath: "nif" },
};

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, {
          keyPath: cfg.keyPath,
          autoIncrement: !!cfg.autoIncrement,
        });
        for (const [idxName, idxKey] of cfg.indexes ?? []) {
          store.createIndex(idxName, idxKey);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const result = fn(store);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async put(storeName, value) {
    return tx(storeName, "readwrite", (store) => reqToPromise(store.put(value)));
  },
  async get(storeName, key) {
    let result;
    await tx(storeName, "readonly", (store) => {
      result = reqToPromise(store.get(key));
    });
    return result;
  },
  async getAll(storeName) {
    let result;
    await tx(storeName, "readonly", (store) => {
      result = reqToPromise(store.getAll());
    });
    return result;
  },
  async getAllByIndex(storeName, indexName, query) {
    let result;
    await tx(storeName, "readonly", (store) => {
      result = reqToPromise(store.index(indexName).getAll(query));
    });
    return result;
  },
  async delete(storeName, key) {
    return tx(storeName, "readwrite", (store) => reqToPromise(store.delete(key)));
  },
  async clear(storeName) {
    return tx(storeName, "readwrite", (store) => reqToPromise(store.clear()));
  },
};

// --- Helpers de domínio, por cima do wrapper genérico acima -----------------

export async function getHousehold() {
  return db.get("household", "singleton");
}

export async function saveHousehold(partial) {
  const atual = (await getHousehold()) ?? { id: "singleton" };
  const novo = { ...atual, ...partial, id: "singleton" };
  await db.put("household", novo);
  return novo;
}

export async function getPessoas() {
  return db.getAll("pessoas");
}

export async function savePessoa(pessoa) {
  await db.put("pessoas", pessoa);
  return pessoa;
}

export async function getDependentes() {
  return db.getAll("dependentes");
}

export async function saveDependente(dependente) {
  const id = await db.put("dependentes", dependente);
  return { ...dependente, id };
}

export async function getDocumentosDoMes(mes, anoFiscal, pessoaId) {
  const todos = await db.getAllByIndex("documentos", "mes_ano_pessoa", [mes, anoFiscal, pessoaId]);
  return todos;
}

export async function saveDocumento(documento) {
  const id = await db.put("documentos", documento);
  return { ...documento, id };
}

export async function getRubricasDoDocumento(documentoId) {
  return db.getAllByIndex("rubricas", "documentoId", documentoId);
}

export async function saveRubricas(documentoId, rubricas) {
  const salvas = [];
  for (const r of rubricas) {
    const id = await db.put("rubricas", { ...r, documentoId });
    salvas.push({ ...r, documentoId, id });
  }
  return salvas;
}

export async function getTodasRubricas(anoFiscal) {
  const documentos = (await db.getAll("documentos")).filter((d) => d.anoFiscal === anoFiscal);
  const porDocumento = await Promise.all(documentos.map((d) => getRubricasDoDocumento(d.id)));
  return { documentos, rubricas: porDocumento.flat() };
}

export async function getAjustesManuais(anoFiscal) {
  return (await db.getAll("ajusteManual")).filter((a) => a.anoFiscal === anoFiscal);
}

export async function saveAjusteManual(ajuste) {
  const id = await db.put("ajusteManual", ajuste);
  return { ...ajuste, id };
}

export async function removeAjusteManual(id) {
  return db.delete("ajusteManual", id);
}

export async function getDeducoesColeta(anoFiscal, pessoaId = "household") {
  return (await db.get("deducoesColeta", `${anoFiscal}:${pessoaId}`)) ?? {
    id: `${anoFiscal}:${pessoaId}`,
    anoFiscal,
    pessoaId,
    saude: 0,
    educacao: 0,
    ppr: 0,
    habitacao: 0,
    exigenciaFatura: 0,
    despesasGerais: 0,
    duplaTributacao: 0,
  };
}

export async function saveDeducoesColeta(anoFiscal, pessoaId, valores) {
  const id = `${anoFiscal}:${pessoaId}`;
  await db.put("deducoesColeta", { id, anoFiscal, pessoaId, ...valores });
}

// --- Correções aprendidas por entidade empregadora (talões) -----------------
//
// Quando o utilizador corrige, no ecrã de confirmação, a descrição, o tipo
// ou a categoria de uma rubrica identificada por código (ex.: "211-001"),
// pode pedir à app para se lembrar dessa correção para a mesma entidade
// (NIF do empregador). Da próxima vez que um talão dessa entidade for
// carregado, a correção é aplicada automaticamente antes da confirmação —
// e pode sempre ser corrigida de novo se algo mudar.

export async function getModeloEntidade(nif) {
  if (!nif) return null;
  return db.get("modelosEntidade", nif);
}

export async function guardarCorrecoesEntidade(nif, novasCorrecoes) {
  if (!nif || !Object.keys(novasCorrecoes).length) return null;
  const atual = (await getModeloEntidade(nif)) ?? { nif, correcoes: {} };
  const modelo = {
    nif,
    correcoes: { ...atual.correcoes, ...novasCorrecoes },
    atualizadoEm: new Date().toISOString(),
  };
  await db.put("modelosEntidade", modelo);
  return modelo;
}

export async function cacheSimulacaoAnual(declaracaoId, simulacao) {
  await db.put("simulacaoAnual", { declaracaoId, ...simulacao, calculadoEm: new Date().toISOString() });
}

export async function getSimulacaoAnual(declaracaoId) {
  return db.get("simulacaoAnual", declaracaoId);
}
