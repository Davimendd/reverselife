// ============================================================
// REVERSE LIFE — identidade do usuário (handle único)
// Controla o modal de escolha de handle e a reserva de nome
// único, usados tanto pelo dado quanto pelas campanhas.
// ============================================================

import { isConfigured, getDb, getFirestoreFns } from "./firebase-core.js";

const USERNAME_KEY = "rl_username";
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

const usernameOverlay = document.getElementById("usernameOverlay");
const usernameInput = document.getElementById("usernameInput");
const usernameSubmit = document.getElementById("usernameSubmit");
const usernameError = document.getElementById("usernameError");
const changeHandleBtn = document.getElementById("changeHandleBtn");
const userTag = document.getElementById("userTag");

let currentHandle = localStorage.getItem(USERNAME_KEY) || null;
let pendingResolvers = [];

function showModal(){
  usernameOverlay.classList.remove("hidden");
  usernameError.textContent = "";
  usernameInput.value = "";
  setTimeout(() => usernameInput.focus(), 50);
}

function hideModal(){
  usernameOverlay.classList.add("hidden");
}

function refreshTag(){
  userTag.textContent = currentHandle ? `handle: ${currentHandle}` : "handle: —";
}

if (currentHandle) {
  hideModal();
} else {
  showModal();
}
refreshTag();

// ------------------------------------------------------------
// reserva de nome único (Firestore transacional ou local)
// ------------------------------------------------------------
async function reserveUsernameFirebase(name){
  const db = await getDb();
  const { doc, runTransaction, serverTimestamp } = await getFirestoreFns();
  const key = name.toLowerCase();
  const ref = doc(db, "usernames", key);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) throw new Error("TAKEN");
      tx.set(ref, { display: name, createdAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (err) {
    if (err && err.message === "TAKEN") {
      return { ok: false, error: "esse handle já está em uso. escolha outro." };
    }
    console.error("Falha ao reservar handle:", err);
    return { ok: false, error: "erro ao reservar handle. tente novamente." };
  }
}

function reserveUsernameLocal(name){
  const KEY = "rl_local_usernames";
  const key = name.toLowerCase();
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
  if (list.includes(key)) {
    return { ok: false, error: "esse handle já está em uso (neste navegador)." };
  }
  list.push(key);
  localStorage.setItem(KEY, JSON.stringify(list));
  return { ok: true };
}

async function reserveUsername(name){
  return isConfigured ? reserveUsernameFirebase(name) : reserveUsernameLocal(name);
}

async function handleSubmit(){
  const raw = usernameInput.value.trim();

  if (!USERNAME_PATTERN.test(raw)) {
    usernameError.textContent = "use 3–16 caracteres: letras, números e underscore.";
    return;
  }

  usernameSubmit.disabled = true;
  usernameError.textContent = "verificando disponibilidade...";

  const result = await reserveUsername(raw);
  usernameSubmit.disabled = false;

  if (!result.ok) {
    usernameError.textContent = result.error || "não foi possível reservar esse handle.";
    return;
  }

  currentHandle = raw;
  localStorage.setItem(USERNAME_KEY, raw);
  refreshTag();
  hideModal();

  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((resolve) => resolve(raw));
}

usernameSubmit.addEventListener("click", handleSubmit);
usernameInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    handleSubmit();
  }
});

changeHandleBtn.addEventListener("click", () => {
  localStorage.removeItem(USERNAME_KEY);
  currentHandle = null;
  refreshTag();
  showModal();
});

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export function getCurrentHandle(){
  return currentHandle;
}

// Retorna uma Promise com o handle atual — se ainda não houver
// um handle escolhido, abre o modal e só resolve quando a
// pessoa confirmar um nome válido e disponível.
export function ensureHandle(){
  if (currentHandle) return Promise.resolve(currentHandle);
  showModal();
  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
  });
}

export function isModalOpen(){
  return !usernameOverlay.classList.contains("hidden");
}
