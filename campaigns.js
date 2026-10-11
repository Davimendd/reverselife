import { isConfigured, getDb, getFirestoreFns } from "./firebase-core.js";
import { getCurrentHandle, getCurrentUid, ensureHandle } from "./identity.js";
import {
  ATTRS, ATTR_POINTS_TOTAL, ATTR_MAX, attrValue, validateAttrs, maxDamageOf, bodyState,
  bleedProgress, computeBleedTicks, BLEED_TICKS, D20_TESTS, rollD20, d20Message,
  HERBS, herbEffect, herbEffectText, INSANE_DESC
} from "./rules.js";
import { DICE_TABLES, DEFAULT_MODE } from "./dice-data.js";
import { playDiceTick, playDeathAlert } from "./sound.js";

// ------------------------------------------------------------
// categorias de item de inventário
// ------------------------------------------------------------
const ITEM_CATEGORIES = {
  alimento: { label: "Alimento", icon: "🍗" },
  bebida: { label: "Bebida", icon: "🥤" },
  arma: { label: "Arma", icon: "🗡️" },
  equipamento: { label: "Equipamento", icon: "🎒" },
  cura: { label: "Cura", icon: "💉" },
  erva_verde: { label: "Erva Verde", icon: "🌿" },
  erva_vermelha: { label: "Erva Vermelha", icon: "🌺" },
  erva_azul: { label: "Erva Azul", icon: "🫐" }
};

function categoryIcon(category){
  return (ITEM_CATEGORIES[category] && ITEM_CATEGORIES[category].icon) || "📦";
}

// ------------------------------------------------------------
// elementos
// ------------------------------------------------------------
const campaignListView = document.getElementById("campaignListView");
const campaignDetailView = document.getElementById("campaignDetailView");
const campaignGrid = document.getElementById("campaignGrid");
const campaignEmpty = document.getElementById("campaignEmpty");
const campaignsModeEl = document.getElementById("campaignsMode");
const backToCampaignsBtn = document.getElementById("backToCampaigns");
const campaignHeaderEl = document.getElementById("campaignHeader");
const htPanel = document.getElementById("htPanel");
const cureConfigEl = document.getElementById("cureConfig");
const rulesPanelEl = document.getElementById("rulesPanel");
const diceHostEl = document.getElementById("campDice");
const charAttrBlock = document.getElementById("charAttrBlock");
const mixModal = document.getElementById("mixModal");
const mixModalClose = document.getElementById("mixModalClose");
const mixHerbA = document.getElementById("mixHerbA");
const mixHerbB = document.getElementById("mixHerbB");
const mixEffect = document.getElementById("mixEffect");
const mixError = document.getElementById("mixError");
const mixSubmit = document.getElementById("mixSubmit");
const characterGrid = document.getElementById("characterGrid");
const characterEmpty = document.getElementById("characterEmpty");
const characterSearch = document.getElementById("characterSearch");
const eventList = document.getElementById("eventList");
const eventLogEmpty = document.getElementById("eventLogEmpty");
const eventCount = document.getElementById("eventCount");
const notifyBtn = document.getElementById("notifyBtn");
const notifyTestBtn = document.getElementById("notifyTestBtn");

const createCampaignBtn = document.getElementById("createCampaignBtn");
const campaignModal = document.getElementById("campaignModal");
const campaignModalClose = document.getElementById("campaignModalClose");
const campaignName = document.getElementById("campaignName");
const campaignDesc = document.getElementById("campaignDesc");
const campaignImage = document.getElementById("campaignImage");
const campaignImagePreview = document.getElementById("campaignImagePreview");
const campaignError = document.getElementById("campaignError");
const campaignSubmit = document.getElementById("campaignSubmit");

const createCharacterBtn = document.getElementById("createCharacterBtn");
const characterModal = document.getElementById("characterModal");
const characterModalTitle = document.getElementById("characterModalTitle");
const characterModalClose = document.getElementById("characterModalClose");
const charName = document.getElementById("charName");
const charGender = document.getElementById("charGender");
const charStrength = document.getElementById("charStrength");
const charWeakness = document.getElementById("charWeakness");
const charPhoto = document.getElementById("charPhoto");
const charPhotoHint = document.getElementById("charPhotoHint");
const charPhotoPreview = document.getElementById("charPhotoPreview");
const characterError = document.getElementById("characterError");
const characterSubmit = document.getElementById("characterSubmit");
const characterSubmitText = document.getElementById("characterSubmitText");

const itemModal = document.getElementById("itemModal");
const itemModalClose = document.getElementById("itemModalClose");
const itemName = document.getElementById("itemName");
const itemDescription = document.getElementById("itemDescription");
const itemCategory = document.getElementById("itemCategory");
const itemQuantity = document.getElementById("itemQuantity");
const itemError = document.getElementById("itemError");
const itemSubmit = document.getElementById("itemSubmit");

const transferModal = document.getElementById("transferModal");
const transferModalClose = document.getElementById("transferModalClose");
const transferItemLabel = document.getElementById("transferItemLabel");
const transferTarget = document.getElementById("transferTarget");
const transferQuantity = document.getElementById("transferQuantity");
const transferError = document.getElementById("transferError");
const transferSubmit = document.getElementById("transferSubmit");

// ------------------------------------------------------------
// helpers de imagem: redimensiona no navegador e converte para
// base64 — a imagem é salva direto no documento do Firestore,
// sem precisar do Firebase Storage (que exige plano pago).
// ------------------------------------------------------------
function compressImage(file, maxDim = 640, quality = 0.72){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality) });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function wireImagePreview(input, previewBox){
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) { previewBox.hidden = true; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      previewBox.querySelector("img").src = e.target.result;
      previewBox.hidden = false;
    };
    reader.readAsDataURL(file);
  });
}
wireImagePreview(campaignImage, campaignImagePreview);
wireImagePreview(charPhoto, charPhotoPreview);

// ------------------------------------------------------------
// backend abstrato: create / listen / createCharacter /
// listenCharacters / patchCharacter — implementado por
// Firebase (initFirebaseBackend) ou localStorage (initLocalBackend)
// ------------------------------------------------------------
const campaignsAPI = {
  create: null,
  listen: null,
  createCharacter: null,
  listenCharacters: null,
  patchCharacter: null,
  updateCharacterInfo: null,
  logEvent: null,
  listenEvents: null,
  transferItem: null,
  patchCampaign: null,
  bulkPatchCharacters: null,
  applyBleeding: null
};

// ------------------------------------------------------------
// lógica pura de transferência de item — usada tanto pelo
// backend Firebase (dentro de uma transação) quanto pelo local
// ------------------------------------------------------------
function computeTransfer(fromItems, toItems, itemId, quantity){
  const fromList = [...fromItems];
  const idx = fromList.findIndex((it) => it.id === itemId);
  if (idx === -1) return null;

  const item = fromList[idx];
  const qty = Math.max(1, Math.min(quantity, item.quantity));

  if (qty >= item.quantity) {
    fromList.splice(idx, 1);
  } else {
    fromList[idx] = { ...item, quantity: item.quantity - qty };
  }

  const toList = [...toItems];
  const matchIdx = toList.findIndex((it) => it.name === item.name && it.category === item.category);
  if (matchIdx !== -1) {
    toList[matchIdx] = { ...toList[matchIdx], quantity: toList[matchIdx].quantity + qty };
  } else {
    toList.push({
      id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: qty
    });
  }

  return { fromItems: fromList, toItems: toList, moved: { name: item.name, quantity: qty } };
}

