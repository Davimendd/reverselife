// ============================================================
// REVERSE LIFE — dados do sistema Jogos Vorazes
// Distritos (com a história de Panem), Cornucópia (armas e suprimentos),
// regiões da arena, modelos de Ameaças e erva preta.
// Convenção de dano (igual ao Percy Jackson): 1 ponto de dano = 1% na ficha;
// "HP" nas descrições = pontos de % de vida; sanidade em % (100% = insano).
// ============================================================

// ---------- Distritos ----------
// passive: o que a passiva faz de verdade no sistema (ver hunger-engine.js)
//   attr:{chave:+n}      bônus fixo em um atributo (vale em testes, dano, carga e limite de vida)
//   maxDmg:n             limite de vida a mais (em pontos de %)
//   dmg:{melee:n}        dano fixo extra com armas corpo a corpo
//   dmgTag:{tags,n}      dano fixo extra com armas que tenham uma dessas tags
//   heal:n               itens de cura curam n a mais
//   sanityCut:n          % a menos em todo dano de sanidade recebido de eventos
//   herb:n               % a mais de eficiência das ervas
export const DISTRICTS = [
  { n: 1, name: "Distrito 1", sector: "Luxo", ico: "💎", color: "#e8d48a",
    lore: "Produz joias, tecidos finos e artigos de luxo para o Capitólio. É o distrito mais rico e mais próximo da capital, e muitos de seus jovens se voluntariam em programas de treino para os Jogos (os Carreiristas).",
    passive: { id: "encanto", name: "Encanto do Capitólio", text: "+1 em Carisma. O público adora os tributos do 1.", attr: { carisma: 1 } } },
  { n: 2, name: "Distrito 2", sector: "Pedreiras e Armamentos", ico: "⛏️", color: "#c9553d",
    lore: "Corta pedra e fabrica armas e treina Pacificadores. Foi o último a se render na rebelião, tem fortaleza nas montanhas (o Nut) e também forma Carreiristas desde a infância.",
    passive: { id: "treino", name: "Treino de Pacificador", text: "+2 de dano fixo com armas corpo a corpo.", dmg: { melee: 2 } } },
  { n: 3, name: "Distrito 3", sector: "Tecnologia", ico: "🔌", color: "#4fb8d6",
    lore: "Fabrica eletrônicos, máquinas e componentes tecnológicos. Seus tributos costumam ser engenhosos e já foram responsáveis por sabotar armadilhas dos Idealizadores.",
    passive: { id: "engenho", name: "Engenho Técnico", text: "+1 em Intelecto. Sempre vê uma saída que os outros não veem.", attr: { intelecto: 1 } } },
  { n: 4, name: "Distrito 4", sector: "Pesca", ico: "🎣", color: "#3fa7b8",
    lore: "Distrito litorâneo que vive do mar: pesca, redes e embarcações. Também é Distrito de Carreiristas e seus tributos dominam tridentes, arpões e redes.",
    passive: { id: "pescador", name: "Mão de Pescador", text: "+2 de dano fixo com Tridente, Arpão, Lança Longa e Facas de Arremesso.", dmgTag: { tags: ["pesca"], n: 2 } } },
  { n: 5, name: "Distrito 5", sector: "Energia", ico: "⚡", color: "#e6d24a",
    lore: "Gera a eletricidade que alimenta Panem, em usinas e barragens. Sempre foi um distrito discreto, de gente acostumada a trabalhar sob pressão e a viver em alerta.",
    passive: { id: "reserva", name: "Reserva de Energia", text: "+10 no limite de vida (morre apenas em 110%).", maxDmg: 10 } },
  { n: 6, name: "Distrito 6", sector: "Transporte", ico: "🚆", color: "#8f9aa6",
    lore: "Produz trens, carros e aeronaves. Muita gente do 6 vive viciada em morfináceo e acostumada à pressa constante: são mensageiros, maquinistas e pilotos.",
    passive: { id: "estrada", name: "Pé na Estrada", text: "+1 em Agilidade. Rápidos para fugir e reagir.", attr: { agilidade: 1 } } },
  { n: 7, name: "Distrito 7", sector: "Madeira", ico: "🪓", color: "#6fa54a",
    lore: "Região de florestas: lenha, papel e madeira beneficiada. Os lenhadores do 7 manejam machados desde crianças e são ótimos em se mover entre as árvores.",
    passive: { id: "lenhador", name: "Braço de Lenhador", text: "+2 de dano fixo com qualquer machado (Machadinha, Machadinhas, Machado de lenhador).", dmgTag: { tags: ["machado"], n: 2 } } },
  { n: 8, name: "Distrito 8", sector: "Têxteis", ico: "🧵", color: "#b983d6",
    lore: "Fábricas de tecidos e uniformes (inclusive os dos Pacificadores). Foi um dos primeiros distritos a se revoltar, e o povo é acostumado a costurar, remendar e improvisar.",
    passive: { id: "remendo", name: "Mãos de Costureiro", text: "Itens de cura (Kit Médico) curam +10 HP em você.", heal: 10 } },
  { n: 9, name: "Distrito 9", sector: "Grãos", ico: "🌾", color: "#d6b94a",
    lore: "Planícies de trigo, cevada e silos. É um distrito paciente, de ciclos longos de plantio e colheita, que aprendeu a suportar a fome sem perder a calma.",
    passive: { id: "paciencia", name: "Paciência do Campo", text: "Recebe 25% a menos de dano de sanidade dos eventos da arena.", sanityCut: 25 } },
  { n: 10, name: "Distrito 10", sector: "Pecuária", ico: "🐄", color: "#c98f5a",
    lore: "Cria gado, cavalos e outros animais de corte e de trabalho. Gente calejada, acostumada a lidar com bichos grandes e teimosos.",
    passive: { id: "calejado", name: "Mãos Calejadas", text: "+1 em Força. Também carrega mais.", attr: { forca: 1 } } },
  { n: 11, name: "Distrito 11", sector: "Agricultura", ico: "🍎", color: "#7fd66a",
    lore: "O maior distrito agrícola de Panem: frutas, legumes e algodão, colhidos sob vigilância pesada. Seu povo conhece cada planta, o que serve para comer e o que é veneno.",
    passive: { id: "colheita", name: "Conhecimento de Plantas", text: "Ervas (verde e azul) são 25% mais eficientes em você.", herb: 25 } },
  { n: 12, name: "Distrito 12", sector: "Mineração de Carvão", ico: "🪨", color: "#7a7a7a",
    lore: "O mais pobre e menor de Panem, nos Apalaches: minas de carvão, fome e miséria. Seus tributos sobrevivem à base de resistência, caça às escondidas e teimosia.",
    passive: { id: "carvao", name: "Pulmões de Carvão", text: "+1 em Vigor (e +5 no limite de vida).", attr: { vigor: 1 } } },
];
export const DISTRICT_BY_N = Object.fromEntries(DISTRICTS.map((d) => [d.n, d]));
export const DISTRICT_MAX_TRIBUTES = 3;

