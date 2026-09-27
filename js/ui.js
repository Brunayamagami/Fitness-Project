/* ui.js — renderizacao de todas as telas e interacoes. */
import * as store from './store.js';
import { get, update, todayKey, dayEntry } from './store.js';
import { calcGoals, previsao, imc, tdee, ATIVIDADE_LABEL } from './nutrition.js';
import * as foods from './foods.js';
import * as game from './gamify.js';
import * as reminders from './reminders.js';
import * as barcode from './barcode.js';
import * as recipes from './recipes.js';

const app = document.getElementById('app');
const tabbar = document.getElementById('tabbar');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const toastEl = document.getElementById('toast');

let current = 'hoje';
let viewDate = todayKey();

/* ---------- Helpers ---------- */
const h = (strings, ...v) => strings.map((s, i) => s + (v[i] ?? '')).join('');
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function n0(x) { return Math.round(x).toLocaleString('pt-BR'); }
function n1(x) { return (Math.round(x * 10) / 10).toLocaleString('pt-BR'); }

let scannerStop = null; // funcao para encerrar a camera, se ativa

let toastTimer;
export function toast(msg, kind = '') {
  toastEl.className = 'toast' + (kind ? ' ' + kind : '');
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

export function openSheet(html) {
  modalContent.innerHTML = `<div class="modal-handle"></div>` + html;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
export function closeSheet() {
  if (scannerStop) { try { scannerStop(); } catch {} scannerStop = null; }
  modal.hidden = true;
  modalContent.innerHTML = '';
  document.body.style.overflow = '';
}
modal.addEventListener('click', (e) => { if (e.target.dataset.close !== undefined) closeSheet(); });

function ringSVG(pct, label, sub, color) {
  const size = 168, sw = 14, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, pct)));
  const col = color || (pct > 1.05 ? 'var(--red)' : 'var(--green)');
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg class="ring" width="${size}" height="${size}">
      <circle class="ring-bg" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke-width="${sw}"/>
      <circle class="ring-fg" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke-width="${sw}"
        stroke="${col}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
    </svg>
    <div class="ring-center"><div class="big">${label}</div><div class="sub">${sub}</div></div>
  </div>`;
}

/* ---------- Navegacao ---------- */
export function go(view) {
  current = view;
  if (view === 'add') { abrirBusca(); current = 'hoje'; return highlightTab('hoje'); }
  render();
  highlightTab(view);
  window.scrollTo(0, 0);
}
function highlightTab(view) {
  tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
}
export function initTabbar() {
  tabbar.hidden = false;
  tabbar.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.view)));
}

function render() {
  if (current === 'hoje') return renderHoje();
  if (current === 'receitas') return renderReceitas();
  if (current === 'progresso') return renderProgresso();
  if (current === 'conquistas') return renderConquistas();
  if (current === 'ajustes') return renderAjustes();
}

/* ==================== HOJE ==================== */
const MEAL_LABELS = { cafe: '☕ Café da manhã', almoco: '🍛 Almoço', lanche: '🍎 Lanche', janta: '🌙 Jantar', ceia: '🌛 Ceia' };

function renderHoje() {
  const s = get();
  const day = dayEntry(viewDate);
  const totals = somaDia(day);
  const goals = s.goals;
  const pct = totals.kcal / goals.kcal;
  const restante = goals.kcal - totals.kcal;
  const streak = game.streakAtual();
  const lvl = game.levelInfo(s.game.xp);

  const isToday = viewDate === todayKey();
  const dataLabel = isToday ? 'Hoje' : new Date(viewDate + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });

  const mealsHtml = (s.prefs.refeicoes || ['cafe','almoco','janta']).map((m) => {
    const itens = (day.meals[m] || []);
    const kc = itens.reduce((a, i) => a + (i.kcal || 0), 0);
    const linhas = itens.map((it, idx) => `
      <div class="food-item">
        <div class="info">
          <div class="nm">${esc(it.nome)}</div>
          <div class="mt">${n0(it.qtd_g)} g · P ${n1(it.prot)}  C ${n1(it.carb)}  G ${n1(it.gord)}</div>
        </div>
        <div class="kc">${n0(it.kcal)}</div>
        <button class="icon-btn" data-del="${m}:${idx}" aria-label="Remover">✕</button>
      </div>`).join('');
    return `<div class="meal-group">
      <div class="meal-head">
        <span class="ttl">${MEAL_LABELS[m] || m}</span>
        <span class="kc">${kc ? n0(kc) + ' kcal' : ''}</span>
      </div>
      ${linhas || '<div class="muted small" style="padding:2px 4px 8px">Nada registrado ainda.</div>'}
      <button class="btn secondary small" data-addmeal="${m}">＋ Adicionar</button>
    </div>`;
  }).join('');

  const aguaPct = goals.agua_ml ? day.agua_ml / goals.agua_ml : 0;

  app.innerHTML = `
    <div class="row spread" style="margin-bottom:8px">
      <div>
        <div class="muted small">${isToday ? 'Seu dia' : 'Vendo'}</div>
        <h1 style="text-transform:capitalize">${dataLabel}</h1>
      </div>
      <div class="row" style="gap:6px">
        <button class="icon-btn" data-nav="prev" aria-label="Dia anterior">‹</button>
        ${isToday ? '' : '<button class="icon-btn" data-nav="today" aria-label="Hoje">•</button>'}
        <button class="icon-btn" data-nav="next" aria-label="Proximo dia" ${isToday ? 'disabled' : ''}>›</button>
      </div>
    </div>

    <div class="card">
      <div class="row spread" style="align-items:center">
        <div class="hero">
          <span class="flame">${streak > 0 ? '🔥' : '🌱'}</span>
          <div>
            <div style="font-weight:800;font-size:1.1rem">${streak} ${streak === 1 ? 'dia' : 'dias'}</div>
            <div class="muted small">sequência${s.game.best > streak ? ' · recorde ' + s.game.best : ''}</div>
          </div>
        </div>
        <div class="center">
          <div class="badge green">Nível ${lvl.level} · ${game.tituloNivel(lvl.level)}</div>
          <div class="level-bar" style="width:110px"><span style="width:${Math.round(lvl.progresso*100)}%"></span></div>
          <div class="muted small" style="margin-top:2px">${lvl.xpNoNivel}/${lvl.xpParaSubir} XP</div>
        </div>
      </div>
    </div>

    <div class="card center">
      ${ringSVG(pct, n0(Math.max(0, restante)), restante >= 0 ? 'kcal restantes' : 'kcal acima')}
      <div class="row spread small muted" style="margin-top:6px">
        <span>Consumido ${n0(totals.kcal)}</span>
        <span>Meta ${n0(goals.kcal)}</span>
      </div>
      <div class="macros">
        ${macroBox('Proteína', totals.prot, goals.prot, 'p')}
        ${macroBox('Carbo', totals.carb, goals.carb, 'c')}
        ${macroBox('Gordura', totals.gord, goals.gord, 'g')}
      </div>
    </div>

    <div class="card tight">
      <div class="row spread">
        <div><strong>💧 Água</strong> <span class="muted small">${n0(day.agua_ml)} / ${n0(goals.agua_ml)} ml</span></div>
        <div class="row" style="gap:6px">
          <button class="chip" data-agua="-250">−250</button>
          <button class="chip on" data-agua="250">+250 ml</button>
        </div>
      </div>
      <div class="bar" style="margin-top:8px"><span style="width:${Math.min(100, aguaPct*100)}%"></span></div>
    </div>

    <h2 style="margin:18px 2px 8px">Refeições</h2>
    ${mealsHtml}
  `;

  // eventos
  app.querySelectorAll('[data-addmeal]').forEach((b) => b.onclick = () => abrirBusca(b.dataset.addmeal));
  app.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { removerItem(b.dataset.del); });
  app.querySelectorAll('[data-agua]').forEach((b) => b.onclick = () => addAgua(+b.dataset.agua));
  app.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => navDia(b.dataset.nav));
}

function macroBox(label, val, meta, cls) {
  const pct = meta ? Math.min(100, (val / meta) * 100) : 0;
  return `<div class="macro">
    <div class="v">${n0(val)}<span class="muted" style="font-weight:500;font-size:.7rem">/${n0(meta)}g</span></div>
    <div class="l">${label}</div>
    <div class="bar ${cls}"><span style="width:${pct}%"></span></div>
  </div>`;
}

function somaDia(day) {
  const t = { kcal: 0, prot: 0, carb: 0, gord: 0 };
  for (const arr of Object.values(day.meals || {})) for (const it of arr) {
    t.kcal += it.kcal || 0; t.prot += it.prot || 0; t.carb += it.carb || 0; t.gord += it.gord || 0;
  }
  return t;
}

function navDia(dir) {
  if (dir === 'today') { viewDate = todayKey(); return renderHoje(); }
  const d = new Date(viewDate + 'T12:00');
  d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
  const k = store.todayKey(d);
  if (k > todayKey()) return; // nao ir pro futuro
  viewDate = k;
  renderHoje();
}

function addAgua(ml) {
  update((s) => {
    const d = dayEntry(viewDate);
    d.agua_ml = Math.max(0, (d.agua_ml || 0) + ml);
  });
  const novas = game.avaliarConquistas();
  renderHoje();
  novas.forEach(anunciarConquista);
}

function removerItem(ref) {
  const [meal, idxStr] = ref.split(':');
  const idx = +idxStr;
  update((s) => {
    const d = dayEntry(viewDate);
    if (d.meals[meal]) d.meals[meal].splice(idx, 1);
  });
  renderHoje();
  toast('Item removido');
}

/* ==================== BUSCA / ADICIONAR ==================== */
let buscaMeal = 'almoco';

function abrirBusca(meal) {
  const s = get();
  buscaMeal = meal || (s.prefs.refeicoes && s.prefs.refeicoes[0]) || 'almoco';
  const mealOpts = (s.prefs.refeicoes || ['cafe','almoco','janta']).map((m) =>
    `<button data-m="${m}" class="${m === buscaMeal ? 'on' : ''}">${(MEAL_LABELS[m]||m).replace(/^\S+\s/, '')}</button>`).join('');

  openSheet(`
    <h2>Adicionar alimento</h2>
    <div class="seg" style="margin-bottom:12px" id="mealSeg">${mealOpts}</div>
    <input id="q" type="search" placeholder="Buscar (ex: arroz, feijão, banana)" autocomplete="off" />
    <button class="btn secondary" id="scanBtn" style="margin:12px 0 6px">📷 Escanear código de barras</button>
    <div class="row wrap" style="margin:6px 0">
      <button class="chip" id="tabTaco">Alimentos (TACO)</button>
      <button class="chip" id="tabFav">⭐ Favoritos</button>
      <button class="chip" id="tabMeus">🍲 Meus pratos</button>
      <button class="chip" id="novoAlim">＋ Criar alimento</button>
    </div>
    <div id="resultados" style="max-height:52vh;overflow-y:auto;margin-top:6px"></div>
  `);

  const q = document.getElementById('q');
  const res = document.getElementById('resultados');
  let aba = 'taco';

  const pintar = () => {
    if (aba === 'fav') return listar(foods.search('', { limit: 200 }).filter((x) => x.fav), res);
    if (aba === 'meus') return listarPratos(res);
    listar(foods.search(q.value, { limit: 40 }), res);
  };

  q.oninput = () => { aba = 'taco'; pintar(); };
  document.getElementById('mealSeg').querySelectorAll('button').forEach((b) => b.onclick = () => {
    buscaMeal = b.dataset.m;
    document.getElementById('mealSeg').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  });
  document.getElementById('tabTaco').onclick = () => { aba = 'taco'; pintar(); };
  document.getElementById('tabFav').onclick = () => { aba = 'fav'; pintar(); };
  document.getElementById('tabMeus').onclick = () => { aba = 'meus'; pintar(); };
  document.getElementById('novoAlim').onclick = () => criarAlimento();
  document.getElementById('scanBtn').onclick = () => abrirScanner();
  pintar();
  setTimeout(() => q.focus(), 100);
}

/* ---------- Scanner de codigo de barras ---------- */
function abrirScanner() {
  openSheet(`
    <h2>📷 Escanear código de barras</h2>
    <p class="muted small">Aponte a câmera para o código de barras do produto. Consultamos a base aberta Open Food Facts (envia só o número do código, precisa de internet na 1ª vez).</p>
    <div style="position:relative;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:4/3;margin-bottom:12px">
      <video id="scanVid" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
      <div style="position:absolute;inset:18% 12%;border:3px solid rgba(255,255,255,.9);border-radius:12px;box-shadow:0 0 0 100vmax rgba(0,0,0,.25)"></div>
    </div>
    <div id="scanStatus" class="note center">Iniciando câmera…</div>
    <hr class="hr"/>
    <label>Ou digite o número do código</label>
    <div class="row" style="gap:10px">
      <input id="scanManual" type="number" inputmode="numeric" placeholder="Ex: 7891000100103" class="grow"/>
      <button class="btn small" id="scanBuscar" style="width:auto">Buscar</button>
    </div>
  `);

  const status = () => document.getElementById('scanStatus');
  const vid = document.getElementById('scanVid');

  const processar = async (code) => {
    if (!code) return;
    if (status()) status().textContent = `Buscando ${code}…`;
    const res = await barcode.lookup(code);
    if (res.food) {
      if (!res.cached) barcode.salvarProduto(res.food);
      escolherQtd(res.food.id); // fecha a camera (closeSheet) e abre a quantidade
    } else if (res.notFound) {
      toast('Produto não encontrado na base');
      criarAlimento({ nome: '', barcode: code });
    } else {
      if (status()) status().innerHTML = '⚠️ Sem internet para consultar agora. Tente de novo com conexão, ou digite o alimento manualmente.';
    }
  };

  document.getElementById('scanBuscar').onclick = () => processar(document.getElementById('scanManual').value.trim());

  if (!barcode.suportaCamera()) {
    if (status()) status().textContent = 'Câmera indisponível neste navegador. Você pode digitar o número do código abaixo.';
    return;
  }
  barcode.iniciarScanner(vid, (code) => processar(code))
    .then((stop) => { scannerStop = stop; if (status()) status().textContent = 'Procurando código…'; })
    .catch(() => { if (status()) status().textContent = 'Não consegui acessar a câmera. Verifique a permissão ou digite o código manualmente.'; });
}

const AVISO_LABEL = { 'nao-vegano': 'não vegano', 'nao-vegetariano': 'não vegetariano', lactose: 'lactose', gluten: 'glúten', carne_vermelha: 'carne vermelha', frutos_mar: 'frutos do mar', ovo: 'ovo', acucar: 'açúcar' };

function listar(items, container) {
  if (!items.length) { container.innerHTML = '<div class="empty"><span class="em">🔍</span>Nada encontrado. Tente outro termo ou crie um alimento.</div>'; return; }
  container.innerHTML = items.map((x) => {
    const f = x.food;
    const avisos = (x.avisos || []).map((a) => `<span class="badge" style="color:var(--amber)">⚠ ${AVISO_LABEL[a] || a}</span>`).join(' ');
    return `<div class="search-result" data-id="${f.id}">
      <div style="min-width:0">
        <div class="nm">${x.fav ? '⭐ ' : ''}${esc(f.nome)}</div>
        <div class="mt">${n0(f.kcal)} kcal / 100g · ${esc(f.grupo)} ${avisos}</div>
      </div>
      <button class="icon-btn">＋</button>
    </div>`;
  }).join('');
  container.querySelectorAll('.search-result').forEach((el) => el.onclick = () => escolherQtd(el.dataset.id));
}

function listarPratos(container) {
  const pratos = get().savedMeals;
  if (!pratos.length) { container.innerHTML = '<div class="empty"><span class="em">🍲</span>Você ainda não salvou pratos. Monte uma refeição e toque em “Salvar como prato”.</div>'; return; }
  container.innerHTML = pratos.map((p) => {
    const kc = p.itens.reduce((a, i) => a + i.kcal, 0);
    return `<div class="search-result" data-prato="${p.id}">
      <div><div class="nm">🍲 ${esc(p.nome)}</div><div class="mt">${p.itens.length} itens · ${n0(kc)} kcal</div></div>
      <button class="icon-btn">＋</button>
    </div>`;
  }).join('');
  container.querySelectorAll('[data-prato]').forEach((el) => el.onclick = () => {
    const p = get().savedMeals.find((x) => x.id === el.dataset.prato);
    if (!p) return;
    update((s) => {
      const d = dayEntry(viewDate);
      if (!d.meals[buscaMeal]) d.meals[buscaMeal] = [];
      p.itens.forEach((it) => d.meals[buscaMeal].push({ ...it }));
    });
    aoRegistrar('Prato adicionado! 🍲');
  });
}

function escolherQtd(id) {
  const f = foods.byId(id);
  if (!f) return;
  const isFav = get().favorites.includes(f.id);
  openSheet(`
    <h2>${esc(f.nome)}</h2>
    <p class="muted small">${n0(f.kcal)} kcal, P ${n1(f.prot)} · C ${n1(f.carb)} · G ${n1(f.gord)} por 100 g</p>
    <div class="field">
      <label>Quantidade (gramas)</label>
      <input id="g" type="number" inputmode="numeric" value="100" min="1" max="3000" />
      <div class="row wrap" style="margin-top:10px">
        ${[50,100,150,200].map((v) => `<button class="chip" data-q="${v}">${v} g</button>`).join('')}
        <button class="chip" data-q="30">1 col. sopa (30g)</button>
        <button class="chip" data-q="120">1 unid. média (120g)</button>
      </div>
    </div>
    <div class="card tight" id="previa"></div>
    <div class="row" style="gap:10px;margin-top:14px">
      <button class="btn secondary" id="favBtn" style="flex:0 0 auto">${isFav ? '⭐' : '☆'}</button>
      <button class="btn" id="add">Adicionar</button>
    </div>
  `);
  const g = document.getElementById('g');
  const previa = document.getElementById('previa');
  const atualizar = () => {
    const gr = Math.max(0, +g.value || 0);
    const nut = foods.forGrams(f, gr);
    previa.innerHTML = `<div class="row spread"><strong>${n0(nut.kcal)} kcal</strong>
      <span class="muted small">P ${n1(nut.prot)} · C ${n1(nut.carb)} · G ${n1(nut.gord)}</span></div>`;
  };
  g.oninput = atualizar; atualizar();
  document.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { g.value = b.dataset.q; atualizar(); });
  document.getElementById('favBtn').onclick = (e) => {
    update((s) => {
      const i = s.favorites.indexOf(f.id);
      if (i >= 0) s.favorites.splice(i, 1); else s.favorites.push(f.id);
    });
    e.currentTarget.textContent = get().favorites.includes(f.id) ? '⭐' : '☆';
  };
  document.getElementById('add').onclick = () => {
    const gr = Math.max(1, +g.value || 100);
    const nut = foods.forGrams(f, gr);
    update((s) => {
      const d = dayEntry(viewDate);
      if (!d.meals[buscaMeal]) d.meals[buscaMeal] = [];
      d.meals[buscaMeal].push({ foodId: f.id, nome: f.nome, qtd_g: gr, ...nut });
    });
    aoRegistrar(`+${n0(nut.kcal)} kcal registrados! 🌱`);
  };
}

function criarAlimento(prefill = {}) {
  openSheet(`
    <h2>Criar alimento</h2>
    <p class="muted small">Valores por 100 g (ou por porção — o que preferir).${prefill.barcode ? ' Código: ' + esc(prefill.barcode) : ''}</p>
    <div class="field"><label>Nome</label><input id="cn" value="${esc(prefill.nome || '')}" placeholder="Ex: Tapioca com queijo"/></div>
    <div class="grid2">
      <div class="field"><label>Calorias (kcal)</label><input id="ck" type="number" inputmode="numeric"/></div>
      <div class="field"><label>Proteína (g)</label><input id="cp" type="number" inputmode="decimal"/></div>
      <div class="field"><label>Carboidrato (g)</label><input id="cc" type="number" inputmode="decimal"/></div>
      <div class="field"><label>Gordura (g)</label><input id="cg" type="number" inputmode="decimal"/></div>
    </div>
    <button class="btn" id="salvarAlim">Salvar alimento</button>
  `);
  document.getElementById('salvarAlim').onclick = () => {
    const nome = document.getElementById('cn').value.trim();
    if (!nome) { toast('Dê um nome ao alimento'); return; }
    const item = {
      id: prefill.barcode ? 'b' + prefill.barcode : 'c' + Date.now(), nome,
      kcal: +document.getElementById('ck').value || 0,
      prot: +document.getElementById('cp').value || 0,
      carb: +document.getElementById('cc').value || 0,
      gord: +document.getElementById('cg').value || 0,
      por_g: 100,
    };
    if (prefill.barcode) item.barcode = prefill.barcode;
    update((s) => s.customFoods.push(item));
    toast('Alimento criado! 🍲');
    escolherQtd(item.id);
  };
}

function aoRegistrar(msg) {
  // XP + streak + conquistas
  const st = game.tocarStreak();
  const up = game.addXp(10);
  const novas = game.avaliarConquistas();
  closeSheet();
  current = 'hoje';
  highlightTab('hoje');
  renderHoje();
  toast(msg, 'xp');
  if (up.subiu) setTimeout(() => anunciarNivel(up.level), 700);
  novas.forEach((a, i) => setTimeout(() => anunciarConquista(a), 900 + i * 400));
}

/* ==================== PROGRESSO ==================== */
function renderProgresso() {
  const s = get();
  const w = [...s.weights].sort((a, b) => a.data.localeCompare(b.data));
  const atual = s.profile.peso_kg;
  const inicial = s.profile.peso_inicial_kg;
  const meta = s.profile.peso_meta_kg;
  const perdido = +(inicial - atual).toFixed(1);
  const faltam = +(atual - meta).toFixed(1);
  const prev = previsao(s.profile);
  const imcInfo = imc(s.profile);

  // media de calorias dos ultimos 7 dias
  const ult7 = [];
  for (let i = 0; i < 7; i++) {
    const k = todayKey(new Date(Date.now() - i * 86400000));
    const d = s.diary[k];
    if (d) { const t = game.totalKcalDia(d); if (t > 0) ult7.push(t); }
  }
  const media7 = ult7.length ? Math.round(ult7.reduce((a, b) => a + b, 0) / ult7.length) : null;

  app.innerHTML = `
    <h1>Progresso</h1>
    <div class="card">
      <div class="row spread">
        <div class="center grow"><div class="muted small">Inicial</div><div style="font-weight:800;font-size:1.2rem">${n1(inicial)}</div></div>
        <div class="center grow"><div class="muted small">Atual</div><div style="font-weight:800;font-size:1.6rem;color:var(--green)">${n1(atual)}</div></div>
        <div class="center grow"><div class="muted small">Meta</div><div style="font-weight:800;font-size:1.2rem">${n1(meta)}</div></div>
      </div>
      <div class="bar" style="height:10px;margin-top:12px">
        <span style="width:${pctPeso(inicial, atual, meta)}%"></span>
      </div>
      <div class="row spread small muted" style="margin-top:8px">
        <span>${perdido > 0 ? '🎉 −' + n1(perdido) + ' kg' : perdido < 0 ? '+' + n1(-perdido) + ' kg' : 'Começando'}</span>
        <span>${faltam > 0 ? 'faltam ' + n1(faltam) + ' kg' : '🏆 meta batida!'}</span>
      </div>
      <button class="btn" id="registrarPeso" style="margin-top:14px">⚖️ Registrar peso de hoje</button>
    </div>

    <div class="card">
      <h2>Evolução do peso</h2>
      ${w.length >= 2 ? sparkline(w) : '<div class="empty small"><span class="em">📈</span>Registre seu peso alguns dias para ver o gráfico.</div>'}
    </div>

    <div class="grid2">
      <div class="card tight center"><div class="muted small">IMC</div><div style="font-weight:800;font-size:1.3rem">${n1(imcInfo.valor)}</div><div class="badge">${imcInfo.faixa}</div></div>
      <div class="card tight center"><div class="muted small">Média 7 dias</div><div style="font-weight:800;font-size:1.3rem">${media7 ? n0(media7) : '—'}</div><div class="badge">kcal/dia</div></div>
    </div>

    ${prev ? `<div class="note">📅 No ritmo de ${n1(s.profile.ritmo)} kg/semana, você chega em <strong>${n1(meta)} kg</strong> por volta de <strong>${prev.data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong> (~${prev.semanas} semanas). É uma estimativa — o corpo tem seu ritmo.</div>` : ''}

    ${w.length ? `<h2 style="margin:18px 2px 8px">Histórico</h2><div class="card tight">${
      [...w].reverse().slice(0, 20).map((x) => `<div class="weight-row"><span>${new Date(x.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span><strong>${n1(x.kg)} kg</strong></div>`).join('')
    }</div>` : ''}
  `;
  document.getElementById('registrarPeso').onclick = () => modalPeso();
}

function pctPeso(ini, atual, meta) {
  const total = ini - meta;
  if (total <= 0) return atual <= meta ? 100 : 0;
  return Math.min(100, Math.max(0, ((ini - atual) / total) * 100));
}

function sparkline(w) {
  const pts = w.slice(-30);
  const kgs = pts.map((p) => p.kg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const range = (max - min) || 1;
  const W = 320, H = 120, pad = 10;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, pts.length - 1);
  const y = (v) => pad + (1 - (v - min) / range) * (H - 2 * pad);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area = d + ` L${x(pts.length-1).toFixed(1)},${H-pad} L${x(0).toFixed(1)},${H-pad} Z`;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <path d="${area}" fill="rgba(22,163,74,.12)"/>
    <path d="${d}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2.5" fill="var(--green)"/>`).join('')}
  </svg>
  <div class="row spread small muted"><span>${n1(min)} kg</span><span>${n1(max)} kg</span></div>`;
}

function modalPeso() {
  const s = get();
  openSheet(`
    <h2>Registrar peso</h2>
    <div class="field"><label>Peso hoje (kg)</label>
      <input id="pw" type="number" inputmode="decimal" step="0.1" value="${s.profile.peso_kg}" /></div>
    <button class="btn" id="salvarPeso">Salvar</button>
  `);
  document.getElementById('salvarPeso').onclick = () => {
    const kg = +document.getElementById('pw').value;
    if (!kg || kg < 20 || kg > 400) { toast('Peso inválido'); return; }
    update((s) => {
      const hoje = todayKey();
      const ex = s.weights.find((x) => x.data === hoje);
      if (ex) ex.kg = kg; else s.weights.push({ data: hoje, kg });
      s.profile.peso_kg = kg;
      // recalcula metas com o novo peso
      s.goals = { ...s.goals, ...calcGoals(s.profile) };
    });
    const novas = game.avaliarConquistas();
    closeSheet();
    toast('Peso registrado! ⚖️', 'xp');
    game.addXp(15);
    renderProgresso();
    novas.forEach((a, i) => setTimeout(() => anunciarConquista(a), 400 + i * 400));
  };
}

/* ==================== CONQUISTAS ==================== */
function renderConquistas() {
  const s = get();
  const lvl = game.levelInfo(s.game.xp);
  const got = new Set(s.game.achievements);
  app.innerHTML = `
    <h1>Conquistas</h1>
    <div class="card center">
      <div style="font-size:2.4rem">🌳</div>
      <div style="font-weight:800;font-size:1.2rem">Nível ${lvl.level} — ${game.tituloNivel(lvl.level)}</div>
      <div class="level-bar" style="margin:10px auto;max-width:220px"><span style="width:${Math.round(lvl.progresso*100)}%"></span></div>
      <div class="muted small">${s.game.xp} XP no total · faltam ${lvl.xpParaSubir - lvl.xpNoNivel} XP p/ o próximo nível</div>
      <div class="row spread" style="margin-top:14px">
        <div class="center grow"><div style="font-weight:800;font-size:1.3rem">${game.streakAtual()}🔥</div><div class="muted small">sequência</div></div>
        <div class="center grow"><div style="font-weight:800;font-size:1.3rem">${s.game.best}</div><div class="muted small">recorde</div></div>
        <div class="center grow"><div style="font-weight:800;font-size:1.3rem">${got.size}/${game.ACHIEVEMENTS.length}</div><div class="muted small">medalhas</div></div>
      </div>
    </div>
    <div class="ach-grid">
      ${game.ACHIEVEMENTS.map((a) => `<div class="ach ${got.has(a.id) ? 'on' : ''}">
        <div class="em">${a.em}</div><div class="nm">${a.nome}</div><div class="ds">${a.ds}</div>
      </div>`).join('')}
    </div>
  `;
}

/* ==================== RECEITAS ==================== */
let receitaCat = 'tudo';

function renderReceitas() {
  const lista = recipes.porCategoria(receitaCat);
  const chips = recipes.CATEGORIAS.map((c) =>
    `<button class="chip ${c.id === receitaCat ? 'on' : ''}" data-cat="${c.id}">${c.label}</button>`).join('');

  const cards = lista.map((r) => `
    <div class="card tight" data-rec="${r.id}" style="cursor:pointer">
      <div class="row spread">
        <div style="min-width:0">
          <div style="font-weight:700">${r.emoji} ${esc(r.nome)}</div>
          <div class="muted small">⏱ ${r.tempo} min · ${(r.tags||[]).map(esc).join(' · ')}</div>
        </div>
        <div class="center" style="flex:0 0 auto">
          <div style="font-weight:800">${n0(r.total.kcal)}</div>
          <div class="muted small">kcal</div>
        </div>
      </div>
      <div class="macros" style="margin-top:8px">
        <div class="macro"><div class="v">${n1(r.total.prot)}g</div><div class="l">Proteína</div></div>
        <div class="macro"><div class="v">${n1(r.total.carb)}g</div><div class="l">Carbo</div></div>
        <div class="macro"><div class="v">${n1(r.total.gord)}g</div><div class="l">Gordura</div></div>
      </div>
    </div>`).join('');

  const meus = get().savedMeals;
  const meusHtml = receitaCat === 'tudo' && meus.length ? `
    <h2 style="margin:18px 2px 8px">🍲 Minhas receitas</h2>
    ${meus.map((p) => {
      const kc = p.itens.reduce((a, i) => a + i.kcal, 0);
      return `<div class="card tight" data-prato="${p.id}" style="cursor:pointer">
        <div class="row spread"><div style="font-weight:700">🍲 ${esc(p.nome)}</div>
        <div class="center"><div style="font-weight:800">${n0(kc)}</div><div class="muted small">kcal</div></div></div>
        <div class="muted small">${p.itens.length} itens</div></div>`;
    }).join('')}` : '';

  app.innerHTML = `
    <div class="row spread" style="margin-bottom:8px">
      <h1>Receitas</h1>
    </div>
    <p class="muted small" style="margin-bottom:12px">Ajustadas às suas preferências — airfryer, seus alimentos e doces fit. Valores por porção; ajuste as gramas conforme sua fome. 💚</p>
    <div class="row wrap" id="recCats" style="margin-bottom:14px">${chips}</div>
    ${cards || '<div class="empty"><span class="em">🍳</span>Sem receitas nesta categoria.</div>'}
    ${meusHtml}
  `;

  app.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { receitaCat = b.dataset.cat; renderReceitas(); });
  app.querySelectorAll('[data-rec]').forEach((c) => c.onclick = () => abrirReceita(c.dataset.rec));
  app.querySelectorAll('[data-prato]').forEach((c) => c.onclick = () => abrirPratoSalvo(c.dataset.prato));
}

function abrirReceita(id) {
  const r = recipes.byId(id);
  if (!r) return;
  const ings = r.ingredientes.map((i) =>
    `<div class="row spread" style="padding:6px 2px;border-bottom:1px solid var(--line)">
      <span>${esc(i.nome)}</span>
      <span class="muted small">${n0(i.g)} g · ${n0(i.kcal)} kcal</span>
    </div>`).join('');
  const passos = r.passos.map((p, i) =>
    `<div class="row" style="gap:10px;align-items:flex-start;margin-bottom:8px">
      <span class="badge green" style="flex:0 0 auto">${i + 1}</span><span>${esc(p)}</span>
    </div>`).join('');

  openSheet(`
    <h2>${r.emoji} ${esc(r.nome)}</h2>
    <div class="card tight" style="margin-bottom:12px">
      <div class="row spread"><strong>${n0(r.total.kcal)} kcal</strong>
        <span class="muted small">P ${n1(r.total.prot)} · C ${n1(r.total.carb)} · G ${n1(r.total.gord)}</span></div>
      <div class="muted small">⏱ ${r.tempo} min · 1 porção</div>
    </div>
    <h3>Ingredientes</h3>
    <div style="margin-bottom:14px">${ings}</div>
    <h3>Modo de preparo</h3>
    <div style="margin-bottom:16px">${passos}</div>
    <label>Registrar em qual refeição?</label>
    <div class="seg" id="recMeal" style="margin:6px 0 14px">
      ${(get().prefs.refeicoes || ['almoco']).map((m, idx) =>
        `<button data-m="${m}" class="${idx === 0 ? 'on' : ''}">${(MEAL_LABELS[m]||m).replace(/^\S+\s/, '')}</button>`).join('')}
    </div>
    <div class="stack">
      <button class="btn" id="recRegistrar">Registrar no diário (+${n0(r.total.kcal)} kcal)</button>
      <button class="btn secondary" id="recSalvar">🍲 Salvar em “Minhas receitas”</button>
    </div>
  `);

  let meal = (get().prefs.refeicoes || ['almoco'])[0];
  document.getElementById('recMeal').querySelectorAll('button').forEach((b) => b.onclick = () => {
    meal = b.dataset.m;
    document.getElementById('recMeal').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  });

  document.getElementById('recRegistrar').onclick = () => {
    update((s) => {
      const d = dayEntry(viewDate);
      if (!d.meals[meal]) d.meals[meal] = [];
      d.meals[meal].push({ foodId: 'rec:' + r.id, nome: r.nome, qtd_g: r.ingredientes.reduce((a, i) => a + i.g, 0),
        kcal: r.total.kcal, prot: r.total.prot, carb: r.total.carb, gord: r.total.gord });
    });
    aoRegistrar(`Receita registrada! +${n0(r.total.kcal)} kcal 🍽️`);
  };
  document.getElementById('recSalvar').onclick = () => {
    update((s) => {
      if (!s.savedMeals.find((p) => p.id === 'rec:' + r.id)) {
        s.savedMeals.push({ id: 'rec:' + r.id, nome: r.nome, itens: [{ foodId: 'rec:' + r.id, nome: r.nome,
          qtd_g: r.ingredientes.reduce((a, i) => a + i.g, 0), kcal: r.total.kcal, prot: r.total.prot, carb: r.total.carb, gord: r.total.gord }] });
      }
    });
    toast('Salvo em Minhas receitas 🍲');
  };
}

function abrirPratoSalvo(id) {
  const p = get().savedMeals.find((x) => x.id === id);
  if (!p) return;
  const kc = p.itens.reduce((a, i) => a + i.kcal, 0);
  openSheet(`
    <h2>🍲 ${esc(p.nome)}</h2>
    <div class="card tight"><div class="row spread"><strong>${n0(kc)} kcal</strong><span class="muted small">${p.itens.length} itens</span></div></div>
    <label style="margin-top:12px">Registrar em qual refeição?</label>
    <div class="seg" id="pMeal" style="margin:6px 0 14px">
      ${(get().prefs.refeicoes || ['almoco']).map((m, idx) =>
        `<button data-m="${m}" class="${idx === 0 ? 'on' : ''}">${(MEAL_LABELS[m]||m).replace(/^\S+\s/, '')}</button>`).join('')}
    </div>
    <div class="stack">
      <button class="btn" id="pReg">Registrar no diário</button>
      <button class="btn danger" id="pDel">Remover das minhas receitas</button>
    </div>
  `);
  let meal = (get().prefs.refeicoes || ['almoco'])[0];
  document.getElementById('pMeal').querySelectorAll('button').forEach((b) => b.onclick = () => {
    meal = b.dataset.m;
    document.getElementById('pMeal').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  });
  document.getElementById('pReg').onclick = () => {
    update((s) => {
      const d = dayEntry(viewDate);
      if (!d.meals[meal]) d.meals[meal] = [];
      p.itens.forEach((it) => d.meals[meal].push({ ...it }));
    });
    aoRegistrar('Registrado! 🍲');
  };
  document.getElementById('pDel').onclick = () => {
    update((s) => { const i = s.savedMeals.findIndex((x) => x.id === id); if (i >= 0) s.savedMeals.splice(i, 1); });
    closeSheet(); renderReceitas(); toast('Removido');
  };
}

/* ==================== AJUSTES ==================== */
const EVITA_OPCOES = [
  ['lactose', '🥛 Lactose'], ['gluten', '🌾 Glúten'], ['carne_vermelha', '🥩 Carne vermelha'],
  ['frutos_mar', '🦐 Frutos do mar'], ['ovo', '🥚 Ovo'], ['acucar', '🍬 Açúcar'],
];
const REFEICOES_OPCOES = [['cafe','☕ Café'],['almoco','🍛 Almoço'],['lanche','🍎 Lanche'],['janta','🌙 Jantar'],['ceia','🌛 Ceia']];

function renderAjustes() {
  const s = get();
  const p = s.profile;
  app.innerHTML = `
    <h1>Ajustes</h1>

    <div class="card">
      <h2>Perfil</h2>
      <div class="field"><label>Nome</label><input id="an" value="${esc(p.nome)}" placeholder="Seu nome"/></div>
      <div class="grid2">
        <div class="field"><label>Sexo</label><select id="asex"><option value="feminino" ${p.sexo==='feminino'?'selected':''}>Feminino</option><option value="masculino" ${p.sexo==='masculino'?'selected':''}>Masculino</option></select></div>
        <div class="field"><label>Idade</label><input id="aage" type="number" value="${p.idade}"/></div>
        <div class="field"><label>Altura (cm)</label><input id="ah" type="number" value="${p.altura_cm}"/></div>
        <div class="field"><label>Peso atual (kg)</label><input id="apw" type="number" step="0.1" value="${p.peso_kg}"/></div>
        <div class="field"><label>Peso-meta (kg)</label><input id="apm" type="number" step="0.1" value="${p.peso_meta_kg}"/></div>
        <div class="field"><label>Ritmo (kg/semana)</label><select id="arit">
          <option value="0.25" ${p.ritmo==0.25?'selected':''}>Suave — 0,25</option>
          <option value="0.5" ${p.ritmo==0.5?'selected':''}>Padrão — 0,5</option>
          <option value="0.75" ${p.ritmo==0.75?'selected':''}>Acelerado — 0,75</option>
          <option value="1" ${p.ritmo==1?'selected':''}>Intenso — 1,0</option>
        </select></div>
      </div>
      <div class="field"><label>Nível de atividade</label><select id="aact">
        ${Object.entries(ATIVIDADE_LABEL).map(([k,v]) => `<option value="${k}" ${p.atividade===k?'selected':''}>${v}</option>`).join('')}
      </select></div>
      <button class="btn" id="salvarPerfil">Salvar e recalcular metas</button>
    </div>

    <div class="card">
      <h2>Preferências alimentares</h2>
      <label>Estilo</label>
      <div class="row wrap" id="estilo" style="margin-bottom:12px">
        ${['onivoro','vegetariano','vegano'].map((e) => `<button class="chip ${s.prefs.estilo===e?'on':''}" data-e="${e}">${e==='onivoro'?'🍽️ Onívoro':e==='vegetariano'?'🥗 Vegetariano':'🌱 Vegano'}</button>`).join('')}
      </div>
      <label>Evitar / avisar sobre</label>
      <div class="row wrap" id="evita" style="margin-bottom:12px">
        ${EVITA_OPCOES.map(([k,l]) => `<button class="chip warn ${s.prefs.evita.includes(k)?'on':''}" data-v="${k}">${l}</button>`).join('')}
      </div>
      <label>Refeições do dia</label>
      <div class="row wrap" id="refs">
        ${REFEICOES_OPCOES.map(([k,l]) => `<button class="chip ${s.prefs.refeicoes.includes(k)?'on':''}" data-r="${k}">${l}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Lembretes</h2>
      <p class="muted small">Notificações para não esquecer de registrar. Funcionam melhor com o app aberto ou recém-fechado; com o celular guardado por muito tempo alguns lembretes podem atrasar (limitação dos navegadores, sem servidor).</p>
      <label class="row spread" style="align-items:center">
        <span>Ativar lembretes</span>
        <button class="chip ${s.reminders.enabled?'on':''}" id="remToggle">${s.reminders.enabled?'Ativado':'Desativado'}</button>
      </label>
      <div id="remTimes" class="${s.reminders.enabled?'':'hidden'}" style="margin-top:12px">
        <div class="grid2">
          <div class="field"><label>☕ Café</label><input id="rcafe" type="time" value="${s.reminders.horarios.cafe||''}"/></div>
          <div class="field"><label>🍛 Almoço</label><input id="ralmoco" type="time" value="${s.reminders.horarios.almoco||''}"/></div>
          <div class="field"><label>🌙 Jantar</label><input id="rjanta" type="time" value="${s.reminders.horarios.janta||''}"/></div>
          <div class="field"><label>💧 Água</label><input id="ragua" type="time" value="${s.reminders.horarios.agua||''}"/></div>
        </div>
        <button class="btn secondary small" id="testarRem" style="width:auto">Testar notificação</button>
      </div>
    </div>

    <div class="card">
      <h2>Seus dados</h2>
      <p class="muted small">Tudo fica só no seu celular. Faça backup de vez em quando — se trocar de aparelho ou limpar o navegador, os dados vão embora sem backup.</p>
      <div class="stack">
        <button class="btn secondary" id="exportar">⬇️ Exportar backup (arquivo)</button>
        <button class="btn secondary" id="importar">⬆️ Importar backup</button>
        <input id="fileIn" type="file" accept="application/json" class="hidden"/>
        <button class="btn danger" id="resetar">🗑️ Apagar tudo e recomeçar</button>
      </div>
    </div>

    <div class="card">
      <h2>Sobre</h2>
      <p class="small muted">Dados de alimentos: <strong>Tabela TACO — 4ª edição (NEPA/UNICAMP)</strong>, 597 alimentos brasileiros. Valores por 100 g de porção comestível. Este app é pessoal, sem anúncios e sem assinatura. Não substitui orientação de nutricionista ou médico.</p>
    </div>
  `;
  wireAjustes();
}

function wireAjustes() {
  const s = get();
  document.getElementById('salvarPerfil').onclick = () => {
    update((st) => {
      const p = st.profile;
      p.nome = document.getElementById('an').value.trim();
      p.sexo = document.getElementById('asex').value;
      p.idade = +document.getElementById('aage').value || p.idade;
      p.altura_cm = +document.getElementById('ah').value || p.altura_cm;
      p.peso_kg = +document.getElementById('apw').value || p.peso_kg;
      p.peso_meta_kg = +document.getElementById('apm').value || p.peso_meta_kg;
      p.ritmo = +document.getElementById('arit').value;
      p.atividade = document.getElementById('aact').value;
      st.goals = { ...st.goals, ...calcGoals(p) };
    });
    toast('Metas atualizadas! 🎯');
    setTimeout(() => go('hoje'), 500);
  };

  document.querySelectorAll('#estilo [data-e]').forEach((b) => b.onclick = () => {
    update((st) => st.prefs.estilo = b.dataset.e); renderAjustes();
  });
  document.querySelectorAll('#evita [data-v]').forEach((b) => b.onclick = () => {
    update((st) => { const a = st.prefs.evita, k = b.dataset.v; const i = a.indexOf(k); i>=0?a.splice(i,1):a.push(k); });
    b.classList.toggle('on');
  });
  document.querySelectorAll('#refs [data-r]').forEach((b) => b.onclick = () => {
    update((st) => { const a = st.prefs.refeicoes, k = b.dataset.r; const i = a.indexOf(k); i>=0?(a.length>1&&a.splice(i,1)):a.push(k); });
    renderAjustes();
  });

  document.getElementById('remToggle').onclick = async () => {
    const on = !get().reminders.enabled;
    if (on) {
      const perm = await reminders.pedirPermissao();
      if (perm !== 'granted') { toast('Permissão de notificação negada'); return; }
    }
    update((st) => st.reminders.enabled = on);
    reminders.agendar();
    renderAjustes();
  };
  ['cafe','almoco','janta','agua'].forEach((k) => {
    const el = document.getElementById('r' + k);
    if (el) el.onchange = () => { update((st) => st.reminders.horarios[k] = el.value); reminders.agendar(); toast('Horário salvo'); };
  });
  const testar = document.getElementById('testarRem');
  if (testar) testar.onclick = () => { reminders.testar() ? toast('Notificação enviada 🔔') : toast('Ative os lembretes primeiro'); };

  document.getElementById('exportar').onclick = exportarBackup;
  document.getElementById('importar').onclick = () => document.getElementById('fileIn').click();
  document.getElementById('fileIn').onchange = (e) => importarBackup(e.target.files[0]);
  document.getElementById('resetar').onclick = confirmarReset;
}

function exportarBackup() {
  const blob = new Blob([store.exportData()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leve-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup baixado ⬇️');
}
function importarBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { store.importData(reader.result); toast('Backup restaurado! ✅'); setTimeout(() => go('hoje'), 500); }
    catch (e) { toast('Arquivo inválido'); }
  };
  reader.readAsText(file);
}
function confirmarReset() {
  openSheet(`
    <h2>Apagar tudo?</h2>
    <p class="muted">Isso remove todo o seu histórico, metas e conquistas deste aparelho. Não dá pra desfazer. Recomendo exportar um backup antes.</p>
    <div class="stack" style="margin-top:14px">
      <button class="btn secondary" data-close>Cancelar</button>
      <button class="btn danger" id="confReset">Sim, apagar tudo</button>
    </div>
  `);
  document.getElementById('confReset').onclick = () => { store.wipe(); location.reload(); };
}

/* ==================== Animacoes de recompensa ==================== */
function anunciarConquista(a) {
  if (!a) return;
  toast(`${a.em} Conquista: ${a.nome}!`, 'xp');
}
function anunciarNivel(level) {
  toast(`🎉 Subiu para o nível ${level} — ${game.tituloNivel(level)}!`, 'xp');
}

/* ==================== ONBOARDING ==================== */
export function mountOnboarding(onDone) {
  tabbar.hidden = true;
  const draft = { ...get().profile };
  const prefs = { ...get().prefs, evita: [...get().prefs.evita], refeicoes: [...get().prefs.refeicoes] };
  let step = 0;
  const steps = [boasVindas, dadosCorpo, objetivo, atividadeStep, preferencias, resumo];

  function paint() {
    app.innerHTML = `<div class="steps">${steps.map((_, i) => `<i class="${i<=step?'on':''}"></i>`).join('')}</div><div id="obc"></div>`;
    steps[step]();
  }
  const cont = document.getElementById ? null : null;

  function nav(html, onNext, nextLabel = 'Continuar', canBack = true) {
    document.getElementById('obc').innerHTML = html +
      `<div class="row" style="gap:10px;margin-top:18px">
        ${canBack && step>0 ? '<button class="btn secondary" id="obBack" style="flex:0 0 40%">Voltar</button>' : ''}
        <button class="btn" id="obNext">${nextLabel}</button>
      </div>`;
    const back = document.getElementById('obBack');
    if (back) back.onclick = () => { step--; paint(); };
    document.getElementById('obNext').onclick = onNext;
  }

  function boasVindas() {
    nav(`<div class="center">
      <img class="ob-logo" src="icons/icon-192.png" alt=""/>
      <h1>Bem-vinda ao Leve 🌱</h1>
      <p class="muted">Seu diário de calorias pessoal, com comida brasileira de verdade (tabela TACO). Sem anúncios, sem assinatura, e seus dados ficam só no seu celular.</p>
      <p class="muted small">Vou te fazer algumas perguntas rápidas pra montar sua meta. Leva 1 minutinho.</p>
    </div>`, () => { step++; paint(); }, 'Começar', false);
  }

  function dadosCorpo() {
    nav(`<h1>Sobre você</h1>
      <div class="field"><label>Como quer ser chamada?</label><input id="d_nome" value="${esc(draft.nome)}" placeholder="Seu nome"/></div>
      <div class="grid2">
        <div class="field"><label>Sexo biológico</label><select id="d_sex"><option value="feminino" ${draft.sexo==='feminino'?'selected':''}>Feminino</option><option value="masculino" ${draft.sexo==='masculino'?'selected':''}>Masculino</option></select></div>
        <div class="field"><label>Idade</label><input id="d_age" type="number" inputmode="numeric" value="${draft.idade}"/></div>
        <div class="field"><label>Altura (cm)</label><input id="d_h" type="number" inputmode="numeric" value="${draft.altura_cm}"/></div>
        <div class="field"><label>Peso atual (kg)</label><input id="d_w" type="number" inputmode="decimal" step="0.1" value="${draft.peso_kg}"/></div>
      </div>
      <p class="note">Usamos isso só pra calcular sua meta calórica (fórmula Mifflin-St Jeor). Fica tudo no seu aparelho.</p>`,
      () => {
        draft.nome = document.getElementById('d_nome').value.trim();
        draft.sexo = document.getElementById('d_sex').value;
        draft.idade = +document.getElementById('d_age').value || 30;
        draft.altura_cm = +document.getElementById('d_h').value || 165;
        draft.peso_kg = +document.getElementById('d_w').value || 70;
        draft.peso_inicial_kg = draft.peso_kg;
        step++; paint();
      });
  }

  function objetivo() {
    nav(`<h1>Sua meta de peso</h1>
      <div class="grid2">
        <div class="field"><label>Peso atual</label><input id="o_at" type="number" step="0.1" value="${draft.peso_kg}" disabled/></div>
        <div class="field"><label>Peso desejado (kg)</label><input id="o_meta" type="number" inputmode="decimal" step="0.1" value="${draft.peso_meta_kg}"/></div>
      </div>
      <label>Ritmo de emagrecimento</label>
      <div class="pick-grid" id="o_ritmo">
        ${[['0.25','🐢 Suave','~0,25 kg/semana — mais fácil de manter'],
           ['0.5','🚶 Padrão','~0,5 kg/semana — equilíbrio recomendado'],
           ['0.75','🏃 Acelerado','~0,75 kg/semana — exige mais disciplina'],
           ['1','⚡ Intenso','~1 kg/semana — só com acompanhamento']]
          .map(([v,t,d]) => `<button class="pick ${draft.ritmo==v?'on':''}" data-r="${v}"><div><div class="t">${t}</div><div class="d">${d}</div></div></button>`).join('')}
      </div>`,
      () => {
        draft.peso_meta_kg = +document.getElementById('o_meta').value || draft.peso_meta_kg;
        step++; paint();
      });
    document.querySelectorAll('#o_ritmo [data-r]').forEach((b) => b.onclick = () => {
      draft.ritmo = +b.dataset.r;
      document.querySelectorAll('#o_ritmo .pick').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
  }

  function atividadeStep() {
    nav(`<h1>Seu dia a dia</h1><p class="muted small">Quanto você se movimenta na semana?</p>
      <div class="pick-grid" id="a_pick">
        ${Object.entries(ATIVIDADE_LABEL).map(([k,v]) => `<button class="pick ${draft.atividade===k?'on':''}" data-a="${k}"><div><div class="t">${v.split(' (')[0]}</div><div class="d">${v.match(/\((.*)\)/)?.[1]||''}</div></div></button>`).join('')}
      </div>`,
      () => { step++; paint(); });
    document.querySelectorAll('#a_pick [data-a]').forEach((b) => b.onclick = () => {
      draft.atividade = b.dataset.a;
      document.querySelectorAll('#a_pick .pick').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    });
  }

  function preferencias() {
    nav(`<h1>Suas preferências</h1>
      <label>Estilo alimentar</label>
      <div class="row wrap" id="p_est" style="margin-bottom:14px">
        ${['onivoro','vegetariano','vegano'].map((e) => `<button class="chip ${prefs.estilo===e?'on':''}" data-e="${e}">${e==='onivoro'?'🍽️ Onívoro':e==='vegetariano'?'🥗 Vegetariano':'🌱 Vegano'}</button>`).join('')}
      </div>
      <label>Tem algo que você evita?</label>
      <div class="row wrap" id="p_evita" style="margin-bottom:14px">
        ${EVITA_OPCOES.map(([k,l]) => `<button class="chip warn ${prefs.evita.includes(k)?'on':''}" data-v="${k}">${l}</button>`).join('')}
      </div>
      <label>Refeições que você costuma fazer</label>
      <div class="row wrap" id="p_ref">
        ${REFEICOES_OPCOES.map(([k,l]) => `<button class="chip ${prefs.refeicoes.includes(k)?'on':''}" data-r="${k}">${l}</button>`).join('')}
      </div>`,
      () => { step++; paint(); });
    document.querySelectorAll('#p_est [data-e]').forEach((b) => b.onclick = () => {
      prefs.estilo = b.dataset.e; document.querySelectorAll('#p_est .chip').forEach((x)=>x.classList.remove('on')); b.classList.add('on');
    });
    document.querySelectorAll('#p_evita [data-v]').forEach((b) => b.onclick = () => {
      const i = prefs.evita.indexOf(b.dataset.v); i>=0?prefs.evita.splice(i,1):prefs.evita.push(b.dataset.v); b.classList.toggle('on');
    });
    document.querySelectorAll('#p_ref [data-r]').forEach((b) => b.onclick = () => {
      const i = prefs.refeicoes.indexOf(b.dataset.r); i>=0?(prefs.refeicoes.length>1&&prefs.refeicoes.splice(i,1)):prefs.refeicoes.push(b.dataset.r); b.classList.toggle('on');
    });
  }

  function resumo() {
    const goals = calcGoals(draft);
    const prev = previsao(draft);
    nav(`<div class="center"><h1>Tudo pronto! 🎉</h1><p class="muted">Sua meta diária, calculada pra você:</p></div>
      <div class="card center" style="margin-top:8px">
        ${ringSVG(0, n0(goals.kcal), 'kcal por dia')}
        <div class="macros">
          <div class="macro"><div class="v">${n0(goals.prot)}g</div><div class="l">Proteína</div></div>
          <div class="macro"><div class="v">${n0(goals.carb)}g</div><div class="l">Carbo</div></div>
          <div class="macro"><div class="v">${n0(goals.gord)}g</div><div class="l">Gordura</div></div>
        </div>
        <div class="note" style="margin-top:12px">💧 Meta de água: <strong>${n0(goals.agua_ml)} ml/dia</strong><br>Manutenção estimada: ${n0(goals.manutencao)} kcal/dia</div>
      </div>
      ${prev ? `<p class="muted small center">No ritmo escolhido, ~${prev.semanas} semanas até ${n1(draft.peso_meta_kg)} kg. Uma estimativa carinhosa, não uma promessa 💚</p>` : ''}
      <p class="small muted center">Você pode mudar tudo isso depois em Ajustes.</p>`,
      () => {
        update((st) => {
          st.profile = { ...st.profile, ...draft };
          st.prefs = { ...st.prefs, ...prefs };
          st.goals = goals;
          st.onboarded = true;
          if (!st.weights.length) st.weights.push({ data: todayKey(), kg: draft.peso_kg });
        });
        onDone();
      }, 'Começar minha jornada 🚀');
  }

  paint();
}
