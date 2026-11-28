// ============================================================
// REVERSE LIFE — sistema Jogos Vorazes (interface da ficha)
// Distrito (1–12, máx. 3 tributos cada) e passiva, localização na arena, infecção, efeitos,
// funções dos itens da Cornucópia (comer, beber, curar, purificar, cozinhar, pescar...) e timers
// (infecção, efeitos agendados). A Cornucópia, os presentes e os eventos ficam em hunger-arena.js.
// ============================================================

import { ATTRS, attrValue, rollD20, d20Message, maxDamageOf, passiveAttrBonus, carryCapacity, itemsCarried } from "./rules.js";
import { DISTRICTS, DISTRICT_BY_N, DISTRICT_MAX_TRIBUTES, REGIONS, CORNUCOPIA, regionLabel, EXTRA_BY_KEY, WEAPONS, SUPPLIES, INFECTION_TICK_DMG, BLACK_HERB_DMG, FIRE_MIN, CATALOG_BY_KEY } from "./hunger-data.js";
import * as HE from "./hunger-engine.js";
import { esc, fxChips, fmtMs } from "./percy.js";
import { icon } from "./icons.js";
import { liveFx, makeFx, effAttr } from "./percy-engine.js";

let ctx = null;
export const getCtx = () => ctx;
const inflight = new Set();

export function initHunger(c){
  ctx = c;
  setInterval(tick, 1000);
}
const camp = () => ctx.campaign();
const active = () => !!(ctx && HE.isHungerCampaign(camp()));
const canAct = (ch) => ctx.isNarrator() || ctx.isMine(ch);
const fresh = (ch) => ctx.characters().find((c) => c.id === ch.id) || ch;
const mutate = (ch, fn) => ctx.api.mutateCharacter(camp().id, ch.id, fn);

export function errMsg(err, fallback = "não foi possível concluir."){
  const m = err && err.message;
  if (m === "INVENTORY_FULL") return "o inventário não tem espaço (limite: 5 + 2 por ponto de Força, +5 com mochila).";
  if (m === "UNIQUE_ITEM") return "este item é único: só pode haver um por inventário.";
  if (m === "SOLD_OUT") return "acabou: alguém reivindicou esse item antes.";
  return ctx.describeError(err, fallback);
}

// ---------- aviso rápido e modal compartilhados ----------
let toastEl = null, toastTimer = null;
export function toast(html){
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "hg-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
  toastEl.innerHTML = html;
  toastEl.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), 5200);
}
let modalEl = null;
export function openModal(inner, cls = ""){
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.className = "modal-overlay hidden hg-modal";
    modalEl.addEventListener("click", (e) => { if (e.target === modalEl) closeModal(); });
    document.body.appendChild(modalEl);
  }
  modalEl.innerHTML = `<div class="modal-card ${cls}">${inner}</div>`;
  modalEl.classList.remove("hidden");
  const x = modalEl.querySelector("[data-hg-close]");
  if (x) x.addEventListener("click", closeModal);
  return modalEl;
}
export function closeModal(){ if (modalEl) { modalEl.classList.add("hidden"); modalEl.innerHTML = ""; } }
export const modalBar = (title) => `<div class="terminal-bar"><div class="terminal-dots"><span></span><span></span><span></span></div><span class="terminal-title">${esc(title)}</span><button class="modal-close" data-hg-close aria-label="Fechar">✕</button></div>`;

// ============================================================
// distrito: cabeçalho de grupo, bloco da ficha e seletor na criação
// ============================================================
export function districtHeaderHtml(n, count){
  const d = DISTRICT_BY_N[n];
  if (!d) return `<header class="hg-dist-head nodist"><span class="hg-dist-medal">?</span><div><b>Sem distrito</b><small>tributos que ainda não escolheram um distrito (use ✎ na ficha)</small></div></header>`;
  return `<header class="hg-dist-head" style="--dist:${d.color}">
    <span class="hg-dist-medal">${d.ico}</span>
    <div class="hg-dist-title"><b>${esc(d.name)} — ${esc(d.sector)}</b><small>passiva: <em>${esc(d.passive.name)}</em> — ${esc(d.passive.text)}</small></div>
    <span class="hg-dist-count ${count >= DISTRICT_MAX_TRIBUTES ? "full" : ""}" title="cada distrito tem no máximo ${DISTRICT_MAX_TRIBUTES} tributos">${count}/${DISTRICT_MAX_TRIBUTES} tributos</span>
  </header>`;
}

export function attrPassiveBadge(character, key){
  if (!active()) return "";
  const n = passiveAttrBonus(character, key);
  return n ? `<span class="pz-mod up hg-pas" title="Passiva do ${esc(DISTRICT_BY_N[character.district].name)}: +${n}">★+${n}</span>` : "";
}

