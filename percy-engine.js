// ============================================================
// REVERSE LIFE — motor de regras do sistema Percy Jackson
// Funções puras (sem DOM nem Firebase) para poder testar fora do navegador.
// Convenção: 1 ponto de dano = 1% de dano na ficha.
// ============================================================

import { ATTRS, attrValue, D20_TESTS, rollD20, maxDamageOf } from "./rules.js";

export const PUNCH = { id: "punch", l: "Soco", t: "forca", melee: true, foe: 1, dmg: "1d4" };

const uid = () => `fx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const attrLabel = (k) => (ATTRS.find((a) => a.key === k) || { label: k }).label;
export { attrLabel };

// ---------- dados ----------
export function rollDice(str, rng = Math.random){
  const parts = [];
  let total = 0;
  String(str || "0").replace(/\s+/g, "").split("+").filter(Boolean).forEach((term) => {
    const m = term.match(/^(\d*)d(\d+)$/i);
    if (m) {
      const n = parseInt(m[1] || "1", 10), s = parseInt(m[2], 10);
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(rng() * s));
      const sum = rolls.reduce((a, b) => a + b, 0);
      total += sum;
      parts.push(`${n}d${s} (${rolls.join("+")})`);
    } else {
      const v = parseInt(term, 10) || 0;
      total += v;
      parts.push(String(v));
    }
  });
  return { total, text: parts.join(" + ") };
}

// ---------- efeitos ativos ----------
export function liveFx(char, now = Date.now()){
  return (char.fx || []).filter((f) => !(f.until && f.until <= now));
}
export function fxMod(char, key, now = Date.now()){
  return liveFx(char, now).reduce((s, f) => s + ((f.m && f.m[key]) || 0), 0);
}
export function fxDmgBonus(char, melee, now = Date.now()){
  const out = [];
  liveFx(char, now).forEach((f) => {
    if (!f.dmgBonus) return;
    if (f.dmgBonus.all) out.push(f.dmgBonus.all);
    if (melee && f.dmgBonus.melee) out.push(f.dmgBonus.melee);
  });
  return out;
}
// valor efetivo do atributo (base + bônus/penalidades de efeitos)
export const effAttr = (char, key, now) => attrValue(char, key) + fxMod(char, key, now);

export function makeFx(def, src, now = Date.now()){
  const f = { id: uid(), l: def.l, src: src || "" };
  if (def.m) f.m = { ...def.m };
  if (def.min) f.until = now + def.min * 60000;
  if (def.acts) f.acts = def.acts;
  if (def.hits) f.hits = def.hits;
  if (def.absorb) f.absorb = def.absorb;
  if (def.dr != null) f.dr = def.dr;
  if (def.dmgBonus) f.dmgBonus = { ...def.dmgBonus };
  if (def.end) f.end = { ...def.end };
  if (def.bad) f.bad = 1;
  return f;
}

// remove efeitos vencidos; devolve dano de "fim de efeito" (ex.: Carnificina de Ares)
export function pruneFx(char, now = Date.now()){
  const gone = [], keep = [];
  (char.fx || []).forEach((f) => {
    const dead = (f.until && f.until <= now) || (f.acts != null && f.acts <= 0) || (f.hits != null && f.hits <= 0) || (f.absorb != null && f.absorb <= 0);
    (dead ? gone : keep).push(f);
  });
  const endDmg = gone.reduce((s, f) => s + ((f.until && f.until <= now && f.end && f.end.dmg) || 0), 0);
  return { fx: keep, gone, endDmg, changed: gone.length > 0 };
}

// ---------- recarga ----------
export function cdKey(entryId, actId){ return `${entryId}:${actId}`; }

export function cdState(char, entry, act, now = Date.now()){
  const cds = char.cds || {};
  if (entry && entry.pool) {
    const p = cds[`pool:${entry.id}`];
    if (p && p.used >= entry.pool.n && p.readyAt > now) return { ready: false, until: p.readyAt, label: "recarregando" };
    return { ready: true };
  }
  const c = cds[cdKey(entry.id, act.id)];
  if (c == null || c === 0) return { ready: true };
  if (c === "u") return { ready: false, manual: true, label: act.cd === "d" ? "usado hoje" : "usado no combate" };
  if (typeof c === "number" && c > now) return { ready: false, until: c, label: "recarga" };
  return { ready: true };
}

export function startCd(cds, entry, act, now = Date.now()){
  const out = { ...(cds || {}) };
  if (entry.pool) {
    const k = `pool:${entry.id}`;
    const p0 = out[k];
    const recharged = p0 && p0.readyAt && p0.readyAt <= now;
    const p = (!p0 || recharged) ? { used: 0, readyAt: 0 } : p0;
    const used = p.used + 1;
    out[k] = { used, readyAt: used >= entry.pool.n ? now + entry.pool.rec * 60000 : 0 };
    return out;
  }
  if (typeof act.cd === "number") out[cdKey(entry.id, act.id)] = now + act.cd * 60000;
  else if (act.cd === "c" || act.cd === "d") out[cdKey(entry.id, act.id)] = "u";
  return out;
}

// ---------- dano recebido: reduções, barreiras e armaduras ----------
export function resolveIncoming(char, amount, now = Date.now(), rng = Math.random){
  const steps = [];
  let left = Math.max(0, Math.round(amount));
  let fx = (char.fx || []).map((f) => ({ ...f }));
  let items = (char.items || []).map((i) => (i.def ? { ...i, def: { ...i.def } } : i));
  if (left <= 0) return { final: 0, fx, items, steps };
  const live = (f) => !(f.until && f.until <= now);

  // 1) redução por golpe (dr)
  fx.forEach((f) => {
    if (!live(f) || f.dr == null || left <= 0) return;
    const r = typeof f.dr === "number" ? f.dr : rollDice(f.dr, rng).total;
    const cut = Math.min(left, r);
    left -= cut;
    steps.push(`${f.l}: -${cut}`);
  });
  // 2) barreiras (absorb)
  fx.forEach((f) => {
    if (!live(f) || !(f.absorb > 0) || left <= 0) return;
    const take = Math.min(f.absorb, left);
    f.absorb -= take;
    left -= take;
    steps.push(`${f.l}: absorveu ${take}`);
  });
  // cada efeito com "hits" conta um golpe sofrido
  fx.forEach((f) => { if (live(f) && f.hits != null) f.hits -= 1; });
  // 3) armaduras e escudos equipados
  items.forEach((it) => {
    if (!it.def || !it.def.equipped || it.def.broken || left <= 0) return;
    const take = Math.min(left, it.def.absorb || 0, it.def.hp);
    if (take <= 0) return;
    it.def.hp -= take;
    left -= take;
    steps.push(`${it.name}: absorveu ${take}`);
    if (it.def.hp <= 0) { it.def.hp = 0; it.def.broken = true; it.def.equipped = false; steps.push(`💥 ${it.name} quebrou!`); }
  });
  return { final: left, fx, items, steps };
}

// aplica um "pacote" (dano, cura, efeitos) numa ficha; devolve o patch do Firestore
export function applyPacket(char, packet, now = Date.now(), rng = Math.random){
  const max = maxDamageOf(char);
  const before = Math.max(0, char.damage || 0);
  let damage = before;
  let fx = (char.fx || []).map((f) => ({ ...f }));
  let items = char.items;
  const steps = [];
  const patch = {};

  if (packet.dmg > 0) {
    const r = resolveIncoming({ ...char, fx }, packet.dmg, now, rng);
    fx = r.fx;
    items = r.items;
    steps.push(...r.steps);
    damage = Math.min(max, damage + r.final);
    if (r.items.some((it, i) => it !== (char.items || [])[i])) patch.items = r.items;
    packet.absorbed = packet.dmg - r.final;
  }
  if (packet.heal > 0) damage = Math.max(0, damage - packet.heal);
  if (packet.stopBleed && char.bleeding) patch.bleeding = null;
  (packet.fx || []).forEach((f) => fx.push(f));

  fx = pruneFx({ fx }, now).fx;
  patch.fx = fx;
  if (damage !== before) patch.damage = damage;
  return { patch, before, after: damage, max, steps, absorbed: packet.absorbed || 0 };
}

// ---------- planejamento de uma ação (poder, presente, soco, arma, objeto mágico) ----------
const DC_DEFAULT = "normal";

export function planAction({ caster, foes = [], allies = [], entry, act, dcKey = DC_DEFAULT, opts = {}, disadv = false, now = Date.now(), rng = Math.random }){
  const src = entry.n || entry.name || act.l;
  const out = { src, act, test: null, failed: false, crit: false, mult: 1, targets: [], selfFx: [], selfPacket: null, lines: [] };

  // opções marcadas (alvo úmido, sem água etc.)
  const chosen = (act.opt || []).filter((o) => opts[o.id]);
  const mult = chosen.reduce((m, o) => m * (o.mult || 1), 1);
  const dmgDice = (chosen.find((o) => o.dmg) || {}).dmg || act.dmg;
  const healAdd = chosen.map((o) => o.healAdd).filter(Boolean);
  const rsPen = chosen.reduce((s, o) => s + (o.rsPen || 0), 0);

  // teste do conjurador
  if (act.t) {
    const atkBonus = act.dmg || act.melee || act.ranged ? fxMod(caster, "ataque", now) : 0;
    const r = rollD20(act.t, effAttr(caster, act.t, now) + (act.tb || 0) + atkBonus, dcKey, rng, disadv);
    out.test = r;
    out.failed = r.success === false;
    out.crit = r.die === 20;
    out.mult = out.crit ? (act.ranged ? 3 : 2) : 1;
  }
  if (out.failed) { out.lines.push("O teste falhou: o efeito não se concretizou."); return out; }

  // bônus de dano de efeitos ativos (ex.: Fúria de Batalha) + Força nas armas corpo a corpo
  const meleeLike = !!act.melee;
  const extra = [];
  if (act.dmg || dmgDice) fxDmgBonus(caster, meleeLike, now).forEach((d) => extra.push(d));
  const forcaBonus = meleeLike ? effAttr(caster, "forca", now) : 0;

  // contestação (rs.vs === "c"): total do conjurador
  let casterContest = null;
  if (act.rs && act.rs.vs === "c") {
    const ca = act.rs.ca || act.t;
    casterContest = (out.test && ca === act.t) ? out.test.total : rollD20(ca, effAttr(caster, ca, now), null, rng, disadv).total;
    out.contest = casterContest;
  }
  const dcMin = D20_TESTS.normal.min;

  foes.forEach((foe) => {
    const t = { target: foe, kind: "foe", dmg: null, heal: 0, fx: [], resist: null, resisted: false, lines: [] };
    if (act.rs) {
      const r = rollD20(act.rs.a, effAttr(foe, act.rs.a, now) + rsPen, null, rng, false);
      const need = act.rs.vs === "c" ? casterContest + 1 : dcMin;
      t.resisted = r.total >= need;
      t.resist = { total: r.total, die: r.die, need, attr: act.rs.a, contest: act.rs.vs === "c" };
    }
    const dealDmg = dmgDice && (!act.dmgFail || !t.resisted);
    if (dealDmg) {
      const base = rollDice([dmgDice, ...extra].join("+") + (forcaBonus ? `+${forcaBonus}` : ""), rng);
      const total = Math.max(0, Math.round(base.total * mult * out.mult));
      t.dmg = { total, text: base.text, mult: mult * out.mult };
    }
    if (!act.rs || !t.resisted) (act.ap || []).forEach((d) => t.fx.push(makeFx(d, src, now)));
    else (act.apOk || []).forEach((d) => t.fx.push(makeFx(d, src, now)));
    (act.apAlways || []).forEach((d) => t.fx.push(makeFx(d, src, now)));
    out.targets.push(t);
  });

  allies.forEach((al) => {
    const isSelf = al.id === caster.id;
    const t = { target: al, kind: isSelf ? "self" : "ally", dmg: null, heal: 0, healText: "", fx: [], stopBleed: !!act.stopBleed };
    const healDice = (isSelf && act.healS) ? act.healS : act.heal;
    if (healDice) {
      const r = rollDice([healDice, ...healAdd].join("+"), rng);
      t.heal = r.total;
      t.healText = r.text;
    }
    (act.apAlly || []).forEach((d) => t.fx.push(makeFx(d, src, now)));
    out.targets.push(t);
  });

  // efeitos e custo no próprio conjurador
  (act.apSelf || []).forEach((d) => out.selfFx.push(makeFx(d, src, now)));
  out.cost = act.cost || 0;
  return out;
}

// ---------- texto auxiliar ----------
export function cdLabel(act){
  if (typeof act.cd === "number") return act.cd >= 60 ? `${act.cd / 60} h` : `${act.cd} min`;
  if (act.cd === "c") return "1x por combate";
  if (act.cd === "d") return "1x por dia";
  return "";
}
