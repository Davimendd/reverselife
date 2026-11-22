// ============================================================
// REVERSE LIFE — efeitos de tela e som ao usar poderes (sistema Percy Jackson)
// Cada deus tem o seu efeito. Ultimates e 20 naturais ocupam a tela inteira
// por cerca de um segundo, com título e som próprios.
// Respeita "movimento reduzido" do sistema e pode ser desligado pelo jogador.
// ============================================================

import { GOD_BY_ID } from "./olympus-data.js";
import { playGodSfx, playCritSfx } from "./sound.js";

const KEY = "rl_fx_off";
export const fxEnabled = () => localStorage.getItem(KEY) !== "1";
export const setFxEnabled = (on) => localStorage.setItem(KEY, on ? "0" : "1");
const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// partículas por deus: glifo e quantidade
const PARTICLES = {
  demeter: { g: "🍃", n: 16 }, hefesto: { g: "✦", n: 26 }, afrodite: { g: "💗", n: 16 },
  dionisio: { g: "●", n: 18 }, hipnos: { g: "z", n: 10 }, morfeu: { g: "✧", n: 14 }, circe: { g: "✦", n: 12 },
};
// deuses cujo ultimate faz a tela tremer
const SHAKE = new Set(["zeus", "ares", "poseidon", "hefesto", "hades"]);

function particles(godId, big){
  const p = PARTICLES[godId];
  if (!p) return "";
  const n = Math.round(p.n * (big ? 1.6 : 1));
  return Array.from({ length: n }, () => {
    const x = Math.random() * 100, dx = (Math.random() - 0.5) * 24, s = 14 + Math.random() * 20;
    const d = Math.random() * 0.5, t = 0.8 + Math.random() * 0.6;
    return `<span class="pzfx-p" style="--x:${x}%;--dx:${dx}vw;--s:${s}px;--d:${d}s;--t:${t}s">${p.g}</span>`;
  }).join("");
}

// relâmpagos em zigue-zague (Zeus)
function bolts(big){
  const make = () => {
    let x = 15 + Math.random() * 70, pts = [`${x},0`];
    for (let y = 8; y <= 100; y += 8 + Math.random() * 6) { x += (Math.random() - 0.5) * 16; pts.push(`${Math.max(2, Math.min(98, x)).toFixed(1)},${y.toFixed(1)}`); }
    return `<polyline points="${pts.join(" ")}" pathLength="100" vector-effect="non-scaling-stroke"/>`;
  };
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${Array.from({ length: big ? 3 : 1 }, make).join("")}</svg>`;
}

// kind: "power" | "ultimate"; god: objeto do deus (ou null); crit: 20 natural; title: nome do poder
export function playFx({ god = null, kind = "power", crit = false, title = "", monster = false } = {}){
  if (!fxEnabled()) return;
  const g = monster ? GOD_BY_ID.ares : (god && (GOD_BY_ID[god.id || god] || god));
  const big = kind === "ultimate";
  if (!g && !crit) return;

  // som
  if (g) playGodSfx(g.id, big);
  if (crit) setTimeout(playCritSfx, g ? (big ? 600 : 260) : 0);

  // visual
  const dur = big || (crit && !g) ? 1400 : (crit ? 1100 : 950);
  const el = document.createElement("div");
  el.className = `pzfx kind-${big ? "ultimate" : "power"}${g ? ` pzfx-${g.id}` : ""}${crit ? " is-crit" : ""}`;
  el.style.setProperty("--god", g ? g.color : "#ffd24a");
  el.style.setProperty("--dur", `${dur}ms`);
  el.setAttribute("aria-hidden", "true");
  const lines = [];
  if (big && title) lines.push(`<small>ULTIMATE</small><b>${esc(title)}</b>`);
  if (crit) lines.push(`<em>★ 20 NATURAL ★</em>`);
  el.innerHTML = `
    <i class="l1"></i><i class="l2"></i><i class="l3"></i>
    ${crit ? `<i class="lc"></i>` : ""}
    ${g && g.id === "zeus" ? bolts(big) : ""}
    ${g ? particles(g.id, big) : ""}
    ${lines.length ? `<div class="pzfx-title">${lines.join("")}</div>` : ""}`;
  document.body.appendChild(el);

  if (big && g && SHAKE.has(g.id) && !reduced()) {
    document.body.classList.add("pzfx-shake");
    setTimeout(() => document.body.classList.remove("pzfx-shake"), 650);
  }
  setTimeout(() => el.remove(), dur + 80);
}
