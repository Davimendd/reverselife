// ============================================================
// REVERSE LIFE — núcleo do Firebase
// Centraliza a inicialização para evitar múltiplas chamadas de
// initializeApp() quando vários módulos (login, dados, campanhas)
// precisam do Firestore/Auth.
// ============================================================

import { firebaseConfig } from "./firebase-config.js";

export const isConfigured = !!(firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("COLOQUE_AQUI"));

let appPromise = null;
let dbPromise = null;
let authPromise = null;

async function getApp(){
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      return initializeApp(firebaseConfig);
    })();
  }
  return appPromise;
}

export async function getDb(){
  if (!isConfigured) return null;
  if (!dbPromise) {
    dbPromise = (async () => {
      const app = await getApp();
      const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      return getFirestore(app);
    })();
  }
  return dbPromise;
}

export async function getAuthInstance(){
  if (!isConfigured) return null;
  if (!authPromise) {
    authPromise = (async () => {
      const app = await getApp();
      const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      return getAuth(app);
    })();
  }
  return authPromise;
}

export function getFirestoreFns(){
  return import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
}

export function getAuthFns(){
  return import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
}
