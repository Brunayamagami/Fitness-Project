/* store.js — estado do app, salvo no proprio celular (localStorage).
 * Nada sai do aparelho. Backup por exportar/importar JSON. */

const KEY = 'leve.state.v1';

const DEFAULTS = () => ({
  version: 1,
  onboarded: false,
  profile: {
    nome: '',
    sexo: 'feminino',        // feminino | masculino
    idade: 30,
    altura_cm: 165,
    peso_kg: 70,
    peso_inicial_kg: 70,
    peso_meta_kg: 63,
    atividade: 'leve',       // sedentario | leve | moderado | intenso | muito
    ritmo: 0.5,              // kg por semana a perder
  },
  prefs: {
    estilo: 'onivoro',       // onivoro | vegetariano | vegano
    evita: [],               // ex: ['lactose','gluten','carne_vermelha','frutos_mar','acucar']
    refeicoes: ['cafe', 'almoco', 'lanche', 'janta'], // habilitadas
  },
  goals: { kcal: 1500, prot: 100, carb: 150, gord: 50, agua_ml: 2450 },
  diary: {},                 // { 'YYYY-MM-DD': { meals:{cafe:[item...]}, agua_ml:0 } }
  weights: [],               // [{ data:'YYYY-MM-DD', kg:70 }]
  favorites: [],             // [foodId]
  customFoods: [],           // [{ id:'c123', nome, kcal, prot, carb, gord, por_g:100 }]
  savedMeals: [],            // [{ id, nome, itens:[item...] }]
  game: { xp: 0, streak: 0, best: 0, lastLog: null, achievements: [] },
  reminders: { enabled: false, horarios: { cafe: '08:00', almoco: '12:30', janta: '19:30', agua: '' }, askedPerm: false },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    return migrate({ ...DEFAULTS(), ...parsed });
  } catch (e) {
    console.warn('Falha ao ler estado, comecando limpo.', e);
    return DEFAULTS();
  }
}

function migrate(s) {
  // Espaco para futuras migracoes de versao. Por ora garante campos.
  s.profile = { ...DEFAULTS().profile, ...s.profile };
  s.prefs = { ...DEFAULTS().prefs, ...s.prefs };
  s.goals = { ...DEFAULTS().goals, ...s.goals };
  s.game = { ...DEFAULTS().game, ...s.game };
  s.reminders = { ...DEFAULTS().reminders, ...s.reminders };
  return s;
}

let saveTimer = null;
export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.error('Nao consegui salvar (armazenamento cheio?)', e); }
  }, 120);
}
export function persistNow() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) { console.error(e); return false; }
}

export const get = () => state;
export function update(fn) { fn(state); persist(); }

/* ---------- Datas ---------- */
export function todayKey(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function dayEntry(key = todayKey()) {
  if (!state.diary[key]) state.diary[key] = { meals: {}, agua_ml: 0 };
  return state.diary[key];
}

/* ---------- Backup ---------- */
export function exportData() {
  return JSON.stringify({ app: 'Leve', exportadoEm: new Date().toISOString(), state }, null, 2);
}
export function importData(text) {
  const obj = JSON.parse(text);
  const incoming = obj.state || obj; // aceita export completo ou state cru
  if (!incoming || typeof incoming !== 'object' || !incoming.profile) {
    throw new Error('Arquivo de backup invalido.');
  }
  state = migrate({ ...DEFAULTS(), ...incoming });
  persistNow();
  return true;
}
export function wipe() {
  state = DEFAULTS();
  persistNow();
}