export function mountDistrictBlock(el, getChars, current){
  const chars = () => (typeof getChars === "function" ? getChars() : getChars);
  let sel = current && current.district ? Number(current.district) : null;
  el.hidden = false;
  const draw = () => {
    const d = sel ? DISTRICT_BY_N[sel] : null;
    el.innerHTML = `
      <span class="modal-label">distrito de origem (1 a 12 — no máximo ${DISTRICT_MAX_TRIBUTES} tributos por distrito)</span>
      <div class="hg-dist-grid">${DISTRICTS.map((x) => {
        const used = HE.districtCount(chars(), x.n, current && current.id);
        const full = used >= DISTRICT_MAX_TRIBUTES;
        return `<button type="button" class="hg-dist-btn ${sel === x.n ? "on" : ""}" style="--dist:${x.color}" data-dist="${x.n}" ${full ? "disabled" : ""} title="${esc(x.sector)}">
          <span class="n">${x.ico} ${x.n}</span><small>${esc(x.sector)}</small><em>${used}/${DISTRICT_MAX_TRIBUTES}</em></button>`;
      }).join("")}</div>
      ${d ? `<div class="hg-dist-info" style="--dist:${d.color}">
        <b>${d.ico} ${esc(d.name)} — ${esc(d.sector)}</b>
        <p>${esc(d.lore)}</p>
        <div class="hg-passive"><span>PASSIVA</span><b>${esc(d.passive.name)}</b><small>${esc(d.passive.text)}</small></div>
      </div>` : `<p class="modal-rules">toque em um distrito para conhecer sua história e a passiva que ele dá ao tributo.</p>`}`;
    el.querySelectorAll("[data-dist]").forEach((b) => b.addEventListener("click", () => { sel = Number(b.dataset.dist); draw(); }));
  };
  draw();
  return {
    get: () => sel,
    validate: () => {
      if (!sel) return "escolha o distrito do tributo.";
      if (HE.districtFull(chars(), sel, current && current.id)) return `o Distrito ${sel} já tem ${DISTRICT_MAX_TRIBUTES} tributos.`;
      return "";
    },
  };
}

// ============================================================
// seções da ficha
// ============================================================
const sectionTitle = (ico, text) => `<div class="section-title">${icon(ico)}<span>${text}</span></div>`;

export function hungerSections(character){
  const d = HE.districtOf(character);
  const now = Date.now();
  const writable = canAct(character);
  const loc = character.region || "";
  return `
    ${d ? `<details class="hg-lore hg-lore-sec" style="--dist:${d.color}"><summary>📜 história do ${esc(d.name)}</summary><p>${esc(d.lore)}</p></details>`
        : `<section class="sheet-section hg-section"><p class="pz-empty">Este tributo ainda não tem distrito.${ctx.isMine(character) ? " Clique em ✎ no topo da ficha para escolher." : " O dono da ficha precisa escolher um."}</p></section>`}
    <section class="sheet-section hg-section">
      ${sectionTitle("activity", "posição na arena")}
      <div class="hg-loc-row">
        <label class="modal-label" for="loc_${character.id}">onde está</label>
        <select class="modal-select hg-loc" id="loc_${character.id}" data-hg-loc ${writable ? "" : "disabled"}>
          <option value="">— não informado —</option>
          <option value="cornucopia" ${loc === "cornucopia" ? "selected" : ""}>🏺 Cornucópia</option>
          ${REGIONS.map((r) => `<option value="${r.id}" ${loc === r.id ? "selected" : ""}>🧭 ${r.label}</option>`).join("")}
        </select>
      </div>
      <p class="hg-hint">Os eventos da arena atingem uma região inteira: o narrador vê quem está nela.</p>
    </section>
    <section class="sheet-section hg-section">
      ${sectionTitle("dice", "combate")}
      <div class="pz-acts pz-punch"><div class="pz-act-row"><button class="pz-act" data-pact="punch|punch|punch" ${writable ? "" : "disabled"}>👊 Soco<small>1d4 + Força</small></button></div>
      <span class="pz-hint">armas e escudos ficam no inventário: toque em ⚔ atacar e escolha o alvo (tributos ou Ameaças). O resultado é aplicado na hora.</span></div>
    </section>`;
}

// ---------- informações e botões dos itens ----------
export function hungerItemMeta(item){
  const chips = [];
  const chip = (cls, html, title) => chips.push(`<span class="item-tag ${cls}"${title ? ` title="${esc(title)}"` : ""}>${html}</span>`);
  if (item.usesMax > 1) chip("", `🔸 ${item.uses ?? item.usesMax}/${item.usesMax} usos`);
  const t = HE.fnOf(item) && HE.fnOf(item).type;
  if (t === "drink" || t === "eat") {
    if (item.contam) chip("bad", "☣ contaminado · 50% infecção", "a Chuva Escarlate contaminou este item");
    else if (item.safe) chip("good", item.category === "bebida" ? "💧 purificada" : "🍳 cozido", "sem risco de infecção");
    else chip("warn", `⚠ ${HE.INFECTION_CHANCE}% infecção`, "purifique a água ou cozinhe a comida para zerar o risco");
  }
  if (item.capBonus) chip("good", `🎒 +${item.capBonus} espaço`, "vestida: não ocupa lugar no inventário");
  if (item.heal) chip("good", `💉 +${item.heal} HP`);
  return chips.join("");
}

const FN_LABEL = { drink: "beber", eat: "comer", cure: "usar", antiseptic: "aplicar", purify: "purificar água", fire: "acender fogueira", buff: "usar", fish: "pescar", cook: "cozinhar/ferver", fill: "encher", antidote: "tomar antídoto", blackherb: "" };
export function hungerItemActions(item, character){
  if (!active() || !canAct(character)) return "";
  const f = HE.fnOf(item);
  if (!f || !FN_LABEL[f.type] && f.type !== "blackherb") return "";
  if (f.type === "blackherb") {
    return `<button class="btn-mini pz-use" data-hg-black="attack" data-hg-item="${item.id}">🖤 ministrar (10)</button>
            <button class="btn-mini" data-hg-black="coat" data-hg-item="${item.id}">🗡️ passar na arma</button>`;
  }
  return `<button class="btn-mini pz-use" data-hg-use="${item.id}">${FN_LABEL[f.type]}</button>`;
}

