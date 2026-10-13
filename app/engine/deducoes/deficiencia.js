// engine/deducoes/deficiencia.js
// Dedução por deficiência do(s) sujeito(s) passivo(s) e de dependentes
// (art.º 87º CIRS) — NOVO (04/09/2026).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos por categoria). Refatoração pura.

import { round2, sum } from "../numero.js";

// `pessoas` aqui é só quem está incluído NESTA declaração (1 pessoa em
// regime separada, 2 em conjunta) — quem decide isso é
// calcularDeducoesAColeta, que já recebe só as pessoas certas.
function somaDeficienciaSujeitosPassivos(pessoas, limites) {
  const config = limites.deficiencia;
  if (!config) return 0;
  return round2(
    sum(pessoas ?? [], (p) => {
      if (!p?.deficiencia) return 0;
      let valor = config.sujeitoPassivo;
      if (p.incapacidadeIgualOuSuperior90) valor += config.despesaAcompanhamentoIncapacidade90;
      return valor;
    })
  );
}

// Soma-se ao valor "normal" de dependentes (engine/deducoes/dependentes.js)
// — ver `confirmado: false` em legislacao-2026.js/deficiencia sobre esta
// acumulação não estar confirmada letra a letra. Aplica-se a mesma divisão
// por 2 em guarda partilhada que já se aplica ao valor normal, por
// consistência — não confirmado especificamente para esta dedução.
function valorDeficienciaDependente(dependente, limites) {
  if (!dependente?.deficiencia) return 0;
  const config = limites.deficiencia;
  if (!config) return 0;
  let valor = config.dependenteOuAscendente;
  if (dependente.incapacidadeIgualOuSuperior90) valor += config.despesaAcompanhamentoIncapacidade90;
  return dependente?.guarda === "partilhada" ? round2(valor / 2) : round2(valor);
}

export function calcularDeducaoDeficiencia({ pessoas = [], dependentes = [], limites }) {
  const deficienciaSujeitosPassivos = somaDeficienciaSujeitosPassivos(pessoas, limites);
  const deficienciaDependentes = round2(sum(dependentes, (d) => valorDeficienciaDependente(d, limites)));
  const total = round2(deficienciaSujeitosPassivos + deficienciaDependentes);
  return { total, referenciaLegal: "art.º 87º CIRS" };
}
