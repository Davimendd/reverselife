// ============================================================
// REVERSE LIFE — painel da arena (Jogos Vorazes)
// Cornucópia (estoque limitado, resetável), presentes de patrocinadores (drops sorteados por local,
// manuais ou automáticos), locais da arena (norte, sul, leste, oeste), eventos por região e o
// banquete da Última Ceia. Reivindicar um item exige colar um texto de cena (mín. 10 letras).
// ============================================================

import { D20_TESTS } from "./rules.js";
import { REGIONS, REGION_BY_ID, CORNUCOPIA, regionLabel, WEAPONS, SUPPLIES, SPONSOR_POOL, THREAT_BY_ID, DISTRICT_BY_N } from "./hunger-data.js";
import { ARENA_EVENTS, EVENT_BY_ID, PLANTS, ZONES, buildBanquet, poisonResult, DISHES } from "./hunger-events.js";
import * as HE from "./hunger-engine.js";
import { getCtx, toast, openModal, closeModal, modalBar, errMsg, hungerItemMeta } from "./hunger.js";
import { esc, fmtMs } from "./percy.js";
import { arenaMapHtml, parachuteFx, eventFx, bombImpactFx } from "./hunger-fx.js";

let ctx = null;
let data = { stock: null, drops: [], loaded: false };
let autoTimer = null;
let seeding = false;
// efeitos de tela: o primeiro retrato da campanha só "marca" o que já existia (sem animar)
let primed = { events: false, drops: false };
const seenEvents = new Set();
const seenDrops = new Set();
const glow = new Map();        // id do presente -> quando caiu (brilho dourado por alguns segundos)
const GLOW_MS = 7000;

export function initArena(){
  ctx = getCtx();
  autoTimer = setInterval(autoTick, 5000);
}
const camp = () => ctx.campaign();
const active = () => !!(ctx && HE.isHungerCampaign(camp()));
const cid = () => camp().id;
const hostEl = () => document.getElementById("arenaPanel");

export function setArenaData(patch){
  data = { ...data, ...patch };
  if (patch.drops) detectNewDrops(patch.drops);
  renderArena();
  maybeSeed();
}
export function resetArenaData(){
  data = { stock: null, drops: [], loaded: false };
  primed = { events: false, drops: false };
  seenEvents.clear(); seenDrops.clear(); glow.clear();
}

// paraquedas novo (ou revelado) -> animação na tela de todo mundo
function detectNewDrops(list){
  if (!active()) return;
  const vis = list.filter((d) => d.kind !== "dish" && !d.hidden && d.qty > 0);
  if (!primed.drops) { vis.forEach((d) => seenDrops.add(d.id)); primed.drops = true; return; }
  vis.filter((d) => !seenDrops.has(d.id)).forEach((d) => {
    seenDrops.add(d.id);
    glow.set(d.id, Date.now());
    parachuteFx(d.name, `${d.locName || "?"}${d.region && d.region !== "cornucopia" ? ` · ${regionLabel(d.region)}` : ""}`);
    setTimeout(() => renderArena(), GLOW_MS + 100);
  });
}
// evento novo -> clima ao fundo (e o impacto da bomba, 1 minuto depois do alerta)
function detectNewEvents(){
  const list = eventsOf();
  if (!primed.events) { list.forEach((e) => seenEvents.add(e.id)); primed.events = true; return; }
  list.filter((e) => !seenEvents.has(e.id)).forEach((e) => {
    seenEvents.add(e.id);
    if (!isLive(e)) return;
    eventFx(e.type);
    if (e.type === "bomba") { const wait = e.startedAt + 60000 - Date.now(); if (wait > 0) setTimeout(bombImpactFx, wait); }
  });
}

// o mapa acompanha a posição dos tributos sem redesenhar o painel todo
export function refreshMap(){
  const w = document.querySelector(".hg-map-wrap");
  if (w && active()) w.innerHTML = mapHtml();
}
function mapHtml(){
  const live = eventsOf().filter(isLive);
  return arenaMapHtml({ locs: locsOf(), drops: data.drops.filter((d) => d.kind !== "dish" && !d.hidden && d.qty > 0), events: live, liveEventIds: live.map((e) => e.id), chars: ctx.characters() });
}

// primeira vez com o sistema ligado: monta o estoque inicial da Cornucópia
async function maybeSeed(){
  if (!active() || !ctx.isNarrator() || !data.loaded || data.stock || seeding) return;
  seeding = true;
  try { await ctx.api.seedCornucopia(cid(), HE.initialStock()); } catch (e) { console.error("seed:", e); }
  seeding = false;
}