export function hungerControls(character){
  if (!active()) return "";
  return `<div class="damage-tool"><span class="damage-tool-label">infecção</span>
    ${character.infection
      ? `<button class="btn-mini" data-hg-infect="stop">curar infecção</button>`
      : `<button class="btn-mini" data-hg-infect="start">🦠 infectar</button>`}
    <span class="damage-tool-label">munição</span>
    <button class="btn-mini" data-hg-reload title="repõe a munição de todas as armas da ficha">↺ repor munição</button></div>`;
}

// ============================================================
// ligação dos botões da ficha
// ============================================================
export function bindHungerCard(card, character){
  const log = (i, t) => ctx.log(i, t);
  const name = () => `<b>${esc(character.fullName)}</b>`;
  const mut = (fn) => mutate(character, fn).catch((e) => { console.error("hunger:", e); toast(`⚠ ${esc(errMsg(e))}`); });

  const loc = card.querySelector("[data-hg-loc]");
  if (loc) loc.addEventListener("change", () => { const v = loc.value; mut(() => ({ region: v })); if (v) log("🧭", `${name()} agora está em <b>${esc(regionLabel(v))}</b>.`); });

  card.querySelectorAll("[data-hg-use]").forEach((b) => b.addEventListener("click", () => useItem(fresh(character), b.dataset.hgUse)));
  card.querySelectorAll("[data-hg-black]").forEach((b) => b.addEventListener("click", () => {
    const ch = fresh(character);
    if (b.dataset.hgBlack === "attack") import("./percy.js").then((P) => P.openAction(ch, "item", b.dataset.hgItem, "use"));
    else coatWeapon(ch, b.dataset.hgItem);
  }));
  card.querySelectorAll("[data-hg-infect]").forEach((b) => b.addEventListener("click", () => {
    const start = b.dataset.hgInfect === "start";
    mut((d) => ({ infection: start ? { startedAt: Date.now(), ticksApplied: 0 } : null }));
    log(start ? "🦠" : "🌺", start ? `${name()} contraiu uma <b>infecção</b> (aplicada pelo narrador).` : `A infecção de ${name()} foi curada (pelo narrador).`);
  }));
  const rl = card.querySelector("[data-hg-reload]");
  if (rl) rl.addEventListener("click", () => {
    mut((d) => ({ items: (d.items || []).map((it) => (it.atk && it.atk.ammo != null ? { ...it, atk: { ...it.atk, ammo: it.atk.ammoMax ?? it.atk.ammo } } : it)) }));
    log("🏹", `${name()} recebeu munição de volta em todas as armas.`);
  });
}

// ============================================================
// funções dos itens
// ============================================================
const MAX_NEED = 3;
const fmtInf = (r) => (r.infected ? `🦠 <b>INFECTADO</b> (${r.roll} ≤ ${r.chance}%)` : `sem infecção (${r.roll} > ${r.chance}%)`);

function pickItem(title, hint, options){
  // devolve uma Promise com o id escolhido (ou null)
  return new Promise((resolve) => {
    const m = openModal(`${modalBar(title)}<div class="modal-body">
      <p class="modal-rules">${hint}</p>
      <select class="modal-select" data-hg-pick>${options.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join("")}</select>
      <p class="modal-error" data-hg-err></p>
      <button class="roll-btn" data-hg-ok><span class="roll-btn-text">CONFIRMAR</span></button></div>`, "hg-pick-card");
    m.querySelector("[data-hg-close]").addEventListener("click", () => resolve(null));
    m.querySelector("[data-hg-ok]").addEventListener("click", () => { const v = m.querySelector("[data-hg-pick]").value; closeModal(); resolve(v); });
  });
}

