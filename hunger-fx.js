// ============================================================
// REVERSE LIFE — efeitos e visual da arena (Jogos Vorazes)
//  · paraquedas de patrocinador descendo pela tela
//  · tela cheia + canhão quando um tributo cai
//  · clima de cada evento, bem ao fundo (não atrapalha a leitura)
//  · contador "tributos restantes"
//  · mapa circular da arena
// Respeita "movimento reduzido" e o botão de efeitos do Percy Jackson (rl_fx_off).
// ============================================================

import { maxDamageOf } from "./rules.js";
import { DISTRICT_BY_N, REGIONS, regionLabel } from "./hunger-data.js";
import { EVENT_BY_ID } from "./hunger-events.js";
import { fxEnabled } from "./percy-fx.js";
import { playCannon, playParachute, playEventAmbient } from "./sound.js";

const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
// som e animação nunca podem derrubar a ficha: qualquer falha (sem áudio, etc.) é ignorada
const safe = (fn) => { try { fn(); } catch (e) { console.warn("efeito ignorado:", e && e.message); } };

function layer(cls, html, ms, style = ""){
  const el = document.createElement("div");
  el.className = cls;
  el.setAttribute("aria-hidden", "true");
  if (style) el.style.cssText = style;
  el.style.setProperty("--dur", `${ms}ms`);
  el.innerHTML = html;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms + 200);
  return el;
}

// ============================================================
// paraquedas de patrocinador
// ============================================================
export function parachuteFx(name, place){
  safe(playParachute);
  if (!fxEnabled() || reduced()) return;
  const left = rnd(18, 78);
  layer("hgfx-chute", `
    <div class="hgfx-chute-body" style="left:${left}%">
      <svg viewBox="0 0 80 110" width="86" height="118" aria-hidden="true">
        <defs><linearGradient id="hgChuteG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f4"/><stop offset="1" stop-color="#9aa3ad"/></linearGradient></defs>
        <path d="M6 38 Q40 -8 74 38 Q60 30 40 36 Q20 30 6 38Z" fill="url(#hgChuteG)" stroke="#d9dde2" stroke-width="1.2"/>
        <path d="M6 38 L34 84 M23 33 L36 84 M40 36 L40 84 M57 33 L44 84 M74 38 L46 84" stroke="#cfd4da" stroke-width="1" fill="none"/>
        <rect x="31" y="82" width="18" height="16" rx="2" fill="#b8902c" stroke="#ffe08a"/>
        <text x="40" y="94" text-anchor="middle" font-size="10">🎁</text>
      </svg>
      <span class="hgfx-chute-tag">${esc(name)}<small>${esc(place)}</small></span>
    </div>`, 5200);
}