async function initFirebaseBackend(){
  const db = await getDb();
  const { collection, addDoc, doc, updateDoc, runTransaction, writeBatch, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } = await getFirestoreFns();

  campaignsAPI.create = async ({ name, description, imageFile }) => {
    const creator = getCurrentHandle();
    const creatorUid = getCurrentUid();
    let imageUrl = "";
    if (imageFile) {
      const { dataUrl } = await compressImage(imageFile, 640, 0.72);
      imageUrl = dataUrl;
    }
    const docRef = await addDoc(collection(db, "campaigns"), {
      name, description, creator, creatorUid, imageUrl, createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  campaignsAPI.listen = (callback) => {
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  };

  campaignsAPI.createCharacter = async (campaignId, { fullName, gender, strength, weakness, photoFile, attrs }) => {
    const creator = getCurrentHandle();
    const creatorUid = getCurrentUid();
    let photoUrl = "";
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      photoUrl = dataUrl;
    }
    const charsRef = collection(db, "campaigns", campaignId, "characters");
    const docRef = await addDoc(charsRef, {
      fullName, gender, strength, weakness, photoUrl,
      creator, creatorUid, damage: 0, injuries: "", items: [], sanity: 0, bleeding: null, attrs: attrs || null, createdAt: serverTimestamp()
    });
    return docRef.id;
  };

  campaignsAPI.listenCharacters = (campaignId, callback) => {
    const q = query(collection(db, "campaigns", campaignId, "characters"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  };

  campaignsAPI.patchCharacter = async (campaignId, characterId, patch) => {
    await updateDoc(doc(db, "campaigns", campaignId, "characters", characterId), patch);
  };

  campaignsAPI.updateCharacterInfo = async (campaignId, characterId, { fullName, gender, strength, weakness, photoFile }) => {
    const patch = { fullName, gender, strength, weakness };
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      patch.photoUrl = dataUrl;
    }
    await updateDoc(doc(db, "campaigns", campaignId, "characters", characterId), patch);
  };

  campaignsAPI.logEvent = async (campaignId, { icon, text }) => {
    const eventsRef = collection(db, "campaigns", campaignId, "events");
    await addDoc(eventsRef, { icon, text, createdAt: serverTimestamp() });
  };

  campaignsAPI.listenEvents = (campaignId, callback, onError) => {
    const q = query(collection(db, "campaigns", campaignId, "events"), orderBy("createdAt", "desc"), limit(60));
    return onSnapshot(q, (snap) => {
      // a query vem do mais recente pro mais antigo; invertemos para
      // manter o mesmo contrato do backend local (mais antigo primeiro)
      const docs = [...snap.docs].reverse();
      callback(docs.map((d) => {
        const data = d.data();
        const date = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
        return { id: d.id, icon: data.icon, text: data.text, date };
      }));
    }, (err) => {
      console.error("Falha ao ler histórico de eventos:", err);
      if (onError) onError(err);
    });
  };

  campaignsAPI.transferItem = async (campaignId, fromCharacterId, toCharacterId, itemId, quantity) => {
    const fromRef = doc(db, "campaigns", campaignId, "characters", fromCharacterId);
    const toRef = doc(db, "campaigns", campaignId, "characters", toCharacterId);

    return runTransaction(db, async (tx) => {
      const fromSnap = await tx.get(fromRef);
      const toSnap = await tx.get(toRef);
      if (!fromSnap.exists() || !toSnap.exists()) throw new Error("CHARACTER_NOT_FOUND");

      const fromData = fromSnap.data();
      const toData = toSnap.data();
      const result = computeTransfer(fromData.items || [], toData.items || [], itemId, quantity);
      if (!result) throw new Error("ITEM_NOT_FOUND");

      tx.update(fromRef, { items: result.fromItems });
      tx.update(toRef, { items: result.toItems });
      return result.moved;
    });
  };

  campaignsAPI.patchCampaign = async (campaignId, patch) => {
    await updateDoc(doc(db, "campaigns", campaignId), patch);
  };

  campaignsAPI.bulkPatchCharacters = async (campaignId, updates) => {
    const batch = writeBatch(db);
    updates.forEach(({ characterId, patch }) => {
      batch.update(doc(db, "campaigns", campaignId, "characters", characterId), patch);
    });
    await batch.commit();
  };

  campaignsAPI.applyBleeding = async (campaignId, characterId, now) => {
    const ref = doc(db, "campaigns", campaignId, "characters", characterId);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const res = computeBleedTicks(snap.data(), now);
      if (!res) return null;
      tx.update(ref, res.patch);
      return res;
    });
  };

  campaignsModeEl.textContent = "modo: online (Firebase)";
}

function initLocalBackend(){
  const CAMPAIGNS_KEY = "rl_local_campaigns";
  const charKey = (campaignId) => `rl_local_characters_${campaignId}`;
  const eventKey = (campaignId) => `rl_local_events_${campaignId}`;
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("reverse_life_campaigns") : null;

  function readCampaigns(){ try { return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || "[]"); } catch { return []; } }
  function writeCampaigns(list){ localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list)); }
  function readCharacters(campaignId){ try { return JSON.parse(localStorage.getItem(charKey(campaignId)) || "[]"); } catch { return []; } }
  function writeCharacters(campaignId, list){ localStorage.setItem(charKey(campaignId), JSON.stringify(list)); }
  function readEvents(campaignId){ try { return JSON.parse(localStorage.getItem(eventKey(campaignId)) || "[]"); } catch { return []; } }
  function writeEvents(campaignId, list){ localStorage.setItem(eventKey(campaignId), JSON.stringify(list.slice(-60))); }

  let campaignListeners = [];
  let characterListeners = {};
  let eventListeners = {};

  function notifyCampaigns(){
    const list = readCampaigns();
    campaignListeners.forEach((cb) => cb(list));
  }
  function notifyCharacters(campaignId){
    const list = readCharacters(campaignId);
    (characterListeners[campaignId] || []).forEach((cb) => cb(list));
  }
  function notifyEvents(campaignId){
    const list = readEvents(campaignId).map((e) => ({ ...e, date: new Date(e.ts) }));
    (eventListeners[campaignId] || []).forEach((cb) => cb(list));
  }

  if (channel) {
    channel.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === "campaign") notifyCampaigns();
      if (msg.type === "character") notifyCharacters(msg.campaignId);
      if (msg.type === "event") notifyEvents(msg.campaignId);
    };
  }
  window.addEventListener("storage", (ev) => {
    if (ev.key === CAMPAIGNS_KEY) notifyCampaigns();
    else if (ev.key && ev.key.startsWith("rl_local_characters_")) {
      notifyCharacters(ev.key.slice("rl_local_characters_".length));
    } else if (ev.key && ev.key.startsWith("rl_local_events_")) {
      notifyEvents(ev.key.slice("rl_local_events_".length));
    }
  });

  campaignsAPI.create = async ({ name, description, imageFile }) => {
    const creator = getCurrentHandle();
    const creatorUid = getCurrentUid();
    let imageUrl = "";
    if (imageFile) {
      const { dataUrl } = await compressImage(imageFile, 640, 0.72);
      imageUrl = dataUrl;
    }
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const list = readCampaigns();
    list.unshift({ id, name, description, imageUrl, creator, creatorUid, createdAt: Date.now() });
    writeCampaigns(list);
    notifyCampaigns();
    if (channel) channel.postMessage({ type: "campaign" });
    return id;
  };

  campaignsAPI.listen = (callback) => {
    campaignListeners.push(callback);
    callback(readCampaigns());
    return () => { campaignListeners = campaignListeners.filter((cb) => cb !== callback); };
  };

  campaignsAPI.createCharacter = async (campaignId, { fullName, gender, strength, weakness, photoFile, attrs }) => {
    const creator = getCurrentHandle();
    const creatorUid = getCurrentUid();
    let photoUrl = "";
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      photoUrl = dataUrl;
    }
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const list = readCharacters(campaignId);
    list.push({ id, fullName, gender, strength, weakness, photoUrl, creator, creatorUid, damage: 0, injuries: "", items: [], sanity: 0, bleeding: null, attrs: attrs || null, createdAt: Date.now() });
    writeCharacters(campaignId, list);
    notifyCharacters(campaignId);
    if (channel) channel.postMessage({ type: "character", campaignId });
    return id;
  };

  campaignsAPI.listenCharacters = (campaignId, callback) => {
    characterListeners[campaignId] = characterListeners[campaignId] || [];
    characterListeners[campaignId].push(callback);
    callback(readCharacters(campaignId));
    return () => {
      characterListeners[campaignId] = (characterListeners[campaignId] || []).filter((cb) => cb !== callback);
    };
  };

  campaignsAPI.patchCharacter = async (campaignId, characterId, patch) => {
    const list = readCharacters(campaignId);
    const idx = list.findIndex((c) => c.id === characterId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...patch };
    writeCharacters(campaignId, list);
    notifyCharacters(campaignId);
    if (channel) channel.postMessage({ type: "character", campaignId });
  };

  campaignsAPI.updateCharacterInfo = async (campaignId, characterId, { fullName, gender, strength, weakness, photoFile }) => {
    const patch = { fullName, gender, strength, weakness };
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      patch.photoUrl = dataUrl;
    }
    await campaignsAPI.patchCharacter(campaignId, characterId, patch);
  };

  campaignsAPI.logEvent = async (campaignId, { icon, text }) => {
    const event = {
      id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      icon, text, ts: Date.now()
    };
    const list = readEvents(campaignId);
    list.push(event);
    writeEvents(campaignId, list);
    notifyEvents(campaignId);
    if (channel) channel.postMessage({ type: "event", campaignId });
  };

  campaignsAPI.listenEvents = (campaignId, callback) => {
    eventListeners[campaignId] = eventListeners[campaignId] || [];
    eventListeners[campaignId].push(callback);
    callback(readEvents(campaignId).map((e) => ({ ...e, date: new Date(e.ts) })));
    return () => {
      eventListeners[campaignId] = (eventListeners[campaignId] || []).filter((cb) => cb !== callback);
    };
  };

  campaignsAPI.transferItem = async (campaignId, fromCharacterId, toCharacterId, itemId, quantity) => {
    const list = readCharacters(campaignId);
    const fromIdx = list.findIndex((c) => c.id === fromCharacterId);
    const toIdx = list.findIndex((c) => c.id === toCharacterId);
    if (fromIdx === -1 || toIdx === -1) throw new Error("CHARACTER_NOT_FOUND");

    const result = computeTransfer(list[fromIdx].items || [], list[toIdx].items || [], itemId, quantity);
    if (!result) throw new Error("ITEM_NOT_FOUND");

    list[fromIdx] = { ...list[fromIdx], items: result.fromItems };
    list[toIdx] = { ...list[toIdx], items: result.toItems };
    writeCharacters(campaignId, list);
    notifyCharacters(campaignId);
    if (channel) channel.postMessage({ type: "character", campaignId });
    return result.moved;
  };

  campaignsAPI.patchCampaign = async (campaignId, patch) => {
    const list = readCampaigns();
    const idx = list.findIndex((c) => c.id === campaignId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...patch };
    writeCampaigns(list);
    notifyCampaigns();
    if (channel) channel.postMessage({ type: "campaign" });
  };

  campaignsAPI.bulkPatchCharacters = async (campaignId, updates) => {
    const list = readCharacters(campaignId);
    updates.forEach(({ characterId, patch }) => {
      const idx = list.findIndex((c) => c.id === characterId);
      if (idx !== -1) list[idx] = { ...list[idx], ...patch };
    });
    writeCharacters(campaignId, list);
    notifyCharacters(campaignId);
    if (channel) channel.postMessage({ type: "character", campaignId });
  };

  campaignsAPI.applyBleeding = async (campaignId, characterId, now) => {
    const list = readCharacters(campaignId);
    const idx = list.findIndex((c) => c.id === characterId);
    if (idx === -1) return null;
    const res = computeBleedTicks(list[idx], now);
    if (!res) return null;
    list[idx] = { ...list[idx], ...res.patch };
    writeCharacters(campaignId, list);
    notifyCharacters(campaignId);
    if (channel) channel.postMessage({ type: "character", campaignId });
    return res;
  };

  campaignsModeEl.textContent = "modo: local (sem Firebase configurado — só entre abas deste navegador)";
}

(async function bootBackend(){
  if (isConfigured) {
    try {
      await initFirebaseBackend();
    } catch (err) {
      console.error("Falha ao iniciar backend de campanhas via Firebase, usando modo local:", err);
      initLocalBackend();
    }
  } else {
    initLocalBackend();
  }
})();

// ------------------------------------------------------------
// status de dano
// ------------------------------------------------------------
function damageStatus(damage){
  if (damage >= 100) return { label: "morto", cls: "status-morto", color: "#7a0d0d" };
  if (damage >= 75) return { label: "estado crítico", cls: "status-critico", color: "#ff2e2e" };
  if (damage >= 50) return { label: "muito ferido", cls: "status-muito-ferido", color: "#ff9a3d" };
  if (damage >= 25) return { label: "ferido", cls: "status-ferido", color: "#e6d24a" };
  return { label: "estável", cls: "status-estavel", color: "#4fd67a" };
}

function clampDamage(v, max = 100){
  return Math.max(0, Math.min(max, Math.round(v)));
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function describeError(err, fallback){
  const code = err && err.code;
  if (code === "permission-denied") {
    return "acesso negado pelo Firestore — confira se as regras foram atualizadas (ver README) e se você está logado.";
  }
  if (code === "unavailable") {
    return "sem conexão com o Firestore no momento. tente de novo em instantes.";
  }
  if (code) return `${fallback} (${code})`;
  if (err && err.message) return `${fallback} (${err.message})`;
  return `${fallback} tente novamente.`;
}

// ------------------------------------------------------------
// notificações (Web Notifications API)
//
// Como o site não usa um plano pago do Firebase, não há um
// servidor de push — então essas notificações só disparam
// enquanto o site estiver aberto em alguma aba (mesmo que em
// segundo plano), com a campanha em questão aberta nela. Não
// funcionam com o navegador/app totalmente fechado.
// ------------------------------------------------------------
const NOTIFY_MUTE_KEY = "rl_notifications_muted";

function isNotifyMuted(){
  return localStorage.getItem(NOTIFY_MUTE_KEY) === "1";
}
function setNotifyMuted(value){
  localStorage.setItem(NOTIFY_MUTE_KEY, value ? "1" : "0");
}

function canNotify(){
  return ("Notification" in window) && Notification.permission === "granted" && !isNotifyMuted();
}

// Mostra a notificação através do service worker sempre que possível —
// no Android (e em PWAs instalados de modo geral), o navegador não deixa
// usar "new Notification(...)" diretamente quando existe um service worker
// registrado; é preciso passar por registration.showNotification().
async function showAppNotification(title, options){
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return true;
    } catch (err) {
      console.error("Falha ao mostrar notificação via service worker:", err);
    }
  }
  try {
    new Notification(title, options);
    return true;
  } catch (err) {
    console.error("Falha ao mostrar notificação:", err);
    return false;
  }
}

function refreshNotifyUI(){
  if (!notifyBtn) return;
  if (!("Notification" in window)) {
    notifyBtn.hidden = true;
    if (notifyTestBtn) notifyTestBtn.hidden = true;
    return;
  }
  const active = Notification.permission === "granted" && !isNotifyMuted();
  notifyBtn.textContent = active ? "🔔" : "🔕";
  notifyBtn.classList.toggle("is-active", active);
  notifyBtn.title = Notification.permission === "denied"
    ? "notificações bloqueadas — libere manualmente nas configurações do site no navegador"
    : (active ? "notificações ativadas — clique para silenciar" : "ativar notificações");

  if (notifyTestBtn) notifyTestBtn.hidden = Notification.permission !== "granted";
}

if (notifyBtn) {
  refreshNotifyUI();
  notifyBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "denied") {
      alert("As notificações foram bloqueadas para este site. Para reativar, libere manualmente nas configurações de notificação do seu navegador.");
      return;
    }

    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result === "granted") {
        setNotifyMuted(false);
        showAppNotification("🔔 Reverse Life", {
          body: "Notificações ativadas — você será avisado sobre mudanças na sua ficha mesmo com a aba em segundo plano.",
          icon: "icons/icon-192.png"
        });
      }
      refreshNotifyUI();
      return;
    }

    // permissão do navegador já concedida — alterna o "mudo" interno do site
    setNotifyMuted(!isNotifyMuted());
    refreshNotifyUI();
  });
}

if (notifyTestBtn) {
  notifyTestBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("Este navegador não suporta notificações (comum no Safari do iPhone/iPad fora do app instalado).");
      return;
    }
    if (Notification.permission !== "granted") {
      alert("Ative as notificações primeiro, clicando no sino.");
      return;
    }
    const ok = await showAppNotification("🧪 Teste — Reverse Life", {
      body: "Se você está vendo isso, o navegador consegue mostrar notificações deste site normalmente.",
      icon: "icons/icon-192.png"
    });
    if (!ok) {
      alert("Erro ao tentar mostrar a notificação de teste — veja o console (F12) para detalhes.");
    }
  });
}

