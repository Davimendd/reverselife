import { isConfigured, getDb } from "./firebase-core.js";
import { isMuted, setMuted } from "./sound.js";

// ------------------------------------------------------------
// botão de som do topo
// ------------------------------------------------------------
const muteBtn = document.getElementById("muteBtn");
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
// indicador de conexão do topo
// ------------------------------------------------------------
const connDot = document.getElementById("connDot");
const connLabel = document.getElementById("connLabel");

function setConnected(ok, label){
  connDot.classList.toggle("live", ok);
  connLabel.textContent = label || (ok ? "conectado" : "desconectado");
}

(async function checkConnection(){
  setConnected(false, "conectando…");
  if (!isConfigured) {
    setConnected(true, "local — só entre abas deste navegador");
    return;
  }
  try {
    await getDb();
    setConnected(true);
  } catch (err) {
    console.error("Falha ao conectar ao Firebase:", err);
    setConnected(true, "local — só entre abas deste navegador");
  }
})();
