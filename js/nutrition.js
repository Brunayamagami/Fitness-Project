/* nutrition.js — calculo de metas.
 * BMR (metabolismo basal) por Mifflin-St Jeor; TDEE por nivel de atividade;
 * deficit calorico conforme o ritmo desejado de perda de peso.
 * Referencia: 1 kg de gordura corporal ~ 7700 kcal. */

const ATIVIDADE_FATOR = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  intenso: 1.725,
  muito: 1.9,
};

export const ATIVIDADE_LABEL = {
  sedentario: 'Sedentária (pouco ou nenhum exercício)',
  leve: 'Leve (exercício 1–3x/semana)',
  moderado: 'Moderada (exercício 3–5x/semana)',
  intenso: 'Intensa (exercício 6–7x/semana)',
  muito: 'Muito intensa (trabalho físico / atleta)',
};

export function bmr({ sexo, peso_kg, altura_cm, idade }) {
  const base = 10 * peso_kg + 6.25 * altura_cm - 5 * idade;
  return sexo === 'masculino' ? base + 5 : base - 161;
}

export function tdee(profile) {
  const fator = ATIVIDADE_FATOR[profile.atividade] || 1.375;
  return bmr(profile) * fator;
}

/* Meta de kcal considerando o ritmo (kg/semana). Com pisos de seguranca. */
export function calcGoals(profile) {
  const manutencao = tdee(profile);
  const deficitDia = (Math.max(0, profile.ritmo) * 7700) / 7; // kcal/dia
  let alvo = manutencao - deficitDia;

  // Pisos de seguranca para nao ficar baixo demais.
  const pisoSexo = profile.sexo === 'masculino' ? 1500 : 1200;
  const piso = Math.max(pisoSexo, bmr(profile) * 0.9);
  if (alvo < piso) alvo = piso;

  const kcal = Math.round(alvo / 10) * 10;

  // Macros: proteina alta para preservar musculo, gordura ~27%, resto carbo.
  const prot = Math.round(1.8 * profile.peso_kg);          // g
  const gord = Math.round((kcal * 0.27) / 9);              // g
  const kcalProt = prot * 4, kcalGord = gord * 9;
  const carb = Math.max(0, Math.round((kcal - kcalProt - kcalGord) / 4));

  const agua_ml = Math.round((35 * profile.peso_kg) / 10) * 10;

  return { kcal, prot, carb, gord, agua_ml, manutencao: Math.round(manutencao) };
}

/* Previsao simples de tempo ate a meta de peso, no ritmo atual. */
export function previsao(profile) {
  const dif = profile.peso_kg - profile.peso_meta_kg;
  if (dif <= 0 || profile.ritmo <= 0) return null;
  const semanas = Math.ceil(dif / profile.ritmo);
  const data = new Date();
  data.setDate(data.getDate() + semanas * 7);
  return { semanas, kg: +dif.toFixed(1), data };
}

export function imc(profile) {
  const m = profile.altura_cm / 100;
  const v = profile.peso_kg / (m * m);
  let faixa = 'normal';
  if (v < 18.5) faixa = 'abaixo';
  else if (v < 25) faixa = 'normal';
  else if (v < 30) faixa = 'sobrepeso';
  else faixa = 'obesidade';
  return { valor: +v.toFixed(1), faixa };
}