function sendNotification(title, body){
  if (!canNotify()) return;
  if (!document.hidden) return; // a interface já mostra a mudança ao vivo; só notifica em segundo plano
  showAppNotification(title, {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: `rl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  });
}

// snapshot leve de cada personagem, usado só para comparar com a
// próxima atualização e detectar o que mudou
let previousCharacterStates = new Map();

function snapshotCharacterForNotify(c){
  return {
    damage: Math.max(0, Math.round(c.damage || 0)),
    max: maxDamageOf(c),
    insane: (c.sanity || 0) >= 100,
    bleeding: !!c.bleeding,
    hunger: c.hunger ?? 3,
    thirst: c.thirst ?? 3,
    itemIds: (c.items || []).map((it) => it.id)
  };
}

function isMineForNotify(character){
  const uid = getCurrentUid();
  const handle = getCurrentHandle();
  return !!(
    (uid && character.creatorUid && uid === character.creatorUid) ||
    (!character.creatorUid && handle && character.creator && handle.toLowerCase() === character.creator.toLowerCase())
  );
}

function checkForNotifications(newList){
  newList.forEach((character) => {
    const prev = previousCharacterStates.get(character.id);
    const curr = snapshotCharacterForNotify(character);

    if (prev) {
      const mine = isMineForNotify(character);

      // morte — vale pra qualquer um que tenha a campanha aberta, não só o dono
      if (prev.damage < curr.max && curr.damage >= curr.max) {
        sendNotification(`☠️ ${character.fullName} morreu`, "O personagem chegou ao limite de dano.");
      } else if (mine && curr.damage !== prev.damage) {
        if (curr.damage > prev.damage) {
          sendNotification(`🩸 ${character.fullName} sofreu dano`, `Dano subiu de ${prev.damage}% para ${curr.damage}%.`);
        } else {
          sendNotification(`💚 ${character.fullName} se recuperou`, `Dano caiu de ${prev.damage}% para ${curr.damage}%.`);
        }
      }

      if (mine) {
        if (curr.insane && !prev.insane) {
          sendNotification(`🌀 ${character.fullName} enlouqueceu`, "O personagem ficou insano.");
        }
        if (curr.bleeding && !prev.bleeding) {
          sendNotification(`🩸 ${character.fullName} está sangrando`, "Perde 5% de dano a cada 10 minutos por 1 hora.");
        }
        if (curr.hunger < prev.hunger) {
          sendNotification(
            curr.hunger === 0 ? `🍗 ${character.fullName} está com fome zerada!` : `🍗 fome de ${character.fullName} diminuiu`,
            `Agora em ${curr.hunger}/3.`
          );
        }
        if (curr.thirst < prev.thirst) {
          sendNotification(
            curr.thirst === 0 ? `💧 ${character.fullName} está com sede zerada!` : `💧 sede de ${character.fullName} diminuiu`,
            `Agora em ${curr.thirst}/3.`
          );
        }

        const newItemIds = curr.itemIds.filter((id) => !prev.itemIds.includes(id));
        if (newItemIds.length > 0) {
          const newItems = (character.items || []).filter((it) => newItemIds.includes(it.id));
          const names = newItems.map((it) => `${categoryIcon(it.category)} ${it.name}`).join(", ");
          sendNotification(`📦 novo item em ${character.fullName}`, names);
        }
      }
    }

    previousCharacterStates.set(character.id, curr);
  });
}

// ------------------------------------------------------------
// lista de campanhas
// ------------------------------------------------------------
let currentCampaign = null;
let unsubscribeCharacters = null;
let unsubscribeEvents = null;

function renderCampaignCard(campaign){
  const card = document.createElement("div");
  card.className = "campaign-card";
  card.innerHTML = `
    ${campaign.imageUrl
      ? `<img class="campaign-card-img" src="${campaign.imageUrl}" alt="${escapeHtml(campaign.name)}">`
      : `<div class="campaign-card-img" style="display:flex;align-items:center;justify-content:center;font-size:32px;">📖</div>`
    }
    <div class="campaign-card-body">
      <span class="campaign-card-name">${escapeHtml(campaign.name)}</span>
      <p class="campaign-card-desc">${escapeHtml(campaign.description)}</p>
      <span class="campaign-card-meta">narrador: ${escapeHtml(campaign.creator)}</span>
    </div>
  `;
  card.addEventListener("click", () => openCampaign(campaign));
  return card;
}

(function watchCampaigns(){
  const tryListen = () => {
    if (!campaignsAPI.listen) { setTimeout(tryListen, 100); return; }
    campaignsAPI.listen((list) => {
      campaignGrid.innerHTML = "";
      campaignEmpty.hidden = list.length > 0;
      list.forEach((campaign) => campaignGrid.appendChild(renderCampaignCard(campaign)));

      // se a campanha aberta foi atualizada (ex: imagem terminou de subir, ou
      // o sistema de fome/sede foi ligado/desligado), atualiza cabeçalho e fichas
      if (currentCampaign) {
        const updated = list.find((c) => c.id === currentCampaign.id);
        if (updated) {
          currentCampaign = updated;
          renderCampaignHeader(updated);
          renderHungerThirstPanel(updated);
          renderCureConfig(updated);
          renderRulesPanel(updated);
          renderDicePanel(updated);
          applyCharacterFilter();
        }
      }
    });
  };
  tryListen();
})();

function renderCampaignHeader(campaign){
  campaignHeaderEl.innerHTML = `
    ${campaign.imageUrl
      ? `<img class="campaign-header-img" src="${campaign.imageUrl}" alt="${escapeHtml(campaign.name)}">`
      : `<div class="campaign-header-img" style="display:flex;align-items:center;justify-content:center;font-size:44px;">📖</div>`
    }
    <div class="campaign-header-body">
      <h3 class="campaign-header-name">${escapeHtml(campaign.name)}</h3>
      <p class="campaign-header-desc">${escapeHtml(campaign.description)}</p>
      <span class="campaign-header-creator">narrador: ${escapeHtml(campaign.creator)}</span>
    </div>
  `;
}

// ------------------------------------------------------------
// permissão compartilhada: "sou o narrador desta campanha?"
// ------------------------------------------------------------
function isCurrentUserCampaignCreator(campaign){
  const uid = getCurrentUid();
  const handle = getCurrentHandle();
  return !!(
    (uid && campaign.creatorUid && uid === campaign.creatorUid) ||
    (!campaign.creatorUid && handle && campaign.creator && handle.toLowerCase() === campaign.creator.toLowerCase())
  );
}

// ------------------------------------------------------------
// painel de fome e sede (nível campanha) — liga/desliga e ações em massa
// ------------------------------------------------------------
function renderHungerThirstPanel(campaign){
  const isNarrator = isCurrentUserCampaignCreator(campaign);
  const enabled = !!campaign.hungerThirstEnabled;

  if (!enabled && !isNarrator) {
    htPanel.hidden = true;
    htPanel.innerHTML = "";
    return;
  }

  htPanel.hidden = false;
  htPanel.innerHTML = `
    <div class="ht-panel-bar">
      <div class="terminal-dots"><span></span><span></span><span></span></div>
      <span class="ht-panel-title">/etc/sobrevivencia.cfg</span>
    </div>
    <div class="ht-panel-body">
      <div class="ht-toggle-row">
        <span class="ht-toggle-label">🍗 fome &amp; 💧 sede</span>
        ${isNarrator
          ? `<button class="ht-switch ${enabled ? "on" : ""}" id="htToggleBtn" aria-pressed="${enabled}"><span class="ht-switch-knob"></span></button>`
          : `<span class="ht-status-badge ${enabled ? "on" : ""}">${enabled ? "ativo" : "inativo"}</span>`
        }
      </div>
      ${isNarrator ? `
        <div class="ht-penalty-row">
          <span class="ht-penalty-label">dano ao perder fome/sede já zerada:</span>
          <input type="number" id="htPenaltyInput" class="damage-input" min="0" max="100" value="${campaign.htDamagePenalty ?? 10}">
          <span class="ht-penalty-suffix">%</span>
          <button class="btn-mini" id="htPenaltySave">salvar</button>
        </div>
      ` : ""}
      ${enabled && isNarrator ? `
        <div class="ht-bulk-row">
          <span class="ht-bulk-label">ação em massa, todas as fichas:</span>
          <button class="btn-mini" id="htBulkHungerMinus">🍗 -1 fome</button>
          <button class="btn-mini" id="htBulkThirstMinus">💧 -1 sede</button>
        </div>
      ` : ""}
      <p class="modal-error" id="htError"></p>
    </div>
  `;

  const toggleBtn = document.getElementById("htToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      toggleBtn.disabled = true;
      try {
        await campaignsAPI.patchCampaign(campaign.id, { hungerThirstEnabled: !enabled });
        logEvent("🍗💧", `<b>${escapeHtml(getCurrentHandle())}</b> ${!enabled ? "ativou" : "desativou"} o sistema de fome e sede nessa campanha.`);
      } catch (err) {
        console.error("Falha ao alternar sistema de fome/sede:", err);
        const el = document.getElementById("htError");
        if (el) el.textContent = describeError(err, "erro ao alternar o sistema.");
        toggleBtn.disabled = false;
      }
    });
  }

  const penaltySaveBtn = document.getElementById("htPenaltySave");
  if (penaltySaveBtn) {
    penaltySaveBtn.addEventListener("click", async () => {
      const input = document.getElementById("htPenaltyInput");
      const errorEl = document.getElementById("htError");
      const val = parseInt(input.value, 10);
      if (!Number.isFinite(val) || val < 0 || val > 100) {
        if (errorEl) errorEl.textContent = "informe uma porcentagem entre 0 e 100.";
        return;
      }
      penaltySaveBtn.disabled = true;
      try {
        await campaignsAPI.patchCampaign(campaign.id, { htDamagePenalty: val });
        logEvent("⚙️", `<b>${escapeHtml(getCurrentHandle())}</b> definiu a penalidade de dano por fome/sede zerada em ${val}%.`);
      } catch (err) {
        console.error("Falha ao salvar penalidade:", err);
        if (errorEl) errorEl.textContent = describeError(err, "erro ao salvar penalidade.");
      }
      penaltySaveBtn.disabled = false;
    });
  }

  const bulkHungerBtn = document.getElementById("htBulkHungerMinus");
  if (bulkHungerBtn) bulkHungerBtn.addEventListener("click", () => bulkAdjustAll("hunger", -1, "fome", "🍗"));

  const bulkThirstBtn = document.getElementById("htBulkThirstMinus");
  if (bulkThirstBtn) bulkThirstBtn.addEventListener("click", () => bulkAdjustAll("thirst", -1, "sede", "💧"));
}

async function bulkAdjustAll(statKey, delta, label, icon){
  if (!currentCampaign || !campaignsAPI.bulkPatchCharacters) return;
  const btnId = statKey === "hunger" ? "htBulkHungerMinus" : "htBulkThirstMinus";
  const btn = document.getElementById(btnId);
  const errorEl = document.getElementById("htError");
  const penaltyPct = currentCampaign.htDamagePenalty ?? 10;

  const updates = [];
  let penaltyCount = 0;
  const deaths = [];

  lastCharacterList.forEach((c) => {
    const current = c[statKey] ?? 3;
    const newValue = Math.max(0, Math.min(3, current + delta));
    const patch = {};
    let changed = false;

    if (newValue !== current) {
      patch[statKey] = newValue;
      changed = true;
    }

    // se já estava zerada e o narrador reduziu de novo, aplica a penalidade de dano
    if (delta < 0 && current === 0) {
      const maxD = maxDamageOf(c);
      const oldDamage = clampDamage(c.damage || 0, maxD);
      const newDamage = clampDamage(oldDamage + penaltyPct, maxD);
      if (newDamage !== oldDamage) {
        patch.damage = newDamage;
        changed = true;
        penaltyCount += 1;
        if (newDamage >= maxD && oldDamage < maxD) deaths.push(c.fullName);
      }
    }

    if (changed) updates.push({ characterId: c.id, patch });
  });

  if (updates.length === 0) return;

  if (btn) btn.disabled = true;
  try {
    await campaignsAPI.bulkPatchCharacters(currentCampaign.id, updates);
    logEvent(icon, `<b>${escapeHtml(getCurrentHandle())}</b> diminuiu ${label} de todas as fichas em 1.`);
    if (penaltyCount > 0) {
      logEvent(icon, `${penaltyCount} ficha${penaltyCount === 1 ? "" : "s"} já com ${label} zerada sofreu${penaltyCount === 1 ? "" : "ram"} +${penaltyPct}% de dano.`);
    }
    deaths.forEach((name) => logEvent("☠️", `<b>${escapeHtml(name)}</b> morreu.`));
  } catch (err) {
    console.error(`Falha ao ajustar ${label} em massa:`, err);
    if (errorEl) errorEl.textContent = describeError(err, `erro ao ajustar ${label} em massa.`);
  }
  if (btn) btn.disabled = false;
}

// ------------------------------------------------------------
// configuração da cura padrão dos itens de categoria "cura"
// ------------------------------------------------------------
function renderCureConfig(campaign){
  const isNarrator = isCurrentUserCampaignCreator(campaign);
  if (!isNarrator) {
    cureConfigEl.hidden = true;
    cureConfigEl.innerHTML = "";
    return;
  }

  cureConfigEl.hidden = false;
  cureConfigEl.innerHTML = `
    <span class="cure-config-label">💉 cura padrão dos itens de categoria "cura":</span>
    <input type="number" id="curePercentInput" class="damage-input" min="1" max="100" value="${campaign.curePercent ?? 30}">
    <span class="ht-penalty-suffix">%</span>
    <button class="btn-mini" id="curePercentSave">salvar</button>
    <p class="cure-config-error" id="cureConfigError"></p>
  `;

  const saveBtn = document.getElementById("curePercentSave");
  saveBtn.addEventListener("click", async () => {
    const input = document.getElementById("curePercentInput");
    const errorEl = document.getElementById("cureConfigError");
    const val = parseInt(input.value, 10);
    if (!Number.isFinite(val) || val < 1 || val > 100) {
      errorEl.textContent = "informe uma porcentagem entre 1 e 100.";
      return;
    }
    saveBtn.disabled = true;
    try {
      await campaignsAPI.patchCampaign(campaign.id, { curePercent: val });
      logEvent("💉", `<b>${escapeHtml(getCurrentHandle())}</b> definiu a cura padrão dos itens de cura em ${val}%.`);
    } catch (err) {
      console.error("Falha ao salvar cura padrão:", err);
      errorEl.textContent = describeError(err, "erro ao salvar.");
    }
    saveBtn.disabled = false;
  });
}

// ------------------------------------------------------------
// histórico de eventos da campanha
// ------------------------------------------------------------
function eventTimeLabel(date){
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function renderEventLog(events){
  eventList.innerHTML = "";
  eventLogEmpty.hidden = events.length > 0;
  eventLogEmpty.textContent = "nenhum evento registrado ainda.";
  eventCount.textContent = `${events.length} evento${events.length === 1 ? "" : "s"}`;

  // mais recente primeiro
  [...events].reverse().forEach((ev) => {
    const line = document.createElement("div");
    line.className = "event-line";
    line.innerHTML = `
      <span class="event-icon">${ev.icon || "•"}</span>
      <span class="event-text">${ev.text || ""}</span>
      <span class="event-time">${ev.date ? eventTimeLabel(ev.date) : ""}</span>
    `;
    eventList.appendChild(line);
  });
}

// Registra um evento no histórico da campanha atual. Não interrompe a
// ação principal caso falhe (o histórico é um extra, não crítico).
function logEvent(icon, text){
  if (!currentCampaign || !campaignsAPI.logEvent) return;
  campaignsAPI.logEvent(currentCampaign.id, { icon, text }).catch((err) => {
    console.error("Falha ao registrar evento no histórico:", err);
  });
}

function logDamageEvent(oldDamage, newDamage, fullName, max = 100){
  if (newDamage === oldDamage) return;
  const handle = escapeHtml(getCurrentHandle());
  const name = escapeHtml(fullName);
  if (newDamage > oldDamage) {
    logEvent("🩸", `<b>${name}</b> sofreu +${newDamage - oldDamage}% de dano (aplicado por <b>${handle}</b>) — agora em ${newDamage}%.`);
  } else {
    logEvent("💚", `<b>${name}</b> recuperou ${oldDamage - newDamage}% de dano (aplicado por <b>${handle}</b>) — agora em ${newDamage}%.`);
  }
  if (newDamage >= max && oldDamage < max) {
    logEvent("☠️", `<b>${name}</b> morreu.`);
  }
}

function openCampaign(campaign){
  currentCampaign = campaign;
  renderCampaignHeader(campaign);
  renderHungerThirstPanel(campaign);
  renderCureConfig(campaign);
  renderRulesPanel(campaign);
  renderDicePanel(campaign);
  startBleedTimer();
  campaignListView.hidden = true;
  campaignDetailView.hidden = false;

  if (unsubscribeCharacters) unsubscribeCharacters();
  characterGrid.innerHTML = "";
  characterSearch.value = "";
  lastCharacterList = [];
  expandedCharacterIds.clear();
  previousCharacterStates = new Map();

  if (unsubscribeEvents) unsubscribeEvents();
  eventList.innerHTML = "";
  eventLogEmpty.hidden = false;
  eventCount.textContent = "0 eventos";

  const tryListen = () => {
    if (!campaignsAPI.listenCharacters) { setTimeout(tryListen, 100); return; }
    unsubscribeCharacters = campaignsAPI.listenCharacters(campaign.id, (list) => {
      checkForNotifications(list);
      lastCharacterList = list;
      refreshDiceCharSelect();
      checkBleedingTicks();
      applyCharacterFilter();
    });
  };
  tryListen();

  const tryListenEvents = () => {
    if (!campaignsAPI.listenEvents) { setTimeout(tryListenEvents, 100); return; }
    unsubscribeEvents = campaignsAPI.listenEvents(campaign.id, renderEventLog, (err) => {
      eventList.innerHTML = "";
      eventCount.textContent = "0 eventos";
      eventLogEmpty.hidden = false;
      eventLogEmpty.textContent = err && err.code === "permission-denied"
        ? "acesso negado pelo Firestore ao ler o histórico — confira se a regra da coleção /events foi publicada (ver README)."
        : "não foi possível carregar o histórico agora.";
    });
  };
  tryListenEvents();
}

backToCampaignsBtn.addEventListener("click", () => {
  if (unsubscribeCharacters) { unsubscribeCharacters(); unsubscribeCharacters = null; }
  if (unsubscribeEvents) { unsubscribeEvents(); unsubscribeEvents = null; }
  currentCampaign = null;
  previousCharacterStates = new Map();
  htPanel.hidden = true;
  htPanel.innerHTML = "";
  cureConfigEl.hidden = true;
  cureConfigEl.innerHTML = "";
  rulesPanelEl.hidden = true;
  rulesPanelEl.innerHTML = "";
  diceHostEl.hidden = true;
  diceHostEl.innerHTML = "";
  stopBleedTimer();
  campaignDetailView.hidden = true;
  campaignListView.hidden = false;
});

// ------------------------------------------------------------
// modal: criar campanha
// ------------------------------------------------------------
function openCampaignModal(){
  campaignName.value = "";
  campaignDesc.value = "";
  campaignImage.value = "";
  campaignImagePreview.hidden = true;
  campaignError.textContent = "";
  campaignModal.classList.remove("hidden");
  setTimeout(() => campaignName.focus(), 50);
}
function closeCampaignModal(){
  campaignModal.classList.add("hidden");
}

createCampaignBtn.addEventListener("click", async () => {
  const handle = await ensureHandle();
  if (!handle) return;
  openCampaignModal();
});
campaignModalClose.addEventListener("click", closeCampaignModal);

campaignSubmit.addEventListener("click", async () => {
  const name = campaignName.value.trim();
  const description = campaignDesc.value.trim();
  const imageFile = campaignImage.files && campaignImage.files[0];

  if (name.length < 2) {
    campaignError.textContent = "dê um nome para a campanha.";
    return;
  }
  if (!campaignsAPI.create) {
    campaignError.textContent = "backend ainda não carregou, tente novamente em instantes.";
    return;
  }

  campaignSubmit.disabled = true;
  campaignError.textContent = "criando campanha...";

  try {
    await campaignsAPI.create({ name, description, imageFile });
    campaignSubmit.disabled = false;
    closeCampaignModal();
  } catch (err) {
    console.error("Falha ao criar campanha:", err);
    campaignSubmit.disabled = false;
    campaignError.textContent = describeError(err, "erro ao criar campanha.");
  }
});

// ------------------------------------------------------------
// modal: criar / editar personagem
// ------------------------------------------------------------
let editingCharacter = null; // null = criando novo · objeto = editando ficha existente

function openCharacterModal(character){
  editingCharacter = character || null;

  charName.value = character ? character.fullName || "" : "";
  charGender.value = character ? character.gender || "" : "";
  charStrength.value = character ? character.strength || "" : "";
  charWeakness.value = character ? character.weakness || "" : "";
  charPhoto.value = "";
  if (character && character.photoUrl) {
    charPhotoPreview.querySelector("img").src = character.photoUrl;
    charPhotoPreview.hidden = false;
  } else {
    charPhotoPreview.hidden = true;
  }
  characterError.textContent = "";
  setupAttrBlock(character);

  characterModalTitle.textContent = character ? "/bin/editar_ficha" : "/bin/nova_ficha";
  characterSubmitText.textContent = character ? "SALVAR ALTERAÇÕES" : "CRIAR FICHA";
  charPhotoHint.textContent = character ? "deixe em branco para manter a foto atual" : "";

  characterModal.classList.remove("hidden");
  setTimeout(() => charName.focus(), 50);
}
function closeCharacterModal(){
  characterModal.classList.add("hidden");
  editingCharacter = null;
}

createCharacterBtn.addEventListener("click", async () => {
  const handle = await ensureHandle();
  if (!handle) return;
  openCharacterModal(null);
});
characterModalClose.addEventListener("click", closeCharacterModal);

characterSubmit.addEventListener("click", async () => {
  if (!currentCampaign) return;

  const fullName = charName.value.trim();
  const gender = charGender.value.trim();
  const strength = charStrength.value.trim();
  const weakness = charWeakness.value.trim();
  const photoFile = charPhoto.files && charPhoto.files[0];

  if (fullName.length < 2) {
    characterError.textContent = "informe o nome completo do personagem.";
    return;
  }

  const isEditing = !!editingCharacter;

  if (isEditing) {
    if (!campaignsAPI.updateCharacterInfo) {
      characterError.textContent = "backend ainda não carregou, tente novamente em instantes.";
      return;
    }
    characterSubmit.disabled = true;
    characterError.textContent = "salvando alterações...";
    try {
      await campaignsAPI.updateCharacterInfo(currentCampaign.id, editingCharacter.id, { fullName, gender, strength, weakness, photoFile });
      logEvent("✎", `<b>${escapeHtml(getCurrentHandle())}</b> editou a ficha de <b>${escapeHtml(fullName)}</b>.`);
      characterSubmit.disabled = false;
      closeCharacterModal();
    } catch (err) {
      console.error("Falha ao editar personagem:", err);
      characterSubmit.disabled = false;
      characterError.textContent = describeError(err, "erro ao salvar alterações.");
    }
  } else {
    if (!campaignsAPI.createCharacter) {
      characterError.textContent = "backend ainda não carregou, tente novamente em instantes.";
      return;
    }
    let attrs = null;
    if (currentCampaign.diceSystem === "d20") {
      const v = validateAttrs(attrDraft);
      if (!v.ok) { characterError.textContent = v.error; return; }
      attrs = { ...attrDraft };
    }
    characterSubmit.disabled = true;
    characterError.textContent = "criando ficha...";
    try {
      await campaignsAPI.createCharacter(currentCampaign.id, { fullName, gender, strength, weakness, photoFile, attrs });
      logEvent("🆕", `<b>${escapeHtml(getCurrentHandle())}</b> criou a ficha de <b>${escapeHtml(fullName)}</b>.`);
      characterSubmit.disabled = false;
      closeCharacterModal();
    } catch (err) {
      console.error("Falha ao criar personagem:", err);
      characterSubmit.disabled = false;
      characterError.textContent = describeError(err, "erro ao criar ficha.");
    }
  }
});

// ------------------------------------------------------------
// modal: adicionar item ao inventário
// ------------------------------------------------------------
let itemModalCharacter = null;

function openItemModal(character){
  itemModalCharacter = character;
  itemName.value = "";
  itemDescription.value = "";
  populateItemCategories();
  itemCategory.value = "alimento";
  itemQuantity.value = "1";
  itemError.textContent = "";
  itemModal.classList.remove("hidden");
  setTimeout(() => itemName.focus(), 50);
}
function closeItemModal(){
  itemModal.classList.add("hidden");
  itemModalCharacter = null;
}
itemModalClose.addEventListener("click", closeItemModal);

itemSubmit.addEventListener("click", async () => {
  if (!currentCampaign || !itemModalCharacter) return;

  const name = itemName.value.trim();
  const description = itemDescription.value.trim();
  const category = itemCategory.value;
  const quantity = parseInt(itemQuantity.value, 10);

  if (name.length < 1) {
    itemError.textContent = "informe o nome do item.";
    return;
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    itemError.textContent = "quantidade precisa ser um número maior que zero.";
    return;
  }
  if (!campaignsAPI.patchCharacter) {
    itemError.textContent = "backend ainda não carregou, tente novamente em instantes.";
    return;
  }

  const newItem = {
    id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name, description, category, quantity
  };
  const newItems = [...(itemModalCharacter.items || []), newItem];

  itemSubmit.disabled = true;
  itemError.textContent = "adicionando item...";

  try {
    await campaignsAPI.patchCharacter(currentCampaign.id, itemModalCharacter.id, { items: newItems });
    logEvent("📦", `<b>${escapeHtml(getCurrentHandle())}</b> adicionou <b>${escapeHtml(name)}</b> (x${quantity}) à ficha de <b>${escapeHtml(itemModalCharacter.fullName)}</b>.`);
    itemSubmit.disabled = false;
    closeItemModal();
  } catch (err) {
    console.error("Falha ao adicionar item:", err);
    itemSubmit.disabled = false;
    itemError.textContent = describeError(err, "erro ao adicionar item.");
  }
});

// ------------------------------------------------------------
// modal: transferir item para outra ficha
// ------------------------------------------------------------
let transferSource = null; // { character, item }

function openTransferModal(character, item){
  transferSource = { character, item };
  transferItemLabel.textContent = `${categoryIcon(item.category)} ${item.name} — você tem ${item.quantity}`;

  transferTarget.innerHTML = "";
  lastCharacterList
    .filter((c) => c.id !== character.id)
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.fullName;
      transferTarget.appendChild(opt);
    });

  if (transferTarget.options.length === 0) {
    transferError.textContent = "não há outra ficha nessa campanha para receber o item.";
    transferSubmit.disabled = true;
  } else {
    transferError.textContent = "";
    transferSubmit.disabled = false;
  }

  transferQuantity.max = String(item.quantity);
  transferQuantity.value = String(item.quantity);

  transferModal.classList.remove("hidden");
}
function closeTransferModal(){
  transferModal.classList.add("hidden");
  transferSource = null;
}
transferModalClose.addEventListener("click", closeTransferModal);

transferSubmit.addEventListener("click", async () => {
  if (!currentCampaign || !transferSource) return;
  const { character, item } = transferSource;

  const targetId = transferTarget.value;
  const quantity = parseInt(transferQuantity.value, 10);

  if (!targetId) {
    transferError.textContent = "escolha uma ficha de destino.";
    return;
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > item.quantity) {
    transferError.textContent = `informe uma quantidade entre 1 e ${item.quantity}.`;
    return;
  }
  if (!campaignsAPI.transferItem) {
    transferError.textContent = "backend ainda não carregou, tente novamente em instantes.";
    return;
  }

  const targetCharacter = lastCharacterList.find((c) => c.id === targetId);

  transferSubmit.disabled = true;
  transferError.textContent = "enviando item...";

  try {
    await campaignsAPI.transferItem(currentCampaign.id, character.id, targetId, item.id, quantity);
    logEvent("🔁", `<b>${escapeHtml(getCurrentHandle())}</b> enviou <b>${escapeHtml(item.name)}</b> (x${quantity}) de <b>${escapeHtml(character.fullName)}</b> para <b>${escapeHtml(targetCharacter ? targetCharacter.fullName : "?")}</b>.`);
    transferSubmit.disabled = false;
    closeTransferModal();
  } catch (err) {
    console.error("Falha ao transferir item:", err);
    transferSubmit.disabled = false;
    transferError.textContent = describeError(err, "erro ao transferir item.");
  }
});

// ------------------------------------------------------------
// grid de personagens
// ------------------------------------------------------------
let lastCharacterList = [];

function applyCharacterFilter(){
  const term = characterSearch.value.trim().toLowerCase();
  const filtered = term
    ? lastCharacterList.filter((c) => (c.fullName || "").toLowerCase().includes(term))
    : lastCharacterList;

  characterEmpty.textContent = term
    ? "nenhum personagem encontrado com esse nome."
    : "nenhum personagem criado nessa campanha ainda.";

  renderCharacters(filtered);
}

characterSearch.addEventListener("input", applyCharacterFilter);

function renderCharacters(list){
  // preserva o texto sendo digitado no campo de ferimentos, se houver foco ativo
  let focusState = null;
  const active = document.activeElement;
  if (active && active.classList && active.classList.contains("injuries-textarea")) {
    focusState = {
      id: active.dataset.charId,
      value: active.value,
      selStart: active.selectionStart,
      selEnd: active.selectionEnd
    };
  }

  characterGrid.innerHTML = "";
  characterEmpty.hidden = list.length > 0;

  list.forEach((character) => {
    characterGrid.appendChild(renderCharacterCard(character));
  });

  if (focusState) {
    const el = characterGrid.querySelector(`.injuries-textarea[data-char-id="${CSS.escape(focusState.id)}"]`);
    if (el) {
      el.value = focusState.value;
      el.focus();
      el.setSelectionRange(focusState.selStart, focusState.selEnd);
    }
  }
}

// ids de personagens com a ficha expandida — persiste entre re-renders
// (toda mudança de dado/kit/ferimento re-renderiza a lista inteira)
const expandedCharacterIds = new Set();

function renderCharacterCard(character){
  const handle = getCurrentHandle();
  const uid = getCurrentUid();

  const isCampaignCreator = currentCampaign ? isCurrentUserCampaignCreator(currentCampaign) : false;
  const isCharCreator = !!(
    (uid && character.creatorUid && uid === character.creatorUid) ||
    (!character.creatorUid && handle && character.creator && handle.toLowerCase() === character.creator.toLowerCase())
  );

  const canEditDamage = isCampaignCreator;
  const canEditInjuries = isCampaignCreator || isCharCreator;
  const canManageItems = isCampaignCreator; // só o narrador adiciona/ajusta quantidade/exclui itens
  const canTransferItems = isCampaignCreator || isCharCreator; // narrador ou dono da ficha podem enviar/usar itens
  const canEditHungerThirst = isCampaignCreator; // só o narrador ajusta fome/sede manualmente
  const hungerThirstOn = !!(currentCampaign && currentCampaign.hungerThirstEnabled);

  const maxDmg = maxDamageOf(character);
  const damage = clampDamage(character.damage || 0, maxDmg);
  const dead = damage >= maxDmg;
  const status = damageStatus(dead ? 100 : Math.floor((damage / maxDmg) * 100));
  const fillPct = Math.min(100, Math.round((damage / maxDmg) * 100));
  const sanityOn = !!(currentCampaign && currentCampaign.sanityEnabled);
  const bleedingOn = !!(currentCampaign && currentCampaign.bleedingEnabled);
  const herbsOn = !!(currentCampaign && currentCampaign.herbsEnabled);
  const sanity = Math.max(0, Math.min(100, Math.round(character.sanity || 0)));
  const insane = sanityOn && sanity >= 100;
  const bodySt = bodyState(damage, character);
  const bleedNow = bleedingOn && character.bleeding ? character.bleeding : null;
  const bleedProg = bleedNow ? bleedProgress(bleedNow, Date.now()) : null;
  const hasAttrs = !!(character.attrs && typeof character.attrs === "object");
  const hunger = character.hunger ?? 3;
  const thirst = character.thirst ?? 3;
  const isExpanded = expandedCharacterIds.has(character.id);

  const card = document.createElement("div");
  card.className = "character-card" + (dead ? " is-dead" : "") + (insane && !dead ? " is-insane" : "");

  card.innerHTML = `
    <div class="character-card-head">
      ${character.photoUrl
        ? `<img class="character-thumb" src="${character.photoUrl}" alt="${escapeHtml(character.fullName)}">`
        : `<div class="character-thumb character-thumb-placeholder">🕯️</div>`
      }
      <div class="character-head-info">
        <div class="character-name-row">
          <span class="character-name">${escapeHtml(character.fullName)}${dead ? " ☠️" : (insane ? " 🌀" : "")}</span>
          ${isCharCreator ? `<button class="btn-mini" data-action="edit-char">✎</button>` : ""}
        </div>
        <div class="character-head-meta">
          <span class="character-gender">${escapeHtml(character.gender || "não informado")}</span>
          <span class="damage-status-pill ${status.cls}">${status.label} · ${damage}%${maxDmg !== 100 ? ` / ${maxDmg}%` : ""}</span>
          ${bleedingOn && !dead ? `<span class="state-pill state-${bodySt.key}">${bodySt.icon} ${bodySt.label}</span>` : ""}
          ${bleedNow ? `<span class="state-pill state-bleeding">🩸 sangrando</span>` : ""}
          ${insane && !dead ? `<span class="state-pill state-insane">🌀 insano</span>` : ""}
        </div>
        <div class="damage-bar mini">
          <div class="damage-bar-fill" style="width:${fillPct}%; background:${status.color};"></div>
        </div>
      </div>
      <button class="expand-toggle ${isExpanded ? "open" : ""}" aria-label="Expandir ficha">▾</button>
    </div>

    <div class="character-card-details" ${isExpanded ? "" : "hidden"}>
      <div class="character-traits">
        <div class="trait-chip trait-strength">
          <span class="trait-chip-label">⚔️ ponto forte</span>
          <span class="trait-chip-value">${escapeHtml(character.strength || "—")}</span>
        </div>
        <div class="trait-chip trait-weakness">
          <span class="trait-chip-label">☠️ ponto fraco</span>
          <span class="trait-chip-value">${escapeHtml(character.weakness || "—")}</span>
        </div>
      </div>

      ${(bleedingOn || sanityOn || hasAttrs) ? `
        <div class="rules-block">
          ${hasAttrs ? `<div class="attr-chips">${ATTRS.map((a) => `<span class="attr-chip" title="${escapeHtml(a.desc)}">${a.icon} ${a.label} <b>${attrValue(character, a.key)}</b></span>`).join("")}</div>` : ""}
          ${bleedingOn ? `
            <div class="body-state state-${bodySt.key}">
              <span class="body-state-name">${bodySt.icon} <b>${bodySt.label}</b></span>
              <span class="body-state-desc">${escapeHtml(bodySt.desc)}</span>
            </div>
            ${bleedNow ? `
              <div class="bleed-row">
                <span>🩸 <b>sangrando</b> — termina em <span class="bleed-countdown" data-bleed-start="${bleedNow.startedAt}">${fmtCountdown(bleedProg.msLeft)}</span> · ${bleedProg.appliedTicks}/${BLEED_TICKS} (+5% a cada 10 min)</span>
                ${canEditDamage ? `<button class="btn-mini" data-action="bleed-stop">parar</button>` : ""}
              </div>
            ` : (canEditDamage && !dead ? `<div class="bleed-row"><button class="btn-mini" data-action="bleed-start">🩸 iniciar sangramento</button></div>` : "")}
          ` : ""}
          ${sanityOn ? `
            <div class="sanity-block ${insane ? "insane" : ""}">
              <div class="damage-head"><span>🌀 sanidade (100% = insano)</span><span class="sanity-val">${insane ? "INSANO" : `${sanity}%`}</span></div>
              <div class="damage-bar"><div class="damage-bar-fill sanity-fill" style="width:${sanity}%;"></div></div>
              ${insane ? `<p class="insane-desc">${escapeHtml(INSANE_DESC)}</p>` : ""}
              ${canEditDamage ? `
                <div class="damage-quick sanity-quick">
                  <button class="btn-mini" data-action="san" data-delta="-10">-10%</button>
                  <button class="btn-mini" data-action="san" data-delta="-5">-5%</button>
                  <button class="btn-mini" data-action="san" data-delta="5">+5%</button>
                  <button class="btn-mini" data-action="san" data-delta="10">+10%</button>
                </div>` : ""}
            </div>
          ` : ""}
        </div>
      ` : ""}

      ${hungerThirstOn ? `
        <div class="ht-block">
          <div class="ht-stat-row ${hunger === 0 ? "critical" : ""}">
            <span class="ht-stat-label">🍗 fome</span>
            <div class="ht-pips">
              ${[1, 2, 3].map((n) => `<span class="ht-pip hunger ${n <= hunger ? "filled" : ""}"></span>`).join("")}
            </div>
            ${canEditHungerThirst ? `
              <div class="ht-stat-controls">
                <button class="btn-mini" data-action="ht-dec" data-stat="hunger">-</button>
                <button class="btn-mini" data-action="ht-inc" data-stat="hunger">+</button>
              </div>
            ` : ""}
          </div>
          <div class="ht-stat-row ${thirst === 0 ? "critical" : ""}">
            <span class="ht-stat-label">💧 sede</span>
            <div class="ht-pips">
              ${[1, 2, 3].map((n) => `<span class="ht-pip thirst ${n <= thirst ? "filled" : ""}"></span>`).join("")}
            </div>
            ${canEditHungerThirst ? `
              <div class="ht-stat-controls">
                <button class="btn-mini" data-action="ht-dec" data-stat="thirst">-</button>
                <button class="btn-mini" data-action="ht-inc" data-stat="thirst">+</button>
              </div>
            ` : ""}
          </div>
        </div>
      ` : ""}

      ${canEditDamage ? `
        <div class="damage-section">
          <div class="damage-tool">
            <span class="damage-tool-label">ajuste rápido de dano</span>
            <div class="damage-quick">
              <button class="btn-mini" data-action="dmg" data-delta="-10">-10%</button>
              <button class="btn-mini" data-action="dmg" data-delta="-5">-5%</button>
              <button class="btn-mini" data-action="dmg" data-delta="5">+5%</button>
              <button class="btn-mini" data-action="dmg" data-delta="10">+10%</button>
            </div>
            <div class="damage-exact">
              <span class="damage-exact-label">definir valor exato:</span>
              <input type="number" class="damage-input" min="0" max="${maxDmg}" placeholder="0-${maxDmg}" data-action="dmg-input">
              <button class="btn-mini damage-apply-btn" data-action="dmg-apply">aplicar</button>
            </div>
          </div>
        </div>
      ` : ""}

      <div class="injuries-box">
        <span class="injuries-label">ferimentos e limitações</span>
        <textarea class="injuries-textarea" data-char-id="${character.id}" ${canEditInjuries ? "" : "disabled"} placeholder="${canEditInjuries ? "descreva ferimentos, sequelas, limitações..." : "somente o narrador ou quem criou a ficha pode editar."}">${escapeHtml(character.injuries || "")}</textarea>
        ${canEditInjuries ? `<button class="btn-mini injuries-save" data-action="save-injuries">salvar ferimentos</button>` : ""}
      </div>

      <div class="inventory-box">
        <div class="inventory-head">
          <span class="injuries-label">inventário</span>
          <span class="inventory-head-actions">
            ${(herbsOn && canTransferItems) ? `<button class="btn-mini" data-action="mix-herbs">🧪 misturar ervas</button>` : ""}
            ${canManageItems ? `<button class="btn-mini" data-action="add-item">+ item</button>` : ""}
          </span>
        </div>
        <div class="inventory-list">
          ${(character.items || []).map((item) => `
            <div class="item-row" data-item-id="${item.id}">
              <span class="item-icon">${categoryIcon(item.category)}</span>
              <div class="item-info">
                <div class="item-name-row">
                  <span class="item-name">${escapeHtml(item.name)}</span>
                  <span class="item-qty">x${item.quantity}</span>
                </div>
                ${item.description ? `<span class="item-desc">${escapeHtml(item.description)}</span>` : ""}
              </div>
              <div class="item-actions">
                ${(herbsOn && canTransferItems && HERBS[item.category])
                  ? `<button class="btn-mini" data-action="item-herb" data-item-id="${item.id}" ${(item.quantity > 0 && herbUsable(item.category, damage, bleedNow, sanity)) ? "" : "disabled"}>usar</button>`
                  : ""}
                ${(canTransferItems && item.category === "cura")
                  ? `<button class="btn-mini" data-action="item-cure" data-item-id="${item.id}" ${(item.quantity > 0 && (damage > 0 || bleedNow)) ? "" : "disabled"}>usar (cura)</button>`
                  : ""}
                ${(hungerThirstOn && canTransferItems && (item.category === "alimento" || item.category === "bebida"))
                  ? `<button class="btn-mini" data-action="item-consume" data-item-id="${item.id}">consumir</button>`
                  : ""}
                ${canManageItems ? `<button class="btn-mini" data-action="item-dec" data-item-id="${item.id}">-</button>` : ""}
                ${canManageItems ? `<button class="btn-mini" data-action="item-inc" data-item-id="${item.id}">+</button>` : ""}
                ${canTransferItems ? `<button class="btn-mini" data-action="item-transfer" data-item-id="${item.id}">↗</button>` : ""}
                ${canManageItems ? `<button class="btn-mini" data-action="item-delete" data-item-id="${item.id}">🗑️</button>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
        ${(character.items || []).length === 0 ? `<p class="inventory-empty">nenhum item.</p>` : ""}
      </div>

      <p class="card-error" data-card-error hidden></p>
    </div>
  `;

  // ---- eventos ----
  function showCardError(err, fallback){
    const el = card.querySelector("[data-card-error]");
    if (!el) return;
    el.textContent = describeError(err, fallback);
    el.hidden = false;
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }

  const headEl = card.querySelector(".character-card-head");
  headEl.addEventListener("click", (ev) => {
    // o botão "✎ editar" também fica dentro do cabeçalho clicável — não deixa o clique nele expandir/recolher
    if (ev.target.closest('[data-action="edit-char"]')) return;
    const details = card.querySelector(".character-card-details");
    const toggleBtn = card.querySelector(".expand-toggle");
    const nowOpen = details.hidden;
    details.hidden = !nowOpen;
    toggleBtn.classList.toggle("open", nowOpen);
    if (nowOpen) expandedCharacterIds.add(character.id);
    else expandedCharacterIds.delete(character.id);
  });

  if (isCharCreator) {
    const editBtn = card.querySelector('[data-action="edit-char"]');
    if (editBtn) {
      editBtn.addEventListener("click", () => openCharacterModal(character));
    }
  }

  if (canEditDamage) {
    card.querySelectorAll('[data-action="dmg"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = parseInt(btn.dataset.delta, 10);
        const newDamage = clampDamage(damage + delta, maxDmg);
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage })
          .then(() => logDamageEvent(damage, newDamage, character.fullName, maxDmg))
          .catch((err) => { console.error("Falha ao atualizar dano:", err); showCardError(err, "erro ao atualizar dano."); });
      });
    });
    const applyBtn = card.querySelector('[data-action="dmg-apply"]');
    const input = card.querySelector('[data-action="dmg-input"]');
    applyBtn.addEventListener("click", () => {
      const val = parseInt(input.value, 10);
      if (Number.isNaN(val)) return;
      const newDamage = clampDamage(val, maxDmg);
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage })
        .then(() => logDamageEvent(damage, newDamage, character.fullName, maxDmg))
        .catch((err) => { console.error("Falha ao atualizar dano:", err); showCardError(err, "erro ao atualizar dano."); });
      input.value = "";
    });
  }

  if (canEditInjuries) {
    const saveBtn = card.querySelector('[data-action="save-injuries"]');
    const textarea = card.querySelector(".injuries-textarea");
    saveBtn.addEventListener("click", () => {
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { injuries: textarea.value.trim() })
        .then(() => logEvent("📝", `<b>${escapeHtml(getCurrentHandle())}</b> atualizou os ferimentos/limitações de <b>${escapeHtml(character.fullName)}</b>.`))
        .catch((err) => { console.error("Falha ao salvar ferimentos:", err); showCardError(err, "erro ao salvar ferimentos."); });
    });
  }

  if (canManageItems) {
    const addItemBtn = card.querySelector('[data-action="add-item"]');
    if (addItemBtn) {
      addItemBtn.addEventListener("click", () => openItemModal(character));
    }

    card.querySelectorAll('[data-action="item-inc"], [data-action="item-dec"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.itemId;
        const items = character.items || [];
        const idx = items.findIndex((it) => it.id === itemId);
        if (idx === -1) return;
        const delta = btn.dataset.action === "item-inc" ? 1 : -1;
        const item = items[idx];
        const newQty = item.quantity + delta;

        let newItems;
        if (newQty <= 0) {
          newItems = items.filter((it) => it.id !== itemId);
        } else {
          newItems = items.map((it) => it.id === itemId ? { ...it, quantity: newQty } : it);
        }

        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { items: newItems })
          .then(() => logEvent(
            newQty <= 0 ? "🗑️" : (delta > 0 ? "📦" : "📦"),
            newQty <= 0
              ? `<b>${escapeHtml(getCurrentHandle())}</b> removeu <b>${escapeHtml(item.name)}</b> da ficha de <b>${escapeHtml(character.fullName)}</b> (quantidade zerada).`
              : `<b>${escapeHtml(getCurrentHandle())}</b> ${delta > 0 ? "aumentou" : "diminuiu"} <b>${escapeHtml(item.name)}</b> na ficha de <b>${escapeHtml(character.fullName)}</b> (agora x${newQty}).`
          ))
          .catch((err) => { console.error("Falha ao atualizar item:", err); showCardError(err, "erro ao atualizar item."); });
      });
    });

    card.querySelectorAll('[data-action="item-delete"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.itemId;
        const items = character.items || [];
        const item = items.find((it) => it.id === itemId);
        if (!item) return;
        const newItems = items.filter((it) => it.id !== itemId);
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { items: newItems })
          .then(() => logEvent("🗑️", `<b>${escapeHtml(getCurrentHandle())}</b> excluiu o item <b>${escapeHtml(item.name)}</b> da ficha de <b>${escapeHtml(character.fullName)}</b>.`))
          .catch((err) => { console.error("Falha ao excluir item:", err); showCardError(err, "erro ao excluir item."); });
      });
    });
  }

  if (canTransferItems) {
    card.querySelectorAll('[data-action="item-transfer"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.itemId;
        const item = (character.items || []).find((it) => it.id === itemId);
        if (!item) return;
        openTransferModal(character, item);
      });
    });

    card.querySelectorAll('[data-action="item-cure"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.itemId;
        const items = character.items || [];
        const item = items.find((it) => it.id === itemId);
        if (!item || item.quantity <= 0 || (damage <= 0 && !bleedNow)) return;

        const curePct = currentCampaign.curePercent ?? 30;
        const newDamage = clampDamage(damage - curePct, maxDmg);
        const newQuantity = item.quantity - 1;
        const newItems = newQuantity <= 0
          ? items.filter((it) => it.id !== itemId)
          : items.map((it) => it.id === itemId ? { ...it, quantity: newQuantity } : it);

        campaignsAPI.patchCharacter(currentCampaign.id, character.id, bleedNow ? { items: newItems, damage: newDamage, bleeding: null } : { items: newItems, damage: newDamage })
          .then(() => logEvent("💉", `<b>${escapeHtml(getCurrentHandle())}</b> usou <b>${escapeHtml(item.name)}</b> em <b>${escapeHtml(character.fullName)}</b>: dano de ${damage}% para ${newDamage}%.`))
          .catch((err) => { console.error("Falha ao usar item de cura:", err); showCardError(err, "erro ao usar item."); });
      });
    });

    if (hungerThirstOn) {
      card.querySelectorAll('[data-action="item-consume"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemId = btn.dataset.itemId;
          const items = character.items || [];
          const item = items.find((it) => it.id === itemId);
          if (!item || item.quantity <= 0) return;

          const newQuantity = item.quantity - 1;
          const newItems = newQuantity <= 0
            ? items.filter((it) => it.id !== itemId)
            : items.map((it) => it.id === itemId ? { ...it, quantity: newQuantity } : it);

          const patch = { items: newItems };
          let statText = "";
          if (item.category === "alimento") {
            const newHunger = Math.min(3, hunger + 1);
            patch.hunger = newHunger;
            statText = `fome: ${newHunger}/3`;
          } else if (item.category === "bebida") {
            const newThirst = Math.min(3, thirst + 1);
            patch.thirst = newThirst;
            statText = `sede: ${newThirst}/3`;
          }

          campaignsAPI.patchCharacter(currentCampaign.id, character.id, patch)
            .then(() => logEvent("🍽️", `<b>${escapeHtml(getCurrentHandle())}</b> consumiu <b>${escapeHtml(item.name)}</b> em <b>${escapeHtml(character.fullName)}</b> (${statText}).`))
            .catch((err) => { console.error("Falha ao consumir item:", err); showCardError(err, "erro ao consumir item."); });
        });
      });
    }
  }

  card.querySelectorAll('[data-action="item-herb"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = (character.items || []).find((it) => it.id === btn.dataset.itemId);
      if (!item) return;
      applyHerbUse(character, [item.id], [item.category], (err) => showCardError(err, "erro ao usar erva."));
    });
  });
  const mixBtn = card.querySelector('[data-action="mix-herbs"]');
  if (mixBtn) mixBtn.addEventListener("click", () => openMixModal(character));

  if (canEditDamage) {
    const startBtn = card.querySelector('[data-action="bleed-start"]');
    if (startBtn) startBtn.addEventListener("click", () => {
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { bleeding: { startedAt: Date.now(), ticksApplied: 0 } })
        .then(() => logEvent("🩸", `<b>${escapeHtml(character.fullName)}</b> começou a sangrar (ativado por <b>${escapeHtml(getCurrentHandle())}</b>) — 5% de dano a cada 10 min, por 1 hora.`))
        .catch((err) => { console.error(err); showCardError(err, "erro ao iniciar sangramento."); });
    });
    const stopBtn = card.querySelector('[data-action="bleed-stop"]');
    if (stopBtn) stopBtn.addEventListener("click", () => {
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { bleeding: null })
        .then(() => logEvent("🩹", `<b>${escapeHtml(getCurrentHandle())}</b> estancou o sangramento de <b>${escapeHtml(character.fullName)}</b>.`))
        .catch((err) => { console.error(err); showCardError(err, "erro ao parar sangramento."); });
    });
    card.querySelectorAll('[data-action="san"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const newSan = Math.max(0, Math.min(100, sanity + parseInt(btn.dataset.delta, 10)));
        if (newSan === sanity) return;
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { sanity: newSan })
          .then(() => {
            logEvent("🌀", `<b>${escapeHtml(getCurrentHandle())}</b> ${newSan > sanity ? "aumentou" : "reduziu"} o abalo mental de <b>${escapeHtml(character.fullName)}</b>: sanidade ${sanity}% → ${newSan}%.`);
            if (newSan >= 100 && sanity < 100) logEvent("🌀", `<b>${escapeHtml(character.fullName)}</b> perdeu o juízo e ficou <b>INSANO</b>.`);
          })
          .catch((err) => { console.error(err); showCardError(err, "erro ao atualizar sanidade."); });
      });
    });
  }

  if (canEditHungerThirst && hungerThirstOn) {
    card.querySelectorAll('[data-action="ht-inc"], [data-action="ht-dec"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat; // "hunger" | "thirst"
        const delta = btn.dataset.action === "ht-inc" ? 1 : -1;
        const current = stat === "hunger" ? hunger : thirst;
        const label = stat === "hunger" ? "fome" : "sede";

        if (delta > 0 && current >= 3) return; // já no máximo, nada a fazer

        const newValue = Math.max(0, Math.min(3, current + delta));
        const alreadyZero = delta < 0 && current === 0;

        const patch = {};
        if (newValue !== current) patch[stat] = newValue;

        let penaltyPct = 0;
        let newDamage = damage;
        if (alreadyZero) {
          penaltyPct = currentCampaign.htDamagePenalty ?? 10;
          newDamage = clampDamage(damage + penaltyPct, maxDmg);
          if (newDamage !== damage) patch.damage = newDamage;
        }

        if (Object.keys(patch).length === 0) return;

        campaignsAPI.patchCharacter(currentCampaign.id, character.id, patch)
          .then(() => {
            if (alreadyZero && patch.damage !== undefined) {
              logEvent(stat === "hunger" ? "🍗" : "💧", `<b>${escapeHtml(character.fullName)}</b> já estava com ${label} zerada e sofreu +${penaltyPct}% de dano (aplicado por <b>${escapeHtml(getCurrentHandle())}</b>) — agora em ${newDamage}%.`);
              if (newDamage >= maxDmg && damage < maxDmg) {
                logEvent("☠️", `<b>${escapeHtml(character.fullName)}</b> morreu.`);
              }
            } else {
              logEvent(stat === "hunger" ? "🍗" : "💧", `<b>${escapeHtml(getCurrentHandle())}</b> ${delta > 0 ? "aumentou" : "diminuiu"} ${label} de <b>${escapeHtml(character.fullName)}</b> para ${newValue}/3.`);
            }
          })
          .catch((err) => { console.error("Falha ao atualizar fome/sede:", err); showCardError(err, "erro ao atualizar fome/sede."); });
      });
    });
  }

  return card;
}

// ============================================================
// REGRAS OPCIONAIS DA CAMPANHA: dados por campanha (D6 / D20 + atributos),
// sanidade, sangramento, ervas e mistura de ervas
// ============================================================

function fmtCountdown(ms){
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}min ${String(total % 60).padStart(2, "0")}s`;
}

function herbUsable(category, damage, bleedNow, sanity){
  const e = herbEffect([category]);
  return (e.heal && damage > 0) || (e.stopBleed && !!bleedNow) || (e.sanity > 0 && sanity > 0);
}

function populateItemCategories(){
  const herbsOn = !!(currentCampaign && currentCampaign.herbsEnabled);
  itemCategory.innerHTML = Object.entries(ITEM_CATEGORIES)
    .filter(([key]) => herbsOn || !HERBS[key])
    .map(([key, c]) => `<option value="${key}">${c.icon} ${c.label}</option>`).join("");
}

// ---------- ervas ----------
function applyHerbUse(character, consumeIds, types, onError){
  const max = maxDamageOf(character);
  const e = herbEffect(types);
  const healPct = currentCampaign.curePercent ?? 30;
  const oldDamage = clampDamage(character.damage || 0, max);
  const oldSanity = Math.max(0, Math.min(100, Math.round(character.sanity || 0)));

  const used = [];
  let items = [...(character.items || [])];
  consumeIds.forEach((id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    used.push(it);
    items = it.quantity - 1 <= 0
      ? items.filter((x) => x.id !== id)
      : items.map((x) => x.id === id ? { ...x, quantity: x.quantity - 1 } : x);
  });

  const patch = { items };
  const parts = [];
  if (e.heal) { const nd = clampDamage(oldDamage - healPct, max); patch.damage = nd; parts.push(`vida ${oldDamage}% → ${nd}%`); }
  if (e.stopBleed && character.bleeding) { patch.bleeding = null; parts.push("sangramento parado"); }
  if (e.sanity) { const ns = Math.max(0, oldSanity - e.sanity); patch.sanity = ns; parts.push(`sanidade ${oldSanity}% → ${ns}%`); }

  const names = used.map((u) => `<b>${escapeHtml(u.name)}</b>`).join(" + ");
  const icon = types.length > 1 ? "🧪" : (HERBS[types[0]] ? HERBS[types[0]].icon : "🌿");
  return campaignsAPI.patchCharacter(currentCampaign.id, character.id, patch)
    .then(() => {
      logEvent(icon, `<b>${escapeHtml(getCurrentHandle())}</b> ${types.length > 1 ? "misturou e usou" : "usou"} ${names} em <b>${escapeHtml(character.fullName)}</b>${parts.length ? `: ${parts.join(", ")}` : ""}.`);
      return true;
    })
    .catch((err) => { console.error("Falha ao usar erva:", err); if (onError) onError(err); return false; });
}

let mixCharId = null;

function mixHerbOptions(character){
  const byCat = new Map();
  (character.items || []).filter((i) => HERBS[i.category] && i.quantity > 0).forEach((i) => {
    if (!byCat.has(i.category)) byCat.set(i.category, { itemId: i.id, qty: 0 });
    byCat.get(i.category).qty += i.quantity;
  });
  return [...byCat.entries()].map(([cat, v]) => ({ cat, itemId: v.itemId, qty: v.qty }));
}

function updateMixEffect(){
  if (mixHerbA.value === mixHerbB.value) { mixEffect.textContent = "escolha duas ervas de cores diferentes."; return; }
  mixEffect.textContent = "efeito: " + herbEffectText([mixHerbA.value, mixHerbB.value], currentCampaign.curePercent ?? 30) + ".";
}

function openMixModal(character){
  mixCharId = character.id;
  const opts = mixHerbOptions(character);
  mixError.textContent = "";
  if (opts.length < 2) {
    mixHerbA.innerHTML = ""; mixHerbB.innerHTML = ""; mixEffect.textContent = "";
    mixError.textContent = "é preciso ter ervas de pelo menos duas cores diferentes no inventário.";
    mixSubmit.disabled = true;
  } else {
    const html = opts.map((o) => `<option value="${o.cat}">${HERBS[o.cat].icon} ${HERBS[o.cat].label} (x${o.qty})</option>`).join("");
    mixHerbA.innerHTML = html; mixHerbB.innerHTML = html;
    mixHerbA.value = opts[0].cat; mixHerbB.value = opts[1].cat;
    mixSubmit.disabled = false;
    updateMixEffect();
  }
  mixModal.classList.remove("hidden");
}
function closeMixModal(){ mixModal.classList.add("hidden"); mixCharId = null; }

mixHerbA.addEventListener("change", updateMixEffect);
mixHerbB.addEventListener("change", updateMixEffect);
mixModalClose.addEventListener("click", closeMixModal);
mixSubmit.addEventListener("click", async () => {
  const fresh = lastCharacterList.find((c) => c.id === mixCharId);
  if (!fresh || !currentCampaign) return;
  const a = mixHerbA.value, b = mixHerbB.value;
  if (a === b) { mixError.textContent = "escolha duas ervas de cores diferentes."; return; }
  const opts = mixHerbOptions(fresh);
  const ia = opts.find((o) => o.cat === a), ib = opts.find((o) => o.cat === b);
  if (!ia || !ib) { mixError.textContent = "essas ervas não estão mais no inventário."; return; }
  mixSubmit.disabled = true;
  const ok = await applyHerbUse(fresh, [ia.itemId, ib.itemId], [a, b], (err) => { mixError.textContent = describeError(err, "erro ao misturar."); });
  mixSubmit.disabled = false;
  if (ok) closeMixModal();
});

// ---------- atributos (D20) na criação da ficha ----------
let attrDraft = {};

function setupAttrBlock(character){
  const d20 = !!(currentCampaign && currentCampaign.diceSystem === "d20");
  if (!d20 || character) { charAttrBlock.hidden = true; charAttrBlock.innerHTML = ""; return; }
  attrDraft = {};
  ATTRS.forEach((a) => { attrDraft[a.key] = 0; });
  charAttrBlock.hidden = false;
  renderAttrBlock();
}

function renderAttrBlock(){
  const used = ATTRS.reduce((s, a) => s + attrDraft[a.key], 0);
  const left = ATTR_POINTS_TOTAL - used;
  charAttrBlock.innerHTML = `
    <span class="modal-label">atributos — distribua ${ATTR_POINTS_TOTAL} pontos (máx. ${ATTR_MAX} cada)</span>
    <p class="attr-left ${left === 0 ? "done" : ""}">pontos restantes: <b>${left}</b> / ${ATTR_POINTS_TOTAL}</p>
    ${ATTRS.map((a) => `
      <div class="attr-row">
        <div class="attr-info"><span class="attr-name">${a.icon} ${a.label}</span><span class="attr-desc">${escapeHtml(a.desc)}</span></div>
        <div class="attr-ctrl">
          <button type="button" class="btn-mini" data-attr="${a.key}" data-d="-1">-</button>
          <span class="attr-val">${attrDraft[a.key]}</span>
          <button type="button" class="btn-mini" data-attr="${a.key}" data-d="1">+</button>
        </div>
      </div>`).join("")}
    <p class="modal-rules">depois de criada, a ficha não permite mais alterar os atributos.</p>`;
  charAttrBlock.querySelectorAll("[data-attr]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.attr;
      const d = parseInt(btn.dataset.d, 10);
      const next = attrDraft[k] + d;
      const usedNow = ATTRS.reduce((s, a) => s + attrDraft[a.key], 0);
      if (next < 0 || next > ATTR_MAX) return;
      if (d > 0 && usedNow >= ATTR_POINTS_TOTAL) return;
      attrDraft[k] = next;
      renderAttrBlock();
    });
  });
}

// ---------- painel de regras (narrador liga/desliga) ----------
function renderRulesPanel(campaign){
  const isNarrator = isCurrentUserCampaignCreator(campaign);
  const sanityOn = !!campaign.sanityEnabled, bleedOn = !!campaign.bleedingEnabled, herbsOn = !!campaign.herbsEnabled;
  const d20 = campaign.diceSystem === "d20";

  if (!isNarrator && !sanityOn && !bleedOn && !herbsOn && !d20) {
    rulesPanelEl.hidden = true; rulesPanelEl.innerHTML = "";
    return;
  }

  const row = (key, on, label, desc, disabled) => `
    <div class="rule-row">
      <div class="rule-text"><span class="rule-label">${label}</span><span class="rule-desc">${desc}</span></div>
      ${isNarrator
        ? `<button class="ht-switch ${on ? "on" : ""}" data-rule="${key}" ${disabled ? "disabled" : ""} aria-pressed="${on}"><span class="ht-switch-knob"></span></button>`
        : `<span class="ht-status-badge ${on ? "on" : ""}">${on ? "ativo" : "inativo"}</span>`}
    </div>`;

  rulesPanelEl.hidden = false;
  rulesPanelEl.innerHTML = `
    <div class="ht-panel-bar">
      <div class="terminal-dots"><span></span><span></span><span></span></div>
      <span class="ht-panel-title">/etc/regras.cfg</span>
    </div>
    <div class="ht-panel-body">
      <div class="rule-row">
        <div class="rule-text"><span class="rule-label">🎲 sistema de dados</span><span class="rule-desc">D6 (com as 3 variações) ou D20 com atributos — em campanhas D20, cada ficha nova distribui 10 pontos entre os 5 atributos.</span></div>
        ${isNarrator
          ? `<select class="modal-select rule-select" data-rule-dice><option value="d6" ${!d20 ? "selected" : ""}>D6</option><option value="d20" ${d20 ? "selected" : ""}>D20 + atributos</option></select>`
          : `<span class="ht-status-badge on">${d20 ? "D20" : "D6"}</span>`}
      </div>
      ${row("sanity", sanityOn, "🌀 sanidade", "Ao chegar em 100% o personagem fica insano: perde o juízo, não luta direito, pode ferir os colegas e chama atenção.", false)}
      ${row("bleeding", bleedOn, "🩸 sangramento", "Estados ligados ao dano: Normal (até 50%), Mancando (51–80%) e No Chão (81–99%). O narrador pode marcar um personagem como Sangrando: 5% de dano a cada 10 min durante 1 hora (30% no total).", false)}
      ${row("herbs", herbsOn, "🌿 ervas", "Exige sanidade ou sangramento ativos. 🌿 Verde: restaura vida, mas não para o sangramento · 🌺 Vermelha: para o sangramento · 🫐 Azul: restaura 20% de sanidade · duas ervas podem ser misturadas (narrador ou jogador).", !(sanityOn || bleedOn) && !herbsOn)}
      <p class="rules-error"></p>
    </div>`;

  const errEl = rulesPanelEl.querySelector(".rules-error");

  rulesPanelEl.querySelectorAll("[data-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.rule;
      const patch = {};
      let label = "";
      if (key === "sanity") { patch.sanityEnabled = !sanityOn; label = "sanidade"; if (!patch.sanityEnabled && !bleedOn) patch.herbsEnabled = false; }
      if (key === "bleeding") { patch.bleedingEnabled = !bleedOn; label = "sangramento"; if (!patch.bleedingEnabled && !sanityOn) patch.herbsEnabled = false; }
      if (key === "herbs") { patch.herbsEnabled = !herbsOn; label = "ervas"; }
      const turnedOn = Object.values(patch)[0];
      btn.disabled = true;
      try {
        await campaignsAPI.patchCampaign(campaign.id, patch);
        logEvent("⚙️", `<b>${escapeHtml(getCurrentHandle())}</b> ${turnedOn ? "ativou" : "desativou"} o sistema de ${label}.`);
      } catch (err) {
        console.error("Falha ao alterar regra:", err);
        errEl.textContent = describeError(err, "erro ao alterar a regra.");
        btn.disabled = false;
      }
    });
  });

  const diceSel = rulesPanelEl.querySelector("[data-rule-dice]");
  if (diceSel) diceSel.addEventListener("change", async () => {
    try {
      await campaignsAPI.patchCampaign(campaign.id, { diceSystem: diceSel.value });
      logEvent("⚙️", `<b>${escapeHtml(getCurrentHandle())}</b> mudou o sistema de dados da campanha para <b>${diceSel.value === "d20" ? "D20 + atributos" : "D6"}</b>.`);
    } catch (err) {
      console.error("Falha ao mudar o sistema de dados:", err);
      errEl.textContent = describeError(err, "erro ao mudar o sistema de dados.");
    }
  });
}

