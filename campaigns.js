import { isConfigured, getDb, getFirestoreFns } from "./firebase-core.js";
import { getCurrentHandle, getCurrentUid, ensureHandle } from "./identity.js";

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
const characterGrid = document.getElementById("characterGrid");
const characterEmpty = document.getElementById("characterEmpty");
const characterSearch = document.getElementById("characterSearch");
const eventList = document.getElementById("eventList");
const eventLogEmpty = document.getElementById("eventLogEmpty");
const eventCount = document.getElementById("eventCount");

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
  listenEvents: null
};

async function initFirebaseBackend(){
  const db = await getDb();
  const { collection, addDoc, doc, updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } = await getFirestoreFns();

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

  campaignsAPI.createCharacter = async (campaignId, { fullName, gender, strength, weakness, photoFile }) => {
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
      creator, creatorUid, damage: 0, injuries: "", medkits: 0, createdAt: serverTimestamp()
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

  campaignsAPI.createCharacter = async (campaignId, { fullName, gender, strength, weakness, photoFile }) => {
    const creator = getCurrentHandle();
    const creatorUid = getCurrentUid();
    let photoUrl = "";
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      photoUrl = dataUrl;
    }
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const list = readCharacters(campaignId);
    list.push({ id, fullName, gender, strength, weakness, photoUrl, creator, creatorUid, damage: 0, injuries: "", medkits: 0, createdAt: Date.now() });
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

function clampDamage(v){
  return Math.max(0, Math.min(100, Math.round(v)));
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

      // se a campanha aberta foi atualizada (ex: imagem terminou de subir), atualiza o cabeçalho
      if (currentCampaign) {
        const updated = list.find((c) => c.id === currentCampaign.id);
        if (updated) {
          currentCampaign = updated;
          renderCampaignHeader(updated);
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

function logDamageEvent(oldDamage, newDamage, fullName){
  if (newDamage === oldDamage) return;
  const handle = escapeHtml(getCurrentHandle());
  const name = escapeHtml(fullName);
  if (newDamage > oldDamage) {
    logEvent("🩸", `<b>${name}</b> sofreu +${newDamage - oldDamage}% de dano (aplicado por <b>${handle}</b>) — agora em ${newDamage}%.`);
  } else {
    logEvent("💚", `<b>${name}</b> recuperou ${oldDamage - newDamage}% de dano (aplicado por <b>${handle}</b>) — agora em ${newDamage}%.`);
  }
  if (newDamage >= 100 && oldDamage < 100) {
    logEvent("☠️", `<b>${name}</b> morreu.`);
  }
}

function openCampaign(campaign){
  currentCampaign = campaign;
  renderCampaignHeader(campaign);
  campaignListView.hidden = true;
  campaignDetailView.hidden = false;

  if (unsubscribeCharacters) unsubscribeCharacters();
  characterGrid.innerHTML = "";
  characterSearch.value = "";
  lastCharacterList = [];
  expandedCharacterIds.clear();

  if (unsubscribeEvents) unsubscribeEvents();
  eventList.innerHTML = "";
  eventLogEmpty.hidden = false;
  eventCount.textContent = "0 eventos";

  const tryListen = () => {
    if (!campaignsAPI.listenCharacters) { setTimeout(tryListen, 100); return; }
    unsubscribeCharacters = campaignsAPI.listenCharacters(campaign.id, (list) => {
      lastCharacterList = list;
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
    characterSubmit.disabled = true;
    characterError.textContent = "criando ficha...";
    try {
      await campaignsAPI.createCharacter(currentCampaign.id, { fullName, gender, strength, weakness, photoFile });
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

  const isCampaignCreator = !!(
    (uid && currentCampaign && currentCampaign.creatorUid && uid === currentCampaign.creatorUid) ||
    (!currentCampaign?.creatorUid && handle && currentCampaign && currentCampaign.creator && handle.toLowerCase() === currentCampaign.creator.toLowerCase())
  );
  const isCharCreator = !!(
    (uid && character.creatorUid && uid === character.creatorUid) ||
    (!character.creatorUid && handle && character.creator && handle.toLowerCase() === character.creator.toLowerCase())
  );

  const canEditDamage = isCampaignCreator;
  const canEditInjuries = isCampaignCreator || isCharCreator;
  const canManageMedkit = isCampaignCreator; // só o narrador adiciona/remove kits
  const canUseMedkit = isCampaignCreator || isCharCreator; // quem criou a ficha pode gastar os kits que ela já tem

  const damage = clampDamage(character.damage || 0);
  const status = damageStatus(damage);
  const medkits = character.medkits || 0;
  const isExpanded = expandedCharacterIds.has(character.id);

  const card = document.createElement("div");
  card.className = "character-card";

  card.innerHTML = `
    <div class="character-card-head" data-action="toggle-expand">
      ${character.photoUrl
        ? `<img class="character-thumb" src="${character.photoUrl}" alt="${escapeHtml(character.fullName)}">`
        : `<div class="character-thumb character-thumb-placeholder">🕯️</div>`
      }
      <div class="character-head-info">
        <div class="character-name-row">
          <span class="character-name">${escapeHtml(character.fullName)}${damage >= 100 ? " ☠️" : ""}</span>
          ${isCharCreator ? `<button class="btn-mini" data-action="edit-char">✎</button>` : ""}
        </div>
        <div class="character-head-meta">
          <span class="character-gender">${escapeHtml(character.gender || "não informado")}</span>
          <span class="damage-status-pill ${status.cls}">${status.label} · ${damage}%</span>
        </div>
        <div class="damage-bar mini">
          <div class="damage-bar-fill" style="width:${damage}%; background:${status.color};"></div>
        </div>
      </div>
      <button class="expand-toggle ${isExpanded ? "open" : ""}" data-action="toggle-expand" aria-label="Expandir ficha">▾</button>
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
              <input type="number" class="damage-input" min="0" max="100" placeholder="0-100" data-action="dmg-input">
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

      <div class="medkit-row">
        <span class="medkit-count">🩹 kits médicos: <b>${medkits}</b></span>
        <div class="medkit-actions">
          ${canManageMedkit ? `<button class="btn-mini" data-action="remove-kit" ${medkits > 0 ? "" : "disabled"}>- kit</button>` : ""}
          ${canManageMedkit ? `<button class="btn-mini" data-action="add-kit">+ kit</button>` : ""}
          ${canUseMedkit ? `<button class="btn-mini" data-action="use-kit" ${(medkits > 0 && damage > 0) ? "" : "disabled"}>usar kit (-30%)</button>` : ""}
        </div>
      </div>
    </div>
  `;

  // ---- eventos ----
  card.querySelectorAll('[data-action="toggle-expand"]').forEach((el) => {
    el.addEventListener("click", (ev) => {
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
        const newDamage = clampDamage(damage + delta);
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage })
          .then(() => logDamageEvent(damage, newDamage, character.fullName))
          .catch((err) => console.error("Falha ao atualizar dano:", err));
      });
    });
    const applyBtn = card.querySelector('[data-action="dmg-apply"]');
    const input = card.querySelector('[data-action="dmg-input"]');
    applyBtn.addEventListener("click", () => {
      const val = parseInt(input.value, 10);
      if (Number.isNaN(val)) return;
      const newDamage = clampDamage(val);
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage })
        .then(() => logDamageEvent(damage, newDamage, character.fullName))
        .catch((err) => console.error("Falha ao atualizar dano:", err));
      input.value = "";
    });
  }

  if (canEditInjuries) {
    const saveBtn = card.querySelector('[data-action="save-injuries"]');
    const textarea = card.querySelector(".injuries-textarea");
    saveBtn.addEventListener("click", () => {
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { injuries: textarea.value.trim() })
        .then(() => logEvent("📝", `<b>${escapeHtml(getCurrentHandle())}</b> atualizou os ferimentos/limitações de <b>${escapeHtml(character.fullName)}</b>.`))
        .catch((err) => console.error("Falha ao salvar ferimentos:", err));
    });
  }

  if (canManageMedkit) {
    const addBtn = card.querySelector('[data-action="add-kit"]');
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { medkits: medkits + 1 })
          .then(() => logEvent("🩹", `<b>${escapeHtml(getCurrentHandle())}</b> adicionou um kit médico à ficha de <b>${escapeHtml(character.fullName)}</b> (agora com ${medkits + 1}).`))
          .catch((err) => console.error("Falha ao adicionar kit médico:", err));
      });
    }
    const removeBtn = card.querySelector('[data-action="remove-kit"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        if (medkits <= 0) return;
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { medkits: medkits - 1 })
          .then(() => logEvent("🗑️", `<b>${escapeHtml(getCurrentHandle())}</b> removeu um kit médico da ficha de <b>${escapeHtml(character.fullName)}</b> (agora com ${medkits - 1}).`))
          .catch((err) => console.error("Falha ao remover kit médico:", err));
      });
    }
  }

  if (canUseMedkit) {
    const useBtn = card.querySelector('[data-action="use-kit"]');
    if (useBtn) {
      useBtn.addEventListener("click", () => {
        if (medkits <= 0) return;
        const newDamage = clampDamage(damage - 30);
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage, medkits: medkits - 1 })
          .then(() => logEvent("💊", `<b>${escapeHtml(getCurrentHandle())}</b> usou um kit médico em <b>${escapeHtml(character.fullName)}</b>: dano de ${damage}% para ${newDamage}% (kits restantes: ${medkits - 1}).`))
          .catch((err) => console.error("Falha ao usar kit médico:", err));
      });
    }
  }

  return card;
}