async function useItem(character, itemId){
  const item = (character.items || []).find((i) => i.id === itemId);
  if (!item) return;
  const f = HE.fnOf(item);
  if (!f) return;
  const now = Date.now();
  const who = `<b>${esc(character.fullName)}</b>`;
  const nm = `<b>${esc(item.name)}</b>`;
  const hunger = character.hunger ?? 3, thirst = character.thirst ?? 3;
  const dmg0 = Math.round(character.damage || 0), max = maxDamageOf(character);
  let msg = null, logIcon = "🎒", out = null;

  try {
    if (f.type === "drink" || f.type === "eat") {
      const sp = HE.spendUse(character.items, itemId);
      const patch = { items: sp.items };
      const bits = [];
      if (f.type === "drink") { patch.thirst = Math.min(MAX_NEED, thirst + f.thirst); bits.push(`sede ${patch.thirst}/3`); logIcon = "💧"; }
      else {
        if (f.hunger) { patch.hunger = Math.min(MAX_NEED, hunger + f.hunger); bits.push(`fome ${patch.hunger}/3`); }
        if (f.thirst) { patch.thirst = Math.max(0, Math.min(MAX_NEED, thirst + f.thirst)); bits.push(`sede ${patch.thirst}/3`); }
        if (f.hp) { patch.damage = Math.max(0, dmg0 - f.hp); bits.push(`+${f.hp} HP`); }
        logIcon = "🍗";
      }
      const r = HE.rollInfection(character, item, now);
      if (r.chance > 0 && !character.infection && r.infected) patch.infection = { startedAt: now, ticksApplied: 0 };
      bits.push(r.chance > 0 ? fmtInf(r) : "sem risco de infecção");
      out = patch;
      msg = `${who} ${f.type === "drink" ? "bebeu" : "comeu"} (${nm}): ${bits.join(" · ")}.`;
    } else if (f.type === "cure") {
      const bleeding = !!character.bleeding;
      const base = item.heal ?? f.heal ?? 0;
      if (!(base > 0 && dmg0 > 0) && !(f.stopBleed && bleeding)) { toast("⚠ Nada para tratar agora (sem dano e sem sangramento)."); return; }
      const heal = base > 0 ? base + HE.healBonus(character) : 0;
      const sp = HE.spendUse(character.items, itemId);
      out = { items: sp.items };
      const bits = [];
      if (heal > 0 && dmg0 > 0) { out.damage = Math.max(0, dmg0 - heal); bits.push(`vida ${dmg0}% → ${out.damage}%${HE.healBonus(character) ? " (bônus do distrito)" : ""}`); }
      if (f.stopBleed && bleeding) { out.bleeding = null; bits.push("sangramento estancado"); }
      logIcon = "💉";
      msg = `${who} usou ${nm}: ${bits.join(", ")}.`;
    } else if (f.type === "antiseptic") {
      const sp = HE.spendUse(character.items, itemId);
      const fx = liveFx(character, now).filter((x) => x.tag !== "antisseptico");
      fx.push({ ...makeFx({ l: "Desinfetado (infecção 15% → 3%)", min: f.min }, item.name, now), tag: "antisseptico" });
      out = { items: sp.items, fx };
      logIcon = "🧴";
      msg = `${who} aplicou ${nm}: por ${f.min} min a chance de infecção cai de 15% para 3% (não cura infecção já instalada).`;
    } else if (f.type === "purify") {
      const waters = (character.items || []).filter((i) => i.category === "bebida" && !i.safe);
      if (!waters.length) { toast("⚠ Não há água crua no inventário para purificar."); return; }
      const id = await pickItem("purificar água", "Escolha a água que receberá a pastilha (a chance de infecção dela cai a 0%).", waters.map((w) => ({ id: w.id, label: `${w.name} (${w.uses ?? w.usesMax ?? 1} usos)` })));
      if (!id) return;
      const cur = fresh(character);
      const tr = HE.transformOne(cur.items, id, { safe: true, contam: false });
      if (!tr) return;
      const sp = HE.spendUse(tr.items, itemId);
      if (!sp) return;
      out = { items: sp.items };
      logIcon = "💧";
      msg = `${who} purificou <b>${esc(tr.item.name)}</b> com uma pastilha — sem risco de infecção.`;
    } else if (f.type === "fire") {
      if (f.test) {
        const r = rollD20("agilidade", effAttr(character, "agilidade", now), "normal", Math.random, ctx.disadv(character));
        if (!r.success) { toast(`🪨 A pederneira não pegou (${esc(d20Message(r))}). Tente de novo.`); log("🪨", `${who} tentou acender uma fogueira com ${nm}, mas a faísca falhou (${esc(d20Message(r))}).`); return; }
      }
      const items = f.test ? character.items : HE.spendUse(character.items, itemId).items;
      const fx = liveFx(character, now).filter((x) => x.tag !== "fogueira");
      fx.push({ ...makeFx({ l: "Fogueira acesa (cozinhar e ferver; denuncia sua posição)", min: FIRE_MIN }, item.name, now), tag: "fogueira" });
      out = { items, fx };
      logIcon = "🔥";
      msg = `${who} acendeu uma <b>fogueira</b> com ${nm} (${FIRE_MIN} min): dá para cozinhar e ferver água — e todos podem ver a fumaça.`;
    } else if (f.type === "buff") {
      const fx = liveFx(character, now).filter((x) => x.tag !== f.fx.tag);
      fx.push({ ...makeFx({ l: f.fx.l, min: f.fx.min, ...(f.fx.m ? { m: f.fx.m } : {}) }, item.name, now), tag: f.fx.tag });
      out = { fx };
      logIcon = "🧥";
      msg = `${who} usou ${nm}: <b>${esc(f.fx.l)}</b> por ${f.fx.min >= 60 ? `${f.fx.min / 60} h` : `${f.fx.min} min`}.`;
    } else if (f.type === "fish") {
      const r = rollD20("agilidade", effAttr(character, "agilidade", now), "normal", Math.random, ctx.disadv(character));
      const sp = HE.spendUse(character.items, itemId);
      let items = sp.items, text;
      if (r.success) {
        const fish = HE.buildItem("peixe");
        try { items = HE.addItemChecked({ ...character, items }, fish); text = `pescou um <b>Peixe</b> (${esc(d20Message(r))})`; }
        catch { text = `pescou um peixe, mas não tinha espaço para carregá-lo (${esc(d20Message(r))})`; }
      } else text = `não pescou nada (${esc(d20Message(r))})`;
      out = { items };
      logIcon = "🎣";
      msg = `${who} usou ${nm} e ${text}. Uma isca foi gasta.`;
    } else if (f.type === "cook") {
      if (!liveFx(character, now).some((x) => x.tag === "fogueira")) { toast("🔥 Acenda uma fogueira primeiro (fósforos ou pederneira)."); return; }
      const targets = (character.items || []).filter((i) => (i.category === "alimento" || i.category === "bebida") && (!i.safe || i.contam));
      if (!targets.length) { toast("⚠ Não há comida ou água para cozinhar/ferver."); return; }
      const id = await pickItem("panela na fogueira", "Escolha o que cozinhar (alimento) ou ferver (água): o risco de infecção vai a 0%.", targets.map((t) => ({ id: t.id, label: `${t.category === "bebida" ? "💧" : "🍗"} ${t.name}${t.contam ? " (contaminado)" : ""}` })));
      if (!id) return;
      const tr = HE.transformOne(fresh(character).items, id, { safe: true, contam: false });
      if (!tr) return;
      out = { items: tr.items };
      logIcon = "🍳";
      msg = `${who} ${tr.item.category === "bebida" ? "ferveu" : "cozinhou"} <b>${esc(tr.item.name)}</b> na panela: sem risco de infecção.`;
    } else if (f.type === "fill") {
      const items = (character.items || []).flatMap((i) => (i.id !== itemId ? [i] : (i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : [])));
      out = { items: HE.addItem(items, HE.buildItem("cantil_cheio")) };
      logIcon = "💧";
      msg = `${who} encheu o cantil numa fonte: <b>Cantil com 1 litro</b> (água crua: ${HE.INFECTION_CHANCE}% de infecção até ser purificada).`;
    } else if (f.type === "antidote") {
      const has = liveFx(character, now).some((x) => x.tag === "veneno" || x.tag === "veneno_leve" || x.tag === "veneno_fruto");
      if (!has) { toast("⚠ Nenhum envenenamento ativo para tratar."); return; }
      const sp = HE.spendUse(character.items, itemId);
      out = { items: sp.items, fx: liveFx(character, now).filter((x) => !["veneno", "veneno_leve", "veneno_fruto"].includes(x.tag)) };
      logIcon = "💉";
      msg = `${who} tomou o <b>Antídoto</b>: o veneno foi neutralizado.`;
    } else return;

    await mutate(character, () => out);
    if (msg) { log_(logIcon, msg); toast(msg); }
  } catch (err) {
    console.error("hunger useItem:", err);
    toast(`⚠ ${esc(errMsg(err))}`);
  }
}
const log_ = (i, t) => ctx.log(i, t);