// ---------- rolagem de dados dentro da campanha ----------
const diceUI = { mode: localStorage.getItem("rl_dice_mode") || DEFAULT_MODE, charId: "", attr: "", test: "normal", resultHtml: "", rolling: false };
if (!DICE_TABLES[diceUI.mode]) diceUI.mode = DEFAULT_MODE;

function diceCharsAvailable(){
  const narrator = !!(currentCampaign && isCurrentUserCampaignCreator(currentCampaign));
  return lastCharacterList.filter((c) => narrator || isMineForNotify(c));
}

function d6ResultHtml(r){
  const table = DICE_TABLES[r.mode] || DICE_TABLES[DEFAULT_MODE];
  const entry = table.entries[r.value];
  return `<div class="dice-result-card">
    <div class="dice-big">${r.value}</div>
    <div class="dice-outcome"><b>${entry.emoji} ${escapeHtml(entry.title)}</b><p>${escapeHtml(entry.desc)}</p></div>
  </div>`;
}

function d20ResultHtml(r){
  const cls = r.success === true ? "ok" : (r.success === false ? "fail" : "");
  const verdict = r.test ? (r.success ? "✔ SUCESSO" : "✖ FALHA") : "resultado";
  return `<div class="dice-result-card ${cls}">
    <div class="dice-big">${r.total}</div>
    <div class="dice-outcome"><b>${verdict}</b><p>${escapeHtml(d20Message(r))}</p></div>
  </div>`;
}

