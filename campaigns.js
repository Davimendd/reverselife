import { isConfigured, getDb, getFirestoreFns } from "./firebase-core.js";
import { getCurrentHandle, ensureHandle } from "./identity.js";

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
const characterModalClose = document.getElementById("characterModalClose");
const charName = document.getElementById("charName");
const charGender = document.getElementById("charGender");
const charStrength = document.getElementById("charStrength");
const charWeakness = document.getElementById("charWeakness");
const charPhoto = document.getElementById("charPhoto");
const charPhotoPreview = document.getElementById("charPhotoPreview");
const characterError = document.getElementById("characterError");
const characterSubmit = document.getElementById("characterSubmit");

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
  patchCharacter: null
};

async function initFirebaseBackend(){
  const db = await getDb();
  const { collection, addDoc, doc, updateDoc, query, orderBy, onSnapshot, serverTimestamp } = await getFirestoreFns();

  campaignsAPI.create = async ({ name, description, imageFile }) => {
    const creator = getCurrentHandle();
    let imageUrl = "";
    if (imageFile) {
      const { dataUrl } = await compressImage(imageFile, 640, 0.72);
      imageUrl = dataUrl;
    }
    const docRef = await addDoc(collection(db, "campaigns"), {
      name, description, creator, imageUrl, createdAt: serverTimestamp()
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
    let photoUrl = "";
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      photoUrl = dataUrl;
    }
    const charsRef = collection(db, "campaigns", campaignId, "characters");
    const docRef = await addDoc(charsRef, {
      fullName, gender, strength, weakness, photoUrl,
      creator, damage: 0, injuries: "", medkits: 0, createdAt: serverTimestamp()
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

  campaignsModeEl.textContent = "modo: online (Firebase)";
}

function initLocalBackend(){
  const CAMPAIGNS_KEY = "rl_local_campaigns";
  const charKey = (campaignId) => `rl_local_characters_${campaignId}`;
  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel("reverse_life_campaigns") : null;

  function readCampaigns(){ try { return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || "[]"); } catch { return []; } }
  function writeCampaigns(list){ localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list)); }
  function readCharacters(campaignId){ try { return JSON.parse(localStorage.getItem(charKey(campaignId)) || "[]"); } catch { return []; } }
  function writeCharacters(campaignId, list){ localStorage.setItem(charKey(campaignId), JSON.stringify(list)); }

  let campaignListeners = [];
  let characterListeners = {};

  function notifyCampaigns(){
    const list = readCampaigns();
    campaignListeners.forEach((cb) => cb(list));
  }
  function notifyCharacters(campaignId){
    const list = readCharacters(campaignId);
    (characterListeners[campaignId] || []).forEach((cb) => cb(list));
  }

  if (channel) {
    channel.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === "campaign") notifyCampaigns();
      if (msg.type === "character") notifyCharacters(msg.campaignId);
    };
  }
  window.addEventListener("storage", (ev) => {
    if (ev.key === CAMPAIGNS_KEY) notifyCampaigns();
    else if (ev.key && ev.key.startsWith("rl_local_characters_")) {
      notifyCharacters(ev.key.slice("rl_local_characters_".length));
    }
  });

  campaignsAPI.create = async ({ name, description, imageFile }) => {
    const creator = getCurrentHandle();
    let imageUrl = "";
    if (imageFile) {
      const { dataUrl } = await compressImage(imageFile, 640, 0.72);
      imageUrl = dataUrl;
    }
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const list = readCampaigns();
    list.unshift({ id, name, description, imageUrl, creator, createdAt: Date.now() });
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
    let photoUrl = "";
    if (photoFile) {
      const { dataUrl } = await compressImage(photoFile, 480, 0.72);
      photoUrl = dataUrl;
    }
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const list = readCharacters(campaignId);
    list.push({ id, fullName, gender, strength, weakness, photoUrl, creator, damage: 0, injuries: "", medkits: 0, createdAt: Date.now() });
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

// ------------------------------------------------------------
// lista de campanhas
// ------------------------------------------------------------
let currentCampaign = null;
let unsubscribeCharacters = null;

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

function openCampaign(campaign){
  currentCampaign = campaign;
  renderCampaignHeader(campaign);
  campaignListView.hidden = true;
  campaignDetailView.hidden = false;

  if (unsubscribeCharacters) unsubscribeCharacters();
  characterGrid.innerHTML = "";

  const tryListen = () => {
    if (!campaignsAPI.listenCharacters) { setTimeout(tryListen, 100); return; }
    unsubscribeCharacters = campaignsAPI.listenCharacters(campaign.id, renderCharacters);
  };
  tryListen();
}

backToCampaignsBtn.addEventListener("click", () => {
  if (unsubscribeCharacters) { unsubscribeCharacters(); unsubscribeCharacters = null; }
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
    campaignError.textContent = "erro ao criar campanha. tente novamente.";
  }
});

// ------------------------------------------------------------
// modal: criar personagem
// ------------------------------------------------------------
function openCharacterModal(){
  charName.value = "";
  charGender.value = "";
  charStrength.value = "";
  charWeakness.value = "";
  charPhoto.value = "";
  charPhotoPreview.hidden = true;
  characterError.textContent = "";
  characterModal.classList.remove("hidden");
  setTimeout(() => charName.focus(), 50);
}
function closeCharacterModal(){
  characterModal.classList.add("hidden");
}

