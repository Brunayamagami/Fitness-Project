/* gamify.js — XP, niveis, streak (sequencia de dias) e conquistas. */
import { get, update, todayKey, dayEntry } from './store.js';

/* Nivel a partir do XP: cada nivel exige um pouco mais que o anterior. */
export function levelInfo(xp) {
  let level = 1, need = 100, acc = 0;
  while (xp >= acc + need) { acc += need; level++; need = Math.round(need * 1.35); }
  const noNivel = xp - acc;
  return { level, xpNoNivel: noNivel, xpParaSubir: need, progresso: noNivel / need };
}

export const NIVEL_TITULOS = [
  'Semente', 'Broto', 'Muda', 'Plantinha', 'Árvore jovem',
  'Árvore firme', 'Copa cheia', 'Floresta', 'Guardiã da mata', 'Lenda verde',
];
export function tituloNivel(level) {
  return NIVEL_TITULOS[Math.min(level - 1, NIVEL_TITULOS.length - 1)] || 'Lenda verde';
}

/* Adiciona XP e devolve se subiu de nivel. */
export function addXp(pontos) {
  const before = levelInfo(get().game.xp).level;
  update((s) => { s.game.xp += pontos; });
  const after = levelInfo(get().game.xp).level;
  return { subiu: after > before, level: after };
}

/* Atualiza streak ao registrar algo hoje. Devolve estado do streak. */
export function tocarStreak() {
  const hoje = todayKey();
  const g = get().game;
  if (g.lastLog === hoje) return { streak: g.streak, novo: false };

  const ontem = todayKey(new Date(Date.now() - 86400000));
  let streak = g.streak;
  if (g.lastLog === ontem) streak += 1;      // manteve a sequencia
  else streak = 1;                            // recomecou

  update((s) => {
    s.game.streak = streak;
    s.game.lastLog = hoje;
    if (streak > s.game.best) s.game.best = streak;
  });
  return { streak, novo: true };
}

/* Se hoje ainda nao teve registro e o ultimo foi antes de ontem, zera visual. */
export function streakAtual() {
  const g = get().game;
  const hoje = todayKey();
  const ontem = todayKey(new Date(Date.now() - 86400000));
  if (g.lastLog === hoje || g.lastLog === ontem) return g.streak;
  return 0;
}

/* ---------- Conquistas ---------- */
export const ACHIEVEMENTS = [
  { id: 'primeiro',   em: '🌱', nome: 'Primeiro passo', ds: 'Registrou a 1ª refeição' },
  { id: 'streak3',    em: '🔥', nome: 'Pegando o ritmo', ds: '3 dias seguidos' },
  { id: 'streak7',    em: '⚡', nome: 'Uma semana!', ds: '7 dias seguidos' },
  { id: 'streak30',   em: '👑', nome: 'Um mês de foco', ds: '30 dias seguidos' },
  { id: 'agua',       em: '💧', nome: 'Hidratada', ds: 'Bateu a meta de água num dia' },
  { id: 'pesagem',    em: '⚖️', nome: 'De olho no peso', ds: 'Registrou o peso' },
  { id: 'meta_dia',   em: '🎯', nome: 'No alvo', ds: 'Ficou dentro da meta de calorias' },
  { id: 'meta5',      em: '🏅', nome: 'Consistente', ds: '5 dias dentro da meta' },
  { id: 'nivel5',     em: '🌳', nome: 'Crescendo', ds: 'Chegou ao nível 5' },
  { id: 'menos1',     em: '📉', nome: 'Primeiro quilo', ds: 'Perdeu 1 kg desde o início' },
  { id: 'prato_meu',  em: '🍲', nome: 'Chef de casa', ds: 'Salvou um prato seu' },
  { id: 'meta_peso',  em: '🏆', nome: 'Missão cumprida', ds: 'Alcançou o peso-meta' },
];

/* Concede conquista se ainda nao tiver. Devolve a conquista concedida ou null. */
export function conceder(id) {
  const g = get().game;
  if (g.achievements.includes(id)) return null;
  update((s) => s.game.achievements.push(id));
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

export function tem(id) { return get().game.achievements.includes(id); }

/* Avalia conquistas que dependem de estado agregado. Devolve lista concedida agora. */
export function avaliarConquistas() {
  const s = get();
  const novas = [];
  const g = (id) => { const a = conceder(id); if (a) novas.push(a); };

  // streaks
  if (s.game.streak >= 3) g('streak3');
  if (s.game.streak >= 7) g('streak7');
  if (s.game.streak >= 30) g('streak30');
  // nivel
  if (levelInfo(s.game.xp).level >= 5) g('nivel5');
  // agua hoje
  const d = s.diary[todayKey()];
  if (d && s.goals.agua_ml && d.agua_ml >= s.goals.agua_ml) g('agua');
  // meta de calorias em dias (conta dias dentro de +-tolerancia)
  const diasNaMeta = Object.values(s.diary).filter((day) => {
    const tot = totalKcalDia(day);
    return tot > 0 && tot <= s.goals.kcal * 1.05;
  }).length;
  if (diasNaMeta >= 1) g('meta_dia');
  if (diasNaMeta >= 5) g('meta5');
  // peso
  if (s.weights.length) g('pesagem');
  if (s.weights.length >= 1 && (s.profile.peso_inicial_kg - s.profile.peso_kg) >= 1) g('menos1');
  if (s.profile.peso_kg <= s.profile.peso_meta_kg) g('meta_peso');
  if (s.savedMeals.length) g('prato_meu');

  return novas;
}

export function totalKcalDia(day) {
  if (!day || !day.meals) return 0;
  let t = 0;
  for (const arr of Object.values(day.meals)) for (const it of arr) t += it.kcal || 0;
  return t;
}
