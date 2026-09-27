/* recipes.js — carrega as receitas curadas (data/recipes.json). */
let LISTA = [];
let ready = null;

export function loadRecipes() {
  if (ready) return ready;
  ready = fetch('data/recipes.json')
    .then((r) => r.json())
    .then((j) => { LISTA = j.receitas || []; return LISTA; })
    .catch(() => { LISTA = []; return LISTA; });
  return ready;
}

export const all = () => LISTA;
export const byId = (id) => LISTA.find((r) => r.id === id) || null;
export function porCategoria(cat) {
  if (!cat || cat === 'tudo') return LISTA;
  return LISTA.filter((r) => r.cat === cat);
}

export const CATEGORIAS = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'refeicao', label: '🍽️ Refeições' },
  { id: 'lanche', label: '🍎 Lanches' },
  { id: 'doce', label: '🍫 Doces fit' },
];