function fillD20Selects(){
  const charSel = diceHostEl.querySelector('[data-dice="char"]');
  const attrSel = diceHostEl.querySelector('[data-dice="attr"]');
  const testSel = diceHostEl.querySelector('[data-dice="test"]');
  if (!charSel || !attrSel || !testSel) return;

  const chars = diceCharsAvailable();
  if (!chars.some((c) => c.id === diceUI.charId)) diceUI.charId = chars[0] ? chars[0].id : "";
  const ch = chars.find((c) => c.id === diceUI.charId);
  if (!ch) diceUI.attr = "";

  const charHtml = `<option value="">(sem ficha — só d20 puro)</option>` + chars.map((c) => `<option value="${c.id}">${escapeHtml(c.fullName)}</option>`).join("");
  const attrHtml = `<option value="">d20 puro</option>` + ATTRS.map((a) => `<option value="${a.key}" ${ch ? "" : "disabled"}>${a.icon} ${a.label}${ch ? ` (+${attrValue(ch, a.key)})` : ""}</option>`).join("");
  if (charSel.innerHTML !== charHtml) charSel.innerHTML = charHtml;
  if (attrSel.innerHTML !== attrHtml) attrSel.innerHTML = attrHtml;
  charSel.value = diceUI.charId;
  attrSel.value = diceUI.attr;
  testSel.value = diceUI.test;
}