async function coatWeapon(character, herbId){
  const weapons = (character.items || []).filter((i) => i.atk && !i.atk.coated);
  if (!weapons.length) { toast("⚠ Nenhuma arma disponível (ou todas já estão envenenadas)."); return; }
  const id = await pickItem("passar erva preta na arma", `A arma ganha <b>+1 dado de dano</b> no próximo ataque (uma vez só). A erva é gasta.`, weapons.map((w) => ({ id: w.id, label: `${w.name} (${w.atk.dmg} → ${HE.coatDice(w.atk.dmg)})` })));
  if (!id) return;
  await mutate(character, (d) => {
    const items = (d.items || []).flatMap((i) => {
      if (i.id === herbId) return i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : [];
      if (i.id === id) return [{ ...i, atk: { ...i.atk, coated: true } }];
      return [i];
    });
    return { items };
  });
  const w = weapons.find((x) => x.id === id);
  log_("🖤", `<b>${esc(character.fullName)}</b> passou <b>Erva Preta</b> em <b>${esc(w.name)}</b>: o próximo ataque causa +1 dado de dano.`);
  toast(`🖤 ${esc(w.name)} envenenada: próximo ataque ${esc(HE.coatDice(w.atk.dmg))}.`);
}

// ============================================================
// timers: infecção, efeitos agendados e contagens regressivas
// ============================================================
export function tick(){
  if (!active()) return;
  const now = Date.now();
  updateTimelines(now);
  document.querySelectorAll("[data-hg-next]").forEach((el) => { el.textContent = fmtMs(Math.max(0, parseInt(el.dataset.hgNext, 10) - now)); });
  ctx.characters().forEach((c) => {
    if (!canAct(c) || inflight.has(c.id)) return;
    const hasInf = c.infection && HE.computeInfectionTicks(c, now);
    const hasSched = (c.fx || []).some((f) => f.sched && f.sched.some((e) => e.at <= now));
    if (!hasInf && !hasSched) return;
    inflight.add(c.id);
    let logs = [], extra = [];
    mutate(c, (data) => {
      logs = []; extra = [];
      const t = Date.now();
      const patch = {};
      const w = { ...data };
      const ir = HE.computeInfectionTicks(w, t);
      if (ir) {
        Object.assign(patch, ir.patch); Object.assign(w, ir.patch);
        logs.push({ icon: "🦠", text: `<b>${esc(data.fullName)}</b> perdeu <b>${ir.ticks * INFECTION_TICK_DMG}%</b> pela infecção — agora em ${ir.newDamage}%.` });
        if (ir.newDamage >= ir.max && ir.oldDamage < ir.max) extra.push({ icon: "☠️", text: `<b>${esc(data.fullName)}</b> morreu.` });
      }
      const sr = HE.processSched(w, t);
      if (sr.changed) {
        Object.assign(patch, sr.patch);
        sr.logs.forEach((l) => logs.push(l));
        if (sr.died && !(ir && ir.newDamage >= ir.max)) extra.push({ icon: "☠️", text: `<b>${esc(data.fullName)}</b> morreu.` });
        if (sr.mad) extra.push({ icon: "🌀", text: `<b>${esc(data.fullName)}</b> perdeu o juízo e ficou <b>INSANO</b>.` });
      }
      return Object.keys(patch).length ? patch : null;
    }).then((patch) => { if (patch) [...logs, ...extra].forEach((l) => ctx.log(l.icon, l.text)); })
      .catch((e) => console.error("hunger tick:", e))
      .finally(() => inflight.delete(c.id));
  });
}

