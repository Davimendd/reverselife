// ============================================================
// REVERSE LIFE — contas (login / criar conta)
// Controla autenticação real (Firebase Authentication) com
// fallback local para testes sem Firebase configurado.
// ============================================================

import { isConfigured, getDb, getFirestoreFns, getAuthInstance, getAuthFns } from "./firebase-core.js";

export const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

// ------------------------------------------------------------
// elementos
// ------------------------------------------------------------
const overlay = document.getElementById("usernameOverlay");
const authTabs = document.getElementById("authTabs");
const loginPanel = document.getElementById("authLoginPanel");
const signupPanel = document.getElementById("authSignupPanel");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmit = document.getElementById("loginSubmit");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

const signupHandle = document.getElementById("signupHandle");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupError = document.getElementById("signupError");
const signupSubmit = document.getElementById("signupSubmit");

const userTag = document.getElementById("userTag");
const logoutBtn = document.getElementById("logoutBtn");

// currentUser: { uid, handle, email } | null
let currentUser = null;
let pendingResolvers = [];

// funções preenchidas por initFirebaseAuth() ou initLocalAuth()
let doLogin = null;
let doSignup = null;
let doLogout = null;
let doForgotPassword = null;

// ------------------------------------------------------------
// modal
// ------------------------------------------------------------
function switchTab(tab){
  [...authTabs.children].forEach((btn) => btn.classList.toggle("active", btn.dataset.authTab === tab));
  loginPanel.classList.toggle("active", tab === "login");
  signupPanel.classList.toggle("active", tab === "signup");
  setTimeout(() => {
    (tab === "login" ? loginEmail : signupHandle).focus();
  }, 50);
}

function showModal(tab = "login"){
  overlay.classList.remove("hidden");
  loginError.textContent = "";
  signupError.textContent = "";
  switchTab(tab);
}

function hideModal(){
  overlay.classList.add("hidden");
}

authTabs.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".auth-tab");
  if (!btn) return;
  switchTab(btn.dataset.authTab);
});

function refreshHeader(){
  if (currentUser) {
    userTag.textContent = `handle: ${currentUser.handle}`;
    logoutBtn.hidden = false;
  } else {
    userTag.textContent = "handle: —";
    logoutBtn.hidden = true;
  }
}

function resolvePending(){
  const handle = currentUser ? currentUser.handle : null;
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  resolvers.forEach((resolve) => resolve(handle));
}

if (currentUser) hideModal(); else showModal();
refreshHeader();

// ------------------------------------------------------------
// tradução de erros
// ------------------------------------------------------------
function mapAuthError(err){
  const code = err && err.code;
  if (code === "auth/email-already-in-use") return "esse e-mail já está cadastrado.";
  if (code === "auth/invalid-email") return "e-mail inválido.";
  if (code === "auth/weak-password") return "a senha precisa ter pelo menos 6 caracteres.";
  if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "e-mail ou senha incorretos.";
  }
  if (code === "auth/too-many-requests") return "muitas tentativas. aguarde um pouco e tente de novo.";

  const msg = err && err.message;
  if (msg === "HANDLE_TAKEN") return "esse handle já está em uso. escolha outro.";
  if (msg === "EMAIL_TAKEN") return "esse e-mail já está cadastrado (neste navegador).";
  if (msg === "INVALID_CREDENTIALS") return "e-mail ou senha incorretos.";
  if (msg === "PROFILE_MISSING") return "conta encontrada, mas sem perfil associado.";
  if (msg === "NO_RESET_LOCAL") return "recuperação de senha só está disponível com o Firebase configurado.";

  console.error("Erro de autenticação:", err);
  return "algo deu errado. tente novamente.";
}

// ------------------------------------------------------------
// backend: Firebase Authentication
// ------------------------------------------------------------
async function initFirebaseAuth(){
  const auth = await getAuthInstance();
  const db = await getDb();
  const {
    onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, sendPasswordResetEmail
  } = await getAuthFns();
  const { doc, getDoc, runTransaction, serverTimestamp } = await getFirestoreFns();

  async function loadProfile(uid, email){
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return { uid, handle: snap.data().handle, email };
  }

  // restaura sessão persistida automaticamente pelo Firebase (ex: recarregar a página)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (currentUser) { currentUser = null; refreshHeader(); }
      return;
    }
    if (currentUser && currentUser.uid === user.uid) return; // já tratado pelo fluxo interativo de login/signup
    const profile = await loadProfile(user.uid, user.email).catch(() => null);
    if (profile) {
      currentUser = profile;
      refreshHeader();
      hideModal();
      resolvePending();
    }
  });

  doLogin = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await loadProfile(cred.user.uid, cred.user.email);
    if (!profile) throw new Error("PROFILE_MISSING");
    currentUser = profile;
    return profile;
  };

  doSignup = async (email, password, handle) => {
    const key = handle.toLowerCase();
    const nameRef = doc(db, "usernames", key);

    const existing = await getDoc(nameRef);
    if (existing.exists()) throw new Error("HANDLE_TAKEN");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(nameRef);
        if (snap.exists()) throw new Error("HANDLE_TAKEN");
        tx.set(nameRef, { display: handle, uid, createdAt: serverTimestamp() });
        tx.set(doc(db, "users", uid), { handle, email, createdAt: serverTimestamp() });
      });
    } catch (err) {
      // se a reserva do handle falhou, desfaz a conta recém-criada
      await cred.user.delete().catch(() => {});
      throw err;
    }

    currentUser = { uid, handle, email };
    return currentUser;
  };

  doLogout = async () => {
    await signOut(auth);
    currentUser = null;
  };

  doForgotPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };
}