function refreshDiceCharSelect(){
  if (currentCampaign && currentCampaign.diceSystem === "d20" && !diceUI.rolling) fillD20Selects();
}

function renderDicePanel(campaign){
  const d20 = campaign.diceSystem === "d20";
  diceHostEl.hidden = false;
  const bar = (t) => `<div class="ht-panel-bar"><div class="terminal-dots"><span></span><span></span><span></span></div><span class="ht-panel-title">${t}</span></div>`;

  if (d20) {
    diceHostEl.innerHTML = `${bar("/dev/dados — d20 + atributos")}
      <div class="ht-panel-body">
        <div class="dice-row"><label class="dice-label">rolando como</label><select class="modal-select" data-dice="char"></select></div>
        <div class="dice-row"><label class="dice-label">rolar</label><select class="modal-select" data-dice="attr"></select></div>
        <div class="dice-row"><label class="dice-label">teste</label>
          <select class="modal-select" data-dice="test">
            <option value="">sem teste (só o resultado)</option>
            ${Object.entries(D20_TESTS).map(([k, t]) => `<option value="${k}">${t.label} (de ${t.min} pra cima)</option>`).join("")}
          </select>
        </div>
        <button class="roll-btn dice-roll" data-dice="roll"><span class="roll-btn-text">ROLAR D20</span></button>
        <div class="dice-result" data-dice="result">${diceUI.resultHtml}</div>
      </div>`;
    fillD20Selects();
    diceHostEl.querySelector('[data-dice="char"]').addEventListener("change", (ev) => { diceUI.charId = ev.target.value; fillD20Selects(); });
    diceHostEl.querySelector('[data-dice="attr"]').addEventListener("change", (ev) => { diceUI.attr = ev.target.value; });
    diceHostEl.querySelector('[data-dice="test"]').addEventListener("change", (ev) => { diceUI.test = ev.target.value; });
  } else {
    diceHostEl.innerHTML = `${bar("/dev/dados — d6")}
      <div class="ht-panel-body">
        <div class="mode-select">${Object.entries(DICE_TABLES).map(([k, t]) => `<button class="mode-btn ${k === diceUI.mode ? "active" : ""}" data-dice-mode="${k}">${t.label}</button>`).join("")}</div>
        <p class="mode-intro">${escapeHtml(DICE_TABLES[diceUI.mode].intro)}</p>
        <button class="roll-btn dice-roll" data-dice="roll"><span class="roll-btn-text">ROLAR D6</span></button>
        <div class="dice-result" data-dice="result">${diceUI.resultHtml}</div>
      </div>`;
    diceHostEl.querySelectorAll("[data-dice-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        diceUI.mode = btn.dataset.diceMode;
        localStorage.setItem("rl_dice_mode", diceUI.mode);
        diceUI.resultHtml = "";
        renderDicePanel(currentCampaign);
      });
    });
  }
  diceHostEl.querySelector('[data-dice="roll"]').addEventListener("click", rollInCampaign);
}

