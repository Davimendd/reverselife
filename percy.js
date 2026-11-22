// ============================================================
// REVERSE LIFE — sistema Percy Jackson (interface e integração)
// Seções da ficha, modal de uso de poderes/armas, entrega de dano e efeitos
// (direto ou pela fila de "hits"), recargas, efeitos ativos e criação da ficha.
// Depende do motor em percy-engine.js e dos dados em olympus-data.js.
// ============================================================

import { ATTRS, attrValue, D20_TESTS, d20Message, maxDamageOf } from "./rules.js";
import { GODS, GOD_BY_ID, godEntries, giftKey } from "./olympus-data.js";
import * as EN from "./percy-engine.js";
import { icon } from "./icons.js";
import { playFx, fxEnabled, setFxEnabled } from "./percy-fx.js";
import { lineFor, randomLine, PUNCH_LINES, WEAPON_LINES, MAGIC_ITEM_LINES, MONSTER_LINES, FAIL_LINES, CRIT_LINES } from "./olympus-lines.js";

let ctx = null;
const inflight = new Set();

export const isPercy = (campaign) => !!(campaign && campaign.percyEnabled && campaign.diceSystem === "d20");
export const godOf = (c) => (c && c.percy && GOD_BY_ID[c.percy.god]) || null;
export { EN };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmtMs = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(r).padStart(2, "0")}`;
};
// alvos possíveis: fichas da campanha + monstros do bestiário (o jogador só vê os revelados)
const monstersNow = () => (ctx.monsters ? ctx.monsters() : []);
const allTargets = () => [...ctx.characters(), ...monstersNow()];
const canWrite = (ch) => (ch.isMonster ? ctx.isNarrator() : (ctx.isNarrator() || ctx.isMine(ch)));
const fresh = (ch) => allTargets().find((c) => c.id === ch.id) || ch;
const kindOf = (c) => (c && c.isMonster ? "monster" : undefined);
const mutateT = (c, fn) => ctx.api.mutateCharacter(ctx.campaign().id, c.id, fn, kindOf(c));
const isDead = (c) => (c.damage || 0) >= maxDamageOf(c);

export function initPercy(c){
  ctx = c;
  setInterval(tick, 1000);
}

// ============================================================
// seções da ficha
// ============================================================
const sectionTitle = (ico, text, extra = "") => `<div class="section-title">${icon(ico)}<span>${text}</span>${extra}</div>`;

function entryCard(character, kind, entry, writable, now){
  const kindLabel = kind === "ultimate" ? "Ultimate" : kind === "presente" ? "Presente divino" : "Poder comum";
  const acts = entry.acts.map((act) => {
    const st = EN.cdState(character, entry, act, now);
    const cdTxt = EN.cdLabel(act);
    const lock = !writable ? "disabled" : (!st.ready ? "disabled" : "");
    let status = "";
    if (!st.ready && st.until) status = `<span class="pz-cd" data-until="${st.until}">${fmtMs(st.until - now)}</span>`;
    else if (!st.ready && st.manual) status = `<span class="pz-cd manual">${st.label}</span>${writable ? `<button class="btn-mini pz-reset" data-pcd-reset="${entry.id}:${act.id}" title="recarregar">↺</button>` : ""}`;
    return `<div class="pz-act-row">
      <button class="pz-act ${st.ready ? "" : "cooling"}" data-pact="${kind}|${entry.id}|${act.id}" ${lock}>${esc(act.l)}${cdTxt && st.ready ? `<small>${cdTxt}</small>` : ""}</button>${status}
    </div>`;
  }).join("");
  const pool = entry.pool ? `<span class="pz-pool">${entry.pool.n} cargas · recarrega em ${entry.pool.rec} min</span>` : "";
  return `<article class="pz-card kind-${kind}">
    <header><b class="pz-name">${esc(entry.n)}</b><span class="pz-kind">${kindLabel}</span></header>
    <span class="pz-tags">${esc(entry.tags)}</span>
    <p class="pz-desc">${esc(entry.d)}</p>
    <details class="pz-fx"><summary>ver efeitos</summary><ul>${entry.fx.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>
    ${pool}
    <div class="pz-acts">${acts}</div>
  </article>`;
}

export function fxChips(character, writable, now){
  const list = EN.liveFx(character, now);
  if (!list.length) return "";
  return `<div class="pz-fx-list">${list.map((f) => {
    const bits = [];
    if (f.until) bits.push(`<em class="pz-timer" data-until="${f.until}">${fmtMs(f.until - now)}</em>`);
    if (f.acts != null) bits.push(`<em>${f.acts} ${f.acts === 1 ? "ação" : "ações"}</em>`);
    if (f.hits != null) bits.push(`<em>${f.hits} golpe${f.hits === 1 ? "" : "s"}</em>`);
    if (f.absorb != null) bits.push(`<em>barreira ${f.absorb}</em>`);
    if (f.dr != null) bits.push(`<em>-${f.dr} por golpe</em>`);
    return `<span class="pz-fxchip ${f.bad ? "bad" : "good"}" title="${esc(f.src || "")}">
      <span class="pz-fxl">${esc(f.l)}</span>${bits.join("")}
      ${writable && f.acts != null ? `<button class="btn-mini" data-fx-act="${f.id}" title="gastar 1 ação">-1</button>` : ""}
      ${writable ? `<button class="btn-mini" data-fx-del="${f.id}" title="remover">✕</button>` : ""}
    </span>`;
  }).join("")}</div>`;
}

// seções específicas do sistema (substituem "necessidades" e "perfil")
export function percySections(character){
  const now = Date.now();
  const writable = canWrite(character);
  const god = godOf(character);
  if (!god) {
    return `<section class="sheet-section pz-section">
      ${sectionTitle("shield", "parente divino")}
      <p class="pz-empty">Esta ficha ainda não tem um parente divino.${ctx.isMine(character) ? " Clique em ✎ no topo da ficha para escolher o seu." : " O dono da ficha precisa escolher um."}</p>
    </section>${drachmasHtml(character)}`;
  }
  const pre = (kind, entry) => entryCard(character, kind, entry, writable, now);
  const gift = god.gifts.find((g) => g.id === character.percy.gift);
  return `
    <section class="sheet-section pz-section">
      ${sectionTitle("shield", "parente divino")}
      <div class="pz-god">
        <span class="pz-medal">${god.ico}</span>
        <div><b class="pz-god-name">${esc(god.n)}</b><small>${esc(god.tit)} · ${esc(god.dom)}</small></div>
      </div>
      <div class="pz-personality"><span class="trait-chip-label">${icon("user")} personalidade</span><p>${esc(character.personality || "—")}</p></div>
    </section>
    <section class="sheet-section pz-section">
      ${sectionTitle("vigor", "poderes")}
      <div class="pz-cards">${god.powers.map((p) => pre("comum", p)).join("")}${pre("ultimate", god.ult)}</div>
    </section>
    <section class="sheet-section pz-section">
      ${sectionTitle("shield", "presente divino")}
      <div class="pz-cards">${gift ? pre("presente", gift) : `<p class="pz-empty">presente não encontrado.</p>`}</div>
    </section>
    <section class="sheet-section pz-section">
      ${sectionTitle("dice", "combate")}
      <div class="pz-acts pz-punch"><div class="pz-act-row"><button class="pz-act" data-pact="punch|punch|punch" ${writable ? "" : "disabled"}>👊 Soco<small>1d4 + Força</small></button></div>
      <span class="pz-hint">armas, armaduras e objetos mágicos ficam no inventário.</span></div>
    </section>
    ${fxChips(character, writable, now) ? `<section class="sheet-section pz-section">${sectionTitle("activity", "efeitos ativos")}${fxChips(character, writable, now)}</section>` : ""}
    ${drachmasHtml(character)}`;
}

function drachmasHtml(character){
  const n = character.drachmas || 0;
  const narrator = ctx.isNarrator();
  return `<section class="sheet-section pz-drachmas">
    <div class="pz-coin"><span class="pz-coin-ico">🪙</span><span class="pz-coin-label">Dracmas de Ouro</span><b class="pz-coin-n">${n}</b></div>
    ${narrator ? `<div class="pz-coin-edit"><input type="number" class="damage-input" min="0" data-drachma-input value="${n}"><button class="btn-mini" data-drachma-set>definir</button></div>` : ""}
  </section>`;
}

// bônus/penalidade de efeitos ao lado do atributo
export function attrBadge(character, key){
  if (!isPercy(ctx.campaign())) return "";
  const m = EN.fxMod(character, key);
  return m ? `<span class="pz-mod ${m > 0 ? "up" : "down"}" title="efeitos ativos">${m > 0 ? "+" : ""}${m}</span>` : "";
}
export const attrBonusOf = (character, key) => (isPercy(ctx.campaign()) ? EN.fxMod(character, key) : 0);

// ---------- itens do inventário ----------
export function itemMeta(item){
  const parts = [];
  if (item.atk) parts.push(`${esc(item.atk.dmg)} · ${attrLabel(item.atk.attr)} · ${item.atk.range === "ranged" ? "à distância" : "corpo a corpo"}`);
  if (item.def) parts.push(item.def.broken ? "💥 quebrado" : `absorve ${item.def.absorb} por golpe · durabilidade ${item.def.hp}/${item.def.hpMax}${item.def.equipped ? " · equipado" : ""}`);
  if (item.mg) parts.push(`✨ ${esc(item.mg.text)}${item.mg.dmg ? ` · ${esc(item.mg.dmg)}` : ""}`);
  return parts.length ? `<span class="pz-item-meta">${parts.join("<br>")}</span>` : "";
}
const attrLabel = EN.attrLabel;

export function itemActions(item, character){
  if (!isPercy(ctx.campaign()) || !canWrite(character)) return "";
  const out = [];
  if (item.atk) out.push(`<button class="btn-mini pz-use" data-pitem-use="${item.id}">⚔ atacar</button>`);
  if (item.mg) out.push(`<button class="btn-mini pz-use" data-pitem-use="${item.id}">✨ usar</button>`);
  if (item.def && !item.def.broken) out.push(`<button class="btn-mini" data-pitem-equip="${item.id}">${item.def.equipped ? "tirar" : "equipar"}</button>`);
  if (item.def && ctx.isNarrator() && (item.def.broken || item.def.hp < item.def.hpMax)) out.push(`<button class="btn-mini" data-pitem-repair="${item.id}">reparar</button>`);
  return out.join("");
}

// controles extras do narrador
export function narratorControls(character){
  return `<div class="damage-tool"><span class="damage-tool-label">poderes e presentes</span>
    <button class="btn-mini" data-pcd-all>↺ recarregar tudo</button></div>`;
}

// ============================================================
// ligação dos botões da ficha
// ============================================================
export function bindCard(card, character){
  card.querySelectorAll("[data-pact]").forEach((b) => b.addEventListener("click", () => {
    const [kind, entryId, actId] = b.dataset.pact.split("|");
    openAction(fresh(character), kind, entryId, actId);
  }));
  card.querySelectorAll("[data-pitem-use]").forEach((b) => b.addEventListener("click", () => {
    openAction(fresh(character), "item", b.dataset.pitemUse, "use");
  }));
  const mut = (fn) => ctx.api.mutateCharacter(ctx.campaign().id, character.id, fn).catch((e) => console.error("percy:", e));
  card.querySelectorAll("[data-pcd-reset]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.pcdReset; mut((d) => { const c = { ...(d.cds || {}) }; delete c[k]; return { cds: c }; });
  }));
  const all = card.querySelector("[data-pcd-all]");
  if (all) all.addEventListener("click", () => { mut(() => ({ cds: {} })); ctx.log("↺", `<b>${esc(ctx.handle())}</b> recarregou os poderes de <b>${esc(character.fullName)}</b>.`); });
  card.querySelectorAll("[data-fx-del]").forEach((b) => b.addEventListener("click", () => mut((d) => ({ fx: (d.fx || []).filter((f) => f.id !== b.dataset.fxDel) }))));
  card.querySelectorAll("[data-fx-act]").forEach((b) => b.addEventListener("click", () => mut((d) => ({
    fx: EN.pruneFx({ fx: (d.fx || []).map((f) => f.id === b.dataset.fxAct ? { ...f, acts: (f.acts || 1) - 1 } : f) }).fx
  }))));
  card.querySelectorAll("[data-pitem-equip]").forEach((b) => b.addEventListener("click", () => mut((d) => ({
    items: (d.items || []).map((i) => i.id === b.dataset.pitemEquip ? { ...i, def: { ...i.def, equipped: !i.def.equipped } } : i)
  }))));
  card.querySelectorAll("[data-pitem-repair]").forEach((b) => b.addEventListener("click", () => mut((d) => ({
    items: (d.items || []).map((i) => i.id === b.dataset.pitemRepair ? { ...i, def: { ...i.def, hp: i.def.hpMax, broken: false } } : i)
  }))));
  const set = card.querySelector("[data-drachma-set]");
  if (set) set.addEventListener("click", () => {
    const v = parseInt(card.querySelector("[data-drachma-input]").value, 10);
    if (!Number.isFinite(v) || v < 0) return;
    const old = character.drachmas || 0;
    mut(() => ({ drachmas: v }));
    ctx.log("🪙", `<b>${esc(ctx.handle())}</b> ajustou os dracmas de <b>${esc(character.fullName)}</b>: ${old} → ${v}.`);
  });
}

// ============================================================
// modal de uso (poder, presente, soco, arma, objeto mágico)
// ============================================================
let modalEl = null;
function ensureModal(){
  if (modalEl) return modalEl;
  modalEl = document.createElement("div");
  modalEl.className = "modal-overlay hidden pz-modal";
  modalEl.addEventListener("click", (e) => { if (e.target === modalEl) closeModal(); });
  document.body.appendChild(modalEl);
  return modalEl;
}
const closeModal = () => { if (modalEl) { modalEl.classList.add("hidden"); modalEl.innerHTML = ""; } };

export function monsterAct(atk){
  const act = { id: atk.id, l: atk.name, t: atk.attr || "forca", foe: atk.targets || 1 };
  if (atk.dmg) { act.dmg = atk.dmg; act[atk.range === "ranged" ? "ranged" : "melee"] = true; }
  if (atk.rs) act.rs = { a: atk.rs, vs: "dc" };
  if (atk.fx && atk.fx.l) {
    const f = atk.fx;
    act.ap = [{ l: f.l, bad: 1, ...(f.min ? { min: f.min } : {}), ...(f.acts ? { acts: f.acts } : {}), ...(f.m ? { m: f.m } : {}) }];
  }
  if (!atk.dmg && !(atk.fx && atk.fx.l)) act.note = true;
  return act;
}

function resolveAction(character, kind, entryId, actId){
  if (kind === "mon") {
    const atk = (character.attacks || []).find((a) => a.id === actId);
    if (!atk) return null;
    const act = monsterAct(atk);
    act.l = "ataque";
    return { entry: { id: `mon:${character.id}`, n: atk.name, tags: "Monstro", d: "", fx: [], acts: [act] }, act, label: atk.name };
  }
  if (kind === "punch") return { entry: { id: "punch", n: "Soco", tags: "Combate", d: "", fx: [], acts: [EN.PUNCH] }, act: EN.PUNCH, label: "Soco" };
  if (kind === "item") {
    const it = (character.items || []).find((i) => i.id === entryId);
    if (!it) return null;
    const entry = { id: `item:${it.id}`, n: it.name, tags: "Item", d: it.description || "", fx: [], acts: [] };
    let act;
    if (it.atk) act = { id: "use", l: `Atacar com ${it.name}`, t: it.atk.attr, [it.atk.range === "ranged" ? "ranged" : "melee"]: true, foe: 1, dmg: it.atk.dmg };
    else act = { id: "use", l: `Usar ${it.name}`, t: it.mg && it.mg.attr || undefined, foe: it.mg && it.mg.dmg ? 1 : 0, dmg: it.mg && it.mg.dmg || undefined, note: !(it.mg && it.mg.dmg) };
    entry.acts = [act];
    return { entry, act, label: act.l, item: it };
  }
  const god = godOf(character);
  const found = god && godEntries(god.id).find((e) => e.entry.id === entryId);
  if (!found) return null;
  const act = found.entry.acts.find((a) => a.id === actId);
  return act ? { entry: found.entry, act, label: act.l } : null;
}

export function openAction(character, kind, entryId, actId){
  const r = resolveAction(character, kind, entryId, actId);
  if (!r) return;
  const { entry, act } = r;
  const chars = ctx.characters();
  const mons = monstersNow().filter((m) => m.id !== character.id);
  const all = [...chars, ...mons];
  const now = Date.now();
  const bonus = act.t ? EN.effAttr(character, act.t, now) + (act.tb || 0) + (act.dmg || act.melee || act.ranged ? EN.fxMod(character, "ataque", now) : 0) : 0;
  const disadv = character.isMonster ? false : ctx.disadv(character);
  const lines = [];
  if (act.t) lines.push(`Teste: <b>${attrLabel(act.t)}</b> (${bonus >= 0 ? "+" : ""}${bonus})${disadv ? " — com desvantagem" : ""}`);
  if (act.dmg) lines.push(`Dano: <b>${esc(act.dmg)}</b>${act.melee ? ` + Força (${EN.effAttr(character, "forca", now)})` : ""}${act.dt ? ` ${esc(act.dt)}` : ""} · crítico (20 natural): dano ×${act.ranged ? 3 : 2}`);
  if (act.heal || act.healS) lines.push(`Cura: <b>${esc(act.healS && !act.heal ? act.healS : act.heal)}</b>`);
  if (act.rs) lines.push(`Resistência do alvo: ${attrLabel(act.rs.a)} ${act.rs.vs === "c" ? "contra o seu teste" : "(Normal 10+)"}`);
  if (act.cost) lines.push(`Custo: <b>${act.cost}%</b> de dano para você`);
  const cd = EN.cdLabel(act); if (cd) lines.push(`Recarga: ${cd}`);

  const pick = (name, label, max, withSelf, preSelf) => {
    const list = (name === "ally" ? chars : all).filter((c) => (withSelf || c.id !== character.id));
    if (name === "foe") list.sort((a, b) => (a.id === character.id) - (b.id === character.id));   // você por último
    const rows = list.map((c) => {
      const me = c.id === character.id;
      return `<label class="pz-pick ${isDead(c) ? "dead" : ""}"><input type="checkbox" data-pick="${name}" value="${c.id}" ${me && preSelf ? "checked" : ""} ${isDead(c) ? "disabled" : ""}> <span>${c.isMonster ? `${esc(c.ico || "👹")} ` : ""}${esc(c.fullName)}${me ? " (você)" : ""}</span></label>`;
    }).join("");
    return `<div class="pz-picker"><span class="modal-label">${label} <small>(até ${max})</small></span><div class="pz-pick-list" data-max="${max}" data-name="${name}">${rows || `<em>ninguém disponível</em>`}</div></div>`;
  };
  const showDc = !!act.t;
  const html = `
    <div class="modal-card">
      <div class="terminal-bar"><div class="terminal-dots"><span></span><span></span><span></span></div>
        <span class="terminal-title">/bin/usar — ${esc(entry.n)}</span><button class="modal-close" data-pz-close aria-label="Fechar">✕</button></div>
      <div class="modal-body">
        <h3 class="pz-modal-title">${esc(r.label)}</h3>
        <ul class="pz-summary">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
        ${showDc ? `<label class="modal-label">dificuldade (defesa do alvo)</label><select class="modal-select" data-pz-dc>${Object.entries(D20_TESTS).map(([k, t]) => `<option value="${k}">${t.label} (${t.min}+)</option>`).join("")}</select>` : ""}
        ${(act.opt || []).map((o) => `<label class="pz-opt"><input type="checkbox" data-opt="${o.id}"> ${esc(o.l)}</label>`).join("")}
        ${act.foe ? pick("foe", "alvos (quem sofre)", act.foe, true, false) : ""}
        ${act.ally ? pick("ally", "aliados / quem recebe", act.ally, !!act.self, !!act.self) : ""}
        <label class="pz-opt pz-fxopt"><input type="checkbox" data-pz-fx ${fxEnabled() ? "checked" : ""}> efeitos de tela e som</label>
        <p class="modal-error" data-pz-err></p>
        <div class="pz-result" data-pz-result></div>
        <button class="roll-btn" data-pz-go><span class="roll-btn-text">${act.note ? "USAR" : "ROLAR"}</span></button>
      </div>
    </div>`;
  const m = ensureModal();
  m.innerHTML = html;
  m.classList.remove("hidden");
  m.querySelector("[data-pz-close]").addEventListener("click", closeModal);
  m.querySelector("[data-pz-fx]").addEventListener("change", (e) => setFxEnabled(e.target.checked));

  // limite de seleção por lista
  m.querySelectorAll(".pz-pick-list").forEach((list) => {
    const max = parseInt(list.dataset.max, 10);
    const sync = () => {
      const boxes = [...list.querySelectorAll("input[type=checkbox]")];
      const n = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => { if (!b.checked) b.disabled = n >= max || b.closest(".pz-pick").classList.contains("dead"); });
    };
    list.addEventListener("change", sync); sync();
  });

  m.querySelector("[data-pz-go]").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    const errEl = m.querySelector("[data-pz-err]");
    const ids = (name) => [...m.querySelectorAll(`input[data-pick="${name}"]:checked`)].map((b) => b.value);
    const foes = ids("foe").map((id) => all.find((c) => c.id === id)).filter(Boolean);
    const allies = ids("ally").map((id) => chars.find((c) => c.id === id)).filter(Boolean);
    if (act.dmg && !foes.length) { errEl.textContent = "escolha pelo menos um alvo para o ataque."; return; }
    if ((act.heal || act.healS) && !allies.length) { errEl.textContent = "escolha quem vai receber a cura."; return; }
    const opts = {}; m.querySelectorAll("[data-opt]").forEach((b) => { opts[b.dataset.opt] = b.checked; });
    const dcSel = m.querySelector("[data-pz-dc]");
    btn.disabled = true; errEl.textContent = "";
    try {
      const resultHtml = await execute({ character: fresh(character), kind, entry, act, foes, allies, dcKey: dcSel ? dcSel.value : "normal", opts });
      m.querySelector("[data-pz-result]").innerHTML = resultHtml;
      const fresh2 = btn.cloneNode(true);
      fresh2.querySelector(".roll-btn-text").textContent = "FECHAR";
      fresh2.disabled = false;
      fresh2.addEventListener("click", closeModal);
      btn.replaceWith(fresh2);
    } catch (err) {
      console.error("Falha ao usar a ação:", err);
      errEl.textContent = ctx.describeError(err, "erro ao executar.");
      btn.disabled = false;
    }
  });
}

// ---------- execução: rola, entrega e registra ----------
async function execute({ character, kind, entry, act, foes, allies, dcKey, opts }){
  const cid = ctx.campaign().id;
  const now = Date.now();
  const plan = EN.planAction({ caster: character, foes, allies, entry, act, dcKey, opts, disadv: character.isMonster ? false : ctx.disadv(character), now });
  const who = `<b>${esc(character.fullName)}</b>`;

  // efeitos de tela e som: um por deus; ultimate e 20 natural ocupam a tela inteira
  const godFx = (kind === "comum" || kind === "ultimate" || kind === "presente") ? godOf(character) : null;
  if (!plan.failed) playFx({ god: godFx, monster: kind === "mon", kind: kind === "ultimate" ? "ultimate" : "power", crit: plan.crit, title: entry.n });
  else if (plan.crit) playFx({ crit: true });
  const rows = [];
  const logs = [];

  // frase de invocação: uma linha de narração para o histórico e para o resultado
  let narr = "";
  const godN = godOf(character);
  if (plan.failed) narr = randomLine(FAIL_LINES);
  else if (kind === "punch") narr = randomLine(PUNCH_LINES);
  else if (kind === "mon") narr = randomLine(MONSTER_LINES(character.fullName, entry.n));
  else if (kind === "item") {
    const it = (character.items || []).find((i) => `item:${i.id}` === entry.id);
    narr = randomLine(it && it.atk ? WEAPON_LINES(entry.n, it.atk.range === "ranged") : MAGIC_ITEM_LINES(entry.n));
  } else if (godN) narr = lineFor(godN.id, entry.id, act.id) || entry.d || "";
  if (plan.crit && !plan.failed) narr = `${narr} ${randomLine(CRIT_LINES)}`.trim();
  const narrHtml = narr ? `<span class="pz-narr">“${esc(narr)}”</span>` : "";
  if (narr) rows.push(`<div class="pz-narr-line">“${esc(narr)}”</div>`);

  if (plan.test) rows.push(`<div class="pz-line pz-test ${plan.failed ? "fail" : "ok"}${plan.crit ? " crit" : ""}">${plan.crit ? "★ 20 NATURAL — " : (plan.test.die === 1 ? "1 natural — " : "")}${esc(d20Message(plan.test))}</div>`);
  if (plan.contest != null) rows.push(`<div class="pz-line">Seu total para a contestação: <b>${plan.contest}</b></div>`);
  if (plan.failed) logs.push(`🎲 ${who} tentou <b>${esc(entry.n)}</b> (${esc(act.l)}), mas o teste falhou.${narrHtml ? `<br>${narrHtml}` : ""}`);

  // 1) alvos
  for (const t of plan.targets) {
    const target = fresh(t.target);
    const packet = { dmg: t.dmg ? t.dmg.total : 0, heal: t.heal || 0, stopBleed: !!t.stopBleed, fx: t.fx, src: plan.src };
    const hasEffect = packet.dmg > 0 || packet.heal > 0 || packet.stopBleed || packet.fx.length;
    const bits = [];
    if (t.resist) bits.push(`resistência ${attrLabel(t.resist.attr)}: ${t.resist.total}${t.resist.contest ? ` contra ${t.resist.need - 1}` : ` (precisa ${t.resist.need}+)`} → <b>${t.resisted ? "resistiu" : "falhou"}</b>`);
    if (t.dmg) bits.push(`dano <b>${t.dmg.total}</b> (${esc(t.dmg.text)}${t.dmg.mult > 1 ? ` ×${t.dmg.mult}` : ""})`);
    if (t.heal) bits.push(`cura <b>${t.heal}</b>`);
    if (t.fx.length) bits.push(t.fx.map((f) => esc(f.l)).join("; "));
    const header = `<b>${target.isMonster ? `${esc(target.ico || "👹")} ` : ""}${esc(target.fullName)}</b>`;
    let status = "";
    if (hasEffect) {
      const delivered = await deliver(target, packet, character, entry, act);
      status = delivered.queued ? ` <em class="pz-queued">⏳ aguardando ${ctx.isNarrator() ? "o dono da ficha" : "o narrador ou o dono da ficha"} aplicar</em>` : (delivered.steps && delivered.steps.length ? ` <em>(${delivered.steps.map(esc).join("; ")})</em>` : "");
      logs.push(delivered.log);
    }
    rows.push(`<div class="pz-line">${header}: ${bits.join(" · ") || "sem efeito"}${status}</div>`);
  }

  // 2) o próprio conjurador: recarga, efeitos próprios e custo (atômico)
  const selfFx = plan.selfFx;
  const cost = plan.failed ? 0 : plan.cost;
  let selfMsg = "";
  await mutateT(character, (data) => {
    const t0 = Date.now();
    const patch = { cds: EN.startCd(data.cds, entry, act, t0) };
    if (entry.id === "punch" || String(entry.id).startsWith("item:") || String(entry.id).startsWith("mon:")) delete patch.cds;
    const fx = EN.liveFx(data, t0).concat(plan.failed ? [] : selfFx);
    if (selfFx.length && !plan.failed) patch.fx = fx;
    if (cost) {
      const max = maxDamageOf(data), nd = (data.damage || 0) + cost;
      if (nd >= max) { patch.damage = Math.max(0, max - 1); patch.fx = (patch.fx || fx).concat([EN.makeFx({ l: "Inconsciente (custo do poder)", bad: 1 }, entry.n, t0)]); selfMsg = ` — ficou <b>inconsciente</b> pelo custo`; }
      else { patch.damage = nd; selfMsg = ` — pagou ${cost}% de dano`; }
    }
    return patch;
  });
  if (!plan.failed) {
    selfFx.forEach((f) => rows.push(`<div class="pz-line good">Você ganhou: ${esc(f.l)}</div>`));
    if (cost) rows.push(`<div class="pz-line">Custo: ${cost}% de dano${selfMsg.includes("inconsciente") ? " — <b>inconsciente</b>" : ""}</div>`);
    if (act.note) rows.push(`<div class="pz-line">Efeito narrativo: o narrador resolve conforme a descrição do poder.</div>`);
    if (!plan.targets.length && !selfFx.length && !act.note) rows.push(`<div class="pz-line">Registrado.</div>`);
  }
  if (!plan.failed) logs.unshift(`${kind === "ultimate" ? "⚡" : kind === "presente" ? "🎁" : "✨"} ${who} usou <b>${esc(entry.n)}</b> — ${esc(act.l)}${plan.test ? ` (${esc(d20Message(plan.test))}${plan.crit ? " ★ 20 natural" : ""})` : ""}${selfMsg}.${narrHtml ? `<br>${narrHtml}` : ""}`);
  logs.forEach((l) => { const m = l.match(/^(\S+)\s+([\s\S]*)$/); ctx.log(m ? m[1] : "🎲", m ? m[2] : l); });
  return rows.join("");
}

// entrega a um alvo: direto se tiver permissão, senão pela fila de hits
async function deliver(target, packet, caster, entry, act){
  const cid = ctx.campaign().id;
  const tname = `<b>${esc(target.fullName)}</b>`;
  if (canWrite(target)) {
    let res = null;
    await mutateT(target, (data) => { res = EN.applyPacket(data, { ...packet }, Date.now()); return res.patch; });
    return { queued: false, steps: res.steps, log: describeApplied(tname, packet, res, "", !!target.isMonster) };
  }
  await ctx.api.createHit(cid, {
    targetId: target.id, targetKind: target.isMonster ? "monster" : "character", targetName: target.fullName, byName: caster.fullName, byHandle: ctx.handle(),
    src: packet.src, packet: { dmg: packet.dmg, heal: packet.heal, stopBleed: packet.stopBleed, fx: packet.fx, src: packet.src },
  });
  return { queued: true, log: `⏳ ${tname} vai sofrer/receber os efeitos de <b>${esc(packet.src)}</b> (de <b>${esc(caster.fullName)}</b>) — aguardando aplicação.` };
}

function describeApplied(tname, packet, res, via, mon){
  const bits = [];
  // monstros: sem % nem vida restante (o narrador decide o que o grupo sabe)
  if (packet.dmg > 0) bits.push(mon ? `sofreu <b>${packet.dmg - (res.absorbed || 0)}</b> de dano${res.absorbed ? ` (${res.absorbed} absorvido)` : ""}` : `sofreu <b>${packet.dmg - (res.absorbed || 0)}%</b> de dano${res.absorbed ? ` (${res.absorbed} absorvido)` : ""} — agora em ${res.after}%`);
  if (packet.heal > 0) bits.push(mon ? `se recuperou` : `recuperou <b>${Math.min(packet.heal, res.before)}%</b> de dano — agora em ${res.after}%`);
  if (packet.stopBleed) bits.push("teve o sangramento estancado");
  if (packet.fx && packet.fx.length) bits.push(`recebeu: ${packet.fx.map((f) => esc(f.l)).join("; ")}`);
  const dead = res.after >= res.max && res.before < res.max ? (mon ? " ☠️ foi derrotado!" : " ☠️ morreu.") : "";
  return `${packet.dmg > 0 ? "🩸" : "💚"} ${tname}: ${bits.join(", ")}${via ? ` <small>(${via})</small>` : ""}${dead}`;
}

// ============================================================
// fila de hits (ataques entre fichas) e passagem do tempo
// ============================================================
export function onHits(hits){
  if (!ctx || !isPercy(ctx.campaign())) return;
  (hits || []).filter((h) => !h.applied && !inflight.has(h.id)).forEach((h) => {
    const target = allTargets().find((c) => c.id === h.targetId);
    if (!target || !canWrite(target)) return;
    inflight.add(h.id);
    let res = null;
    ctx.api.applyHit(ctx.campaign().id, h.id, h.targetId, (data, hit) => { res = EN.applyPacket(data, { ...hit.packet }, Date.now()); return res.patch; }, h.targetKind === "monster" ? "monster" : undefined)
      .then((done) => { if (done && res) { const l = describeApplied(`<b>${target.isMonster ? `${esc(target.ico || "👹")} ` : ""}${esc(target.fullName)}</b>`, h.packet, res, `${esc(h.src || "ataque")} de <b>${esc(h.byName || "?")}</b>`, !!target.isMonster); const m = l.match(/^(\S+)\s+([\s\S]*)$/); ctx.log(m[1], m[2]); } })
      .catch((e) => console.error("percy hit:", e))
      .finally(() => inflight.delete(h.id));
  });
}

let refreshTimer = null;
const pruning = new Set();
function tick(){
  if (!ctx) return;
  const camp = ctx.campaign();
  if (!isPercy(camp)) return;
  const now = Date.now();
  let expired = false;
  document.querySelectorAll("[data-until]").forEach((el) => {
    const u = parseInt(el.dataset.until, 10);
    if (u <= now) expired = true; else el.textContent = fmtMs(u - now);
  });
  allTargets().forEach((c) => {
    if (!canWrite(c) || pruning.has(c.id)) return;
    const r = EN.pruneFx(c, now);
    if (!r.changed) return;
    pruning.add(c.id);
    ctx.api.mutateCharacter(camp.id, c.id, (data) => {
      const p = EN.pruneFx(data, Date.now());
      if (!p.changed) return null;
      const patch = { fx: p.fx };
      if (p.endDmg) patch.damage = Math.min(maxDamageOf(data), (data.damage || 0) + p.endDmg);
      return patch;
    }, kindOf(c)).then(() => { if (r.endDmg) ctx.log("🩸", `<b>${esc(c.fullName)}</b> sofreu <b>${r.endDmg}%</b> de dano pelo fim de <b>${esc(r.gone.find((f) => f.end).l)}</b>.`); })
      .catch((e) => console.error("percy prune:", e)).finally(() => pruning.delete(c.id));
  });
  if (expired && !refreshTimer) refreshTimer = setTimeout(() => { refreshTimer = null; ctx.refresh(); }, 400);
}


// ---------- cena de reivindicação (escuro, símbolo brilhando, nome e poderes um a um) ----------
export function playClaimScene(godId, giftId){
  const god = GOD_BY_ID[godId];
  const gift = god && god.gifts.find((g) => g.id === giftId);
  if (!god) return Promise.resolve();
  return new Promise((resolve) => {
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = [
      ...god.powers.map((p) => ({ k: "Poder comum", e: p })),
      { k: "Ultimate", e: god.ult },
      ...(gift ? [{ k: "Presente divino", e: gift }] : []),
    ];
    const el = document.createElement("div");
    el.className = "pz-claim";
    el.style.setProperty("--god", god.color);
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", `Reivindicação por ${god.n}`);
    el.innerHTML = `
      <div class="pz-claim-light"></div>
      <button type="button" class="pz-claim-skip">pular</button>
      <div class="pz-claim-stage">
        <p class="pz-claim-omen">Um sinal surge sobre a sua cabeça...</p>
        <div class="pz-claim-sym">${god.ico}</div>
        <p class="pz-claim-lead">Você foi reivindicado por</p>
        <h2 class="pz-claim-name">${esc(god.n)}</h2>
        <p class="pz-claim-title">${esc(god.tit)} · ${esc(god.dom)}</p>
        <div class="pz-claim-powers">${items.map((it) => `<div class="pz-claim-pw"><span>${it.k}</span><b>${esc(it.e.n)}</b><small>${esc(it.e.tags)}</small></div>`).join("")}</div>
        <button type="button" class="roll-btn pz-claim-go"><span class="roll-btn-text">CONTINUAR</span></button>
      </div>`;
    document.body.appendChild(el);

    const q = (sel) => el.querySelector(sel);
    const timers = [];
    let finished = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, reduce ? Math.min(ms, 400) : ms));
    const tick = () => { try { import("./sound.js").then((m) => m.playDiceTick()).catch(() => {}); } catch { /* sem som */ } };
    const on = (sel, cls = "on") => { const n = q(sel); if (n) n.classList.add(cls); };
    const showAll = () => {
      timers.forEach(clearTimeout);
      el.classList.add("on");
      ["sym", "lead", "name", "title"].forEach((n) => on(`.pz-claim-${n}`));
      q(".pz-claim-omen").classList.add("off");
      el.querySelectorAll(".pz-claim-pw").forEach((n) => n.classList.add("on"));
      q(".pz-claim-go").classList.add("on");
      q(".pz-claim-skip").hidden = true;
    };
    const close = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey);
      el.classList.add("out");
      setTimeout(() => { el.remove(); resolve(); }, reduce ? 0 : 500);
    };
    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") { if (q(".pz-claim-go").classList.contains("on")) close(); else showAll(); } };
    document.addEventListener("keydown", onKey);
    q(".pz-claim-skip").addEventListener("click", showAll);
    q(".pz-claim-go").addEventListener("click", close);

    requestAnimationFrame(() => el.classList.add("on"));                        // a tela escurece
    at(700, () => on(".pz-claim-omen"));
    at(2600, () => { q(".pz-claim-omen").classList.add("off"); on(".pz-claim-sym"); tick(); });   // o símbolo brilha
    at(4600, () => on(".pz-claim-lead"));
    at(5400, () => { on(".pz-claim-name"); tick(); });                          // o nome do deus
    at(6400, () => on(".pz-claim-title"));
    items.forEach((_, i) => at(7600 + i * 1100, () => { el.querySelectorAll(".pz-claim-pw")[i].classList.add("on"); tick(); }));   // poderes, um a um
    at(7600 + items.length * 1100 + 700, () => { on(".pz-claim-go"); q(".pz-claim-skip").hidden = true; });
  });
}

// ============================================================
// criação da ficha: o semideus começa indeterminado e é reivindicado por um parente divino
// ============================================================
export function takenGifts(characters, exceptId){
  const m = {};
  (characters || []).forEach((c) => { if (c.percy && c.percy.gift && c.id !== exceptId) m[giftKey(c.percy.god, c.percy.gift)] = c.fullName; });
  return m;
}

export function mountCharBlock(el, characters, current){
  const taken = takenGifts(characters, current && current.id);
  const already = !!(current && current.percy);                 // ficha que já foi reivindicada
  const sel = { god: already ? current.percy.god : null, gift: already ? current.percy.gift : null };
  let stage = already ? "claimed" : "idle";                     // idle (indeterminado) → choosing → claimed
  el.hidden = false;

  const claimedHtml = () => {
    const g = GOD_BY_ID[sel.god];
    const gf = g.gifts.find((x) => x.id === sel.gift);
    return `<div class="pz-claimed" style="--god:${g.color}">
      <span class="pz-medal">${g.ico}</span>
      <div><b class="pz-god-name">${esc(g.n)}</b><small>${esc(g.tit)} · reivindicado</small>
        <span class="pz-claimed-gift">presente divino: <b>${esc(gf ? gf.n : "?")}</b></span></div>
      <button type="button" class="btn-mini" data-replay>rever a cena</button>
    </div>`;
  };

  const draw = () => {
    if (stage === "idle") {
      el.innerHTML = `<span class="modal-label">parente divino</span>
        <div class="pz-unknown">
          <span class="pz-medal unknown">?</span>
          <div><b>Semideus indeterminado</b><small>Seu pai ou mãe divino ainda não o reivindicou. Quando o sinal vier, os deuses do Olimpo se revelam.</small></div>
        </div>
        <button type="button" class="roll-btn small-btn pz-wait" data-reveal><span class="roll-btn-text">AGUARDAR O SINAL</span></button>`;
      el.querySelector("[data-reveal]").addEventListener("click", () => { stage = "choosing"; draw(); });
      return;
    }
    if (stage === "claimed") {
      el.innerHTML = `<span class="modal-label">parente divino</span>${claimedHtml()}`;
      el.querySelector("[data-replay]").addEventListener("click", () => playClaimScene(sel.god, sel.gift));
      return;
    }
    const g = sel.god ? GOD_BY_ID[sel.god] : null;
    el.innerHTML = `
      <span class="modal-label">quem o reivindica? escolha o seu pai ou mãe divino</span>
      <div class="pz-gods">${GODS.map((x) => `<button type="button" class="pz-godbtn ${sel.god === x.id ? "on" : ""}" style="--god:${x.color}" data-god="${x.id}">
        <span class="pz-medal">${x.ico}</span><b>${esc(x.n)}</b></button>`).join("")}</div>
      ${g ? `<div class="pz-godinfo" style="--god:${g.color}">
        <b>${esc(g.n)}</b> — ${esc(g.tit)}<small>${esc(g.dom)}</small>
        <ul><li><b>Poderes comuns:</b> ${g.powers.map((p) => esc(p.n)).join(" · ")}</li><li><b>Ultimate:</b> ${esc(g.ult.n)}</li></ul>
        <span class="modal-label">presente divino (apenas um por ficha — nenhum outro semideus da campanha poderá tê-lo)</span>
        <div class="pz-gifts">${g.gifts.map((gf) => {
          const by = taken[giftKey(g.id, gf.id)];
          return `<button type="button" class="pz-giftbtn ${sel.gift === gf.id ? "on" : ""}" data-gift="${gf.id}" ${by ? "disabled" : ""}>
            <b>${esc(gf.n)}</b><small>${esc(gf.tags)}</small><span>${esc(gf.d)}</span>${by ? `<em>já reservado por ${esc(by)}</em>` : ""}</button>`;
        }).join("")}</div></div>` : `<p class="modal-rules">toque em um deus para conhecer os poderes e presentes dele.</p>`}
      <div class="pz-claim-actions">
        <button type="button" class="btn-mini" data-back>voltar</button>
        <button type="button" class="roll-btn small-btn pz-confirm" data-confirm ${sel.god && sel.gift ? "" : "disabled"}><span class="roll-btn-text">CONFIRMAR REIVINDICAÇÃO</span></button>
      </div>
      <p class="modal-rules">a escolha é definitiva: depois de confirmada, não dá para trocar de parente divino.</p>`;
    el.querySelectorAll("[data-god]").forEach((b) => b.addEventListener("click", () => { sel.god = b.dataset.god; sel.gift = null; draw(); }));
    el.querySelectorAll("[data-gift]").forEach((b) => b.addEventListener("click", () => { sel.gift = b.dataset.gift; draw(); }));
    el.querySelector("[data-back]").addEventListener("click", () => { stage = "idle"; sel.god = null; sel.gift = null; draw(); });
    el.querySelector("[data-confirm]").addEventListener("click", async () => {
      if (!(sel.god && sel.gift)) return;
      await playClaimScene(sel.god, sel.gift);
      stage = "claimed";
      draw();
    });
  };
  draw();
  return {
    get: () => ({ god: sel.god, gift: sel.gift }),
    validate: () => (stage !== "claimed" ? "aguarde o sinal e confirme a reivindicação do seu parente divino." : ""),
    locked: already,
  };
}

// ============================================================
// campos extras do item (arma, armadura/escudo, objeto mágico)
// ============================================================
export function mountItemFields(el){
  el.innerHTML = `
    <div data-pf="arma" hidden>
      <label class="modal-label">atributo do ataque</label>
      <select class="modal-select" data-pf-attr>${ATTRS.map((a) => `<option value="${a.key}">${a.label}</option>`).join("")}</select>
      <label class="modal-label">dado de dano (ex.: 1d6, 1d10+2)</label>
      <div class="modal-input-row"><span class="prompt">&gt;</span><input type="text" class="modal-input" data-pf-dmg maxlength="20" placeholder="1d6"></div>
      <label class="modal-label">tipo</label>
      <select class="modal-select" data-pf-range><option value="melee">corpo a corpo (soma a Força no dano; crítico ×2)</option><option value="ranged">à distância (sem Força; crítico ×3)</option></select>
    </div>
    <div data-pf="defesa" hidden>
      <label class="modal-label">absorve por golpe</label>
      <div class="modal-input-row"><span class="prompt">&gt;</span><input type="number" class="modal-input" data-pf-absorb min="1" value="3"></div>
      <label class="modal-label">durabilidade total (quebra ao chegar a zero)</label>
      <div class="modal-input-row"><span class="prompt">&gt;</span><input type="number" class="modal-input" data-pf-hp min="1" value="12"></div>
    </div>
    <div data-pf="magico" hidden>
      <label class="modal-label">efeito do objeto mágico</label>
      <textarea class="modal-textarea" data-pf-text maxlength="200" placeholder="o que o objeto faz..."></textarea>
      <label class="modal-label">atributo do teste (opcional)</label>
      <select class="modal-select" data-pf-mattr><option value="">sem teste</option>${ATTRS.map((a) => `<option value="${a.key}">${a.label}</option>`).join("")}</select>
      <label class="modal-label">dado de dano (opcional)</label>
      <div class="modal-input-row"><span class="prompt">&gt;</span><input type="text" class="modal-input" data-pf-mdmg maxlength="20" placeholder="2d6"></div>
    </div>`;
  const q = (s) => el.querySelector(s);
  const okDice = (s) => /^\s*(\d*d\d+|\d+)(\s*\+\s*(\d*d\d+|\d+))*\s*$/i.test(s);
  return {
    show(category){
      q('[data-pf="arma"]').hidden = category !== "arma";
      q('[data-pf="defesa"]').hidden = !(category === "armadura" || category === "escudo");
      q('[data-pf="magico"]').hidden = category !== "magico";
    },
    read(category){
      if (category === "arma") {
        const dmg = q("[data-pf-dmg]").value.trim();
        if (!okDice(dmg)) return { error: "informe o dado de dano da arma (ex.: 1d6)." };
        return { extra: { atk: { attr: q("[data-pf-attr]").value, dmg, range: q("[data-pf-range]").value } } };
      }
      if (category === "armadura" || category === "escudo") {
        const absorb = parseInt(q("[data-pf-absorb]").value, 10), hp = parseInt(q("[data-pf-hp]").value, 10);
        if (!(absorb >= 1) || !(hp >= 1)) return { error: "informe quanto absorve por golpe e a durabilidade (números maiores que zero)." };
        return { extra: { def: { absorb, hp, hpMax: hp, equipped: true, broken: false } } };
      }
      if (category === "magico") {
        const text = q("[data-pf-text]").value.trim();
        if (!text) return { error: "descreva o efeito do objeto mágico." };
        const dmg = q("[data-pf-mdmg]").value.trim();
        if (dmg && !okDice(dmg)) return { error: "dado de dano inválido (ex.: 2d6)." };
        return { extra: { mg: { text, attr: q("[data-pf-mattr]").value || "", dmg } } };
      }
      return { extra: {} };
    },
  };
}
