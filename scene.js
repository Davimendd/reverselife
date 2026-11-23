// ============================================================
// REVERSE LIFE — cenário da cena (sistema Percy Jackson)
// O narrador marca etiquetas do ambiente ("perto de água", "chovendo", "sombras"...).
// Elas aparecem para todos, preenchem sozinhas as opções dos poderes (alvo úmido, sem água...),
// avisam quando um poder exige algo que o cenário não tem e criam um clima visual leve.
// ============================================================

// mesma regra de percy.js (copiada para não criar dependência circular entre os módulos)
const isPercy = (c) => !!(c && c.percyEnabled && c.diceSystem === "d20");

export const SCENE_TAGS = [
  { id: "agua", ico: "🌊", label: "Perto de água" },
  { id: "chuva", ico: "🌧️", label: "Chovendo" },
  { id: "tempestade", ico: "⛈️", label: "Tempestade" },
  { id: "sombra", ico: "🌑", label: "Sombras" },
  { id: "vegetacao", ico: "🌿", label: "Vegetação" },
  { id: "seco", ico: "🏜️", label: "Ambiente seco" },
  { id: "sol", ico: "☀️", label: "Sol forte" },
  { id: "noite", ico: "🌙", label: "Noite" },
  { id: "fogo", ico: "🔥", label: "Fogo por perto" },
  { id: "artificial", ico: "🏢", label: "Superfície artificial" },
];
const TAG_BY_ID = Object.fromEntries(SCENE_TAGS.map((t) => [t.id, t]));

let ctx = null;
export function initScene(c){ ctx = c; }

export const sceneOf = (campaign) => (campaign && campaign.scene) || { name: "", tags: [] };
export const sceneTags = (campaign) => new Set((sceneOf(campaign).tags || []).filter((t) => TAG_BY_ID[t]));
export const sceneConfigured = (campaign) => sceneTags(campaign).size > 0;
const labelOf = (id) => (TAG_BY_ID[id] ? `${TAG_BY_ID[id].ico} ${TAG_BY_ID[id].label}` : id);

// opção do poder preenchida pelo cenário: true / false / null (sem regra ou cenário vazio)
export function autoOpt(opt, campaign){
  if (!opt || !opt.auto || !isPercy(campaign)) return null;
  const tags = sceneTags(campaign);
  if (!tags.size) return null;
  if (opt.auto.on) return opt.auto.on.some((t) => tags.has(t));
  if (opt.auto.unless) return !opt.auto.unless.some((t) => tags.has(t));
  return null;
}

// avisos de requisito do poder diante do cenário atual (sem bloquear: o narrador decide)
export function actWarnings(act, campaign){
  if (!isPercy(campaign) || !(act.need || act.not)) return [];
  const tags = sceneTags(campaign);
  if (!tags.size) return [];
  const out = [];
  const bad = (act.not || []).filter((t) => tags.has(t));
  if (bad.length) out.push(`O cenário (${bad.map(labelOf).join(", ")}) não combina com este poder — o narrador decide se funciona.`);
  if (act.need && !act.need.some((t) => tags.has(t))) out.push(`Este poder pede: ${act.need.map(labelOf).join(" ou ")}. O cenário atual não indica isso — confirme com o narrador.`);
  return out;
}

// ---------- painel ----------
let saveTimer = null, logTimer = null;