createCharacterBtn.addEventListener("click", async () => {
  const handle = await ensureHandle();
  if (!handle) return;
  openCharacterModal();
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
  if (!campaignsAPI.createCharacter) {
    characterError.textContent = "backend ainda não carregou, tente novamente em instantes.";
    return;
  }

  characterSubmit.disabled = true;
  characterError.textContent = "criando ficha...";

  try {
    await campaignsAPI.createCharacter(currentCampaign.id, { fullName, gender, strength, weakness, photoFile });
    characterSubmit.disabled = false;
    closeCharacterModal();
  } catch (err) {
    console.error("Falha ao criar personagem:", err);
    characterSubmit.disabled = false;
    characterError.textContent = "erro ao criar ficha. tente novamente.";
  }
});

// ------------------------------------------------------------
// grid de personagens
// ------------------------------------------------------------
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

function renderCharacterCard(character){
  const handle = getCurrentHandle();
  const isCampaignCreator = !!(handle && currentCampaign && currentCampaign.creator && handle.toLowerCase() === currentCampaign.creator.toLowerCase());
  const isCharCreator = !!(handle && character.creator && handle.toLowerCase() === character.creator.toLowerCase());
  const canEditDamage = isCampaignCreator;
  const canEditInjuries = isCampaignCreator || isCharCreator;
  const canManageMedkit = isCampaignCreator || isCharCreator;

  const damage = clampDamage(character.damage || 0);
  const status = damageStatus(damage);
  const medkits = character.medkits || 0;

  const card = document.createElement("div");
  card.className = "character-card";

  card.innerHTML = `
    ${character.photoUrl
      ? `<img class="character-photo" src="${character.photoUrl}" alt="${escapeHtml(character.fullName)}">`
      : `<div class="character-photo" style="display:flex;align-items:center;justify-content:center;font-size:40px;">🕯️</div>`
    }
    <div class="character-body">
      <div class="character-identity">
        <div class="character-name">${escapeHtml(character.fullName)}${damage >= 100 ? " ☠️" : ""}</div>
        <span class="character-gender">${escapeHtml(character.gender || "não informado")}</span>
      </div>

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

      <div class="damage-section">
        <div class="damage-head">
          <span>dano acumulado</span>
          <span class="damage-status ${status.cls}">${status.label} · ${damage}%</span>
        </div>
        <div class="damage-bar">
          <div class="damage-bar-fill" style="width:${damage}%; background:${status.color};"></div>
        </div>

        ${canEditDamage ? `
          <div class="damage-tool">
            <span class="damage-tool-label">ajuste rápido</span>
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
        ` : ""}
      </div>

      <div class="injuries-box">
        <span class="injuries-label">ferimentos e limitações</span>
        <textarea class="injuries-textarea" data-char-id="${character.id}" ${canEditInjuries ? "" : "disabled"} placeholder="${canEditInjuries ? "descreva ferimentos, sequelas, limitações..." : "somente o narrador ou quem criou a ficha pode editar."}">${escapeHtml(character.injuries || "")}</textarea>
        ${canEditInjuries ? `<button class="btn-mini injuries-save" data-action="save-injuries">salvar ferimentos</button>` : ""}
      </div>

      <div class="medkit-row">
        <span class="medkit-count">🩹 kits médicos: <b>${medkits}</b></span>
        <div class="medkit-actions">
          ${canManageMedkit ? `<button class="btn-mini" data-action="add-kit">+ kit</button>` : ""}
          ${canManageMedkit ? `<button class="btn-mini" data-action="use-kit" ${(medkits > 0 && damage > 0) ? "" : "disabled"}>usar kit (-30%)</button>` : ""}
        </div>
      </div>
    </div>
  `;

  // ---- eventos ----
  if (canEditDamage) {
    card.querySelectorAll('[data-action="dmg"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = parseInt(btn.dataset.delta, 10);
        const newDamage = clampDamage(damage + delta);
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage })
          .catch((err) => console.error("Falha ao atualizar dano:", err));
      });
    });
    const applyBtn = card.querySelector('[data-action="dmg-apply"]');
    const input = card.querySelector('[data-action="dmg-input"]');
    applyBtn.addEventListener("click", () => {
      const val = parseInt(input.value, 10);
      if (Number.isNaN(val)) return;
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: clampDamage(val) })
        .catch((err) => console.error("Falha ao atualizar dano:", err));
      input.value = "";
    });
  }

  if (canEditInjuries) {
    const saveBtn = card.querySelector('[data-action="save-injuries"]');
    const textarea = card.querySelector(".injuries-textarea");
    saveBtn.addEventListener("click", () => {
      campaignsAPI.patchCharacter(currentCampaign.id, character.id, { injuries: textarea.value.trim() })
        .catch((err) => console.error("Falha ao salvar ferimentos:", err));
    });
  }

  if (canManageMedkit) {
    const addBtn = card.querySelector('[data-action="add-kit"]');
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { medkits: medkits + 1 })
          .catch((err) => console.error("Falha ao adicionar kit médico:", err));
      });
    }
    const useBtn = card.querySelector('[data-action="use-kit"]');
    if (useBtn) {
      useBtn.addEventListener("click", () => {
        if (medkits <= 0) return;
        const newDamage = clampDamage(damage - 30);
        campaignsAPI.patchCharacter(currentCampaign.id, character.id, { damage: newDamage, medkits: medkits - 1 })
          .catch((err) => console.error("Falha ao usar kit médico:", err));
      });
    }
  }

  return card;
}