async function rollInCampaign(){
  if (diceUI.rolling || !currentCampaign) return;
  const handle = await ensureHandle();
  if (!handle || !currentCampaign) return;

  const d20 = currentCampaign.diceSystem === "d20";
  let final;
  if (d20) {
    const ch = lastCharacterList.find((c) => c.id === diceUI.charId);
    const attr = diceUI.attr && ch ? diceUI.attr : null;
    final = rollD20(attr, attr ? attrValue(ch, attr) : 0, diceUI.test || null);
    final.charName = ch ? ch.fullName : null;
  } else {
    final = { value: 1 + Math.floor(Math.random() * 6), mode: diceUI.mode };
  }

  diceUI.rolling = true;
  const rollBtn = diceHostEl.querySelector('[data-dice="roll"]');
  if (rollBtn) rollBtn.disabled = true;
  const sides = d20 ? 20 : 6;
  await new Promise((resolve) => {
    let n = 0;
    const t = setInterval(() => {
      const el = diceHostEl.querySelector('[data-dice="result"]');
      if (el) el.innerHTML = `<div class="dice-result-card"><div class="dice-big shuffle">${1 + Math.floor(Math.random() * sides)}</div></div>`;
      playDiceTick();
      if (++n >= 9) { clearInterval(t); resolve(); }
    }, 55);
  });
  diceUI.rolling = false;

  diceUI.resultHtml = d20 ? d20ResultHtml(final) : d6ResultHtml(final);
  const el = diceHostEl.querySelector('[data-dice="result"]');
  if (el) el.innerHTML = diceUI.resultHtml;
  const btn2 = diceHostEl.querySelector('[data-dice="roll"]');
  if (btn2) btn2.disabled = false;

  const who = `<b>${escapeHtml(handle)}</b>`;
  if (d20) {
    logEvent("🎲", `${who}${final.charName ? ` (<b>${escapeHtml(final.charName)}</b>)` : ""} rolou ${escapeHtml(d20Message(final))}.`);
  } else {
    const table = DICE_TABLES[final.mode] || DICE_TABLES[DEFAULT_MODE];
    const entry = table.entries[final.value];
    if (entry.emoji === "🔴") playDeathAlert();
    logEvent("🎲", `${who} rolou <b>${final.value}</b> (${escapeHtml(table.label)}) — ${entry.emoji} ${escapeHtml(entry.title)}.`);
  }
}