// itens: o catálogo ajuda o narrador a adicionar tudo já configurado
export function catalogPresets(){
  const opt = (x) => `<option value="hg:${x.key}">${x.name}</option>`;
  return `<optgroup label="🗡️ Armas da Cornucópia">${WEAPONS.map(opt).join("")}</optgroup>
          <optgroup label="🎒 Suprimentos da Cornucópia">${SUPPLIES.map(opt).join("")}</optgroup>
          <optgroup label="🖤 Outros">${Object.values(EXTRA_BY_KEY).map(opt).join("")}</optgroup>`;
}
export { HE };


// ============================================================
// identidade visual da ficha: selo, faixa do distrito, linha recolhida e painel de status
// ============================================================
const FX_ALERT = [["veneno", "☠", "envenenado"], ["fogo", "🔥", "em chamas"], ["inconsciente", "😵", "inconsciente"], ["preso", "⛓", "preso"], ["asfixia", "😮‍💨", "asfixiado"], ["alucinacao", "👁", "alucinando"], ["afogando", "🌊", "afogando"]];

export function hungerSeal(character){
  const d = HE.districtOf(character);
  return d ? `<span class="hg-seal" style="--dist:${d.color}" title="${esc(d.name)} — ${esc(d.sector)}">${d.ico}<b>${d.n}</b></span>` : "";
}

// faixa no topo da ficha aberta: distrito + passiva em destaque
export function hungerBanner(character){
  const d = HE.districtOf(character);
  if (!d) return "";
  return `<div class="hg-banner" style="--dist:${d.color}">
    <span class="hg-banner-seal">${d.ico}</span>
    <div class="hg-banner-info">
      <small>DISTRITO ${d.n}</small>
      <b>${esc(d.sector)}</b>
    </div>
    <div class="hg-banner-pas"><small>★ PASSIVA</small><b>${esc(d.passive.name)}</b><span>${esc(d.passive.text)}</span></div>
  </div>`;
}

const diceAvg = (dmg) => { const m = /(\d*)d(\d+)/i.exec(String(dmg || "")); return m ? (parseInt(m[1] || "1", 10) * (parseInt(m[2], 10) + 1)) / 2 : 0; };
const shortName = (n) => String(n).replace(/\s*\(.*?\)\s*/g, " ").trim();
export function bestWeapon(items){
  const w = (items || []).filter((i) => i.atk && (i.atk.ammo == null || i.atk.ammo > 0));
  if (!w.length) return (items || []).find((i) => i.atk) || null;
  return w.sort((a, b) => diceAvg(b.atk.dmg) - diceAvg(a.atk.dmg))[0];
}

// linha recolhida: tudo o que o jogador precisa sem abrir a ficha
export function hungerQuickRow({ character, damage, status, sanity, sanityOn, insane, hunger, thirst, bleedNow, disadv, dead }){
  const d = HE.districtOf(character);
  const now = Date.now();
  const live = liveFx(character, now);
  const w = bestWeapon(character.items);
  const shield = (character.items || []).find((i) => i.def && i.def.equipped && !i.def.broken);
  const alerts = [];
  if (bleedNow) alerts.push(["bleed", "🩸", "sangrando"]);
  if (character.infection) alerts.push(["bad", "🦠", "infectado"]);
  if (insane && !dead) alerts.push(["bad", "🌀", "insano"]);
  FX_ALERT.forEach(([tag, ico, label]) => { if (live.some((f) => f.tag === tag || (tag === "veneno" && /^veneno/.test(f.tag || "")))) alerts.push(["bad", ico, label]); });
  const evs = live.filter((f) => f.ev);
  if (evs.length) alerts.push(["ev", "⚡", `em evento (${evs.length})`]);
  if (disadv && !dead) alerts.push(["warn", "⚠", "desvantagem"]);
  const need = (n) => (n <= 0 ? "crit" : (n === 1 ? "low" : ""));
  return `<div class="hg-quick">
    ${d ? `<span class="hg-q dist" style="--dist:${d.color}" title="${esc(d.name)} — ${esc(d.sector)}">${d.ico} D${d.n}</span>` : ""}
    <span class="hg-q hp" style="--c:${status.color}" title="dano acumulado">❤ ${damage}%</span>
    ${sanityOn ? `<span class="hg-q san ${sanity >= 70 ? "bad" : ""}" title="sanidade">🌀 ${sanity}%</span>` : ""}
    <span class="hg-q need ${need(hunger)}" title="fome">🍗 ${hunger}/3</span>
    <span class="hg-q need ${need(thirst)}" title="sede">💧 ${thirst}/3</span>
    ${w ? `<span class="hg-q wpn" title="arma mais forte do inventário">🗡️ ${esc(shortName(w.name))} <em>${esc(w.atk.coated ? HE.coatDice(w.atk.dmg) : w.atk.dmg)}${w.atk.ammo != null ? ` · ${w.atk.ammo}🏹` : ""}</em></span>` : `<span class="hg-q wpn mute" title="sem arma no inventário">✊ desarmado</span>`}
    ${shield ? `<span class="hg-q wpn" title="escudo equipado">🔰 ${esc(shortName(shield.name))}</span>` : ""}
    ${alerts.map(([c, ico, label]) => `<span class="hg-q al ${c}" title="${esc(label)}">${ico} ${esc(label)}</span>`).join("")}
  </div>`;
}

