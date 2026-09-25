/* foods.js — base de alimentos TACO + alimentos personalizados + busca. */
import { get } from './store.js';

let DB = [];        // alimentos TACO
let META = {};
let ready = null;

// remove acentos e baixa caixa para busca tolerante
const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// palavras que sinalizam restricoes (heuristica para AVISOS, nao filtro rigido)
const FLAGS = {
  lactose: ['leite', 'queijo', 'iogurte', 'requeijao', 'manteiga', 'creme de leite', 'nata', 'coalhada', 'doce de leite', 'achocolatado'],
  gluten: ['trigo', 'pao', 'macarrao', 'biscoito', 'bolo', 'farinha de trigo', 'cevada', 'centeio', 'aveia', 'cuscuz', 'lasanha', 'pizza'],
  carne_vermelha: ['carne', 'bovina', 'boi', 'suina', 'porco', 'bacon', 'linguica', 'cordeiro', 'vitela'],
  frutos_mar: ['camarao', 'peixe', 'atum', 'sardinha', 'lula', 'polvo', 'marisco', 'ostra', 'caranguejo', 'pescada', 'merluza', 'salmao', 'bacalhau'],
  ovo: ['ovo'],
  acucar: ['acucar', 'doce', 'chocolate', 'bala', 'refrigerante', 'sorvete', 'brigadeiro', 'goiabada'],
};

// para estilo vegetariano/vegano
const ANIMAL = [...FLAGS.carne_vermelha, ...FLAGS.frutos_mar, 'frango', 'ave', 'peru', 'presunto', 'mortadela', 'salsicha', 'gelatina'];
const ANIMAL_DERIV = [...FLAGS.lactose, ...FLAGS.ovo, 'mel'];

export function loadFoods() {
  if (ready) return ready;
  ready = fetch('data/foods.json')
    .then((r) => r.json())
    .then((j) => { DB = j.alimentos || []; META = { fonte: j.fonte, unidade: j.unidade }; return DB; });
  return ready;
}

export const foodsMeta = () => META;

export function allFoods() {
  // TACO + personalizados normalizados para o mesmo formato
  const custom = get().customFoods.map((c) => ({
    id: c.id, nome: c.nome, grupo: 'Meus alimentos',
    kcal: c.kcal, prot: c.prot, carb: c.carb, gord: c.gord, fibra: c.fibra || 0, sodio: c.sodio || 0,
    custom: true,
  }));
  return [...custom, ...DB];
}

/* Marca avisos de restricao para um alimento, conforme preferencias do usuario. */
export function restricoesDe(nome) {
  const { prefs } = get();
  const n = norm(nome);
  const avisos = [];
  const hit = (arr) => arr.some((w) => n.includes(norm(w)));

  if (prefs.estilo === 'vegano' && (hit(ANIMAL) || hit(ANIMAL_DERIV))) avisos.push('nao-vegano');
  else if (prefs.estilo === 'vegetariano' && hit(ANIMAL)) avisos.push('nao-vegetariano');

  for (const r of prefs.evita || []) {
    if (FLAGS[r] && hit(FLAGS[r])) avisos.push(r);
  }
  return avisos;
}

/* Busca por texto. Personalizados e favoritos primeiro; alimentos que batem
 * com restricoes vao para o fim (mas continuam visiveis, com aviso). */
export function search(query, { limit = 40 } = {}) {
  const q = norm(query).trim();
  const favs = new Set(get().favorites);
  let items = allFoods();

  let scored = items.map((f) => {
    const n = norm(f.nome);
    let score = 0;
    if (q) {
      if (n === q) score = 100;
      else if (n.startsWith(q)) score = 80;
      else if (n.includes(' ' + q)) score = 60;
      else if (n.includes(q)) score = 40;
      else {
        // todas as palavras da busca presentes?
        const parts = q.split(/\s+/).filter(Boolean);
        if (parts.length > 1 && parts.every((p) => n.includes(p))) score = 30;
        else return null;
      }
    } else {
      score = 10;
    }
    if (f.custom) score += 25;
    if (favs.has(f.id)) score += 15;
    const avisos = restricoesDe(f.nome);
    if (avisos.length) score -= 20;
    return { food: f, score, avisos, fav: favs.has(f.id) };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score || a.food.nome.localeCompare(b.food.nome));
  return scored.slice(0, limit);
}

export function byId(id) {
  return allFoods().find((f) => String(f.id) === String(id)) || null;
}

/* Calcula nutrientes para uma quantidade em gramas (base é por 100 g). */
export function forGrams(food, gramas) {
  const k = gramas / 100;
  return {
    kcal: Math.round(food.kcal * k),
    prot: +(food.prot * k).toFixed(1),
    carb: +(food.carb * k).toFixed(1),
    gord: +(food.gord * k).toFixed(1),
    fibra: +((food.fibra || 0) * k).toFixed(1),
    sodio: Math.round((food.sodio || 0) * k),
  };
}
