// ============================================================
// REVERSE LIFE — modelos do bestiário (monstros da mitologia grega)
// O narrador escolhe um modelo e ajusta o que quiser antes de salvar.
// Dano: 1 ponto = 1 ponto de vida do monstro (vida fixa, em pontos).
//
// Ataque: name · attr (atributo do teste) · dmg (dados) · range (melee soma a Força do monstro; ranged não)
//   targets (nº de alvos) · rs (atributo de resistência do alvo, Normal 10+; vazio = sem resistência)
//   fx {l rótulo, min minutos | acts ações, m {atributo|ataque|percepcao: ±n}} (efeito em quem falhar)
// ============================================================

export const MONSTER_TEMPLATES = [
  { id: "furia", ico: "🦇", fullName: "Fúria", kind: "Espírito alado",
    attrs: { forca: 2, agilidade: 4, vigor: 3, carisma: 3, intelecto: 3 }, hpMax: 30, armor: 0,
    attacks: [
      { name: "Garras", attr: "agilidade", dmg: "1d6", range: "melee", targets: 1 },
      { name: "Grito aterrador", attr: "carisma", dmg: "", range: "ranged", targets: 3, rs: "vigor", fx: { l: "Aterrorizado (-3 nos ataques)", min: 5, m: { ataque: -3 } } },
    ] },
  { id: "minotauro", ico: "🐂", fullName: "Minotauro", kind: "Besta do labirinto",
    attrs: { forca: 5, agilidade: 2, vigor: 5, carisma: 1, intelecto: 1 }, hpMax: 60, armor: 2,
    attacks: [
      { name: "Chifrada", attr: "forca", dmg: "2d6", range: "melee", targets: 1 },
      { name: "Investida", attr: "forca", dmg: "2d8", range: "melee", targets: 1, rs: "forca", fx: { l: "Derrubado pela investida", acts: 1 } },
    ] },
  { id: "hidra", ico: "🐍", fullName: "Hidra", kind: "Serpente de muitas cabeças",
    attrs: { forca: 4, agilidade: 3, vigor: 5, carisma: 1, intelecto: 2 }, hpMax: 80, armor: 1,
    attacks: [
      { name: "Mordida", attr: "forca", dmg: "2d6", range: "melee", targets: 2 },
      { name: "Cuspe ácido", attr: "agilidade", dmg: "1d8", range: "ranged", targets: 1, rs: "agilidade", fx: { l: "Queimadura ácida (-2 Vigor)", min: 10, m: { vigor: -2 } } },
    ] },
  { id: "quimera", ico: "🦁", fullName: "Quimera", kind: "Fera de três cabeças",
    attrs: { forca: 4, agilidade: 3, vigor: 4, carisma: 2, intelecto: 2 }, hpMax: 55, armor: 1,
    attacks: [
      { name: "Mordida e chifres", attr: "forca", dmg: "1d10", range: "melee", targets: 1 },
      { name: "Sopro de fogo", attr: "agilidade", dmg: "2d6", range: "ranged", targets: 2, rs: "agilidade" },
    ] },
  { id: "cerbero", ico: "🐕", fullName: "Cérbero", kind: "Guardião do Submundo",
    attrs: { forca: 5, agilidade: 3, vigor: 5, carisma: 2, intelecto: 2 }, hpMax: 70, armor: 1,
    attacks: [
      { name: "Três mordidas", attr: "forca", dmg: "2d8", range: "melee", targets: 3 },
      { name: "Uivo infernal", attr: "carisma", dmg: "", range: "ranged", targets: 8, rs: "vigor", fx: { l: "Paralisado de medo", acts: 1 } },
    ] },
  { id: "harpia", ico: "🦅", fullName: "Harpia", kind: "Ave de rapina",
    attrs: { forca: 2, agilidade: 5, vigor: 2, carisma: 1, intelecto: 2 }, hpMax: 20, armor: 0,
    attacks: [
      { name: "Garras", attr: "agilidade", dmg: "1d6", range: "melee", targets: 1 },
      { name: "Rajada de vento", attr: "agilidade", dmg: "", range: "ranged", targets: 2, rs: "forca", fx: { l: "Desequilibrado (-3 Agilidade)", min: 5, m: { agilidade: -3 } } },
    ] },
  { id: "gorgona", ico: "🪨", fullName: "Górgona", kind: "Criatura de olhar mortal",
    attrs: { forca: 3, agilidade: 3, vigor: 4, carisma: 3, intelecto: 3 }, hpMax: 40, armor: 0,
    attacks: [
      { name: "Cabelos de serpente", attr: "agilidade", dmg: "1d6", range: "melee", targets: 1, rs: "vigor", fx: { l: "Veneno de serpente (-2 Vigor)", min: 10, m: { vigor: -2 } } },
      { name: "Olhar de pedra", attr: "carisma", dmg: "", range: "ranged", targets: 1, rs: "vigor", fx: { l: "Petrificado (1 ação)", acts: 1 } },
    ] },
  { id: "ciclope", ico: "👁️", fullName: "Ciclope", kind: "Gigante de um olho só",
    attrs: { forca: 5, agilidade: 1, vigor: 5, carisma: 1, intelecto: 1 }, hpMax: 55, armor: 1,
    attacks: [
      { name: "Pancada", attr: "forca", dmg: "2d8", range: "melee", targets: 1 },
      { name: "Arremesso de rocha", attr: "forca", dmg: "2d6", range: "ranged", targets: 1 },
    ] },
  { id: "esqueleto", ico: "💀", fullName: "Esqueleto guerreiro", kind: "Morto-vivo",
    attrs: { forca: 3, agilidade: 3, vigor: 3, carisma: 0, intelecto: 1 }, hpMax: 25, armor: 1,
    attacks: [{ name: "Espada enferrujada", attr: "forca", dmg: "1d8", range: "melee", targets: 1 }] },
  { id: "caoinfernal", ico: "🔥", fullName: "Cão infernal", kind: "Fera das sombras",
    attrs: { forca: 3, agilidade: 4, vigor: 3, carisma: 1, intelecto: 1 }, hpMax: 30, armor: 0,
    attacks: [
      { name: "Mordida", attr: "forca", dmg: "1d8", range: "melee", targets: 1 },
      { name: "Uivo", attr: "carisma", dmg: "", range: "ranged", targets: 3, rs: "vigor", fx: { l: "Assustado (-2 nos ataques)", min: 5, m: { ataque: -2 } } },
    ] },
  { id: "drakon", ico: "🐉", fullName: "Drakon", kind: "Dragão ancestral",
    attrs: { forca: 5, agilidade: 3, vigor: 6, carisma: 3, intelecto: 3 }, hpMax: 100, armor: 3,
    attacks: [
      { name: "Mordida", attr: "forca", dmg: "3d6", range: "melee", targets: 1 },
      { name: "Golpe de cauda", attr: "forca", dmg: "2d6", range: "melee", targets: 3, rs: "forca", fx: { l: "Derrubado pela cauda", acts: 1 } },
      { name: "Sopro de fogo", attr: "agilidade", dmg: "3d8", range: "ranged", targets: 8, rs: "agilidade" },
    ] },
];

export const TEMPLATE_BY_ID = Object.fromEntries(MONSTER_TEMPLATES.map((t) => [t.id, t]));
