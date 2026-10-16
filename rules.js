// ============================================================
// REVERSE LIFE — regras de jogo (lógica pura, sem DOM nem Firebase)
// Atributos, estados do corpo, sangramento, testes de D20 e ervas.
// ============================================================

export const ATTR_POINTS_TOTAL = 10;
export const ATTR_MAX = 5;

export const ATTRS = [
  { key: "forca", label: "Força", icon: "💪", desc: "Ações de força bruta, dano corpo a corpo e capacidade de carregar itens." },
  { key: "agilidade", label: "Agilidade", icon: "⚡", desc: "Reflexos, esquiva, ataques à distância e iniciativa." },
  { key: "vigor", label: "Vigor", icon: "🫀", desc: "Resistência física e fortitude. Cada ponto aumenta em 5% o limite de dano." },
  { key: "carisma", label: "Carisma", icon: "🗣️", desc: "Força de vontade, persuasão, diplomacia e resistência mental." },
  { key: "intelecto", label: "Intelecto", icon: "🧠", desc: "Raciocínio, conhecimento e poder de investigação." }
];

export function attrValue(character, key){
  const v = character && character.attrs ? Number(character.attrs[key]) : 0;
  return Number.isFinite(v) ? v : 0;
}

export function validateAttrs(attrs){
  const values = ATTRS.map((a) => Number(attrs[a.key]) || 0);
  const total = values.reduce((s, v) => s + v, 0);
  if (values.some((v) => v < 0 || v > ATTR_MAX)) return { ok: false, total, error: `cada atributo vai de 0 a ${ATTR_MAX}.` };
  if (total !== ATTR_POINTS_TOTAL) return { ok: false, total, error: `distribua exatamente ${ATTR_POINTS_TOTAL} pontos (faltam ${ATTR_POINTS_TOTAL - total}).` };
  return { ok: true, total };
}

// ---------- vida / estados do corpo ----------
export function maxDamageOf(character){
  return 100 + 5 * attrValue(character, "vigor");
}

// Normal / Mancando / No Chão — os limites sobem 5 por ponto de Vigor
export function bodyState(damage, character){
  const v = attrValue(character, "vigor");
  const max = 100 + 5 * v;
  if (damage >= max) return { key: "morto", label: "Morto", icon: "☠️", desc: "O personagem não resistiu." };
  if (damage > 80 + 5 * v) return { key: "chao", label: "No Chão", icon: "🧎", desc: "Não consegue nem andar: só se arrasta ou é carregado por outro jogador (que terá movimento limitado)." };
  if (damage > 50 + 5 * v) return { key: "mancando", label: "Mancando", icon: "🦯", desc: "Movimento limitado, precisa de ajuda para concluir algumas ações e luta em desvantagem." };
  return { key: "normal", label: "Normal", icon: "🧍", desc: "Apto a qualquer ação e a lutar normalmente, com apenas limitações narrativas se necessário." };
}

// ---------- sanidade ----------
export const SANITY_MAX = 100;
export const INSANE_DESC = "Perdeu completamente o juízo: não consegue lutar direito, pode ferir os próprios colegas e chama atenção.";

// ---------- sangramento (1h, 5% a cada 10 min, total 30%) ----------
export const BLEED_TICK_MS = 10 * 60 * 1000;
export const BLEED_TICKS = 6;
export const BLEED_TICK_DAMAGE = 5;

export function bleedProgress(bleeding, now){
  if (!bleeding) return null;
  const elapsed = Math.min(BLEED_TICKS, Math.max(0, Math.floor((now - bleeding.startedAt) / BLEED_TICK_MS)));
  const msLeft = Math.max(0, bleeding.startedAt + BLEED_TICKS * BLEED_TICK_MS - now);
  return { elapsedTicks: elapsed, appliedTicks: bleeding.ticksApplied || 0, msLeft };
}

// devolve null quando não há nada a aplicar; senão o patch a gravar
export function computeBleedTicks(character, now){
  const b = character.bleeding;
  if (!b) return null;
  const { elapsedTicks, appliedTicks } = bleedProgress(b, now);
  if (elapsedTicks <= appliedTicks) return null;

  const n = elapsedTicks - appliedTicks;
  const max = maxDamageOf(character);
  const oldDamage = Math.min(max, Math.max(0, Math.round(character.damage || 0)));
  const newDamage = Math.min(max, oldDamage + n * BLEED_TICK_DAMAGE);
  const finished = elapsedTicks >= BLEED_TICKS || newDamage >= max;

  return {
    patch: {
      damage: newDamage,
      bleeding: finished ? null : { startedAt: b.startedAt, ticksApplied: elapsedTicks }
    },
    ticks: n, finished, oldDamage, newDamage, max
  };
}