const locsOf = () => camp().arenaLocs || [];
const eventsOf = () => camp().arenaEvents || [];
const isLive = (e) => !e.endedAt && Date.now() < e.startedAt + e.durationMin * 60000;
const mine = () => ctx.characters().filter((c) => ctx.isNarrator() || ctx.isMine(c));
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ============================================================
// render
// ============================================================
export function renderArena(){
  const host = hostEl();
  if (!host) return;
  if (!active()) { host.hidden = true; host.innerHTML = ""; return; }
  const narr = ctx.isNarrator();
  const c = camp();
  host.hidden = false;
  detectNewEvents();
  const now = Date.now();
  const live = eventsOf().filter(isLive);
  const sponsors = data.drops.filter((d) => d.source !== "ceia" && !d.hidden && d.qty > 0);
  const dishes = data.drops.filter((d) => d.kind === "dish" && d.qty > 0);
  const hidden = narr ? data.drops.filter((d) => d.hidden && d.qty > 0) : [];

  host.innerHTML = `
    <div class="ht-panel-bar hg-bar"><div class="terminal-dots"><span></span><span></span><span></span></div><span class="ht-panel-title">/arena/jogos_vorazes</span><span class="rules-summary">${live.length ? `🚨 ${live.length} evento${live.length > 1 ? "s" : ""} ativo${live.length > 1 ? "s" : ""}` : "arena calma"}</span></div>
    <div class="ht-panel-body hg-body">
      ${live.map((e) => eventBanner(e, narr, now)).join("")}

      <details class="hg-block hg-map" open>
        <summary><h3>🗺️ Mapa da arena <small>Cornucópia no centro · quatro regiões</small></h3></summary>
        <div class="hg-map-wrap">${mapHtml()}</div>
        <p class="hg-hint hg-map-legend">🪂 presente caído · 👥 tributos na região (pontos coloridos = distrito) · a região <b>pisca</b> durante um evento · marque sua posição na ficha.</p>
      </details>

      <section class="hg-block hg-sponsor ${[...glow.values()].some((t) => Date.now() - t < GLOW_MS) ? "hg-glow" : ""}">
        <h3>🪂 Presentes de Patrocinadores <small>${sponsors.length ? `${sponsors.length} no ar` : "nada caiu ainda"}</small></h3>
        <p class="hg-hint">Os patrocinadores enviam suprimentos por paraquedas. Cada presente fica no local onde caiu: reivindique-o como qualquer item da Cornucópia.</p>
        <div class="hg-loot">${sponsors.length ? sponsors.map((d) => lootRow(d, narr)).join("") : `<p class="empty-state">nenhum paraquedas prateado caiu. Fique de olho no céu.</p>`}</div>
      </section>

      ${dishes.length || (narr && eventsOf().some((e) => e.type === "ceia" && !e.endedAt)) ? `<section class="hg-block hg-banquet">
        <h3>🍽️ Banquete da Última Ceia <small>${esc(regionLabel(((eventsOf().find((e) => e.type === "ceia") || {}).region)))}</small></h3>
        <p class="hg-hint">Um banquete oferecido pelos Idealizadores. Escolha um prato com o seu tributo… mas lembre que nada é de graça.</p>
        <div class="hg-loot">${dishes.map((d) => dishRow(d, narr)).join("") || `<p class="empty-state">o banquete acabou.</p>`}</div>
      </section>` : ""}

      ${hidden.length ? `<section class="hg-block hg-hidden"><h3>🕵️ Escondidos (só o narrador vê)</h3><div class="hg-loot">${hidden.map((d) => `
        <div class="hg-loot-row"><span class="hg-loot-ico">${HE.itemInfo(d.key).ico}</span><div class="hg-loot-info"><b>${esc(d.name)}</b><small>${esc(d.locName || "")} · ${esc(regionLabel(d.region))} · x${d.qty}</small></div>
        <button class="btn-mini" data-hg-reveal="${d.id}">revelar aos jogadores</button><button class="btn-mini" data-hg-dropdel="${d.id}">🗑️</button></div>`).join("")}</div></section>` : ""}

      <details class="hg-block hg-corn" open>
        <summary><h3>🏺 Cornucópia <small>estoque limitado do início da edição</small></h3></summary>
        ${cornucopiaHtml(narr)}
      </details>

      <details class="hg-block hg-locs">
        <summary><h3>🗺️ Locais da arena <small>norte · sul · leste · oeste</small></h3></summary>
        ${locsHtml(narr)}
      </details>

      ${narr ? narratorTools(c) : ""}

      <details class="hg-block hg-guide">
        <summary><h3>📜 Guia das regras do Jogos Vorazes</h3></summary>
        ${guideHtml()}
      </details>
      <p class="rules-error" id="hgError"></p>
    </div>`;
  bind(host);
}

const err = (m) => { const e = document.getElementById("hgError"); if (e) e.textContent = m || ""; if (m) toast(`⚠ ${esc(m)}`); };

function eventBanner(rec, narr, now){
  const ev = EVENT_BY_ID[rec.type];
  if (!ev) return "";
  const left = rec.startedAt + rec.durationMin * 60000 - now;
  return `<div class="hg-alert" style="--ev:${ev.color}" data-hg-event="${rec.id}">
    <span class="hg-alert-ico">${ev.ico}</span>
    <div class="hg-alert-body">
      <b class="hg-alert-title">ALERTA DA ARENA — ${esc(ev.name)}</b>
      <span class="hg-alert-region">região <b>${esc(regionLabel(rec.region)).toUpperCase()}</b> · termina em <b class="hg-next" data-hg-next="${rec.startedAt + rec.durationMin * 60000}">${fmtMs(left)}</b></span>
      <p>${esc(ev.desc)}</p>
      <ul>${ev.cons.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <details><summary>mecânicas e equipamentos que ajudam</summary><ul>${ev.mech.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>
      ${narr ? `<div class="hg-alert-tools"><button class="btn-mini pz-use" data-hg-apply="${rec.id}">aplicar nas fichas da região</button><button class="btn-mini" data-hg-endev="${rec.id}">encerrar evento</button></div>` : `<small class="hg-hint">Quem estiver na região ${esc(regionLabel(rec.region))} sofre os efeitos. Procure abrigo!</small>`}
    </div>
  </div>`;
}

