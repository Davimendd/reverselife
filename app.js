import { firebaseConfig, ROLLS_COLLECTION, FEED_LIMIT } from "./firebase-config.js";

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
const userTag = document.getElementById("userTag");
const modeTag = document.getElementById("modeTag");
const terminalBody = document.getElementById("terminalBody");

// ------------------------------------------------------------
// handle anônimo da sessão (estilo "hacker tag")
// ------------------------------------------------------------
const ADJ = ["GHOST", "VOID", "CRIMSON", "NULL", "SHADE", "WRAITH", "ECHO", "FERAL", "ASH", "OMEN"];
function makeHandle(){
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = Math.floor(1000 + Math.random() * 8999);
  return `${a}_${n}`;
}
let USER_HANDLE = sessionStorage.getItem("rl_handle");
if (!USER_HANDLE) {
  USER_HANDLE = makeHandle();
  sessionStorage.setItem("rl_handle", USER_HANDLE);
}
userTag.textContent = `handle: ${USER_HANDLE}`;

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

function addFeedLine(roll){
  if (roll.id && renderedIds.has(roll.id)) return;
  if (roll.id) renderedIds.add(roll.id);

  if (terminalBoot) terminalBoot.style.display = "none";

  const line = document.createElement("div");
  const isYou = roll.user === USER_HANDLE;
  line.className = "feed-line" + (isYou ? " feed-you" : "");

  const ts = roll.date ? timeLabel(roll.date) : "--:--:--";
  line.innerHTML =
    `<span class="feed-time">[${ts}]</span> ` +
    `<span class="feed-user">${escapeHtml(roll.user)}</span> ` +
    `<span class="feed-arrow">rolou →</span> ` +
    `<span class="feed-result">${roll.value}</span>`;

  feedEl.prepend(line);

  // limita quantidade de linhas no DOM
  while (feedEl.children.length > FEED_LIMIT) {
    feedEl.removeChild(feedEl.lastChild);
  }

  rollTotal += 1;
  rollCountEl.textContent = `${rollTotal} rolagem${rollTotal === 1 ? "" : "s"}`;
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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
const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("COLOQUE_AQUI");

let submitRoll = null;

async function initFirebase(){
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const {
    getFirestore, collection, addDoc, query, orderBy, limit,
    onSnapshot, serverTimestamp, Timestamp
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const rollsRef = collection(db, ROLLS_COLLECTION);

  const q = query(rollsRef, orderBy("createdAt", "desc"), limit(FEED_LIMIT));

  onSnapshot(q, (snapshot) => {
    setConnected(true);
    const docs = [...snapshot.docs].reverse();
    docs.forEach((docSnap) => {
      if (renderedIds.has(docSnap.id)) return;
      const data = docSnap.data();
      const date = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
      addFeedLine({ id: docSnap.id, user: data.user, value: data.value, date });
    });
  }, () => {
    setConnected(false, "erro de conexão");
  });

  submitRoll = async (value) => {
    await addDoc(rollsRef, {
      user: USER_HANDLE,
      value,
      createdAt: serverTimestamp()
    });
  };

  modeTag.textContent = "modo: online (Firebase)";
  setConnected(true);
}

// ------------------------------------------------------------
// fallback local: localStorage + BroadcastChannel
// sincroniza entre abas do mesmo navegador enquanto o Firebase
// não estiver configurado.
// ------------------------------------------------------------
function initLocalFallback(){
  const STORAGE_KEY = "rl_local_rolls";
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("reverse_life_rolls") : null;

  function readStored(){
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeStored(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-FEED_LIMIT)));
  }

  // carrega histórico já existente
  readStored().forEach((r) => {
    addFeedLine({ id: r.id, user: r.user, value: r.value, date: new Date(r.ts) });
  });

  function handleIncoming(r){
    addFeedLine({ id: r.id, user: r.user, value: r.value, date: new Date(r.ts) });
  }

  if (channel) {
    channel.onmessage = (ev) => handleIncoming(ev.data);
  }

  window.addEventListener("storage", (ev) => {
    if (ev.key !== STORAGE_KEY || !ev.newValue) return;
    try {
      const list = JSON.parse(ev.newValue);
      const last = list[list.length - 1];
      if (last) handleIncoming(last);
    } catch {}
  });

  submitRoll = async (value) => {
    const roll = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user: USER_HANDLE,
      value,
      ts: Date.now()
    };
    const list = readStored();
    list.push(roll);
    writeStored(list);
    addFeedLine({ id: roll.id, user: roll.user, value: roll.value, date: new Date(roll.ts) });
    if (channel) channel.postMessage(roll);
  };

  modeTag.textContent = "modo: local (sem Firebase configurado)";
  setConnected(true, "local — só entre abas deste navegador");
}

function setConnected(ok, label){
  connDot.classList.toggle("live", ok);
  connLabel.textContent = label || (ok ? "conectado" : "desconectado");
}

// ------------------------------------------------------------
// boot
// ------------------------------------------------------------
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
  const value = 1 + Math.floor(Math.random() * 6);
  await playRollAnimation(value);
  try {
    await submitRoll(value);
  } catch (err) {
    console.error("Falha ao enviar rolagem:", err);
  }
}

dieBtn.addEventListener("click", handleRoll);
rollBtn.addEventListener("click", handleRoll);

window.addEventListener("keydown", (ev) => {
  if (ev.code === "Space" && !ev.repeat) {
    ev.preventDefault();
    handleRoll();
  }
});
