// ============================================================
// REVERSE LIFE — bestiário (fichas de monstros do narrador)
// Seção própria da campanha (sistema Percy Jackson). Monstros usam a mesma mecânica das
// fichas: atacam com testes de atributo e dados de dano, sofrem dano, têm efeitos e couraça.
// O narrador controla tudo; os jogadores só veem monstros revelados e podem atacá-los.
// ============================================================

import { ATTRS, maxDamageOf } from "./rules.js";
import { isPercy, fxChips, openAction, esc } from "./percy.js";
import { MONSTER_TEMPLATES, TEMPLATE_BY_ID } from "./bestiary-data.js";

let ctx = null;
export function initBestiary(c){ ctx = c; }

const ATTR_OPTS = ATTRS.map((a) => `<option value="${a.key}">${a.label}</option>`).join("");
const MOD_KEYS = [["", "sem modificador"], ...ATTRS.map((a) => [a.key, a.label]), ["ataque", "ataques"], ["percepcao", "percepção"]];
const okDice = (s) => !s || /^\s*(\d*d\d+|\d+)(\s*\+\s*(\d*d\d+|\d+))*\s*$/i.test(s);
const visible = (m) => ctx.isNarrator() || !!m.revealed;

function statusWord(m){
  const max = maxDamageOf(m), p = (m.damage || 0) / max;
  if (p >= 1) return ["derrotado", "dead"];
  if (p >= 0.75) return ["quase morto", "crit"];
  if (p >= 0.5) return ["muito ferido", "bad"];
  if (p >= 0.25) return ["ferido", "hurt"];
  if (p > 0) return ["arranhado", "ok"];
  return ["ileso", "ok"];
}

function cardHtml(m, narr, now){
  const max = maxDamageOf(m), dmg = m.damage || 0, hp = Math.max(0, max - dmg);
  const pct = Math.min(100, Math.round((dmg / max) * 100));
  const [word, cls] = statusWord(m);
  const dead = dmg >= max;
  const attrs = ATTRS.map((a) => `<span class="mon-attr"><small>${a.label.slice(0, 3).toUpperCase()}</small><b>${(m.attrs && m.attrs[a.key]) || 0}</b></span>`).join("");
  const attacks = (m.attacks || []).map((a) => `<button type="button" class="pz-act" data-mon-atk="${m.id}|${a.id}" ${dead ? "disabled" : ""}>${esc(a.name)}<small>${a.dmg ? esc(a.dmg) : "efeito"}${a.targets > 1 ? ` · ${a.targets} alvos` : ""}</small></button>`).join("");
  return `<article class="mon-card ${dead ? "is-dead" : ""} ${m.revealed ? "" : "is-hidden"}" data-mon="${m.id}">
    <header>
      <span class="mon-ico">${esc(m.ico || "👹")}</span>
      <div class="mon-title"><b class="mon-name">${esc(m.fullName)}</b><small>${esc(m.kind || "Monstro")}</small></div>
      ${narr ? `<button type="button" class="btn-mini mon-vis ${m.revealed ? "on" : ""}" data-mon-reveal="${m.id}" title="${m.revealed ? "esconder dos jogadores" : "revelar aos jogadores"}">${m.revealed ? "👁 revelado" : "🙈 oculto"}</button>` : ""}
    </header>
    <div class="mon-hp ${cls}">
      <div class="mon-bar"><div class="mon-bar-fill" style="width:${100 - pct}%"></div></div>
      <span class="mon-hp-text">${narr ? `vida <b>${hp}</b> / ${max}` : ""}${narr ? " · " : ""}${word}</span>
    </div>
    ${narr ? `<div class="mon-attrs">${attrs}${m.armor ? `<span class="mon-armor">🛡 couraça -${m.armor} por golpe</span>` : ""}</div>` : ""}
    ${fxChips(m, narr, now)}
    ${narr ? `<div class="mon-attacks">${attacks || `<em class="pz-hint">sem ataques cadastrados</em>`}</div>
      <div class="mon-tools">
        <span class="mon-tools-label">vida</span>
        <button type="button" class="btn-mini" data-mon-dmg="${m.id}|10">-10</button>
        <button type="button" class="btn-mini" data-mon-dmg="${m.id}|5">-5</button>
        <button type="button" class="btn-mini" data-mon-dmg="${m.id}|-5">+5</button>
        <button type="button" class="btn-mini" data-mon-dmg="${m.id}|-10">+10</button>
        <button type="button" class="btn-mini" data-mon-restore="${m.id}" title="vida cheia e sem efeitos">↺ restaurar</button>
        <button type="button" class="btn-mini" data-mon-edit="${m.id}">✎</button>
        <button type="button" class="btn-mini" data-mon-dup="${m.id}" title="duplicar">⧉</button>
        <button type="button" class="btn-mini" data-mon-del="${m.id}" title="excluir">🗑️</button>
      </div>` : ""}
  </article>`;
}