// ============================================================
// tributo caído: canhão + tela escura com nome, foto e distrito
// ============================================================
export function fallenTributeFx(character){
  safe(playCannon);
  const d = character.district ? DISTRICT_BY_N[character.district] : null;
  const el = document.createElement("div");
  el.className = "hgfx-fallen";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", `${character.fullName} caiu`);
  el.style.setProperty("--dist", d ? d.color : "#d4af37");
  el.innerHTML = `
    <div class="hgfx-fallen-card">
      <small class="hgfx-cannon">💥 um canhão soa na arena…</small>
      <div class="hgfx-photo">${character.photoUrl ? `<img src="${esc(character.photoUrl)}" alt="">` : `<span>${d ? d.ico : "☠️"}</span>`}</div>
      <b class="hgfx-name">${esc(character.fullName)}</b>
      <span class="hgfx-district">${d ? `${d.ico} ${esc(d.name)} — ${esc(d.sector)}` : "tributo sem distrito"}</span>
      <em class="hgfx-mock">caiu nos Jogos Vorazes</em>
      <button type="button" class="btn-mini" data-fallen-close>continuar</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 600); };
  el.querySelector("[data-fallen-close]").addEventListener("click", close);
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  setTimeout(close, 7500);
}

// ============================================================
// clima de cada evento: curto (cerca de 8 s), transparente e só nas bordas/ao fundo
// ============================================================
const AMB_MS = 8000;
function parts(n, make){ return Array.from({ length: n }, (_, i) => make(i)).join(""); }

const EVENT_FX = {
  chuva: () => ({ cls: "hgfx-chuva", html: parts(46, () => `<i class="drop" style="left:${rnd(0, 100)}%;--d:${rnd(0, 2.4)}s;--t:${rnd(0.55, 1.1)}s;height:${rnd(16, 34)}px"></i>`) }),
  nevasca: () => ({ cls: "hgfx-nevasca", html: parts(34, () => `<i class="flake" style="left:${rnd(0, 100)}%;--d:${rnd(0, 4)}s;--t:${rnd(4, 7)}s;--s:${rnd(9, 18)}px;--dx:${rnd(-6, 6)}vw">❄</i>`) }),
  cinzas: () => ({ cls: "hgfx-cinzas", html: parts(34, () => `<i class="ash" style="left:${rnd(0, 100)}%;--d:${rnd(0, 4)}s;--t:${rnd(4, 7)}s;--s:${rnd(3, 8)}px;--dx:${rnd(-10, 10)}vw"></i>`) }),
  terremoto: () => ({ cls: "hgfx-terremoto", html: parts(18, () => `<i class="dust" style="left:${rnd(0, 100)}%;--d:${rnd(0, 3)}s;--t:${rnd(1.6, 3)}s;--s:${rnd(3, 7)}px"></i>`), shake: true }),
  tsunami: () => ({ cls: "hgfx-tsunami", html: `<i class="wave w1"></i><i class="wave w2"></i>` }),
  canarios: () => ({ cls: "hgfx-canarios", html: parts(7, () => `<i class="bird" style="top:${rnd(4, 38)}%;--d:${rnd(0, 4)}s;--t:${rnd(3.2, 5)}s;--s:${rnd(16, 26)}px">🐦</i>`) }),
  predadores: () => ({ cls: "hgfx-predadores", html: `<i class="eyes e1">👁️👁️</i><i class="eyes e2">👁️👁️</i><i class="eyes e3">👁️👁️</i>` }),
  flora: () => ({ cls: "hgfx-flora", html: parts(26, () => `<i class="spore" style="left:${rnd(0, 100)}%;--d:${rnd(0, 4)}s;--t:${rnd(4, 7)}s;--s:${rnd(5, 12)}px;--dx:${rnd(-8, 8)}vw"></i>`) }),
  ceia: () => ({ cls: "hgfx-ceia", html: parts(24, () => `<i class="spark" style="left:${rnd(0, 100)}%;top:${rnd(4, 96)}%;--d:${rnd(0, 5)}s;--s:${rnd(4, 9)}px"></i>`) }),
  bomba: () => ({ cls: "hgfx-bomba", html: `<i class="siren"></i>` }),
  vulcao: () => ({ cls: "hgfx-vulcao", html: parts(30, () => `<i class="ember" style="left:${rnd(0, 100)}%;--d:${rnd(0, 4)}s;--t:${rnd(2.6, 5)}s;--s:${rnd(3, 8)}px;--dx:${rnd(-12, 12)}vw"></i>`) + `<i class="glow"></i>`, shake: true }),
  passaros: () => ({ cls: "hgfx-passaros", html: parts(16, () => `<i class="bird" style="top:${rnd(2, 70)}%;--d:${rnd(0, 4.5)}s;--t:${rnd(1.6, 3)}s;--s:${rnd(14, 30)}px;--dy:${rnd(-8, 14)}vh">🦅</i>`) }),
};

export function eventFx(typeId){
  const ev = EVENT_BY_ID[typeId];
  if (!ev) return;
  safe(() => playEventAmbient(typeId));
  if (!fxEnabled()) return;
  const make = EVENT_FX[typeId];
  if (!make) return;
  const f = make();
  const el = layer(`hgfx hgfx-ev ${f.cls}`, `<i class="edge"></i>${reduced() ? "" : f.html}`, AMB_MS, `--ev:${ev.color}`);
  if (f.shake && !reduced()) { document.body.classList.add("hgfx-shake"); setTimeout(() => document.body.classList.remove("hgfx-shake"), 1500); }
  return el;
}

// impacto da bomba: clarão branco, rachaduras e tremor (1 minuto depois do alerta)
export function bombImpactFx(){
  safe(() => playEventAmbient("bomba_impacto"));
  if (!fxEnabled()) return;
  layer("hgfx hgfx-impact", `
    <i class="flash"></i>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="cracks">
      <polyline points="50,50 44,38 49,26 42,12 45,0"/><polyline points="50,50 63,43 72,47 84,36 100,40"/>
      <polyline points="50,50 57,63 53,74 62,86 58,100"/><polyline points="50,50 36,56 28,52 16,64 0,60"/>
    </svg><i class="smoke"></i>`, 2600);
  if (!reduced()) { document.body.classList.add("hgfx-shake"); setTimeout(() => document.body.classList.remove("hgfx-shake"), 1500); }
}

// ============================================================
// contador "tributos restantes"
// ============================================================
let counterEl = null;
let lastAlive = null;
export function renderCounter(chars, active){
  if (!counterEl) counterEl = document.getElementById("hgCounter");
  if (!counterEl) return;
  if (!active || !chars || !chars.length) { counterEl.hidden = true; counterEl.innerHTML = ""; lastAlive = null; return; }
  const dead = (c) => (c.damage || 0) >= maxDamageOf(c);
  const alive = chars.filter((c) => !dead(c));
  const fallen = chars.filter(dead);
  counterEl.hidden = false;
  const tick = lastAlive !== null && alive.length < lastAlive;
  lastAlive = alive.length;
  counterEl.innerHTML = `
    <div class="hg-count-main">
      <span class="hg-count-label">tributos restantes</span>
      <span class="hg-count-num ${tick ? "tick" : ""}">${alive.length}<small>/${chars.length}</small></span>
    </div>
    <div class="hg-count-dots" aria-hidden="true">${chars.slice().sort((a, b) => (a.district || 99) - (b.district || 99)).map((c) => {
      const d = c.district ? DISTRICT_BY_N[c.district] : null;
      return `<i class="${dead(c) ? "dead" : ""}" style="--dist:${d ? d.color : "#777"}" title="${esc(c.fullName)}${dead(c) ? " (caiu)" : ""}"></i>`;
    }).join("")}</div>
    <div class="hg-count-fallen">
      <span class="hg-count-label">baixas</span>
      <b>${fallen.length}</b>
      ${fallen.length ? `<small>${fallen.slice(-4).map((c) => `☠ ${esc(c.fullName)}${c.district ? ` (D${c.district})` : ""}`).join(" · ")}</small>` : `<small>nenhum canhão soou ainda</small>`}
    </div>`;
}

// ============================================================
// mapa circular da arena
// ============================================================
const CX = 200, CY = 200, R_OUT = 186, R_IN = 52;
const pol = (r, deg) => { const a = (deg * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
function sector(a0, a1, r0, r1){
  const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1), [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r1} ${r1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r0} ${r0} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
}
// norte em cima, leste à direita, sul embaixo, oeste à esquerda
const SECT = { norte: [-135, -45], leste: [-45, 45], sul: [45, 135], oeste: [135, 225] };

export function arenaMapHtml({ locs = [], drops = [], events = [], chars = [], liveEventIds = [] } = {}){
  const liveByRegion = {};
  events.filter((e) => liveEventIds.includes(e.id)).forEach((e) => { (liveByRegion[e.region] = liveByRegion[e.region] || []).push(e); });

  const sectors = REGIONS.map((r) => {
    const [a0, a1] = SECT[r.id];
    const live = liveByRegion[r.id];
    const ev = live && EVENT_BY_ID[live[0].type];
    const mid = (a0 + a1) / 2, [lx, ly] = pol(R_OUT - 14, mid);
    const here = chars.filter((c) => c.region === r.id);
    const [tx, ty] = pol(R_OUT - 38, mid);
    return `<g class="map-sec ${ev ? "ev" : ""}" ${ev ? `style="--ev:${ev.color}"` : ""}>
      <path d="${sector(a0 + 1, a1 - 1, R_IN + 6, R_OUT)}"/>
      <text class="map-rname" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${r.label.toUpperCase()}</text>
      ${ev ? `<text class="map-evico" x="${tx.toFixed(1)}" y="${(ty + 6).toFixed(1)}" text-anchor="middle">${ev.ico}</text>` : ""}
      ${here.length ? `<g class="map-people"><title>${esc(here.map((c) => c.fullName).join(", "))}</title>${here.slice(0, 6).map((c, i) => { const d = c.district ? DISTRICT_BY_N[c.district] : null; const [px, py] = pol(R_OUT - 62, mid - 14 + i * 5.6); return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.6" fill="${d ? d.color : "#999"}" stroke="#000" stroke-width="1"/>`; }).join("")}${here.length > 6 ? `<text class="map-more" x="${pol(R_OUT - 62, mid + 22)[0].toFixed(1)}" y="${pol(R_OUT - 62, mid + 22)[1].toFixed(1)}">+${here.length - 6}</text>` : ""}</g>` : ""}
    </g>`;
  }).join("");

  // locais cadastrados: espalhados dentro do quadrante
  const pins = {};
  REGIONS.forEach((r) => {
    const list = locs.filter((l) => l.region === r.id);
    const [a0, a1] = SECT[r.id];
    list.forEach((l, k) => {
      const ang = a0 + ((k + 1) / (list.length + 1)) * (a1 - a0);
      const rad = 96 + (k % 2) * 34;
      const [x, y] = pol(rad, ang);
      pins[l.id] = { x, y, name: l.name, blocked: !!l.blocked };
    });
  });
  const cornDrops = drops.filter((d) => d.locId === "cornucopia");
  const pinSvg = Object.entries(pins).map(([id, p]) => {
    const ds = drops.filter((d) => d.locId === id);
    return `<g class="map-pin ${ds.length ? "has" : ""} ${p.blocked ? "blocked" : ""}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
      <title>${esc(p.name)}${ds.length ? ` — ${ds.length} presente(s)` : ""}</title>
      <circle r="5" class="dot"/>${p.blocked ? `<text class="map-block" y="4" text-anchor="middle">✕</text>` : ""}
      <text class="map-lname" y="16" text-anchor="middle">${esc(p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name)}</text>
      ${ds.length ? `<text class="map-chute" y="-9" text-anchor="middle">🪂${ds.length > 1 ? `<tspan class="map-cnt" dx="1">×${ds.length}</tspan>` : ""}</text>` : ""}
    </g>`;
  }).join("");
  const cornHere = chars.filter((c) => c.region === "cornucopia");

  return `<svg class="hg-map-svg" viewBox="0 0 400 400" role="img" aria-label="Mapa da arena: Cornucópia no centro e quatro regiões">
    <circle cx="${CX}" cy="${CY}" r="${R_OUT + 6}" class="map-ring"/>
    ${sectors}
    <g class="map-corn ${cornDrops.length ? "has" : ""}">
      <circle cx="${CX}" cy="${CY}" r="${R_IN}"/>
      <text x="${CX}" y="${CY - 2}" text-anchor="middle" class="map-cico">🏺</text>
      <text x="${CX}" y="${CY + 20}" text-anchor="middle" class="map-clabel">CORNUCÓPIA</text>
      ${cornDrops.length ? `<text x="${CX + 34}" y="${CY - 30}" class="map-chute">🪂<tspan class="map-cnt" dx="1">×${cornDrops.length}</tspan></text>` : ""}
      ${cornHere.length ? `<text x="${CX - 40}" y="${CY - 30}" class="map-chute" text-anchor="end">👥${cornHere.length}</text>` : ""}
    </g>
    ${pinSvg}
  </svg>`;
}