// ---------- regiões da arena ----------
export const REGIONS = [
  { id: "norte", label: "Norte", ico: "🧭" },
  { id: "sul", label: "Sul", ico: "🧭" },
  { id: "leste", label: "Leste", ico: "🧭" },
  { id: "oeste", label: "Oeste", ico: "🧭" },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export const CORNUCOPIA = { id: "cornucopia", label: "Cornucópia", ico: "🏺" };
export const regionLabel = (id) => (id === "cornucopia" ? "Cornucópia" : (REGION_BY_ID[id] ? REGION_BY_ID[id].label : id || "—"));

// ---------- armas da Cornucópia ----------
// atk: attr (teste) · dmg · range (melee soma Força; ranged não) · bleed (% base de sangramento) · ammo (cargas)
// tags: usados pelas passivas de distrito (ex.: "pesca", "machado")
// Chance de sangramento: lâminas afiadas sangram mais; armas contundentes (martelo e bastão) pouco ou nada.
export const WEAPONS = [
  { key: "faca_caca", name: "Faca de Caça", n: 4, atk: { attr: "agilidade", dmg: "2d8", range: "melee", bleed: 15 }, desc: "Lâmina longa e resistente, boa para caçar e para lutar de perto." },
  { key: "punhal", name: "Punhal", n: 2, atk: { attr: "agilidade", dmg: "2d6", range: "melee", bleed: 20 }, desc: "Lâmina curta e fina, feita para estocadas rápidas." },
  { key: "facas_arremesso", name: "Facas de Arremesso (Bolsa com 4 Facas)", n: 2, atk: { attr: "agilidade", dmg: "2d8", range: "ranged", bleed: 15, ammo: 4, ammoMax: 4, tags: ["pesca"] }, desc: "Quatro facas balanceadas. Cada ataque gasta 1 faca (a narração pode permitir recolher)." },
  { key: "machadinha", name: "Machadinha", n: 2, atk: { attr: "forca", dmg: "3d6", range: "melee", bleed: 20, tags: ["machado"] }, desc: "Machado curto de uma mão, pesado e brutal." },
  { key: "lanca_longa", name: "Lança Longa", n: 2, atk: { attr: "forca", dmg: "2d12", range: "melee", bleed: 10, tags: ["pesca"] }, desc: "Haste longa com ponta de aço: alcance e dano alto, mas sangra pouco." },
  { key: "arco_caca", name: "Arco de Caça (6 flechas)", n: 2, atk: { attr: "agilidade", dmg: "2d10", range: "ranged", bleed: 20, ammo: 6, ammoMax: 6 }, desc: "Arco de madeira com 6 flechas. Cada ataque gasta 1 flecha." },
  { key: "espada_curta", name: "Espada Curta", n: 2, atk: { attr: "forca", dmg: "2d10", range: "melee", bleed: 25 }, desc: "Lâmina de duas faces, leve e mortal." },
  { key: "espada_longa", name: "Espada Longa", n: 1, atk: { attr: "forca", dmg: "3d8", range: "melee", bleed: 30 }, desc: "Espada de combate de lâmina longa — a maior chance de sangramento entre as lâminas." },
  { key: "tridente", name: "Tridente", n: 1, atk: { attr: "forca", dmg: "4d6", range: "melee", bleed: 25, tags: ["pesca"] }, desc: "Três pontas de aço, arma clássica dos Carreiristas do 4." },
  { key: "machadinhas", name: "Machadinhas (par)", n: 1, atk: { attr: "agilidade", dmg: "3d6", range: "ranged", bleed: 20, ammo: 2, ammoMax: 2, tags: ["machado"] }, desc: "Um par de machadinhas de arremesso. Cada ataque gasta 1 machadinha." },
  { key: "machado_lenhador", name: "Machado de Lenhador", n: 1, atk: { attr: "forca", dmg: "3d8", range: "melee", bleed: 35, tags: ["machado"] }, desc: "Machado de duas mãos: ferimentos profundos." },
  { key: "foice_curta", name: "Foice Curta", n: 1, atk: { attr: "agilidade", dmg: "4d4", range: "melee", bleed: 40 }, desc: "Lâmina curva que rasga: a maior chance de sangramento de todas." },
  { key: "arpao", name: "Arpão", n: 1, atk: { attr: "forca", dmg: "4d6", range: "ranged", bleed: 30, ammo: 1, ammoMax: 1, tags: ["pesca"] }, desc: "Arremessado com força, uma carga: depois do tiro é preciso recuperá-lo." },
  { key: "besta", name: "Besta (6 flechas)", n: 1, atk: { attr: "agilidade", dmg: "3d10", range: "ranged", bleed: 25, ammo: 6, ammoMax: 6 }, desc: "Besta de tensão com 6 virotes. Cada ataque gasta 1." },
  { key: "martelo", name: "Martelo", n: 1, atk: { attr: "forca", dmg: "1d12", range: "melee", bleed: 5 }, desc: "Cabeça de ferro: esmaga mais do que corta (quase nunca sangra)." },
  { key: "bastao", name: "Bastão de Madeira", n: 2, atk: { attr: "forca", dmg: "1d12", range: "melee", bleed: 0 }, desc: "Bastão robusto de madeira. Contundente: não causa sangramento." },
];
export const WEAPON_BY_KEY = Object.fromEntries(WEAPONS.map((w) => [w.key, w]));

// ---------- suprimentos da Cornucópia ----------
// fn = o que o item faz no sistema (ver hunger.js, useSupply)
export const SUPPLIES = [
  { key: "mochila", name: "Mochila de Sobrevivência Vazia", n: 7, category: "equipamento", unique: true, noSlot: true, capBonus: 5,
    desc: "Vestida, não ocupa espaço no inventário e dá +5 de espaço. Só pode haver uma por inventário.", fn: { type: "pack" } },
  { key: "cantil_cheio", name: "Cantil com 1 litro de água", n: 5, category: "bebida", uses: 2, raw: true,
    desc: "2 goles: cada um recupera 1 nível de sede e, se a água não estiver purificada, tem 15% de chance de causar infecção.", fn: { type: "drink", thirst: 1 } },
  { key: "cantil_vazio", name: "Cantil Vazio", n: 4, category: "equipamento",
    desc: "Em uma fonte de água ele vira um Cantil com 1 litro (2 goles, água crua: 15% de infecção até ser purificada).", fn: { type: "fill" } },
  { key: "garrafa", name: "Garrafa de Água 500 ml", n: 4, category: "bebida", uses: 1, raw: true,
    desc: "Um gole: recupera 1 nível de sede (15% de chance de infecção se a água não estiver purificada).", fn: { type: "drink", thirst: 1 } },
  { key: "racao", name: "Ração de Sobrevivência", n: 6, category: "alimento", uses: 1,
    desc: "Refeição completa: recupera 2 níveis de fome (15% de chance de infecção se não for cozida).", fn: { type: "eat", hunger: 2 } },
  { key: "barra", name: "Barra Energética", n: 6, category: "alimento", uses: 1,
    desc: "Recupera 1 nível de fome e 5 HP de vida na hora (15% de chance de infecção se não for cozida).", fn: { type: "eat", hunger: 1, hp: 5 } },
  { key: "carne_seca", name: "Porção de Carne Seca", n: 3, category: "alimento", uses: 1,
    desc: "Recupera 2 níveis de fome, mas é salgada: tira 1 nível de sede. Pode ser cozida na panela.", fn: { type: "eat", hunger: 2, thirst: -1 } },
  { key: "frutas", name: "Saco de Frutas", n: 3, category: "alimento", uses: 3,
    desc: "3 frutas: cada uma recupera 1 nível de fome (15% de chance de infecção em cada, se não forem cozidas).", fn: { type: "eat", hunger: 1 } },
  { key: "kit_medico", name: "Kit Médico", n: 3, category: "cura", heal: 30,
    desc: "Cura 30 HP e estanca o sangramento. Não cura infecção (só a Erva Vermelha).", fn: { type: "cure", heal: 30, stopBleed: true } },
  { key: "atadura", name: "Atadura", n: 4, category: "cura", heal: 0,
    desc: "Estanca o sangramento (não cura vida). Não cura infecção.", fn: { type: "cure", heal: 0, stopBleed: true } },
  { key: "antisseptico", name: "Antisséptico", n: 2, category: "cura",
    desc: "Prevenção: por 1 hora, a chance de infecção de água e comida cai de 15% para 3%. Não cura uma infecção já instalada.", fn: { type: "antiseptic", min: 60 } },
  { key: "pastilhas", name: "Pacote de Pastilhas Purificadoras", n: 2, category: "equipamento", uses: 6,
    desc: "6 pastilhas: cada uma purifica 1 cantil ou garrafa de água crua (chance de infecção da água cai a 0%).", fn: { type: "purify" } },
  { key: "fosforos", name: "Caixa de Fósforos", n: 3, category: "equipamento", uses: 8,
    desc: "8 fósforos: cada um acende uma fogueira (30 min), necessária para cozinhar e ferver água. A fogueira também aquece, mas denuncia a sua posição.", fn: { type: "fire", test: false } },
  { key: "pederneira", name: "Pederneira", n: 2, category: "equipamento",
    desc: "Acende fogueiras sem limite de usos, mas pede um teste Normal de Agilidade (a faísca falha às vezes).", fn: { type: "fire", test: true } },
  { key: "corda", name: "Corda de 5 metros", n: 3, category: "equipamento",
    desc: "Usar para se ancorar (30 min): imune ao arrasto do Tsunami e a ser separado dos aliados no Terremoto.", fn: { type: "buff", fx: { l: "Ancorado com corda", min: 30, tag: "ancora" } } },
  { key: "cobertor", name: "Cobertor Térmico", n: 4, category: "equipamento",
    desc: "Usar para se aquecer (1 hora): corta pela metade a perda de HP da Nevasca e anula a penalidade de Vigor do frio.", fn: { type: "buff", fx: { l: "Aquecido (cobertor térmico)", min: 60, tag: "aquecido" } } },
  { key: "lona", name: "Lona Impermeável", n: 2, category: "equipamento",
    desc: "Montar abrigo (2 horas): reduz pela metade o dano de Chuva Escarlate, Nevasca e Tempestade de Cinzas. Terremoto e Tsunami destroem o abrigo.", fn: { type: "buff", fx: { l: "Abrigado (lona)", min: 120, tag: "abrigo" } } },
  { key: "capa", name: "Capa de Chuva", n: 2, category: "equipamento",
    desc: "Vestir (1 hora): na Chuva Escarlate evita a irritação e a visão embaçada e reduz o dano pela metade; protege a água e a comida do inventário.", fn: { type: "buff", fx: { l: "Encapado (capa de chuva)", min: 60, tag: "capa" } } },
  { key: "kit_pesca", name: "Kit de Pesca", n: 2, category: "equipamento", uses: 4,
    desc: "4 iscas: cada uso é um teste Normal de Agilidade perto de água; se passar, rende 1 Peixe (2 níveis de fome, 15% de infecção se cru; cozinhe na panela).", fn: { type: "fish" } },
  { key: "bussola", name: "Bússola", n: 1, category: "equipamento",
    desc: "Usar (1 hora): +2 em Intelecto para se orientar e não se perde no Terremoto nem na Nevasca.", fn: { type: "buff", fx: { l: "Orientado (bússola)", min: 60, tag: "bussola", m: { intelecto: 2 } } } },
  { key: "lanterna", name: "Lanterna", n: 2, category: "equipamento",
    desc: "Acender (1 hora): +1 em Intelecto e Agilidade no escuro e ignora a visão embaçada. Chama atenção.", fn: { type: "buff", fx: { l: "Lanterna acesa", min: 60, tag: "lanterna", m: { intelecto: 1, agilidade: 1 } } } },
  { key: "panela", name: "Panela Pequena", n: 2, category: "equipamento",
    desc: "Com uma fogueira acesa: cozinha 1 alimento (o risco de infecção vai a 0%) ou ferve 1 água crua (fica purificada).", fn: { type: "cook" } },
  { key: "escudo", name: "Escudo de Madeira", n: 2, category: "escudo", def: { absorb: 6, hp: 24 },
    desc: "Equipado, absorve até 6 de dano por golpe e perde a mesma quantidade de durabilidade (24). Quebra ao chegar a zero.", fn: { type: "shield" } },
];
export const SUPPLY_BY_KEY = Object.fromEntries(SUPPLIES.map((s) => [s.key, s]));

// itens extras que nascem de outras mecânicas (não ficam na Cornucópia)
export const EXTRA_ITEMS = [
  { key: "peixe", name: "Peixe", category: "alimento", uses: 1, raw: false,
    desc: "Pescado fresco: recupera 2 níveis de fome. 15% de chance de infecção se comer cru; cozido na panela fica seguro.", fn: { type: "eat", hunger: 2 } },
  { key: "antidoto", name: "Antídoto", category: "cura",
    desc: "Remove o envenenamento da Última Ceia. Escondido discretamente na arena.", fn: { type: "antidote" } },
  { key: "erva_preta", name: "Erva Preta", category: "erva_preta",
    desc: "Veneno. Engolida à força causa 10 de dano ignorando armadura. Passada em uma arma, adiciona 1 dado de dano ao próximo ataque (uma vez só). Não se mistura com outras ervas.", fn: { type: "blackherb" } },
];
export const EXTRA_BY_KEY = Object.fromEntries(EXTRA_ITEMS.map((s) => [s.key, s]));
export const CATALOG_BY_KEY = { ...WEAPON_BY_KEY, ...SUPPLY_BY_KEY, ...EXTRA_BY_KEY };

// ---------- infecção e outras constantes de regra ----------
export const INFECTION_CHANCE = 15;            // % em toda água e alimento
export const INFECTION_CHANCE_ANTISEPTIC = 3;  // com Antisséptico ativo
export const INFECTION_CHANCE_CONTAMINATED = 50; // item contaminado pela Chuva Escarlate
export const INFECTION_TICK_MS = 30 * 60 * 1000; // 2% a cada 30 min (sangramento: 5% a cada 10)
export const INFECTION_TICK_DMG = 2;
export const BLEED_CHANCE_CRIT_BONUS = 15;     // 20 natural: +15 pontos de chance de sangrar
export const BLACK_HERB_DMG = 10;
export const FIRE_MIN = 30;

// ---------- sorteio de presentes de patrocinadores ----------
// "uma das 4 ervas, uma bebida ou um alimento"
export const SPONSOR_POOL = [
  { key: "erva_verde", w: 2, kind: "herb" },
  { key: "erva_vermelha", w: 2, kind: "herb" },
  { key: "erva_azul", w: 2, kind: "herb" },
  { key: "erva_preta", w: 1, kind: "herb" },
  { key: "garrafa", w: 2, kind: "drink" },
  { key: "cantil_cheio", w: 2, kind: "drink" },
  { key: "racao", w: 2, kind: "food" },
  { key: "barra", w: 2, kind: "food" },
  { key: "carne_seca", w: 1, kind: "food" },
  { key: "frutas", w: 1, kind: "food" },
];

// ---------- modelos de Ameaças (NPCs inimigos e bestantes) ----------
// mesmo formato do bestiário do Percy Jackson; bleed = % de sangramento do ataque
export const THREAT_TEMPLATES = [
  { id: "coelho", ico: "🐇", fullName: "Coelho Bestante", kind: "Bestante geneticamente modificado",
    attrs: { forca: 3, agilidade: 4, vigor: 3, carisma: 0, intelecto: 1 }, hpMax: 50, armor: 0,
    attacks: [
      { name: "Mordida Predadora", attr: "agilidade", dmg: "2d6", range: "melee", targets: 1, bleed: 20 },
      { name: "Investida Selvagem", attr: "forca", dmg: "2d8", range: "melee", targets: 1, rs: "agilidade", fx: { l: "Derrubado pela investida", acts: 1 } },
    ] },
  { id: "carreirista", ico: "🗡️", fullName: "Tributo Carreirista", kind: "NPC inimigo",
    attrs: { forca: 4, agilidade: 3, vigor: 3, carisma: 2, intelecto: 2 }, hpMax: 40, armor: 0,
    attacks: [
      { name: "Espada", attr: "forca", dmg: "2d8", range: "melee", targets: 1, bleed: 25 },
      { name: "Lança arremessada", attr: "agilidade", dmg: "2d10", range: "ranged", targets: 1, bleed: 15 },
    ] },
  { id: "tributo_fugitivo", ico: "🏃", fullName: "Tributo Desesperado", kind: "NPC inimigo",
    attrs: { forca: 2, agilidade: 3, vigor: 2, carisma: 1, intelecto: 2 }, hpMax: 25, armor: 0,
    attacks: [{ name: "Facada", attr: "agilidade", dmg: "1d8", range: "melee", targets: 1, bleed: 20 }] },
  { id: "teleguiadas", ico: "🐝", fullName: "Vespas Teleguiadas", kind: "Bestante de enxame",
    attrs: { forca: 1, agilidade: 5, vigor: 1, carisma: 0, intelecto: 0 }, hpMax: 15, armor: 0,
    attacks: [
      { name: "Ferroadas", attr: "agilidade", dmg: "1d6", range: "melee", targets: 3, rs: "vigor", fx: { l: "Veneno de vespa (alucinações, -2 Intelecto)", min: 10, m: { intelecto: -2 } } },
    ] },
  { id: "mutacao_lobo", ico: "🐺", fullName: "Mutação Lobo", kind: "Bestante de laboratório",
    attrs: { forca: 4, agilidade: 4, vigor: 4, carisma: 0, intelecto: 1 }, hpMax: 55, armor: 1,
    attacks: [
      { name: "Mordida", attr: "forca", dmg: "2d8", range: "melee", targets: 1, bleed: 30 },
      { name: "Salto", attr: "agilidade", dmg: "2d6", range: "melee", targets: 1, rs: "forca", fx: { l: "Derrubado pelo salto", acts: 1 } },
    ] },
  { id: "mutt_cao", ico: "🐕", fullName: "Cão Mutante", kind: "Bestante de laboratório",
    attrs: { forca: 4, agilidade: 3, vigor: 4, carisma: 0, intelecto: 1 }, hpMax: 45, armor: 1,
    attacks: [{ name: "Mordida", attr: "forca", dmg: "2d6", range: "melee", targets: 1, bleed: 25 }] },
  { id: "pacificador", ico: "🪖", fullName: "Pacificador", kind: "NPC inimigo",
    attrs: { forca: 3, agilidade: 3, vigor: 4, carisma: 1, intelecto: 2 }, hpMax: 45, armor: 2,
    attacks: [{ name: "Cassetete", attr: "forca", dmg: "1d12", range: "melee", targets: 1 }] },
];
export const THREAT_BY_ID = Object.fromEntries(THREAT_TEMPLATES.map((t) => [t.id, t]));