function lootRow(d, narr){
  const info = HE.itemInfo(d.key);
  return `<div class="hg-loot-row ${glow.has(d.id) && Date.now() - glow.get(d.id) < GLOW_MS ? "hg-glow" : ""}">
    <span class="hg-loot-ico">${info.ico}</span>
    <div class="hg-loot-info"><b>${esc(d.name)}</b><small>📍 ${esc(d.locName || "?")} · ${esc(regionLabel(d.region))} · x${d.qty}</small><small class="hg-desc">${esc(info.desc)}</small></div>
    <button class="btn-mini pz-use" data-hg-claim="drops|${d.id}">reivindicar</button>
    ${narr ? `<button class="btn-mini" data-hg-dropdel="${d.id}" title="remover">🗑️</button>` : ""}
  </div>`;
}

function dishRow(d, narr){
  const lv = { pequeno: "☠ veneno pequeno", medio: "☠ veneno médio", grande: "☠ veneno GRANDE" };
  return `<div class="hg-loot-row">
    <span class="hg-loot-ico">${esc(d.ico || "🍽️")}</span>
    <div class="hg-loot-info"><b>${esc(d.name)}</b><small>porções: ${d.qty}</small>${narr ? `<small class="hg-poison ${d.poison ? "bad" : "ok"}">${d.poison ? lv[d.poison] : "seguro"} (só você vê)</small>` : ""}</div>
    <button class="btn-mini pz-use" data-hg-eat="${d.id}">comer</button>
  </div>`;
}

function cornucopiaHtml(narr){
  const stock = data.stock && data.stock.stock;
  if (!stock) return `<p class="empty-state">${data.loaded ? "preparando a Cornucópia…" : "carregando…"}</p>`;
  const init = HE.initialStock();
  const row = (x, kind) => {
    const n = stock[x.key] ?? 0, tot = init[x.key] ?? x.n;
    const stat = kind === "w"
      ? `${esc(x.atk.dmg)} · ${esc(x.atk.attr)} · ${x.atk.range === "ranged" ? "à distância" : "corpo a corpo"} · ${x.atk.bleed > 0 ? `🩸 ${x.atk.bleed}% sangra` : "não sangra"}${x.atk.ammo ? ` · 🏹 ${x.atk.ammo} cargas` : ""}`
      : "";
    return `<div class="hg-loot-row ${n <= 0 ? "out" : ""}">
      <span class="hg-loot-ico">${HE.itemInfo(x.key).ico}</span>
      <div class="hg-loot-info"><b>${esc(x.name)}</b>${stat ? `<small class="hg-stat">${stat}</small>` : ""}<small class="hg-desc">${esc(x.desc)}</small></div>
      <span class="hg-qty ${n <= 0 ? "zero" : ""}">${n}/${tot}</span>
      <button class="btn-mini pz-use" data-hg-claim="arena|${x.key}" ${n <= 0 ? "disabled" : ""}>reivindicar</button>
    </div>`;
  };
  return `<div class="hg-corn-body">
    <p class="hg-hint">A Cornucópia é a estrutura em forma de chifre no centro da arena, repleta de armas e suprimentos no início de cada edição. Para pegar um item, escreva (ou cole) um trecho da cena com pelo menos 10 letras: quem reivindicar primeiro leva, e o item precisa caber no inventário.</p>
    <h4>🗡️ Armas</h4><div class="hg-loot">${WEAPONS.map((w) => row(w, "w")).join("")}</div>
    <h4>🎒 Suprimentos</h4><div class="hg-loot">${SUPPLIES.map((s) => row(s, "s")).join("")}</div>
    ${narr ? `<div class="hg-corn-tools"><button class="btn-mini" data-hg-reset>↺ resetar a Cornucópia</button><small class="hg-hint">volta o estoque ao início da edição (não mexe nas fichas)</small></div>` : ""}
  </div>`;
}

function locsHtml(narr){
  const locs = locsOf();
  const by = (r) => locs.filter((l) => l.region === r);
  return `<div class="hg-locs-body">
    <div class="hg-loc-grid">
      <div class="hg-loc-col cornucopia"><b>🏺 Cornucópia</b><small>local fixo, no centro da arena</small></div>
      ${REGIONS.map((r) => `<div class="hg-loc-col"><b>🧭 ${r.label}</b>${by(r.id).map((l) => `<div class="hg-loc-item ${l.blocked ? "blocked" : ""}"><span>${l.blocked ? "🚫 " : ""}${esc(l.name)}${l.blocked ? " <em>(bloqueado)</em>" : ""}</span>${narr ? `<button class="btn-mini" data-hg-locblock="${l.id}" title="${l.blocked ? "liberar a rota" : "bloquear a rota (vulcão)"}">${l.blocked ? "liberar" : "🚫"}</button><button class="btn-mini" data-hg-locdel="${l.id}" title="remover">✕</button>` : ""}${l.desc ? `<small>${esc(l.desc)}</small>` : ""}</div>`).join("") || `<small class="hg-hint">nenhum local</small>`}</div>`).join("")}
    </div>
    ${narr ? `<div class="hg-loc-add">
      <input type="text" class="modal-input" data-hg-locname maxlength="40" placeholder="nome do local (ex.: Lago Seco)">
      <select class="modal-select" data-hg-locregion>${REGIONS.map((r) => `<option value="${r.id}">${r.label}</option>`).join("")}</select>
      <input type="text" class="modal-input" data-hg-locdesc maxlength="80" placeholder="descrição curta (opcional)">
      <button class="btn-mini pz-use" data-hg-locadd>+ adicionar local</button>
    </div>` : ""}
  </div>`;
}