// ------------------------------------------------------------
// backend: contas locais (sem Firebase configurado)
// ⚠️ armazena a senha em texto simples no navegador — serve só
// para testar o site antes de configurar o Firebase de verdade.
// ------------------------------------------------------------
function initLocalAuth(){
  const ACCOUNTS_KEY = "rl_local_accounts";
  const SESSION_KEY = "rl_local_session";

  function readAccounts(){ try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); } catch { return []; } }
  function writeAccounts(list){ localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }

  function restoreSession(){
    const uid = localStorage.getItem(SESSION_KEY);
    if (!uid) return;
    const acc = readAccounts().find((a) => a.uid === uid);
    if (acc) {
      currentUser = { uid: acc.uid, handle: acc.handle, email: acc.email };
      refreshHeader();
      hideModal();
    }
  }
  restoreSession();

  doLogin = async (email, password) => {
    const acc = readAccounts().find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!acc || acc.password !== password) throw new Error("INVALID_CREDENTIALS");
    currentUser = { uid: acc.uid, handle: acc.handle, email: acc.email };
    localStorage.setItem(SESSION_KEY, acc.uid);
    return currentUser;
  };

  doSignup = async (email, password, handle) => {
    const list = readAccounts();
    const key = handle.toLowerCase();
    const emailKey = email.trim().toLowerCase();
    if (list.some((a) => a.handle.toLowerCase() === key)) throw new Error("HANDLE_TAKEN");
    if (list.some((a) => a.email.toLowerCase() === emailKey)) throw new Error("EMAIL_TAKEN");

    const uid = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    list.push({ uid, email: email.trim(), password, handle });
    writeAccounts(list);

    currentUser = { uid, handle, email: email.trim() };
    localStorage.setItem(SESSION_KEY, uid);
    return currentUser;
  };

  doLogout = async () => {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  };

  doForgotPassword = async () => {
    throw new Error("NO_RESET_LOCAL");
  };
}

(async function boot(){
  if (isConfigured) {
    try {
      await initFirebaseAuth();
    } catch (err) {
      console.error("Falha ao iniciar autenticação via Firebase, usando modo local:", err);
      initLocalAuth();
    }
  } else {
    initLocalAuth();
  }
  refreshHeader();
})();

// ------------------------------------------------------------
// eventos da UI
// ------------------------------------------------------------
async function handleLogin(){
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginError.textContent = "preencha e-mail e senha.";
    return;
  }
  if (!doLogin) {
    loginError.textContent = "backend ainda não carregou, tente novamente em instantes.";
    return;
  }

  loginSubmit.disabled = true;
  loginError.textContent = "entrando...";

  try {
    await doLogin(email, password);
    loginSubmit.disabled = false;
    refreshHeader();
    hideModal();
    resolvePending();
  } catch (err) {
    loginSubmit.disabled = false;
    loginError.textContent = mapAuthError(err);
  }
}

async function handleSignup(){
  const handle = signupHandle.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;

  if (!HANDLE_PATTERN.test(handle)) {
    signupError.textContent = "handle inválido: 3–16 caracteres, letras, números e underscore.";
    return;
  }
  if (!email) {
    signupError.textContent = "informe um e-mail.";
    return;
  }
  if (password.length < 6) {
    signupError.textContent = "a senha precisa ter pelo menos 6 caracteres.";
    return;
  }
  if (!doSignup) {
    signupError.textContent = "backend ainda não carregou, tente novamente em instantes.";
    return;
  }

  signupSubmit.disabled = true;
  signupError.textContent = "criando conta...";

  try {
    await doSignup(email, password, handle);
    signupSubmit.disabled = false;
    refreshHeader();
    hideModal();
    resolvePending();
  } catch (err) {
    signupSubmit.disabled = false;
    signupError.textContent = mapAuthError(err);
  }
}

loginSubmit.addEventListener("click", handleLogin);
loginPassword.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleLogin(); } });
loginEmail.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleLogin(); } });

signupSubmit.addEventListener("click", handleSignup);
signupPassword.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); handleSignup(); } });

forgotPasswordBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  if (!email) {
    loginError.textContent = "digite seu e-mail acima primeiro.";
    return;
  }
  if (!doForgotPassword) return;
  loginError.textContent = "enviando e-mail de recuperação...";
  try {
    await doForgotPassword(email);
    loginError.textContent = "e-mail de recuperação enviado — confira sua caixa de entrada.";
  } catch (err) {
    loginError.textContent = mapAuthError(err);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!doLogout) return;
  try {
    await doLogout();
  } catch (err) {
    console.error("Falha ao sair:", err);
  }
  currentUser = null;
  refreshHeader();
});

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export function getCurrentHandle(){
  return currentUser ? currentUser.handle : null;
}

export function getCurrentUid(){
  return currentUser ? currentUser.uid : null;
}

// Retorna uma Promise com o handle do usuário logado — se ainda
// não houver sessão, abre o modal de login e só resolve quando a
// pessoa entrar ou criar uma conta com sucesso.
export function ensureHandle(){
  if (currentUser) return Promise.resolve(currentUser.handle);
  showModal("login");
  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
  });
}

export function isModalOpen(){
  return !overlay.classList.contains("hidden");
}
