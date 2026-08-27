import { ROLLS_COLLECTION, FEED_LIMIT } from "./firebase-config.js";
import { isConfigured, getDb, getFirestoreFns } from "./firebase-core.js";
import { getCurrentHandle, ensureHandle, isModalOpen } from "./identity.js";
import { playDiceTick, playDeathAlert, isMuted, setMuted } from "./sound.js";

// ------------------------------------------------------------
// tabelas de resultado do dado
// ------------------------------------------------------------
const DICE_TABLES = {
  tabela: {
    label: "Tabela do Dado",
    intro: "Quando uma ação decisiva de ataque, defesa ou fuga for exigida, role o dado. Os resultados são os seguintes, dependendo de como seu personagem está:",
    entries: {
      1: { emoji: "🔴", title: "Morte Instantânea", desc: "O ataque é fatal. O personagem morre no ato." },
      2: { emoji: "🟠", title: "Dano Crítico/Quase Morte", desc: "O personagem sofre um dano massivo e fica incapacitado. Entra em estado de sangramento e morrerá se nenhum aliado ajudar a tempo." },
      3: { emoji: "🟡", title: "Acerto Crítico e Lentidão", desc: "O golpe debilita gravemente o personagem, deixando-o muito lento. O jogador pode tentar reagir respondendo com outra ação imediata, mas deve rolar o dado novamente: se cair 3 ou menos, o narrador tem direito de aplicar o golpe fatal." },
      4: { emoji: "🟢", title: "Dano Padrão", desc: "O ataque causa dano considerável, mas não mata. O defensor deve rolar o dado novamente para ver a consequência do ferimento (seguindo a mesma regra do número 3)." },
      5: { emoji: "🔵", title: "Raspão", desc: "O ataque pega de raspão causando dano mínimo. No entanto, o personagem ainda está preso no combate e não consegue fugir." },
      6: { emoji: "🟣", title: "Fuga Perfeita", desc: "O personagem consegue esquivar perfeitamente do golpe ou encontra uma brecha e foge da batalha com sucesso." }
    }
  },
  simplificada: {
    label: "Variação Simplificada",
    intro: "Divisão por Funções: dependendo do RPG, os dados podem ter apenas duas funções diretas, sendo divididos em dois blocos de 3 números.",
    entries: {
      1: { emoji: "⚔️", title: "Dano", desc: "O personagem falha na defesa e sofre o dano do ataque." },
      2: { emoji: "⚔️", title: "Dano", desc: "O personagem falha na defesa e sofre o dano do ataque." },
      3: { emoji: "⚔️", title: "Dano", desc: "O personagem falha na defesa e sofre o dano do ataque." },
      4: { emoji: "🏃", title: "Escapou", desc: "O personagem consegue se esquivar e escapar do combate com sucesso." },
      5: { emoji: "🏃", title: "Escapou", desc: "O personagem consegue se esquivar e escapar do combate com sucesso." },
      6: { emoji: "🏃", title: "Escapou", desc: "O personagem consegue se esquivar e escapar do combate com sucesso." }
    }
  },
  execucao: {
    label: "Dado de Execução",
    intro: "Quando um personagem é realmente alcançado e existe oportunidade de execução:",
    entries: {
      1: { emoji: "🔴", title: "Ataque Devastador", desc: "O personagem não morre automaticamente apenas pelo número. O Narrador determina um dano muito alto e um ferimento compatível. Se o dano acumulado atingir 100%, ocorre a morte." },
      2: { emoji: "🟠", title: "Ataque Crítico", desc: "Grande quantidade de dano. Pode provocar um ferimento grave e deixar o personagem extremamente vulnerável. Se atingir 100%: ☠️ Morte." },
      3: { emoji: "🟡", title: "Ataque Grave", desc: "O personagem evita a execução imediata, mas sofre dano considerável e um possível ferimento." },
      4: { emoji: "🟢", title: "Escape Ferido", desc: "O personagem consegue escapar do ataque principal, mas pode sofrer uma consequência menor." },
      5: { emoji: "🔵", title: "Esquiva", desc: "O personagem evita o ataque e consegue abrir distância." },
      6: { emoji: "🟣", title: "Escape Perfeito", desc: "O personagem evita completamente aquela tentativa de execução e consegue sair da situação imediata." }
    }
  }
};

const DEFAULT_MODE = "tabela";

// ------------------------------------------------------------
// elementos
// ------------------------------------------------------------
const dieBtn = document.getElementById("dieBtn");
const dieSvg = document.getElementById("dieSvg");
const dieGlow = document.getElementById("dieGlow");
const pipsGroup = document.getElementById("pips");
const rollBtn = document.getElementById("rollBtn");
const resultValue = document.getElementById("resultValue");
const feedEl = document.getElementById("feed");
const terminalBoot = document.getElementById("terminalBoot");
const rollCountEl = document.getElementById("rollCount");
const connDot = document.getElementById("connDot");
const connLabel = document.getElementById("connLabel");
const modeTag = document.getElementById("modeTag");
const muteBtn = document.getElementById("muteBtn");

