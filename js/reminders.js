/* reminders.js — lembretes locais via Notification API.
 * Limitacao honesta: navegadores so disparam com confiabilidade enquanto o app
 * esta aberto ou recem-fechado. Reagenda sempre que o app abre. Para lembrete
 * garantido com o app fechado seria preciso um servidor (Push) — fora do escopo
 * "100% local". Ainda assim ajuda bastante no uso diario. */
import { get } from './store.js';

let timers = [];

const MSGS = {
  cafe: ['☀️ Bom dia! Já registrou o café da manhã?', 'Hora do café — anota aí pra manter o foco 🌱'],
  almoco: ['🍽️ Hora do almoço! Bora registrar?', 'Almoço registrado = streak mantido 🔥'],
  janta: ['🌙 Não esquece de anotar a janta!', 'Fechando o dia — registra a janta 💪'],
  agua: ['💧 Bebeu água? Dá um gole e registra!', 'Hidratação em dia te deixa mais leve 💧'],
};

export function suportado() {
  return 'Notification' in window;
}
export function permissao() {
  return suportado() ? Notification.permission : 'denied';
}

export async function pedirPermissao() {
  if (!suportado()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); }
  catch { return Notification.permission; }
}

function disparar(tipo) {
  const [a, b] = MSGS[tipo] || ['⏰ Lembrete', ''];
  const body = Math.random() > 0.5 ? a : b;
  const opts = { body: '', icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: 'leve-' + tipo, renotify: true };
  const title = 'Leve';
  const texto = body;
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { ...opts, body: texto }))
      .catch(() => { try { new Notification(title, { ...opts, body: texto }); } catch {} });
  } else {
    try { new Notification(title, { ...opts, body: texto }); } catch {}
  }
}

export function limpar() {
  timers.forEach(clearTimeout);
  timers = [];
}

/* Agenda os lembretes de HOJE que ainda vao acontecer. */
export function agendar() {
  limpar();
  const r = get().reminders;
  if (!r.enabled || permissao() !== 'granted') return;

  const agora = new Date();
  for (const [tipo, hhmm] of Object.entries(r.horarios)) {
    if (!hhmm) continue;
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h)) continue;
    const quando = new Date();
    quando.setHours(h, m, 0, 0);
    const delta = quando - agora;
    if (delta > 0 && delta < 24 * 3600 * 1000) {
      timers.push(setTimeout(() => disparar(tipo), delta));
    }
  }
}

/* Notificacao de teste imediata. */
export function testar() {
  if (permissao() !== 'granted') return false;
  disparar('cafe');
  return true;
}
