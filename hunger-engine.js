// ============================================================
// REVERSE LIFE — motor de regras do sistema Jogos Vorazes
// Funções puras (sem DOM nem Firebase) para poder testar fora do navegador.
// Convenção: 1 ponto de dano = 1% de dano na ficha ("HP" = pontos de %).
// ============================================================

import { HERBS, maxDamageOf, carryCapacity, itemsCarried, rollD20, D20_TESTS } from "./rules.js";
import { makeFx, rollDice, effAttr, liveFx, passiveWeaponBonus } from "./percy-engine.js";
import {
  DISTRICT_BY_N, DISTRICT_MAX_TRIBUTES, CATALOG_BY_KEY, SUPPLY_BY_KEY, WEAPONS, SUPPLIES,
  INFECTION_CHANCE, INFECTION_CHANCE_ANTISEPTIC, INFECTION_CHANCE_CONTAMINATED,
  INFECTION_TICK_MS, INFECTION_TICK_DMG, BLEED_CHANCE_CRIT_BONUS, SPONSOR_POOL, CORNUCOPIA,
} from "./hunger-data.js";

export const isHungerCampaign = (c) => !!(c && c.hungerGamesEnabled && c.diceSystem === "d20");
export const districtOf = (ch) => (ch && ch.district && DISTRICT_BY_N[ch.district]) || null;
const passive = (ch) => { const d = districtOf(ch); return d ? d.passive : null; };
export const healBonus = (ch) => (passive(ch) && passive(ch).heal) || 0;
export const sanityCutPct = (ch) => (passive(ch) && passive(ch).sanityCut) || 0;
export const herbBonusPct = (ch) => (passive(ch) && passive(ch).herb) || 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- distritos ----------
export function districtCount(chars, n, exceptId){
  return (chars || []).filter((c) => Number(c.district) === Number(n) && c.id !== exceptId).length;
}
export function districtFull(chars, n, exceptId){
  return districtCount(chars, n, exceptId) >= DISTRICT_MAX_TRIBUTES;
}
export function groupByDistrict(chars){
  const map = new Map();
  (chars || []).forEach((c) => {
    const k = Number(c.district) || 0;           // 0 = sem distrito
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  });
  return [...map.entries()].sort((a, b) => (a[0] || 99) - (b[0] || 99));
}

// dano de sanidade depois da passiva (Distrito 9)
export const cutSanity = (ch, n) => Math.max(0, Math.round(n * (100 - sanityCutPct(ch)) / 100));

export { passiveWeaponBonus };

