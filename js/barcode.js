/* barcode.js — leitor de codigo de barras + consulta Open Food Facts.
 * Detector: usa a API nativa BarcodeDetector quando existe (Android/Chrome);
 * senao carrega a ZXing (js/vendor/zxing.js) sob demanda (iPhone/Safari).
 * Consulta produtos na base aberta Open Food Facts. O produto encontrado e
 * salvo localmente (customFoods) para reuso e para funcionar offline depois. */
import { get, update } from './store.js';

const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
const r1 = (v) => Math.round(num(v) * 10) / 10;

const OFF_FIELDS = 'product_name,product_name_pt,generic_name,brands,nutriments';
const offUrl = (code) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`;

export function produtoSalvo(barcode) {
  return get().customFoods.find((c) => c.barcode === barcode) || null;
}

export function salvarProduto(food) {
  update((s) => { if (!s.customFoods.find((c) => c.id === food.id)) s.customFoods.push(food); });
}

/* Converte a resposta da Open Food Facts em um alimento no formato do app. */
export function parseOFF(product, barcode) {
  const nut = product.nutriments || {};
  const nomeBase = (product.product_name_pt || product.product_name || product.generic_name || '').trim();
  const marca = (product.brands || '').split(',')[0].trim();
  const nome = (nomeBase || ('Produto ' + barcode)) + (marca ? ` (${marca})` : '');

  let kcal = num(nut['energy-kcal_100g']);
  if (!kcal && nut['energy_100g']) kcal = num(nut['energy_100g']) / 4.184; // kJ -> kcal
  // sodio em mg: usa sodium (g) ou deriva do sal (g) / 2.5
  let sodio = num(nut['sodium_100g']) * 1000;
  if (!sodio && nut['salt_100g']) sodio = (num(nut['salt_100g']) / 2.5) * 1000;

  return {
    id: 'b' + barcode, barcode, custom: true,
    nome, grupo: 'Código de barras',
    kcal: Math.round(kcal),
    prot: r1(nut['proteins_100g']),
    carb: r1(nut['carbohydrates_100g']),
    gord: r1(nut['fat_100g']),
    fibra: r1(nut['fiber_100g']),
    sodio: Math.round(sodio),
    por_g: 100,
  };
}

/* Busca um codigo. Devolve {food} (achado/cache) ou {notFound:true} ou {erro}. */
export async function lookup(barcode, fetchImpl) {
  const f = fetchImpl || ((...a) => fetch(...a));
  const cache = produtoSalvo(barcode);
  if (cache) return { food: cache, cached: true };
  let j;
  try {
    const res = await f(offUrl(barcode), { headers: { Accept: 'application/json' } });
    j = await res.json();
  } catch (e) {
    return { erro: 'rede' };
  }
  if (!j || j.status === 0 || !j.product) return { notFound: true, barcode };
  return { food: parseOFF(j.product, barcode) };
}

/* ---------- Camera / deteccao ---------- */
export function suportaCamera() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

let zxingPromise = null;
function carregarZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (zxingPromise) return zxingPromise;
  zxingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/zxing.js';
    s.onload = () => resolve(window.ZXing);
    s.onerror = () => reject(new Error('Falha ao carregar leitor'));
    document.head.appendChild(s);
  });
  return zxingPromise;
}

/* Inicia a leitura no elemento <video>. Chama onDetect(codigo) uma vez.
 * Devolve uma funcao para parar (encerra camera). */
export async function iniciarScanner(videoEl, onDetect) {
  // Caminho 1: BarcodeDetector nativo
  if ('BarcodeDetector' in window) {
    let formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    try {
      const sup = await window.BarcodeDetector.getSupportedFormats?.();
      if (sup && sup.length) formats = formats.filter((x) => sup.includes(x));
    } catch {}
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    videoEl.srcObject = stream;
    await videoEl.play().catch(() => {});
    const det = new window.BarcodeDetector({ formats: formats.length ? formats : ['ean_13'] });
    let rodando = true;
    const parar = () => { rodando = false; stream.getTracks().forEach((t) => t.stop()); };
    const loop = async () => {
      if (!rodando) return;
      try {
        const codes = await det.detect(videoEl);
        if (codes && codes[0] && codes[0].rawValue) { parar(); onDetect(codes[0].rawValue); return; }
      } catch {}
      requestAnimationFrame(loop);
    };
    loop();
    return parar;
  }

  // Caminho 2: ZXing (fallback amplo, inclui iPhone)
  const ZX = await carregarZXing();
  const hints = new Map();
  hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
    ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E,
  ]);
  const reader = new ZX.BrowserMultiFormatReader(hints, 350);
  let parado = false;
  reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoEl, (result) => {
    if (result && !parado) { parado = true; reader.reset(); onDetect(result.getText()); }
  }).catch(() => {});
  return () => { parado = true; try { reader.reset(); } catch {} };
}