function narratorTools(c){
  const auto = c.hgAuto || {};
  const hist = eventsOf();
  return `<section class="hg-block hg-narr">
    <h3>🎛️ Controles do narrador</h3>
    <div class="hg-tool">
      <b>🪂 Sortear presente de patrocinador</b>
      <div class="hg-tool-row">
        <select class="modal-select" data-hg-dropitem><option value="">item sorteado (erva, bebida ou alimento)</option>${SPONSOR_POOL.map((p) => `<option value="${p.key}">${esc(HE.itemInfo(p.key).name)}</option>`).join("")}</select>
        <select class="modal-select" data-hg-droploc><option value="">local sorteado</option>${HE.dropLocations(locsOf()).map((l) => `<option value="${l.id}">${esc(l.name)}${l.region !== "cornucopia" ? ` (${esc(regionLabel(l.region))})` : ""}</option>`).join("")}</select>
        <button class="btn-mini pz-use" data-hg-dropnow>🪂 soltar agora</button>
      </div>
      <div class="hg-tool-row">
        <label class="hg-check"><input type="checkbox" data-hg-auto ${auto.on ? "checked" : ""}> sorteio automático a cada</label>
        <input type="number" class="damage-input" min="1" max="1440" value="${auto.everyMin || 60}" data-hg-everymin> <span>min</span>
        <button class="btn-mini" data-hg-autosave>salvar</button>
        <small class="hg-hint">${auto.on ? `próximo drop: ${new Date(auto.nextAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Roda enquanto a sua aba estiver aberta.` : "desligado."}</small>
      </div>
    </div>
    <div class="hg-tool">
      <b>⚡ Sortear evento da arena</b>
      <div class="hg-tool-row">
        <select class="modal-select" data-hg-evtype><option value="">evento sorteado</option>${ARENA_EVENTS.map((e) => `<option value="${e.id}">${e.ico} ${esc(e.name)}</option>`).join("")}</select>
        <select class="modal-select" data-hg-evregion><option value="">região sorteada</option>${REGIONS.map((r) => `<option value="${r.id}">${r.label}</option>`).join("")}</select>
        <input type="number" class="damage-input" min="1" max="240" data-hg-evmin placeholder="min" title="duração em minutos (vazio = padrão do evento)">
        <button class="btn-mini pz-use" data-hg-evgo>⚡ lançar evento</button>
      </div>
    </div>
    ${hist.length ? `<div class="hg-tool"><b>📜 Eventos recentes</b>${hist.slice(0, 6).map((e) => { const ev = EVENT_BY_ID[e.type]; return `<div class="hg-hist"><span>${ev ? ev.ico : "•"} ${esc(ev ? ev.name : e.type)} — ${esc(regionLabel(e.region))}</span><small>${isLive(e) ? "ativo" : "encerrado"}</small>${ev ? `<button class="btn-mini" data-hg-apply="${e.id}">aplicar</button>` : ""}</div>`; }).join("")}</div>` : ""}
  </section>`;
}

function guideHtml(){
  return `<div class="hg-guide-body">
    <p><b>Vida e sanidade.</b> "HP" são pontos de % de vida (1 ponto = 1% de dano). Sanidade em % (100% = insano). Testes: D20 + atributo (Normal 10+, Difícil 15+, Arriscado 18+).</p>
    <p><b>Ataques.</b> Toque em ⚔ atacar na arma do inventário, escolha o alvo (tributos ou Ameaças) e a dificuldade. O teste, o dano e os efeitos são aplicados na hora. Corpo a corpo soma a Força; à distância não. 20 natural: dano ×2 (×3 à distância) e +15 de chance de sangramento.</p>
    <p><b>Sangramento.</b> Cada arma afiada tem uma chance de abrir sangramento (5% a cada 10 min, por 1 h). Martelo quase nunca; bastão nunca; foice e machado de lenhador são as piores.</p>
    <p><b>Infecção.</b> Toda água e comida tem 15% de chance de infectar (3% com Antisséptico; 50% se contaminada pela Chuva Escarlate). Purificar a água (pastilhas ou fervendo) e cozinhar a comida zeram o risco. A infecção tira 2% a cada 30 min e <b>só a Erva Vermelha cura</b>.</p>
    <p><b>Erva Preta.</b> Engolida à força: 10 de dano ignorando armadura. Numa arma: +1 dado de dano no próximo ataque (uma vez só). Não se mistura com as outras ervas.</p>
    <p><b>Inventário.</b> 5 itens + 2 por ponto de Força. A Mochila dá +5 (uma por inventário e não ocupa espaço).</p>
    <p><b>Distritos.</b> Máximo de 3 tributos por distrito. Cada um tem uma passiva própria (veja o cabeçalho do grupo).</p>
    <p><b>Eventos.</b> Atingem uma região inteira. Todos os eventos (menos A Última Ceia) causam dano de sanidade, informado em cada um.</p>
  </div>`;
}

// ============================================================
// ligações
// ============================================================
function bind(host){
  host.querySelectorAll("[data-hg-claim]").forEach((b) => b.addEventListener("click", () => {
    const [col, id] = b.dataset.hgClaim.split("|");
    openClaim(col, id);
  }));
  host.querySelectorAll("[data-hg-eat]").forEach((b) => b.addEventListener("click", () => openEat(b.dataset.hgEat)));
  host.querySelectorAll("[data-hg-dropdel]").forEach((b) => b.addEventListener("click", async () => { try { await ctx.api.deleteDrop(cid(), b.dataset.hgDropdel); } catch (e) { err(errMsg(e)); } }));
  host.querySelectorAll("[data-hg-reveal]").forEach((b) => b.addEventListener("click", async () => {
    const d = data.drops.find((x) => x.id === b.dataset.hgReveal);
    try { await ctx.api.updateDrop(cid(), b.dataset.hgReveal, { hidden: false }); ctx.log("🪂", `Algo foi encontrado na arena: <b>${esc(d.name)}</b> em <b>${esc(d.locName || "?")}</b> (${esc(regionLabel(d.region))}).`); } catch (e) { err(errMsg(e)); }
  }));
  host.querySelectorAll("[data-hg-apply]").forEach((b) => b.addEventListener("click", () => openApply(b.dataset.hgApply)));
  host.querySelectorAll("[data-hg-endev]").forEach((b) => b.addEventListener("click", () => endEvent(b.dataset.hgEndev)));
  const q = (s) => host.querySelector(s);
  const reset = q("[data-hg-reset]");
  if (reset) reset.addEventListener("click", async () => {
    if (!confirm("Resetar a Cornucópia?\n\nO estoque volta ao início da edição (todas as armas e suprimentos disponíveis de novo). As fichas dos jogadores não são alteradas.")) return;
    try { await ctx.api.seedCornucopia(cid(), HE.initialStock()); ctx.log("🏺", `<b>${esc(ctx.handle())}</b> resetou a <b>Cornucópia</b>: um novo estoque de armas e suprimentos está disponível.`); } catch (e) { err(errMsg(e)); }
  });
  const add = q("[data-hg-locadd]");
  if (add) add.addEventListener("click", async () => {
    const name = q("[data-hg-locname]").value.trim();
    if (name.length < 2) { err("dê um nome ao local."); return; }
    const loc = { id: uid("loc"), name, region: q("[data-hg-locregion]").value, desc: q("[data-hg-locdesc]").value.trim() };
    try { await ctx.api.patchCampaign(cid(), { arenaLocs: [...locsOf(), loc] }); ctx.log("🗺️", `Novo local na arena: <b>${esc(name)}</b> (${esc(regionLabel(loc.region))}).`); } catch (e) { err(errMsg(e)); }
  });
  host.querySelectorAll("[data-hg-locdel]").forEach((b) => b.addEventListener("click", async () => {
    try { await ctx.api.patchCampaign(cid(), { arenaLocs: locsOf().filter((l) => l.id !== b.dataset.hgLocdel) }); } catch (e) { err(errMsg(e)); }
  }));
  host.querySelectorAll("[data-hg-locblock]").forEach((b) => b.addEventListener("click", async () => {
    const id = b.dataset.hgLocblock, l = locsOf().find((x) => x.id === id);
    if (!l) return;
    try {
      await ctx.api.patchCampaign(cid(), { arenaLocs: locsOf().map((x) => (x.id === id ? { ...x, blocked: !x.blocked } : x)) });
      ctx.log(l.blocked ? "🛤️" : "🚫", l.blocked ? `A rota para <b>${esc(l.name)}</b> foi liberada.` : `A rota para <b>${esc(l.name)}</b> foi <b>bloqueada</b> (${esc(regionLabel(l.region))}).`);
    } catch (e) { err(errMsg(e)); }
  }));
  const dn = q("[data-hg-dropnow]");
  if (dn) dn.addEventListener("click", async () => {
    try { await doDrop(q("[data-hg-dropitem]").value || null, q("[data-hg-droploc]").value || null, "narrador"); } catch (e) { err(errMsg(e)); }
  });
  const asv = q("[data-hg-autosave]");
  if (asv) asv.addEventListener("click", async () => {
    const on = q("[data-hg-auto]").checked, every = Math.max(1, Math.min(1440, parseInt(q("[data-hg-everymin]").value, 10) || 60));
    try {
      await ctx.api.patchCampaign(cid(), { hgAuto: { on, everyMin: every, nextAt: Date.now() + every * 60000 } });
      ctx.log("⏱️", `<b>${esc(ctx.handle())}</b> ${on ? `ligou o sorteio automático de presentes: um paraquedas a cada <b>${every} min</b>` : "desligou o sorteio automático de presentes"}.`);
    } catch (e) { err(errMsg(e)); }
  });
  const go = q("[data-hg-evgo]");
  if (go) go.addEventListener("click", () => {
    const type = q("[data-hg-evtype]").value || ARENA_EVENTS[Math.floor(Math.random() * ARENA_EVENTS.length)].id;
    const region = q("[data-hg-evregion]").value || REGIONS[Math.floor(Math.random() * REGIONS.length)].id;
    const min = parseInt(q("[data-hg-evmin]").value, 10) || null;
    startEvent(type, region, min).catch((e) => err(errMsg(e)));
  });
}

// ============================================================
// presentes (drops)
// ============================================================
async function doDrop(key, locId, source){
  const k = key || HE.rollSponsorKey();
  const loc = locId ? HE.dropLocations(locsOf()).find((l) => l.id === locId) : HE.pickLocation(locsOf());
  const info = HE.itemInfo(k);
  await ctx.api.createDrop(cid(), { key: k, kind: "item", name: info.name, qty: 1, locId: loc.id, locName: loc.name, region: loc.region, source: "sponsor", hidden: false });
  ctx.log("🪂", `<b>PRESENTE DE PATROCINADOR!</b> Um paraquedas prateado desce com <b>${esc(info.name)}</b> em <b>${esc(loc.name)}</b>${loc.region !== "cornucopia" ? ` (região ${esc(regionLabel(loc.region))})` : ""}. Corra para reivindicar!`);
  return loc;
}

let autoBusy = false;
async function autoTick(){
  if (!active() || !ctx.isNarrator() || autoBusy) return;
  const a = camp().hgAuto;
  if (!a || !a.on || Date.now() < a.nextAt) return;
  autoBusy = true;
  try {
    await ctx.api.patchCampaign(cid(), { hgAuto: { ...a, nextAt: Date.now() + a.everyMin * 60000 } });   // marca antes: evita soltar duas vezes
    await doDrop(null, null, "auto");
  } catch (e) { console.error("auto drop:", e); }
  autoBusy = false;
}

// ============================================================
// reivindicar (Cornucópia e drops) e comer (banquete)
// ============================================================
const letters = (s) => (s.match(/\S/g) || []).length;

function characterSelect(){
  const list = mine();
  if (!list.length) return "";
  return `<label class="modal-label">quem pega o item</label>
    <select class="modal-select" data-hg-char>${list.map((c) => `<option value="${c.id}">${esc(c.fullName)}${c.district ? ` (D${c.district})` : ""}</option>`).join("")}</select>`;
}

function openClaim(col, id){
  let key, name, desc;
  if (col === "arena") { key = id; }
  else { const d = data.drops.find((x) => x.id === id); if (!d) return; key = d.key; }
  const info = HE.itemInfo(key);
  name = info.name; desc = info.desc;
  const list = mine();
  if (!list.length) { toast("⚠ Você precisa de uma ficha nesta campanha para reivindicar itens."); return; }
  const m = openModal(`${modalBar(`/bin/reivindicar — ${name}`)}<div class="modal-body">
    <h3 class="pz-modal-title">${info.ico} ${esc(name)}</h3>
    <p class="modal-rules">${esc(desc)}</p>
    ${characterSelect()}
    <label class="modal-label">cena (escreva ou cole o trecho em que o seu tributo pega o item — mínimo 10 letras)</label>
    <textarea class="modal-textarea" data-hg-scene maxlength="600" placeholder="Corro até a boca da Cornucópia, desvio de um tributo e agarro…"></textarea>
    <small class="hg-hint"><span data-hg-count>0</span>/10 letras</small>
    <p class="modal-error" data-hg-err></p>
    <button class="roll-btn" data-hg-go><span class="roll-btn-text">REIVINDICAR</span></button>
  </div>`);
  const ta = m.querySelector("[data-hg-scene]"), cnt = m.querySelector("[data-hg-count]");
  ta.addEventListener("input", () => { cnt.textContent = letters(ta.value); });
  m.querySelector("[data-hg-go]").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget, e = m.querySelector("[data-hg-err]");
    const scene = ta.value.trim();
    if (letters(scene) < 10) { e.textContent = "escreva uma cena com pelo menos 10 letras."; return; }
    const charId = m.querySelector("[data-hg-char]").value;
    const ch = ctx.characters().find((c) => c.id === charId);
    btn.disabled = true; e.textContent = "reivindicando…";
    try {
      await ctx.api.claimLoot(cid(), {
        col, id: col === "arena" ? "cornucopia" : id, key, characterId: charId,
        fn: (charData, srcData) => {
          const item = HE.buildItem(key, 1);
          return { items: HE.addItemChecked(charData, item) };
        },
      });
      closeModal();
      const where = col === "arena" ? "da Cornucópia" : "do presente de patrocinador";
      ctx.log("🏺", `<b>${esc(ch.fullName)}</b> reivindicou <b>${esc(name)}</b> ${where}: <i>“${esc(scene.length > 140 ? scene.slice(0, 140) + "…" : scene)}”</i>`);
      toast(`✅ ${esc(ch.fullName)} pegou ${esc(name)}.`);
    } catch (er) { e.textContent = errMsg(er); btn.disabled = false; }
  });
}