// ---------- seção ----------
export function renderBestiary(host, monsters){
  if (!host || !ctx) return;
  const camp = ctx.campaign();
  const narr = ctx.isNarrator();
  const list = (monsters || []).filter(visible);
  if (!isPercy(camp) || (!narr && !list.length)) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;
  const now = Date.now();
  host.innerHTML = `
    <div class="panel-label campaigns-head bestiary-head">
      <span>06</span>
      <h2>bestiário</h2>
      ${narr ? `<button class="roll-btn small-btn" data-mon-new><span class="roll-btn-text">+ MONSTRO</span></button>` : ""}
    </div>
    <p class="bestiary-note">${narr ? "Seu espaço reservado: monstros ocultos só aparecem para você. Revele-os quando entrarem em cena. Atacam e são atacados com a mesma mecânica das fichas." : "Criaturas que o narrador revelou. Você pode escolhê-las como alvo ao atacar ou usar poderes."}</p>
    <div class="bestiary-grid">${list.length ? list.map((m) => cardHtml(m, narr, now)).join("") : `<p class="empty-state">nenhum monstro no bestiário ainda. Use <b>+ MONSTRO</b> e comece por um dos modelos.</p>`}</div>`;
  bind(host, monsters);
}

function bind(host, monsters){
  const cid = ctx.campaign().id;
  const find = (id) => (monsters || []).find((m) => m.id === id);
  const mut = (id, fn) => ctx.api.mutateCharacter(cid, id, fn, "monster").catch((e) => console.error("bestiário:", e));

  const nb = host.querySelector("[data-mon-new]");
  if (nb) nb.addEventListener("click", () => openEditor(null));

  host.querySelectorAll("[data-mon-atk]").forEach((b) => b.addEventListener("click", () => {
    const [id, atkId] = b.dataset.monAtk.split("|");
    const m = find(id);
    if (m) openAction(m, "mon", m.id, atkId);
  }));
  host.querySelectorAll("[data-mon-reveal]").forEach((b) => b.addEventListener("click", () => {
    const m = find(b.dataset.monReveal);
    if (!m) return;
    mut(m.id, () => ({ revealed: !m.revealed }));
    if (!m.revealed) ctx.log("👹", `Um(a) <b>${esc(m.ico || "")} ${esc(m.fullName)}</b> surge diante do grupo!`);
  }));
  host.querySelectorAll("[data-mon-dmg]").forEach((b) => b.addEventListener("click", () => {
    const [id, d] = b.dataset.monDmg.split("|");
    const m = find(id); if (!m) return;
    const delta = parseInt(d, 10), max = maxDamageOf(m), before = m.damage || 0;
    mut(id, (data) => ({ damage: Math.max(0, Math.min(max, (data.damage || 0) + delta)) }));
    if (before < max && before + delta >= max) ctx.log("☠️", `<b>${esc(m.ico || "")} ${esc(m.fullName)}</b> foi derrotado!`);
  }));
  host.querySelectorAll("[data-mon-restore]").forEach((b) => b.addEventListener("click", () => mut(b.dataset.monRestore, () => ({ damage: 0, fx: [], cds: {} }))));
  host.querySelectorAll("[data-mon-edit]").forEach((b) => b.addEventListener("click", () => openEditor(find(b.dataset.monEdit))));
  host.querySelectorAll("[data-mon-dup]").forEach((b) => b.addEventListener("click", async () => {
    const m = find(b.dataset.monDup); if (!m) return;
    const copy = JSON.parse(JSON.stringify({ fullName: `${m.fullName} (cópia)`, kind: m.kind, ico: m.ico, attrs: m.attrs, hpMax: m.hpMax, armor: m.armor, attacks: m.attacks }));
    await ctx.api.createMonster(cid, copy).catch((e) => console.error(e));
  }));
  host.querySelectorAll("[data-mon-del]").forEach((b) => b.addEventListener("click", async () => {
    const m = find(b.dataset.monDel); if (!m) return;
    if (!confirm(`Excluir "${m.fullName}" do bestiário? Isso não pode ser desfeito.`)) return;
    await ctx.api.deleteMonster(cid, m.id).catch((e) => console.error(e));
  }));
  // efeitos ativos no monstro
  host.querySelectorAll("[data-fx-del]").forEach((b) => b.addEventListener("click", () => {
    const card = b.closest("[data-mon]");
    mut(card.dataset.mon, (d) => ({ fx: (d.fx || []).filter((f) => f.id !== b.dataset.fxDel) }));
  }));
  host.querySelectorAll("[data-fx-act]").forEach((b) => b.addEventListener("click", () => {
    const card = b.closest("[data-mon]");
    mut(card.dataset.mon, (d) => ({ fx: (d.fx || []).map((f) => (f.id === b.dataset.fxAct ? { ...f, acts: (f.acts || 1) - 1 } : f)).filter((f) => !(f.acts != null && f.acts <= 0)) }));
  }));
}

