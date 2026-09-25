/* app.js — inicializacao. */
import { get } from './store.js';
import { loadFoods } from './foods.js';
import * as ui from './ui.js';
import { agendar as agendarLembretes } from './reminders.js';

async function boot() {
  // Registra o service worker (offline + notificacoes). Silencioso se falhar.
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* ok em http/local */ }
  }

  await loadFoods().catch(() => {
    document.getElementById('app').innerHTML =
      '<div class="card center"><h2>Ops</h2><p class="muted">Não consegui carregar a base de alimentos. Recarregue a página.</p></div>';
    throw new Error('foods');
  });

  if (!get().onboarded) {
    ui.mountOnboarding(() => start());
  } else {
    start();
  }
}

function start() {
  ui.initTabbar();
  ui.go('hoje');
  try { agendarLembretes(); } catch {}
  // Reagenda lembretes ao voltar pro app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { try { agendarLembretes(); } catch {} }
  });
}

boot();