function openEat(dropId){
  const d = data.drops.find((x) => x.id === dropId);
  if (!d) return;
  const list = mine();
  if (!list.length) { toast("⚠ Você precisa de uma ficha para comer no banquete."); return; }
  const m = openModal(`${modalBar("/bin/banquete")}<div class="modal-body">
    <h3 class="pz-modal-title">${esc(d.ico || "🍽️")} ${esc(d.name)}</h3>
    <p class="modal-rules">Um prato dos Idealizadores. Cheira bem… mas nada na arena é de graça.</p>
    ${characterSelect()}
    <p class="modal-error" data-hg-err></p>
    <button class="roll-btn" data-hg-go><span class="roll-btn-text">COMER</span></button></div>`);
  m.querySelector("[data-hg-go]").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget, e = m.querySelector("[data-hg-err]");
    const charId = m.querySelector("[data-hg-char]").value;
    const ch = ctx.characters().find((c) => c.id === charId);
    btn.disabled = true;
    let res = null, ap = null;
    try {
      await ctx.api.claimLoot(cid(), {
        col: "drops", id: dropId, key: d.key, characterId: charId,
        fn: (charData, src) => {
          const now = Date.now();
          res = src.poison ? poisonResult(src.poison, src.evId || "") : { dmg: 0, fx: [], lines: [] };
          res.src = "A Última Ceia";
          ap = HE.applyResult(charData, res, now);
          return { ...ap.patch, hunger: 3 };
        },
      });
      closeModal();
      ctx.log("🍽️", `<b>${esc(ch.fullName)}</b> comeu <b>${esc(d.name)}</b> do banquete.`);
      if (res && res.fx && res.fx.length) { ctx.log("🤢", `<b>${esc(ch.fullName)}</b> começa a passar mal… ${esc(res.lines.join(" "))}`); toast("🤢 Algo está errado com esse prato…"); }
      else toast("😋 Delicioso. Fome saciada.");
    } catch (er) { e.textContent = errMsg(er); btn.disabled = false; }
  });
}