// ---------- itens ----------
const iid = () => `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export function strip(obj){            // o Firestore não aceita undefined
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined) out[k] = (v && typeof v === "object" && !Array.isArray(v)) ? strip(v) : v; });
  return out;
}

const HERB_TEXT = {
  erva_verde: "Restaura vida (usa a % de cura da campanha), mas não para o sangramento.",
  erva_vermelha: "Para o sangramento e é a ÚNICA cura da infecção.",
  erva_azul: "Restaura 20% de sanidade.",
};

export function itemInfo(key){
  if (HERBS[key]) return { key, name: HERBS[key].label, ico: HERBS[key].icon, desc: HERB_TEXT[key] || "", category: key };
  const c = CATALOG_BY_KEY[key];
  if (!c) return { key, name: key, ico: "📦", desc: "", category: "equipamento" };
  const ico = c.atk ? "🗡️" : ({ alimento: "🍗", bebida: "🥤", cura: "💉", escudo: "🔰", erva_preta: "🖤" }[c.category] || "🎒");
  return { key, name: c.name, ico, desc: c.desc, category: c.atk ? "arma" : c.category };
}

// cria um item de inventário a partir do catálogo (Cornucópia, drops, narrador)
export function buildItem(key, quantity = 1, over = {}){
  if (HERBS[key]) {
    return strip({ id: iid(), key, name: HERBS[key].label, description: HERB_TEXT[key] || "", category: key, quantity, ...over });
  }
  const c = CATALOG_BY_KEY[key];
  if (!c) return null;
  const it = { id: iid(), key, name: c.name, description: c.desc, quantity, category: c.atk ? "arma" : c.category };
  if (c.atk) it.atk = { ...c.atk, tags: c.atk.tags ? [...c.atk.tags] : undefined };
  if (c.uses) { it.uses = c.uses; it.usesMax = c.uses; }
  if (c.def) it.def = { absorb: c.def.absorb, hp: c.def.hp, hpMax: c.def.hp, equipped: false, broken: false };
  if (c.unique) it.unique = true;
  if (c.noSlot) it.noSlot = true;
  if (c.capBonus) it.capBonus = c.capBonus;
  if (c.heal !== undefined) it.heal = c.heal;
  const t = c.fn && c.fn.type;
  if (t === "drink" || t === "eat") it.safe = false;
  return strip({ ...it, ...over });
}

// só empilha item "intacto" e do mesmo tipo (arma, escudo, item já aberto ou contaminado ficam separados)
const stateless = (it) => !it.atk && !it.def && !it.contam && !it.coated && (it.usesMax == null || it.uses === it.usesMax);
export function canStack(a, b){
  return !!a.key && a.key === b.key && !!a.safe === !!b.safe && stateless(a) && stateless(b);
}
export function addItem(items, newItem){
  const list = [...(items || [])];
  const i = list.findIndex((x) => canStack(x, newItem));
  if (i >= 0) list[i] = { ...list[i], quantity: list[i].quantity + newItem.quantity };
  else list.push(newItem);
  return list;
}

// confere espaço e itens únicos (mochila); lança "INVENTORY_FULL" ou "UNIQUE_ITEM"
export function addItemChecked(character, newItem){
  const items = character.items || [];
  if (newItem.unique && items.some((x) => x.key === newItem.key)) throw new Error("UNIQUE_ITEM");
  if (!newItem.noSlot && itemsCarried(items) + newItem.quantity > carryCapacity(character)) throw new Error("INVENTORY_FULL");
  return addItem(items, newItem);
}

// gasta 1 uso de um item (cantil 2 goles, saco de frutas 3 frutas, pastilhas, fósforos...)
export function spendUse(items, itemId){
  const list = [...(items || [])];
  const idx = list.findIndex((i) => i.id === itemId);
  if (idx < 0) return null;
  const it = list[idx];
  const max = it.usesMax || 1;
  const cur = it.uses ?? max;
  const left = cur - 1;
  if (it.quantity > 1) {
    list[idx] = { ...it, quantity: it.quantity - 1 };
    if (max > 1 && left > 0) list.splice(idx + 1, 0, { ...it, id: iid(), quantity: 1, uses: left });
  } else if (max > 1 && left > 0) {
    list[idx] = { ...it, uses: left };
  } else {
    list.splice(idx, 1);
  }
  let out = list;
  if (left <= 0 && it.key === "cantil_cheio") out = addItem(list, buildItem("cantil_vazio"));
  return { items: out, left: Math.max(0, left), item: it };
}

// separa 1 unidade de um item empilhado, aplicando um patch a ela (ex.: água purificada, comida cozida)
export function transformOne(items, itemId, patch){
  const list = [...(items || [])];
  const idx = list.findIndex((i) => i.id === itemId);
  if (idx < 0) return null;
  const it = list[idx];
  if (it.quantity > 1) {
    list[idx] = { ...it, quantity: it.quantity - 1 };
    const one = { ...it, id: iid(), quantity: 1, ...patch };
    return { items: addItem(list, one), item: one };
  }
  list[idx] = { ...it, ...patch };
  return { items: list, item: list[idx] };
}

export const hasKey = (character, key) => (character.items || []).some((i) => i.key === key && i.quantity > 0);
export const isWater = (it) => it.category === "bebida";
export const isFood = (it) => it.category === "alimento";
export const isConsumable = (it) => it.category === "bebida" || it.category === "alimento";
export const fnOf = (it) => { const c = it && CATALOG_BY_KEY[it.key]; return c && c.fn ? c.fn : null; };

// ---------- infecção ----------
export function infectionChance(char, item, now = Date.now()){
  const anti = liveFx(char, now).some((f) => f.tag === "antisseptico");
  if (item && item.contam) return anti ? 20 : INFECTION_CHANCE_CONTAMINATED;
  if (item && item.safe) return 0;
  return anti ? INFECTION_CHANCE_ANTISEPTIC : INFECTION_CHANCE;
}
export function rollInfection(char, item, now = Date.now(), rng = Math.random){
  const chance = infectionChance(char, item, now);
  const roll = 1 + Math.floor(rng() * 100);
  return { chance, roll, infected: chance > 0 && roll <= chance };
}
// infecção: 2% de dano a cada 30 min, SEM fim natural — só a Erva Vermelha cura
export function computeInfectionTicks(character, now){
  const b = character.infection;
  if (!b) return null;
  const elapsed = Math.floor((now - b.startedAt) / INFECTION_TICK_MS);
  const applied = b.ticksApplied || 0;
  if (elapsed <= applied) return null;
  const n = elapsed - applied;
  const max = maxDamageOf(character);
  const oldDamage = clamp(Math.round(character.damage || 0), 0, max);
  const newDamage = Math.min(max, oldDamage + n * INFECTION_TICK_DMG);
  return { patch: { damage: newDamage, infection: { startedAt: b.startedAt, ticksApplied: elapsed } }, ticks: n, oldDamage, newDamage, max };
}
export function infectionProgress(inf, now){
  const t = now - inf.startedAt;
  const next = INFECTION_TICK_MS - (t % INFECTION_TICK_MS);
  return { ticksApplied: inf.ticksApplied || 0, msToNext: next };
}

// ---------- armas ----------
export function bleedChanceOf(atk, crit){
  const base = Number(atk && atk.bleed) || 0;
  if (base <= 0) return 0;
  return Math.min(95, base + (crit ? BLEED_CHANCE_CRIT_BONUS : 0));
}
// erva preta numa arma: +1 dado do mesmo tipo (2d8 → 3d8; 1d10+2 → 2d10+2)
export function coatDice(dmg){
  let done = false;
  return String(dmg).replace(/(\d*)d(\d+)/i, (m, n, s) => { if (done) return m; done = true; return `${(parseInt(n || "1", 10)) + 1}d${s}`; });
}

// ---------- sorteios ----------
export function weightedPick(pool, rng = Math.random){
  const total = pool.reduce((s, p) => s + (p.w || 1), 0);
  let r = rng() * total;
  for (const p of pool) { r -= (p.w || 1); if (r < 0) return p; }
  return pool[pool.length - 1];
}
export const rollSponsorKey = (rng = Math.random) => weightedPick(SPONSOR_POOL, rng).key;
// locais possíveis: a Cornucópia (fixa) + os locais cadastrados pelo narrador
export function dropLocations(locs){
  return [{ id: CORNUCOPIA.id, name: CORNUCOPIA.label, region: "cornucopia" }, ...(locs || []).filter((l) => !l.blocked)];   // rotas bloqueadas pelo vulcão não recebem drops
}
export const pickLocation = (locs, rng = Math.random) => { const l = dropLocations(locs); return l[Math.floor(rng() * l.length)]; };

export function initialStock(){
  const stock = {};
  [...WEAPONS, ...SUPPLIES].forEach((x) => { stock[x.key] = x.n; });
  return stock;
}

// ---------- efeitos com agenda (sched) ----------
// def.schedRel = [{ afterMs, dmg?, sanity?, test?, onPass?, onFail?, again?, fx?, label? }]
export function relSched(rel, now){
  return (rel || []).map((e) => { const { afterMs, ...r } = e; return { ...r, at: now + (afterMs || 0) }; });
}
// cria o efeito real a partir da definição (converte tempos relativos em absolutos)
export function makeEventFx(def, src, now = Date.now()){
  const { schedRel, tag, ev, dropWhenDone, ...base } = def;
  const f = makeFx(base, src, now);
  if (tag) f.tag = tag;
  if (ev) f.ev = ev;
  if (dropWhenDone) f.dropWhenDone = 1;
  if (schedRel && schedRel.length) { f.sched = relSched(schedRel, now); f.t0 = now; f.n0 = f.sched.length; }
  return f;
}

// processa as etapas vencidas de todos os efeitos agendados da ficha
export function processSched(char, now = Date.now(), rng = Math.random){
  if (!(char.fx || []).some((f) => f.sched && f.sched.length && f.sched.some((e) => e.at <= now))) return { changed: false };
  const max = maxDamageOf(char);
  let damage = clamp(Math.round(char.damage || 0), 0, max);
  const dBefore = damage;
  let sanity = clamp(Math.round(char.sanity || 0), 0, 100);
  const sBefore = sanity;
  let fx = (char.fx || []).map((f) => ({ ...f, sched: f.sched ? f.sched.map((e) => ({ ...e })) : f.sched }));
  const spawned = [];
  const logs = [];
  const name = `<b>${esc(char.fullName)}</b>`;

  fx.forEach((f) => {
    if (!f.sched || !f.sched.length) return;
    const queue = f.sched.slice().sort((a, b) => a.at - b.at);
    let kill = false;
    while (queue.length && queue[0].at <= now && !kill) {
      const e = queue.shift();
      f.last = e.at; f.done = (f.done || 0) + 1;
      let R = e, testTxt = "";
      if (e.test) {
        const r = rollD20(e.test.attr, effAttr({ ...char, fx }, e.test.attr, now), e.test.dc || "normal", rng, false);
        R = (r.success ? e.onPass : e.onFail) || {};
        testTxt = ` (${r.die}+${r.bonus}=${r.total} vs ${D20_TESTS[e.test.dc || "normal"].min}: ${r.success ? "passou" : "falhou"})`;
      }
      const bits = [];
      if (R.dmg) { const add = Math.round(R.dmg); damage = Math.min(max, damage + add); bits.push(`sofreu <b>${add}%</b> de dano`); }
      if (R.sanity) { const add = cutSanity(char, R.sanity); sanity = Math.min(100, sanity + add); bits.push(`+${add}% de sanidade`); }
      (R.fx || []).forEach((d) => { spawned.push(makeEventFx(d, f.src, now)); bits.push(`recebeu: ${esc(d.l)}`); });
      if (R.clear) { kill = true; bits.push("o efeito terminou"); }
      if (R.msg) bits.push(esc(R.msg));
      if (e.again && !kill && (e.n || 1) < e.again.max) queue.push({ ...e, at: e.at + e.again.everyMs, n: (e.n || 1) + 1 });
      queue.sort((a, b) => a.at - b.at);
      logs.push({ icon: R.dmg ? "🩸" : (R.sanity ? "🌀" : "⏱️"), text: `${name} — ${esc(e.label || f.l)}${testTxt}: ${bits.join(", ") || "sem efeito"}${R.dmg ? ` — agora em ${damage}%` : ""}.` });
    }
    f.sched = kill ? [] : queue;
    if (kill || (!f.sched.length && f.dropWhenDone)) f._drop = true;
  });
  fx = fx.filter((f) => !f._drop).concat(spawned);

  const patch = { fx };
  if (damage !== dBefore) patch.damage = damage;
  if (sanity !== sBefore) patch.sanity = sanity;
  const died = damage >= max && dBefore < max;
  const mad = sanity >= 100 && sBefore < 100;
  return { changed: true, patch, logs, died, mad, after: damage, max };
}

// ---------- aplica o resultado de um evento (ou de um efeito imediato) numa ficha ----------
// res: { dmg, heal, sanity, fx:[defs], stripTags:[], contaminate, destroy:n, src, lines:[] }
export function applyResult(char, res, now = Date.now(), rng = Math.random){
  const max = maxDamageOf(char);
  const before = clamp(Math.round(char.damage || 0), 0, max);
  let damage = before;
  if (res.dmg > 0) damage = Math.min(max, damage + Math.round(res.dmg));
  if (res.heal > 0) damage = Math.max(0, damage - Math.round(res.heal));
  const sBefore = clamp(Math.round(char.sanity || 0), 0, 100);
  let sanity = sBefore;
  if (res.sanity > 0) sanity = Math.min(100, sanity + cutSanity(char, res.sanity));
  if (res.sanity < 0) sanity = Math.max(0, sanity + res.sanity);

  let fx = (char.fx || []).map((f) => ({ ...f }));
  if (res.stripTags && res.stripTags.length) fx = fx.filter((f) => !res.stripTags.includes(f.tag));
  const added = (res.fx || []).map((d) => makeEventFx(d, res.src || "", now));
  fx = fx.concat(added);
  fx = fx.filter((f) => !(f.until && f.until <= now));

  let items = (char.items || []).map((i) => ({ ...i }));
  const lost = [];
  let contaminated = 0;
  if (res.contaminate) {
    items = items.map((it) => { if (isConsumable(it) && !it.contam) { contaminated += 1; return { ...it, safe: false, contam: true }; } return it; });
  }
  for (let n = 0; n < (res.destroy || 0) && items.length; n++) {
    const i = Math.floor(rng() * items.length);
    const it = items[i];
    lost.push(it.name);
    if (it.quantity > 1) items[i] = { ...it, quantity: it.quantity - 1 };
    else items.splice(i, 1);
  }

  const patch = { fx };
  if (damage !== before) patch.damage = damage;
  if (sanity !== sBefore) patch.sanity = sanity;
  if (lost.length || contaminated) patch.items = items.map(strip);
  // garras e estilhaços: chance de abrir sangramento (só em fichas de personagem, só se houve dano)
  let bled = false;
  if (res.bleedChance > 0 && damage > before && !char.hpMax && !char.bleeding && damage < max && rng() * 100 < res.bleedChance) {
    patch.bleeding = { startedAt: now, ticksApplied: 0 };
    bled = true;
  }
  return {
    bled,
    patch, before, after: damage, max, sBefore, sAfter: sanity, lost, contaminated,
    added: added.length, died: damage >= max && before < max, mad: sanity >= 100 && sBefore < 100,
  };
}

// utilidades para os eventos
export const hasTag = (char, tag, now = Date.now()) => liveFx(char, now).some((f) => f.tag === tag);
export function attrTest(char, attr, dc, now = Date.now(), rng = Math.random){
  return rollD20(attr, effAttr(char, attr, now), dc, rng, false);
}
export { rollDice, liveFx };