// ---------- editor ----------
function attackRow(a = {}){
  const fx = a.fx || {};
  const modKey = fx.m ? Object.keys(fx.m)[0] : "";
  return `<div class="mon-atk-row">
    <div class="mon-atk-top">
      <input type="text" class="modal-input" data-f="name" maxlength="40" placeholder="nome do ataque" value="${esc(a.name || "")}">
      <button type="button" class="btn-mini" data-rm title="remover ataque">✕</button>
    </div>
    <div class="mon-atk-grid">
      <label>teste<select class="modal-select" data-f="attr">${ATTR_OPTS.replace(`value="${a.attr || "forca"}"`, `value="${a.attr || "forca"}" selected`)}</select></label>
      <label>dano (ex.: 2d6)<input type="text" class="modal-input" data-f="dmg" maxlength="20" placeholder="vazio = só efeito" value="${esc(a.dmg || "")}"></label>
      <label>tipo<select class="modal-select" data-f="range"><option value="melee" ${a.range !== "ranged" ? "selected" : ""}>corpo a corpo</option><option value="ranged" ${a.range === "ranged" ? "selected" : ""}>à distância</option></select></label>
      <label>alvos<input type="number" class="modal-input" data-f="targets" min="1" max="8" value="${a.targets || 1}"></label>
      <label>resistência<select class="modal-select" data-f="rs"><option value="">nenhuma</option>${ATTR_OPTS.replace(`value="${a.rs || ""}"`, `value="${a.rs}" selected`)}</select></label>
    </div>
    <div class="mon-atk-fx">
      <span class="modal-label">efeito em quem falhar (opcional)</span>
      <input type="text" class="modal-input" data-f="fxl" maxlength="60" placeholder="ex.: Veneno (-2 Vigor)" value="${esc(fx.l || "")}">
      <div class="mon-atk-grid">
        <label>modificador<select class="modal-select" data-f="fxk">${MOD_KEYS.map(([k, l]) => `<option value="${k}" ${k === modKey ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>valor<input type="number" class="modal-input" data-f="fxv" value="${modKey ? fx.m[modKey] : -2}"></label>
        <label>duração<select class="modal-select" data-f="fxd"><option value="min" ${!fx.acts ? "selected" : ""}>minutos</option><option value="acts" ${fx.acts ? "selected" : ""}>ações</option></select></label>
        <label>quantidade<input type="number" class="modal-input" data-f="fxn" min="1" value="${fx.acts || fx.min || 5}"></label>
      </div>
    </div>
  </div>`;
}

function openEditor(monster){
  const editing = !!monster;
  const base = monster || { fullName: "", kind: "", ico: "👹", attrs: { forca: 3, agilidade: 3, vigor: 3, carisma: 1, intelecto: 1 }, hpMax: 40, armor: 0, attacks: [{ name: "Ataque", attr: "forca", dmg: "1d8", range: "melee", targets: 1 }] };
  let host = document.getElementById("monsterModal");
  if (!host) { host = document.createElement("div"); host.id = "monsterModal"; host.className = "modal-overlay hidden"; document.body.appendChild(host); host.addEventListener("click", (e) => { if (e.target === host) host.classList.add("hidden"); }); }
  host.innerHTML = `
    <div class="modal-card mon-editor">
      <div class="terminal-bar"><div class="terminal-dots"><span></span><span></span><span></span></div>
        <span class="terminal-title">/bin/${editing ? "editar" : "novo"}_monstro</span><button class="modal-close" data-mm-close aria-label="Fechar">✕</button></div>
      <div class="modal-body">
        ${editing ? "" : `<label class="modal-label">começar de um modelo</label>
        <select class="modal-select" data-mm-tpl><option value="">em branco</option>${MONSTER_TEMPLATES.map((t) => `<option value="${t.id}">${t.ico} ${esc(t.fullName)} — ${esc(t.kind)}</option>`).join("")}</select>`}
        <div class="mon-form" data-mm-form></div>
        <p class="modal-error" data-mm-err></p>
        <button class="roll-btn" data-mm-save><span class="roll-btn-text">${editing ? "SALVAR" : "ADICIONAR AO BESTIÁRIO"}</span></button>
      </div>
    </div>`;
  host.classList.remove("hidden");
  const q = (s) => host.querySelector(s);
  const fill = (d) => {
    q("[data-mm-form]").innerHTML = `
      <div class="mon-top-grid">
        <label>ícone<input type="text" class="modal-input" data-m="ico" maxlength="4" value="${esc(d.ico || "👹")}"></label>
        <label class="wide">nome<input type="text" class="modal-input" data-m="fullName" maxlength="50" value="${esc(d.fullName || "")}"></label>
      </div>
      <label class="modal-label">tipo</label>
      <div class="modal-input-row"><span class="prompt">&gt;</span><input type="text" class="modal-input" data-m="kind" maxlength="50" placeholder="ex.: Besta do labirinto" value="${esc(d.kind || "")}"></div>
      <div class="mon-top-grid">
        <label>vida (pontos)<input type="number" class="modal-input" data-m="hpMax" min="1" value="${d.hpMax || 40}"></label>
        <label>couraça (reduz cada golpe)<input type="number" class="modal-input" data-m="armor" min="0" value="${d.armor || 0}"></label>
      </div>
      <span class="modal-label">atributos (sem limite de pontos)</span>
      <div class="mon-attr-grid">${ATTRS.map((a) => `<label>${a.label}<input type="number" class="modal-input" data-attr="${a.key}" min="0" max="15" value="${(d.attrs && d.attrs[a.key]) ?? 1}"></label>`).join("")}</div>
      <span class="modal-label">ataques e habilidades</span>
      <div data-mm-atks>${(d.attacks || []).map(attackRow).join("")}</div>
      <button type="button" class="btn-mini" data-mm-addatk>+ ataque</button>`;
    wireRows();
  };
  const wireRows = () => {
    host.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => b.closest(".mon-atk-row").remove());
    const add = q("[data-mm-addatk]");
    add.onclick = () => { q("[data-mm-atks]").insertAdjacentHTML("beforeend", attackRow({})); wireRows(); };
  };
  fill(base);
  q("[data-mm-close]").onclick = () => host.classList.add("hidden");
  const tpl = q("[data-mm-tpl]");
  if (tpl) tpl.onchange = () => { const t = TEMPLATE_BY_ID[tpl.value]; fill(t || { ...base, fullName: "", kind: "" }); };

  q("[data-mm-save]").onclick = async () => {
    const err = q("[data-mm-err]"); err.textContent = "";
    const val = (k) => q(`[data-m="${k}"]`).value.trim();
    const fullName = val("fullName");
    const hpMax = parseInt(val("hpMax"), 10), armor = parseInt(val("armor"), 10) || 0;
    if (fullName.length < 2) { err.textContent = "informe o nome do monstro."; return; }
    if (!(hpMax >= 1)) { err.textContent = "a vida precisa ser de pelo menos 1 ponto."; return; }
    const attrs = {}; ATTRS.forEach((a) => { attrs[a.key] = Math.max(0, parseInt(q(`[data-attr="${a.key}"]`).value, 10) || 0); });
    const attacks = [];
    for (const row of host.querySelectorAll(".mon-atk-row")) {
      const g = (k) => row.querySelector(`[data-f="${k}"]`).value.trim();
      const name = g("name");
      if (!name) { err.textContent = "todo ataque precisa de um nome."; return; }
      if (!okDice(g("dmg"))) { err.textContent = `dado de dano inválido em "${name}" (ex.: 2d6).`; return; }
      const atk = { id: `at_${Date.now().toString(36)}${attacks.length}`, name, attr: g("attr"), dmg: g("dmg"), range: g("range"), targets: Math.min(8, Math.max(1, parseInt(g("targets"), 10) || 1)) };
      if (g("rs")) atk.rs = g("rs");
      if (g("fxl")) {
        const n = Math.max(1, parseInt(g("fxn"), 10) || 1), k = g("fxk"), v = parseInt(g("fxv"), 10) || 0;
        atk.fx = { l: g("fxl"), ...(g("fxd") === "acts" ? { acts: n } : { min: n }), ...(k && v ? { m: { [k]: v } } : {}) };
      }
      attacks.push(atk);
    }
    const data = { fullName, kind: val("kind"), ico: val("ico") || "👹", hpMax, armor, attrs, attacks };
    const btn = q("[data-mm-save]"); btn.disabled = true;
    try {
      const cid = ctx.campaign().id;
      if (editing) await ctx.api.updateMonster(cid, monster.id, data);
      else await ctx.api.createMonster(cid, data);
      host.classList.add("hidden");
    } catch (e) {
      console.error(e);
      err.textContent = ctx.describeError(e, "não foi possível salvar o monstro.");
    } finally { btn.disabled = false; }
  };
}