// ============================================================
// eventos da arena
// ============================================================
async function startEvent(type, region, minutes){
  const ev = EVENT_BY_ID[type];
  const rec = { id: uid("ev"), type, region, startedAt: Date.now(), durationMin: minutes || ev.durationMin, endedAt: null, by: ctx.handle() };
  await ctx.api.patchCampaign(cid(), { arenaEvents: [rec, ...eventsOf()].slice(0, 12) });
  ctx.log("🚨", `<b>ALERTA DA ARENA: ${esc(ev.name)}</b> atinge a região <b>${esc(regionLabel(region)).toUpperCase()}</b>! ${esc(ev.desc)}`);

  if (ev.spawn) {
    const T = THREAT_BY_ID[ev.spawn.template];
    for (let i = 1; i <= ev.spawn.n; i++) {
      const { id, ico, fullName, ...rest } = T;
      const mid = await ctx.api.createMonster(cid(), { ...JSON.parse(JSON.stringify(rest)), ico, fullName: `${fullName} ${i}`, attacks: T.attacks.map((a, k) => ({ ...a, id: `at_${Date.now().toString(36)}${i}${k}` })) });
      await ctx.api.updateMonster(cid(), mid, { revealed: true });
    }
    ctx.log("🐇", `<b>${ev.spawn.n} ${esc(T.fullName)}s</b> foram soltos na arena e caçam os tributos. Veja em <b>Ameaças</b>.`);
  }
  if (ev.banquet) {
    const dishes = buildBanquet();
    for (const d of dishes) await ctx.api.createDrop(cid(), { key: "banquete", kind: "dish", name: d.name, ico: d.ico, qty: d.qty, poison: d.poison, evId: rec.id, locId: "ceia", locName: "Banquete", region, source: "ceia", hidden: false });
    const locs = HE.dropLocations(locsOf()).filter((l) => l.id !== "cornucopia");
    const pool = locs.length ? locs : HE.dropLocations(locsOf());
    for (let i = 0; i < 2; i++) {
      const l = pool[Math.floor(Math.random() * pool.length)];
      await ctx.api.createDrop(cid(), { key: "antidoto", kind: "item", name: "Antídoto", qty: 1, locId: l.id, locName: l.name, region: l.region, source: "antidoto", hidden: true, evId: rec.id });
    }
    ctx.log("🍽️", `Um <b>banquete</b> foi servido na região <b>${esc(regionLabel(region))}</b>. Os Idealizadores prometem… mas ninguém sabe o que há nos pratos.`);
  }
  openApply(rec.id);
}