// silhueta do tributo: o "nível" de vida sobe de baixo para cima e a cor muda por estado
export function silhouetteSvg(character, damage, maxDmg, stateKey, dead){
  const d = HE.districtOf(character);
  const remain = dead ? 0 : Math.max(0, Math.min(1, 1 - damage / maxDmg));
  const H = 160, y = H - remain * H;
  const tone = dead ? "#3a3a3a" : ({ normal: (d ? d.color : "#46c27a"), mancando: "#e0a23c", chao: "#d83a3a" }[stateKey] || (d ? d.color : "#46c27a"));
  const id = `sil_${character.id}`;
  return `<svg class="hg-sil-svg" viewBox="0 0 80 160" role="img" aria-label="silhueta: vida restante ${Math.round(remain * 100)}%">
    <defs><clipPath id="${id}"><circle cx="40" cy="16" r="12"/><path d="M24 32 Q40 27 56 32 L62 66 L53 68 L51 94 L58 152 L46 152 L40 112 L34 152 L22 152 L29 94 L27 68 L18 66 Z"/></clipPath></defs>
    <g clip-path="url(#${id})">
      <rect x="0" y="0" width="80" height="160" fill="#0d0d0d"/>
      <rect x="0" y="${y.toFixed(1)}" width="80" height="${(H - y).toFixed(1)}" fill="${tone}" opacity="${dead ? 1 : 0.92}"/>
      ${remain > 0 && remain < 1 ? `<rect x="0" y="${y.toFixed(1)}" width="80" height="2.5" fill="#fff" opacity=".35"/>` : ""}
    </g>
    <path d="M24 32 Q40 27 56 32 L62 66 L53 68 L51 94 L58 152 L46 152 L40 112 L34 152 L22 152 L29 94 L27 68 L18 66 Z" fill="none" stroke="${tone}" stroke-width="1.6"/>
    <circle cx="40" cy="16" r="12" fill="none" stroke="${tone}" stroke-width="1.6"/>
    ${dead ? `<path d="M34 11 l4 4 m0 -4 l-4 4 M42 11 l4 4 m0 -4 l-4 4" stroke="#aaa" stroke-width="1.4"/>` : ""}
  </svg>`;
}

