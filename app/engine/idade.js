// engine/idade.js
// Idade a 31 de dezembro do ano fiscal, a partir de uma data de nascimento
// ISO ("AAAA-MM-DD") — usada tanto para dependentes/ascendentes (escalões
// etários do art.º 78º-A CIRS) como para sujeitos passivos (teto do PPR por
// idade e elegibilidade do IRS Jovem, art.º 12º-B CIRS).
//
// Extraído de engine/calculo-irs.js (13/10/2026, split do motor em
// submódulos) para ser partilhado sem import circular entre o ficheiro
// principal (IRS Jovem) e engine/deducoes/dependentes.js. Refatoração pura.

export function idadeNoAno(dataNascimento, anoFiscal) {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;
  const referencia = new Date(`${anoFiscal}-12-31`);
  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAnos =
    referencia.getMonth() < nascimento.getMonth() ||
    (referencia.getMonth() === nascimento.getMonth() && referencia.getDate() < nascimento.getDate());
  if (aindaNaoFezAnos) idade -= 1;
  return idade;
}