async function endEvent(evId){
  const rec = eventsOf().find((e) => e.id === evId);
  if (!rec || !confirm(`Encerrar este evento?\n\nOs efeitos e as etapas agendadas deste evento serão removidos de todas as fichas.`)) return;
  try {
    await ctx.api.patchCampaign(cid(), { arenaEvents: eventsOf().map((e) => (e.id === evId ? { ...e, endedAt: Date.now() } : e)) });
    for (const c of ctx.characters()) {
      if ((c.fx || []).some((f) => f.ev === evId)) await ctx.api.mutateCharacter(cid(), c.id, (d) => ({ fx: (d.fx || []).filter((f) => f.ev !== evId) }));
    }
    const ev = EVENT_BY_ID[rec.type];
    ctx.log("🌤️", `O evento <b>${esc(ev ? ev.name : "")}</b> terminou na região <b>${esc(regionLabel(rec.region))}</b>.`);
  } catch (e) { err(errMsg(e)); }
}

// janela do narrador: escolhe as fichas na região e aplica
function optInput(o, charId){
  const k = `${charId}|${o.id}`;
  if (o.type === "bool") return `<label class="hg-check"><input type="checkbox" data-hg-opt="${k}" ${o.def ? "checked" : ""}> ${esc(o.label)}</label>`;
  if (o.type === "plant") return `<label class="hg-opt">${esc(o.label)} <select class="modal-select" data-hg-opt="${k}"><option value="random">aleatória</option>${PLANTS.map((p) => `<option value="${p.id}">${p.ico} ${esc(p.name)}</option>`).join("")}</select></label>
    <label class="hg-check"><input type="checkbox" data-hg-opt="${charId}|ate"> comeu o fruto</label>`;
  if (o.type === "zone") return `<label class="hg-opt">${esc(o.label)} <select class="modal-select" data-hg-opt="${k}">${Object.entries(ZONES).map(([z, l]) => `<option value="${z}" ${z === o.def ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  return "";
}

function openApply(evId){
  const rec = eventsOf().find((e) => e.id === evId);
  if (!rec) return;
  const ev = EVENT_BY_ID[rec.type];
  const chars = ctx.characters();
  const inRegion = (c) => c.region === rec.region;
  const m = openModal(`${modalBar(`/bin/evento — ${ev.name}`)}<div class="modal-body hg-apply">
    <h3 class="pz-modal-title">${ev.ico} ${esc(ev.name)} — ${esc(regionLabel(rec.region))}</h3>
    <p class="modal-rules">${esc(ev.desc)}</p>
    <ul class="pz-summary">${ev.cons.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    <p class="hg-hint">🌀 Dano de sanidade: ${ev.sanity ? `<b>${ev.sanity}%</b>${ev.id === "canarios" ? " (para quem for acertado)" : ""}` : "<b>nenhum</b> (a Última Ceia é a exceção)"}. Cada ficha rola os testes sozinha e os equipamentos entram na conta.</p>
    ${ev.banquet ? `<p class="hg-hint">O banquete já está na arena: os tributos escolhem os pratos no painel. Não há nada a aplicar aqui.</p>` : `
    <div class="hg-apply-bar"><button class="btn-mini" data-hg-all>todas as fichas</button><button class="btn-mini" data-hg-region>só quem está em ${esc(regionLabel(rec.region))}</button><button class="btn-mini" data-hg-none>nenhuma</button></div>
    <div class="hg-apply-list">${chars.map((c) => {
      return `<div class="hg-apply-row"><label class="hg-check"><input type="checkbox" data-hg-pick="${c.id}" ${inRegion(c) ? "checked" : ""}> <b>${esc(c.fullName)}</b>${c.district ? ` <small>D${c.district}</small>` : ""} <small class="hg-where">${c.region ? esc(regionLabel(c.region)) : "posição ?"}</small></label>
        <div class="hg-opts">${(ev.opts || []).map((o) => optInput(o, c.id)).join("")}</div></div>`;
    }).join("") || `<p class="empty-state">nenhuma ficha na campanha.</p>`}</div>
    <button class="roll-btn" data-hg-go><span class="roll-btn-text">APLICAR O EVENTO NAS FICHAS</span></button>
    ${(ev.followUps || []).map((f) => `<button class="btn-mini hg-follow" data-hg-follow="${f.id}">${esc(f.label)}</button>`).join("")}`}
    <p class="modal-error" data-hg-err></p>
    <div class="pz-result hg-result" data-hg-result></div>
  </div>`, "hg-apply-card");
  const picks = () => [...m.querySelectorAll("[data-hg-pick]")].filter((b) => b.checked).map((b) => b.dataset.hgPick);
  const optsOf = (charId) => {
    const o = {};
    m.querySelectorAll(`[data-hg-opt^="${charId}|"]`).forEach((el) => { const k = el.dataset.hgOpt.split("|")[1]; o[k] = el.type === "checkbox" ? el.checked : el.value; });
    return o;
  };
  const q = (s) => m.querySelector(s);
  if (ev.banquet) return;
  q("[data-hg-all]").addEventListener("click", () => m.querySelectorAll("[data-hg-pick]").forEach((b) => { b.checked = true; }));
  q("[data-hg-none]").addEventListener("click", () => m.querySelectorAll("[data-hg-pick]").forEach((b) => { b.checked = false; }));
  q("[data-hg-region]").addEventListener("click", () => m.querySelectorAll("[data-hg-pick]").forEach((b) => { const c = ctx.characters().find((x) => x.id === b.dataset.hgPick); b.checked = !!c && inRegion(c); }));
  const run = async (followUp) => {
    const ids = picks();
    if (!ids.length) { q("[data-hg-err]").textContent = "escolha pelo menos uma ficha."; return; }
    q("[data-hg-err]").textContent = "";
    m.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    try {
      const html = await applyEvent(rec, ev, ids.map((id) => ({ id, opt: optsOf(id) })), followUp);
      q("[data-hg-result]").innerHTML = html;
    } catch (e) { q("[data-hg-err]").textContent = errMsg(e); }
    m.querySelectorAll("button").forEach((b) => { b.disabled = false; });
  };
  q("[data-hg-go]").addEventListener("click", () => run(null));
  m.querySelectorAll("[data-hg-follow]").forEach((b) => b.addEventListener("click", () => run((ev.followUps || []).find((f) => f.id === b.dataset.hgFollow))));
}

async function applyEvent(rec, ev, picks, followUp){
  const rows = [];
  for (const p of picks) {
    const ch = ctx.characters().find((c) => c.id === p.id);
    if (!ch) continue;
    let res = null, ap = null;
    await ctx.api.mutateCharacter(cid(), ch.id, (d) => {
      const o = { now: Date.now(), rng: Math.random, minutes: rec.durationMin, evId: rec.id, opt: p.opt };
      res = followUp ? followUp.resolve(d, o) : ev.resolve(d, o);
      res.src = ev.name;
      ap = HE.applyResult(d, res, o.now);
      return ap.patch;
    });
    const bits = [];
    if (ap.after !== ap.before) bits.push(`vida ${ap.before}% → <b>${ap.after}%</b>`);
    if (ap.sAfter !== ap.sBefore) bits.push(`sanidade ${ap.sBefore}% → <b>${ap.sAfter}%</b>`);
    if (ap.bled) bits.push("🩸 começou a sangrar");
    if (ap.lost.length) bits.push(`perdeu: ${ap.lost.map(esc).join(", ")}`);
    if (ap.contaminated) bits.push(`${ap.contaminated} item(ns) de água/comida contaminados`);
    if (res.fx.length) bits.push(`recebeu: ${res.fx.map((f) => esc(f.l)).join("; ")}`);
    const lines = (res.lines || []).map(esc).join(" ");
    rows.push(`<div class="pz-line"><b>${esc(ch.fullName)}</b>: ${bits.join(" · ") || "sem efeito imediato"}<br><small>${lines}</small></div>`);
    ctx.log(ev.ico, `<b>${esc(ch.fullName)}</b> — <b>${esc(followUp ? followUp.label.split(":")[0] : ev.name)}</b>: ${bits.join(", ") || "sem efeito imediato"}. <small>${lines}</small>`);
    if (ap.died) ctx.log("☠️", `<b>${esc(ch.fullName)}</b> morreu.`);
    if (ap.mad) ctx.log("🌀", `<b>${esc(ch.fullName)}</b> perdeu o juízo e ficou <b>INSANO</b>.`);
  }
  return rows.join("");
}