const modeSelect = document.getElementById("modeSelect");
const modeIntro = document.getElementById("modeIntro");
const outcomeBox = document.getElementById("outcomeBox");
const outcomeEmoji = document.getElementById("outcomeEmoji");
const outcomeTitle = document.getElementById("outcomeTitle");
const outcomeDesc = document.getElementById("outcomeDesc");

// ------------------------------------------------------------
// troca de abas (Dados / Campanhas)
// ------------------------------------------------------------
const tabNav = document.getElementById("tabNav");
tabNav.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab-btn");
  if (!btn) return;
  const targetId = btn.dataset.tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === targetId));
});

// ------------------------------------------------------------
// mudo
// ------------------------------------------------------------
function applyMuteUI(){
  const muted = isMuted();
  muteBtn.textContent = muted ? "🔇" : "🔊";
  muteBtn.classList.toggle("is-muted", muted);
}
muteBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  applyMuteUI();
});
applyMuteUI();

// ------------------------------------------------------------
// modo/sistema de dado selecionado
// ------------------------------------------------------------
const MODE_KEY = "rl_dice_mode";
let currentMode = localStorage.getItem(MODE_KEY) || DEFAULT_MODE;
if (!DICE_TABLES[currentMode]) currentMode = DEFAULT_MODE;

function applyModeUI(){
  [...modeSelect.children].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === currentMode);
  });
  modeIntro.textContent = DICE_TABLES[currentMode].intro;
}

modeSelect.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".mode-btn");
  if (!btn) return;
  currentMode = btn.dataset.mode;
  localStorage.setItem(MODE_KEY, currentMode);
  applyModeUI();
});

applyModeUI();

function getEntry(modeKey, value){
  const table = DICE_TABLES[modeKey] || DICE_TABLES[DEFAULT_MODE];
  return table.entries[value] || null;
}

function renderOutcome(modeKey, value){
  const entry = getEntry(modeKey, value);
  if (!entry) return;
  outcomeEmoji.textContent = entry.emoji;
  outcomeTitle.textContent = entry.title;
  outcomeDesc.textContent = entry.desc;
  outcomeBox.hidden = false;
}

function outcomeTitleFor(modeKey, value){
  const entry = getEntry(modeKey, value);
  return entry ? `${entry.emoji} ${entry.title}` : "";
}

// ------------------------------------------------------------
// pips do dado (layout clássico 1-6)
// ------------------------------------------------------------
const PIP_LAYOUTS = {
  1: [[100,100]],
  2: [[62,62],[138,138]],
  3: [[62,62],[100,100],[138,138]],
  4: [[62,62],[138,62],[62,138],[138,138]],
  5: [[62,62],[138,62],[100,100],[62,138],[138,138]],
  6: [[62,55],[138,55],[62,100],[138,100],[62,145],[138,145]]
};

function renderPips(value){
  pipsGroup.innerHTML = "";
  const coords = PIP_LAYOUTS[value] || PIP_LAYOUTS[1];
  coords.forEach(([cx, cy]) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx);
    c.setAttribute("cy", cy);
    c.setAttribute("r", 12);
    c.setAttribute("class", "pip");
    pipsGroup.appendChild(c);
  });
}
renderPips(1);

// ------------------------------------------------------------
// formatação de horário
// ------------------------------------------------------------
function timeLabel(date){
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ------------------------------------------------------------
// feed: renderiza uma linha de rolagem no terminal
// ------------------------------------------------------------
let renderedIds = new Set();
let rollTotal = 0;

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function addFeedLine(roll){
  if (roll.id && renderedIds.has(roll.id)) return;
  if (roll.id) renderedIds.add(roll.id);

  if (terminalBoot) terminalBoot.style.display = "none";

  const handle = getCurrentHandle();
  const line = document.createElement("div");
  const isYou = handle && roll.user.toLowerCase() === handle.toLowerCase();
  line.className = "feed-line" + (isYou ? " feed-you" : "");

  const ts = roll.date ? timeLabel(roll.date) : "--:--:--";
  const outcome = outcomeTitleFor(roll.mode, roll.value);
  line.innerHTML =
    `<span class="feed-time">[${ts}]</span> ` +
    `<span class="feed-user">${escapeHtml(roll.user)}</span> ` +
    `<span class="feed-arrow">rolou →</span> ` +
    `<span class="feed-result">${roll.value}</span>` +
    (outcome ? ` <span class="feed-arrow">·</span> <span class="feed-outcome">${escapeHtml(outcome)}</span>` : "");

  feedEl.prepend(line);

  while (feedEl.children.length > FEED_LIMIT) {
    feedEl.removeChild(feedEl.lastChild);
  }

  rollTotal += 1;
  rollCountEl.textContent = `${rollTotal} rolagem${rollTotal === 1 ? "" : "s"}`;
}

// ------------------------------------------------------------
// animação do dado
// ------------------------------------------------------------
let rolling = false;

function playRollAnimation(finalValue){
  return new Promise((resolve) => {
    rolling = true;
    dieSvg.classList.add("rolling");
    dieGlow.classList.add("rolling");
    rollBtn.disabled = true;

    let ticks = 0;
    const maxTicks = 10;
    const interval = setInterval(() => {
      renderPips(1 + Math.floor(Math.random() * 6));
      playDiceTick();
      ticks += 1;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        renderPips(finalValue);
        resultValue.textContent = finalValue;
        dieSvg.classList.remove("rolling");
        dieGlow.classList.remove("rolling");
        rollBtn.disabled = false;
        rolling = false;
        resolve();
      }
    }, 55);
  });
}