// ---------- sangramento: aplica os "ticks" de 5% a cada 10 min ----------
let bleedTimer = null;
const bleedInFlight = new Set();

function startBleedTimer(){
  stopBleedTimer();
  bleedTimer = setInterval(() => { checkBleedingTicks(); updateBleedCountdowns(); }, 1000);
}
function stopBleedTimer(){
  if (bleedTimer) clearInterval(bleedTimer);
  bleedTimer = null;
}

function updateBleedCountdowns(){
  const now = Date.now();
  document.querySelectorAll("[data-bleed-start]").forEach((el) => {
    const p = bleedProgress({ startedAt: Number(el.dataset.bleedStart) }, now);
    el.textContent = fmtCountdown(p.msLeft);
  });
}

async function checkBleedingTicks(){
  if (!currentCampaign || !currentCampaign.bleedingEnabled || !campaignsAPI.applyBleeding) return;
  const narrator = isCurrentUserCampaignCreator(currentCampaign);
  const now = Date.now();
  for (const c of lastCharacterList) {
    if (!c.bleeding || bleedInFlight.has(c.id)) continue;
    if (!(narrator || isMineForNotify(c))) continue;
    if (!computeBleedTicks(c, now)) continue;
    bleedInFlight.add(c.id);
    try {
      const res = await campaignsAPI.applyBleeding(currentCampaign.id, c.id, now);
      if (res) {
        const name = escapeHtml(c.fullName);
        if (res.ticks > 0) logEvent("🩸", `<b>${name}</b> sangrou +${res.ticks * 5}% de dano — agora em ${res.newDamage}%.`);
        if (res.newDamage >= res.max && res.oldDamage < res.max) logEvent("☠️", `<b>${name}</b> morreu.`);
        else if (res.finished) logEvent("🩹", `O sangramento de <b>${name}</b> terminou.`);
      }
    } catch (err) {
      console.error("Falha ao aplicar sangramento:", err);
    } finally {
      bleedInFlight.delete(c.id);
    }
  }
}