function describe(scene){
  const tags = (scene.tags || []).map(labelOf).join(", ");
  return `${scene.name ? `<b>${esc(scene.name)}</b>` : "novo cenário"}${tags ? ` — ${tags}` : " — sem condições especiais"}`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderScene(host, campaign){
  if (!host) return;
  applyAmbient(campaign);
  if (!campaign || !isPercy(campaign)) { host.hidden = true; host.innerHTML = ""; return; }
  const narr = ctx.isNarrator();
  const scene = sceneOf(campaign);
  const tags = sceneTags(campaign);
  if (!narr && !tags.size && !scene.name) { host.hidden = true; host.innerHTML = ""; return; }
  host.hidden = false;

  if (narr) {
    host.innerHTML = `
      <div class="scene-head"><span class="scene-title">🎬 cenário da cena</span><span class="scene-hint">todos veem; preenche as opções dos poderes sozinho</span></div>
      <div class="scene-name-row"><input type="text" class="scene-name" maxlength="60" placeholder="nome do lugar (opcional) — ex.: Bosque perto do lago" value="${esc(scene.name || "")}"></div>
      <div class="scene-tags">${SCENE_TAGS.map((t) => `<button type="button" class="scene-tag ${tags.has(t.id) ? "on" : ""}" data-tag="${t.id}" aria-pressed="${tags.has(t.id)}"><span>${t.ico}</span>${t.label}</button>`).join("")}</div>
      <div class="scene-foot"><button type="button" class="btn-mini" data-scene-clear>limpar cenário</button><label class="scene-amb"><input type="checkbox" data-amb ${ambientOn() ? "checked" : ""}> clima na tela</label></div>`;
    const commit = (next) => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          await ctx.api.patchCampaign(campaign.id, { scene: next });
          clearTimeout(logTimer);
          logTimer = setTimeout(() => ctx.log("🎬", `O narrador mudou o cenário: ${describe(next)}.`), 2500);
        } catch (e) { console.error("cenário:", e); }
      }, 150);
    };
    host.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => {
      const cur = new Set(sceneOf(ctx.campaign()).tags || []);
      if (cur.has(b.dataset.tag)) cur.delete(b.dataset.tag); else cur.add(b.dataset.tag);
      b.classList.toggle("on", cur.has(b.dataset.tag));          // resposta imediata antes do servidor
      commit({ name: host.querySelector(".scene-name").value.trim(), tags: [...cur] });
    }));
    const nameEl = host.querySelector(".scene-name");
    nameEl.addEventListener("change", () => commit({ name: nameEl.value.trim(), tags: sceneOf(ctx.campaign()).tags || [] }));
    host.querySelector("[data-scene-clear]").addEventListener("click", () => commit({ name: "", tags: [] }));
    host.querySelector("[data-amb]").addEventListener("change", (e) => { localStorage.setItem("rl_ambient_off", e.target.checked ? "0" : "1"); applyAmbient(ctx.campaign()); });
  } else {
    host.innerHTML = `
      <div class="scene-head"><span class="scene-title">🎬 cenário</span>${scene.name ? `<b class="scene-place">${esc(scene.name)}</b>` : ""}<label class="scene-amb"><input type="checkbox" data-amb ${ambientOn() ? "checked" : ""}> clima na tela</label></div>
      <div class="scene-tags readonly">${SCENE_TAGS.filter((t) => tags.has(t.id)).map((t) => `<span class="scene-tag on"><span>${t.ico}</span>${t.label}</span>`).join("") || `<em class="scene-hint">sem condições especiais</em>`}</div>`;
    host.querySelector("[data-amb]").addEventListener("change", (e) => { localStorage.setItem("rl_ambient_off", e.target.checked ? "0" : "1"); applyAmbient(ctx.campaign()); });
  }
}

// ---------- clima na tela (leve, sem atrapalhar a leitura) ----------
const ambientOn = () => localStorage.getItem("rl_ambient_off") !== "1";
export function applyAmbient(campaign){
  let el = document.getElementById("sceneAmbient");
  const tags = campaign && isPercy(campaign) ? sceneTags(campaign) : new Set();
  const classes = ["chuva", "tempestade", "noite", "sol", "sombra"].filter((t) => tags.has(t));
  if (!classes.length || !ambientOn()) { if (el) el.className = "scene-ambient"; return; }
  if (!el) { el = document.createElement("div"); el.id = "sceneAmbient"; el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
  el.className = `scene-ambient on ${classes.map((c) => `amb-${c}`).join(" ")}`;
}