// ------------------------------------------------------------
// backend: tenta Firebase, senão cai em modo local
// ------------------------------------------------------------
let submitRoll = null;

async function initFirebase(){
  const db = await getDb();
  const { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } = await getFirestoreFns();

  const rollsRef = collection(db, ROLLS_COLLECTION);
  const q = query(rollsRef, orderBy("createdAt", "desc"), limit(FEED_LIMIT));

  onSnapshot(q, (snapshot) => {
    setConnected(true);
    const docs = [...snapshot.docs].reverse();
    docs.forEach((docSnap) => {
      if (renderedIds.has(docSnap.id)) return;
      const data = docSnap.data();
      const date = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
      addFeedLine({ id: docSnap.id, user: data.user, value: data.value, mode: data.mode, date });
    });
  }, () => {
    setConnected(false, "erro de conexão");
  });

  submitRoll = async (value, mode) => {
    await addDoc(rollsRef, {
      user: getCurrentHandle(),
      value,
      mode,
      createdAt: serverTimestamp()
    });
  };

  modeTag.textContent = "modo: online (Firebase)";
  setConnected(true);
}

function initLocalFallback(){
  const STORAGE_KEY = "rl_local_rolls";
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("reverse_life_rolls") : null;

  function readStored(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  }
  function writeStored(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-FEED_LIMIT)));
  }

  readStored().forEach((r) => {
    addFeedLine({ id: r.id, user: r.user, value: r.value, mode: r.mode, date: new Date(r.ts) });
  });

  function handleIncoming(r){
    addFeedLine({ id: r.id, user: r.user, value: r.value, mode: r.mode, date: new Date(r.ts) });
  }

  if (channel) channel.onmessage = (ev) => handleIncoming(ev.data);

  window.addEventListener("storage", (ev) => {
    if (ev.key !== STORAGE_KEY || !ev.newValue) return;
    try {
      const list = JSON.parse(ev.newValue);
      const last = list[list.length - 1];
      if (last) handleIncoming(last);
    } catch {}
  });

  submitRoll = async (value, mode) => {
    const roll = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user: getCurrentHandle(),
      value,
      mode,
      ts: Date.now()
    };
    const list = readStored();
    list.push(roll);
    writeStored(list);
    addFeedLine({ id: roll.id, user: roll.user, value: roll.value, mode: roll.mode, date: new Date(roll.ts) });
    if (channel) channel.postMessage(roll);
  };

  modeTag.textContent = "modo: local (sem Firebase configurado)";
  setConnected(true, "local — só entre abas deste navegador");
}

function setConnected(ok, label){
  connDot.classList.toggle("live", ok);
  connLabel.textContent = label || (ok ? "conectado" : "desconectado");
}

(async function boot(){
  setConnected(false, "conectando…");
  if (isConfigured) {
    try {
      await initFirebase();
    } catch (err) {
      console.error("Falha ao iniciar Firebase, usando modo local:", err);
      initLocalFallback();
    }
  } else {
    initLocalFallback();
  }
})();

// ------------------------------------------------------------
// interação: rolar o dado
// ------------------------------------------------------------
async function handleRoll(){
  if (rolling || !submitRoll) return;
  const handle = await ensureHandle();
  if (!handle) return;

  outcomeBox.hidden = true;
  const value = 1 + Math.floor(Math.random() * 6);
  await playRollAnimation(value);
  renderOutcome(currentMode, value);

  const entry = getEntry(currentMode, value);
  if (entry && entry.emoji === "🔴") {
    playDeathAlert();
  }

  try {
    await submitRoll(value, currentMode);
  } catch (err) {
    console.error("Falha ao enviar rolagem:", err);
  }
}

dieBtn.addEventListener("click", handleRoll);
rollBtn.addEventListener("click", handleRoll);

window.addEventListener("keydown", (ev) => {
  if (ev.code !== "Space" || ev.repeat) return;
  if (isModalOpen()) return;
  const activeTag = document.activeElement && document.activeElement.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  const diceTabActive = document.getElementById("tabDice").classList.contains("active");
  if (!diceTabActive) return;
  ev.preventDefault();
  handleRoll();
});