// ============================================================
// resultado do ataque em destaque (dado, veredito e dano em número grande)
// ============================================================
const VERDICT = { crit: "★ CRÍTICO!", hit: "ACERTOU", miss: "ERROU", fumble: "FALHA CRÍTICA", resisted: "RESISTIU" };
export function attackHeroHtml({ plan, entry, act, targets }){
  const t = plan.test;
  let outcome = "hit";
  if (t) {
    if (plan.failed) outcome = t.die === 1 ? "fumble" : "miss";
    else if (plan.crit) outcome = "crit";
  }
  const dmgTargets = (targets || []).filter((x) => x.hasDmg);
  if (outcome === "hit" && dmgTargets.length && dmgTargets.every((x) => x.resisted)) outcome = "resisted";
  const flavor = { crit: "20 natural: dano dobrado (triplo à distância)", fumble: "1 natural: o pior dos resultados", miss: "o golpe passa longe", resisted: "o alvo resistiu ao efeito", hit: "" }[outcome];

  const die = t ? `<div class="hg-die"><small>D20</small><b>${t.die}</b><span>${t.bonus >= 0 ? "+" : ""}${t.bonus} = <em>${t.total}</em></span><span class="need">precisa ${t.test ? t.test.min : "?"}</span></div>` : "";

  const one = (x, big) => {
    const unit = x.mon ? "de dano" : "% de dano";
    const shown = x.queued ? x.rolled : x.applied;
    const bits = [];
    if (x.hasDmg && !x.queued && x.rolled !== x.applied) bits.push(`rolou ${x.rolled} · ${x.absorbed ? `−${x.absorbed} absorvido` : "reduzido"}`);
    if (x.pierce) bits.push("ignora armadura");
    if (x.bled) bits.push("🩸 abriu um sangramento!");
    if (x.queued) bits.push("⏳ aguardando aplicação");
    if (x.heal) bits.push(`+${x.heal} de cura`);
    if (x.fx && x.fx.length) bits.push(x.fx.map(esc).join("; "));
    const num = x.hasDmg ? `<b class="n">${shown}</b><small>${unit}</small>` : (x.heal ? `<b class="n heal">+${x.heal}</b><small>cura</small>` : `<small>sem dano</small>`);
    return `<div class="hg-hero-t ${big ? "big" : ""}"><span class="who">${x.mon ? "👹 " : ""}${esc(x.name)}</span><span class="num">${num}</span>${bits.length ? `<span class="sub">${bits.join(" · ")}</span>` : ""}</div>`;
  };
  let body = "";
  if (outcome === "miss" || outcome === "fumble") body = `<div class="hg-hero-miss">${(targets || []).length ? esc(targets.map((x) => x.name).join(", ")) + " não foi atingido" : "nenhum efeito"}</div>`;
  else if ((targets || []).length === 1) body = one(targets[0], true);
  else if ((targets || []).length > 1) body = targets.map((x) => one(x, false)).join("");
  else body = `<div class="hg-hero-miss">efeito registrado</div>`;

  return `<div class="hg-hero ${outcome}">
    <div class="hg-hero-head"><span>${esc(entry.n)}</span><small>${esc(act.l || "")}</small></div>
    <div class="hg-hero-main">${die}<div class="hg-verdict">${VERDICT[outcome]}${flavor ? `<small>${flavor}</small>` : ""}</div></div>
    <div class="hg-hero-body">${body}</div>
  </div>`;
}

// ============================================================
// ficha atingida: treme e o número de dano sobe (e verde quando recebe cura)
// ============================================================
export function damagePop(card, delta){
  if (!card || !delta || !fxEnabled()) return;
  const dmg = delta > 0, n = Math.abs(delta);
  const pop = document.createElement("div");
  pop.className = `hg-pop ${dmg ? "dmg" : "heal"} ${n >= 15 ? "big" : ""}`;
  pop.textContent = `${dmg ? "−" : "+"}${n}%`;
  pop.setAttribute("aria-hidden", "true");
  card.appendChild(pop);
  setTimeout(() => pop.remove(), 1900);
  const cls = dmg ? (n >= 15 ? "hg-hit hard" : (n >= 5 ? "hg-hit" : "hg-hit light")) : "hg-healed";
  cls.split(" ").forEach((c) => card.classList.add(c));
  setTimeout(() => cls.split(" ").forEach((c) => card.classList.remove(c)), 900);
}
export function popDamages(deltas){
  deltas.forEach((delta, id) => {
    const card = document.querySelector(`.character-card[data-char-id="${CSS.escape(id)}"]`);
    if (card) damagePop(card, delta);
  });
}