// painel único: silhueta + barras alinhadas (dano, sanidade, fome, sede) + etiquetas de condição
export function hungerStatusPanel(o){
  const { character, damage, maxDmg, status, fillPct, ticksHtml, bodySt, disadv, sanityOn, sanity, insane, hunger, thirst, canEditHT, bleedNow, bleedProg, canEditDamage, fmtCountdown, bleedTicks, stateIconHtml, vigor, dead, htOn, bleedingOn } = o;
  const now = Date.now();
  const writable = canAct(character);
  const seg = (n, cls) => `<div class="hg-seg ${cls}">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;
  const ctrl = (stat) => (canEditHT ? `<span class="hg-ctl"><button class="btn-mini" data-action="ht-dec" data-stat="${stat}">−</button><button class="btn-mini" data-action="ht-inc" data-stat="${stat}">+</button></span>` : "");
  const inf = character.infection;
  const infP = inf ? HE.infectionProgress(inf, now) : null;
  const tags = [];
  if (bleedNow) tags.push(`<span class="hg-tag bleed">🩸 <b>sangrando</b> · termina em <span class="bleed-countdown" data-bleed-start="${bleedNow.startedAt}">${fmtCountdown(bleedProg.msLeft)}</span> · ${bleedProg.appliedTicks}/${bleedTicks}${canEditDamage ? ` <button class="btn-mini" data-action="bleed-stop">parar</button>` : ""}</span>`);
  if (inf) tags.push(`<span class="hg-tag bad" title="só a Erva Vermelha cura">🦠 <b>infectado</b> · −${INFECTION_TICK_DMG}% a cada 30 min · próxima em <b class="hg-next" data-hg-next="${now + infP.msToNext}">${fmtMs(infP.msToNext)}</b></span>`);
  if (insane && !dead) tags.push(`<span class="hg-tag bad">🌀 <b>insano</b></span>`);
  if (disadv && !dead) tags.push(`<span class="hg-tag warn" title="2d20, vale o menor">⚠ <b>desvantagem</b> em todos os testes</span>`);
  const fxHtml = fxChips(character, writable, now, { noSched: true });
  const tlHtml = timelinesHtml(character, writable, now);
  return `<section class="sheet-section vital hg-status" data-state="${dead ? "morto" : bodySt.key}">
    <div class="hg-status-grid">
      <div class="hg-sil state-${dead ? "morto" : bodySt.key}">
        ${silhouetteSvg(character, damage, maxDmg, bodySt.key, dead)}
        <span class="hg-sil-state">${dead ? "☠ caiu" : `${stateIconHtml} ${esc(bodySt.label)}`}</span>
      </div>
      <div class="hg-bars">
        <div class="hg-stat dmg">
          <span class="hg-stat-l">❤️ dano</span>
          <div class="hg-bar big"><i style="width:${fillPct}%;background:${status.color}"></i>${ticksHtml}</div>
          <span class="hg-stat-v" style="color:${status.color}">${damage}%<small>/${maxDmg}</small></span>
        </div>
        ${sanityOn ? `<div class="hg-stat san ${insane ? "insane" : ""}">
          <span class="hg-stat-l">🌀 sanidade</span>
          <div class="hg-bar"><i class="san-fill" style="width:${sanity}%"></i></div>
          <span class="hg-stat-v">${insane ? "INSANO" : `${sanity}%`}</span>
        </div>` : ""}
        ${htOn ? `<div class="hg-stat need ${hunger === 0 ? "crit" : ""}">
          <span class="hg-stat-l">🍗 fome</span>${seg(hunger, "hunger")}<span class="hg-stat-v">${hunger}/3</span>${ctrl("hunger")}
        </div>
        <div class="hg-stat need ${thirst === 0 ? "crit" : ""}">
          <span class="hg-stat-l">💧 sede</span>${seg(thirst, "thirst")}<span class="hg-stat-v">${thirst}/3</span>${ctrl("thirst")}
        </div>` : ""}
        <p class="hg-status-note">${bleedingOn ? esc(bodySt.desc) : `Limite de dano ${maxDmg}% (Vigor ${vigor}).`}</p>
      </div>
    </div>
    ${tlHtml ? `<div class="hg-tls">${tlHtml}</div>` : ""}
    ${(tags.length || fxHtml) ? `<div class="hg-tags">${tags.join("")}${fxHtml}</div>` : ""}
  </section>`;
}


// ============================================================
// linha do tempo dos efeitos agendados (veneno, fogo, cinzas, nevasca, chuva, afogamento, bomba...)
// ============================================================
const TL_ICON = { veneno: "☠️", veneno_leve: "🤢", fogo: "🔥", cinzas_hp: "🌫️", cinzas: "🌫️", nevasca_hp: "❄️", chuva_hp: "🌧️", afogando: "🌊", bomba: "💣" };
const ATTR_NAME = { forca: "Força", agilidade: "Agilidade", vigor: "Vigor", carisma: "Carisma", intelecto: "Intelecto" };
const stepText = (e) => {
  const b = [];
  if (e.dmg) b.push(`−${e.dmg}% de vida`);
  if (e.sanity) b.push(`+${e.sanity}% de sanidade`);
  if (e.test) b.push(`teste de ${ATTR_NAME[e.test.attr] || e.test.attr}`);
  if (e.fx && e.fx.length && !e.dmg) b.push("novo efeito");
  return `${e.label ? `${e.label}` : "etapa"}${b.length ? `: ${b.join(", ")}` : ""}`;
};

export function timelinesHtml(character, writable, now = Date.now()){
  return liveFx(character, now).filter((f) => f.sched && f.sched.length).map((f) => {
    const q = f.sched.slice().sort((a, b) => a.at - b.at);
    const pts = [];                                   // pontos futuros; repetições ("again") aparecem como pontos mais apagados
    q.forEach((e) => {
      pts.push({ at: e.at, sure: true });
      if (e.again) for (let k = 1; k <= e.again.max - (e.n || 1); k++) pts.push({ at: e.at + k * e.again.everyMs, sure: false });
    });
    const t0 = f.t0 || Math.min(now, q[0].at - 1000);
    const end = Math.max(...pts.map((p) => p.at), t0 + 1000);
    const pct = (t) => Math.max(0, Math.min(100, ((t - t0) / (end - t0)) * 100));
    const done = f.done || 0;
    const next = q[0];
    const icon = TL_ICON[f.tag] || "⏱️";
    return `<div class="hg-tl ${f.bad ? "bad" : "good"}" data-hg-tl data-t0="${t0}" data-end="${end}" data-next="${next.at}">
      <div class="hg-tl-top">
        <span class="hg-tl-name">${icon} ${esc(f.l)}</span>
        <span class="hg-tl-eta">próxima etapa em <b data-hg-eta>${fmtMs(Math.max(0, next.at - now))}</b></span>
        ${writable ? `<button class="btn-mini" data-fx-del="${f.id}" title="remover o efeito">✕</button>` : ""}
      </div>
      <div class="hg-tl-bar" role="progressbar" aria-valuenow="${Math.round(pct(now))}" aria-valuemin="0" aria-valuemax="100">
        <i class="fill" style="width:${pct(now).toFixed(1)}%"></i>
        ${pts.map((p) => `<span class="mk ${p.sure ? "" : "maybe"} ${p.at <= now ? "past" : ""}" style="left:${pct(p.at).toFixed(1)}%"></span>`).join("")}
      </div>
      <div class="hg-tl-next">▸ ${esc(stepText(next))} <em>· etapa ${done + 1}/${done + pts.length}</em></div>
    </div>`;
  }).join("");
}

function updateTimelines(now){
  document.querySelectorAll("[data-hg-tl]").forEach((el) => {
    const t0 = parseInt(el.dataset.t0, 10), end = parseInt(el.dataset.end, 10), nx = parseInt(el.dataset.next, 10);
    const pct = Math.max(0, Math.min(100, ((now - t0) / (end - t0)) * 100));
    const fill = el.querySelector(".fill"); if (fill) fill.style.width = `${pct.toFixed(1)}%`;
    const eta = el.querySelector("[data-hg-eta]"); if (eta) eta.textContent = fmtMs(Math.max(0, nx - now));
    el.querySelectorAll(".mk").forEach((m) => { const left = parseFloat(m.style.left); m.classList.toggle("past", left <= pct); });
  });
}