// ---------- testes de D20 ----------
export const D20_TESTS = {
  normal: { label: "Normal", min: 10 },
  dificil: { label: "Difícil", min: 15 },
  arriscado: { label: "Arriscado", min: 18 }
};

// attrKey = null → d20 puro; testKey = null → sem teste (só o resultado)
// disadvantage (true ou o motivo, ex.: "Mancando") → rola 2d20 e fica com o menor
export function rollD20(attrKey, attrBonus, testKey, rng = Math.random, disadvantage = false){
  const roll = () => 1 + Math.floor(rng() * 20);
  const rolls = disadvantage ? [roll(), roll()] : [roll()];
  const die = Math.min(...rolls);
  const bonus = attrKey ? attrBonus : 0;
  const total = die + bonus;
  const test = testKey && D20_TESTS[testKey] ? D20_TESTS[testKey] : null;
  return { die, rolls, disadvantage: !!disadvantage, disadvantageReason: typeof disadvantage === "string" ? disadvantage : "", bonus, total, attrKey, test, success: test ? total >= test.min : null };
}

export function d20Message(r){
  const attr = r.attrKey ? ATTRS.find((a) => a.key === r.attrKey) : null;
  const dice = r.disadvantage ? `2d20 (${r.rolls.join(" e ")} → vale o menor: ${r.die})` : `1d20 (${r.die})`;
  const calc = attr ? `${dice} + ${attr.label} (${r.bonus}) = ${r.total}` : (r.disadvantage ? `${dice} = ${r.total}` : `1d20 = ${r.die}`);
  const dis = r.disadvantage ? ` — com desvantagem${r.disadvantageReason ? ` (${r.disadvantageReason})` : ""}` : "";
  if (!r.test) return calc + dis;
  return `${calc}${dis} — teste ${r.test.label} (≥${r.test.min}): ${r.success ? "SUCESSO" : "FALHA"}`;
}

// ---------- carga (só em campanhas D20): 5 itens + 2 por ponto de Força ----------
export const CARRY_BASE = 5;
export const CARRY_PER_STRENGTH = 2;
export function carryCapacity(character){
  return CARRY_BASE + CARRY_PER_STRENGTH * attrValue(character, "forca");
}
export function itemsCarried(items){
  return (items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
}

// ---------- ervas ----------
export const HERBS = {
  erva_verde: { label: "Erva Verde", icon: "🌿", short: "verde" },
  erva_vermelha: { label: "Erva Vermelha", icon: "🌺", short: "vermelha" },
  erva_azul: { label: "Erva Azul", icon: "🫐", short: "azul" }
};
export const HERB_SANITY_RESTORE = 20;

// misturas: 2 ervas = +25% de eficiência, 3 ervas = +35% (valores arredondados)
export const HERB_MIX_BONUS = { 2: 25, 3: 35 };
export function herbMixBonus(types){ return HERB_MIX_BONUS[types.length] || 0; }
const boosted = (base, bonus) => Math.round(base * (100 + bonus) / 100);

// efeitos de 1 a 3 ervas: cura (vida), para sangramento, sanidade restaurada
// healPct = % de cura base da campanha (itens de cura); a mistura aplica o bônus por cima
export function herbEffect(types, healPct = 0){
  const has = (t) => types.includes(t);
  const bonus = herbMixBonus(types);
  return {
    heal: has("erva_verde"),
    healAmount: has("erva_verde") ? boosted(healPct, bonus) : 0,
    stopBleed: has("erva_vermelha"),
    sanity: has("erva_azul") ? boosted(HERB_SANITY_RESTORE, bonus) : 0,
    bonus,
    mixed: types.length > 1
  };
}

export function herbEffectText(types, healPct){
  const e = herbEffect(types, healPct);
  const parts = [];
  if (e.heal) parts.push(`restaura ${e.healAmount}% de vida`);
  if (e.stopBleed) parts.push("para o sangramento");
  if (e.sanity) parts.push(`restaura ${e.sanity}% de sanidade`);
  if (types.length === 1 && types[0] === "erva_verde") parts.push("não impede o sangramento");
  return parts.join(", ");
}
