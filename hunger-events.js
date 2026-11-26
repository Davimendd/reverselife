// ============================================================
// REVERSE LIFE — eventos da arena (Jogos Vorazes)
// Cada evento atinge UMA região inteira (norte, sul, leste ou oeste), sorteada junto com o evento.
// O narrador aplica o evento nas fichas que estavam na região: resolve(ficha, o) rola os testes,
// calcula dano, sanidade, efeitos (com agenda de dano por tempo) e perda de itens.
// Equipamentos da Cornucópia reduzem ou anulam partes dos eventos (ver "mech" de cada um).
// Convenção: dano em pontos de % (HP); sanidade em % (100% = insano).
// ============================================================

import { attrTest, hasTag, weightedPick } from "./hunger-engine.js";

const MIN = 60000;
const newRes = () => ({ dmg: 0, heal: 0, sanity: 0, fx: [], stripTags: [], contaminate: false, destroy: 0, lines: [] });
const tmsg = (r, label) => `${label}: ${r.die}+${r.bonus}=${r.total} (precisa ${r.test.min}) → ${r.success ? "passou" : "falhou"}`;
const fxd = (o, def) => ({ ...def, ev: o.evId });
// ticks de dano em intervalos: n ticks de "each" a cada "every" min, começando em "first" min
const ticks = (first, every, n, each, label, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ afterMs: (first + i * every) * MIN, dmg: each, label, ...extra }));

export const ARENA_EVENTS = [
  // ---------------------------------------------------------------- Chuva Escarlate
  { id: "chuva", name: "Chuva Escarlate", ico: "🌧️", color: "#d8362e", durationMin: 30, sanity: 10,
    desc: "Uma chuva avermelhada e tóxica começa a cair sobre a região, contaminando a vegetação e as fontes de água. Os tributos precisam encontrar abrigo antes que a exposição se torne perigosa.",
    cons: [
      "Irritação na pele (-2 em Vigor) e visão embaçada (-2 em Agilidade).",
      "Perda de 25 HP conforme o tempo de exposição (5 HP a cada 5 minutos).",
      "Contaminação de alimentos e água do inventário (a chance de infecção deles sobe para 50%).",
      "Necessidade de abandonar esconderijos.",
    ],
    mech: [
      "🧥 Capa de Chuva: sem irritação nem visão embaçada, protege a água e a comida e corta o dano pela metade.",
      "⛺ Lona Impermeável (abrigo): corta o dano pela metade.",
      "🔦 Lanterna acesa: ignora a visão embaçada.",
      "🌀 Dano de sanidade do evento: 10%.",
    ],
    resolve(c, o){
      const r = newRes();
      const capa = hasTag(c, "capa", o.now), abrigo = hasTag(c, "abrigo", o.now), lant = hasTag(c, "lanterna", o.now);
      const f = (capa || abrigo) ? 0.5 : 1;
      if (!capa) r.fx.push(fxd(o, { l: "Irritação na pele (-2 Vigor)", bad: 1, min: o.minutes, m: { vigor: -2 }, tag: "chuva_pele" }));
      else r.lines.push("Capa de chuva: sem irritação na pele.");
      if (!capa && !lant) r.fx.push(fxd(o, { l: "Visão embaçada (-2 Agilidade)", bad: 1, min: o.minutes, m: { agilidade: -2 }, tag: "chuva_visao" }));
      else r.lines.push(lant ? "Lanterna: ignora a visão embaçada." : "Capa de chuva: sem visão embaçada.");
      const per = Math.max(1, Math.round(5 * f));
      r.fx.push(fxd(o, { l: `Chuva tóxica: -${per} HP a cada 5 min`, bad: 1, dropWhenDone: 1, tag: "chuva_hp", schedRel: ticks(5, 5, 5, per, "Chuva Escarlate") }));
      if (!capa) r.contaminate = true; else r.lines.push("Capa de chuva: água e comida do inventário protegidas.");
      if (f < 1) r.lines.push(`Proteção contra a chuva: dano pela metade (${per} HP por pulso).`);
      r.lines.push("Precisa abandonar o esconderijo.");
      r.sanity = this.sanity;
      return r;
    },
  },

  // ---------------------------------------------------------------- Terremoto
  { id: "terremoto", name: "Terremoto", ico: "🌋", color: "#b5733a", durationMin: 15, sanity: 12,
    desc: "Um terremoto provocado pelos Idealizadores desestabiliza a floresta. Árvores começam a tombar, raízes se rompem e o terreno sofre deslizamentos, bloqueando rotas de fuga.",
    cons: [
      "Ferimentos por quedas e destroços (30 HP).",
      "Tributos presos sob troncos ou em deslizamentos (teste de Força para se soltar).",
      "Separação de aliados durante a fuga.",
      "Destruição de acampamentos e equipamentos (1 item da pessoa se quebra).",
    ],
    mech: [
      "🪢 Corda (ancorado) ou 🧭 Bússola: não é separado dos aliados.",
      "⛺ Lona: o abrigo montado é destruído.",
      "🔨 O item que quebra é sorteado do inventário (pode ser até a mochila).",
      "🌀 Dano de sanidade do evento: 12%.",
    ],
    resolve(c, o){
      const r = newRes();
      r.dmg = 30;
      const t = attrTest(c, "forca", "normal", o.now, o.rng);
      r.lines.push(tmsg(t, "Força para escapar dos troncos"));
      if (!t.success) r.fx.push(fxd(o, { l: "Preso sob troncos e deslizamentos (precisa de Força para se soltar)", bad: 1, acts: 2, tag: "preso" }));
      r.destroy = 1;
      r.stripTags.push("abrigo");
      if (hasTag(c, "ancora", o.now) || hasTag(c, "bussola", o.now)) r.lines.push("Corda/bússola: não se separou dos aliados.");
      else r.lines.push("Separado dos aliados durante a fuga.");
      r.sanity = this.sanity;
      return r;
    },
  },

  // ---------------------------------------------------------------- Nevasca
  { id: "nevasca", name: "Nevasca", ico: "❄️", color: "#9fd6ff", durationMin: 30, sanity: 10,
    desc: "A arena ficará coberta por neve, a temperatura cai e uma avalanche se aproxima cobrindo tudo e os tributos que vê pela frente.",
    cons: [
      "Se não escapar da avalanche (teste Difícil de Agilidade), perde 25 de HP.",
      "A cada 10 minutos que permanecer na nevasca, perde 10 de HP.",
      "Exposição causa -5 em testes de Vigor.",
    ],
    mech: [
      "🧣 Cobertor Térmico (aquecido): perda de HP pela metade e sem a penalidade de Vigor.",
      "⛺ Lona (abrigo): perda de HP pela metade.",
      "🧭 Bússola: não se perde na tempestade de neve.",
      "🌀 Dano de sanidade do evento: 10%.",
    ],
    resolve(c, o){
      const r = newRes();
      const t = attrTest(c, "agilidade", "dificil", o.now, o.rng);
      r.lines.push(tmsg(t, "Agilidade para escapar da avalanche"));
      if (!t.success) { r.dmg = 25; r.lines.push("Atingido pela avalanche: -25 HP."); }
      const warm = hasTag(c, "aquecido", o.now), abrigo = hasTag(c, "abrigo", o.now);
      const per = (warm || abrigo) ? 5 : 10;
      if (!warm) r.fx.push(fxd(o, { l: "Exposição ao frio (-5 Vigor)", bad: 1, min: o.minutes, m: { vigor: -5 }, tag: "frio" }));
      else r.lines.push("Cobertor térmico: sem a penalidade de Vigor.");
      r.fx.push(fxd(o, { l: `Nevasca: -${per} HP a cada 10 min`, bad: 1, dropWhenDone: 1, tag: "nevasca_hp", schedRel: ticks(10, 10, Math.max(1, Math.round(o.minutes / 10)), per, "Nevasca") }));
      if (warm || abrigo) r.lines.push("Proteção contra o frio: perda de HP pela metade.");
      r.sanity = this.sanity;
      return r;
    },
  },

  // ---------------------------------------------------------------- Canários Venenosos
  { id: "canarios", name: "Canários Venenosos", ico: "🐦", color: "#e6d24a", durationMin: 60, sanity: 20,
    desc: "Canários venenosos que, ao encostar, aumentam a sanidade de todos que ficam por 1 hora tendo alucinações e ficam raivosos, criando caos.",
    cons: [
      "Aumenta 20 pontos de sanidade se um canário te acertar (teste Normal de Agilidade para desviar).",
      "Por 1 hora possui alucinações, não podendo fazer testes que envolvam Intelecto e Carisma.",
      "Devem atacar alguém ou a si mesmo para não perderem mais 20 pontos de sanidade.",
    ],
    mech: [
      "🌀 O dano de sanidade deste evento são os 20% de quem for acertado (quem desvia não sofre nada).",
      "Quando passar o tempo, use \"quem não atacou ninguém\" para aplicar os +20% de sanidade extras.",
    ],
    resolve(c, o){
      const r = newRes();
      const t = attrTest(c, "agilidade", "normal", o.now, o.rng);
      r.lines.push(tmsg(t, "Agilidade para desviar dos canários"));
      if (t.success) { r.lines.push("Desviou dos canários: sem alucinações."); return r; }
      r.sanity = 20;
      r.fx.push(fxd(o, { l: "Alucinações (sem testes de Intelecto e Carisma)", bad: 1, min: o.minutes, m: { intelecto: -20, carisma: -20 }, tag: "alucinacao" }));
      r.fx.push(fxd(o, { l: "Raiva dos canários: ataque alguém ou a si mesmo", bad: 1, min: o.minutes, tag: "raiva" }));
      r.lines.push("Acertado por um canário: +20% de sanidade e 1 hora de alucinações.");
      return r;
    },
    followUps: [
      { id: "nao_atacou", label: "Quem não atacou ninguém: +20% de sanidade", resolve(c, o){
        const r = newRes(); r.sanity = 20; r.stripTags.push("raiva");
        r.lines.push("Não atacou ninguém durante a fúria: mais 20% de sanidade perdidos."); return r;
      } },
    ],
  },

  // ---------------------------------------------------------------- Despertar dos Predadores
  { id: "predadores", name: "Despertar dos Predadores", ico: "🐇", color: "#c43a5a", durationMin: 30, sanity: 15,
    spawn: { template: "coelho", n: 5 },
    desc: "Criaturas geneticamente modificadas são soltas na arena durante a noite, precisamente COELHOS que vão se transformando em feras gigantes, onde eles saem perseguindo os tributos e fazendo com que eles precisem fugir ou procurar lugares seguros.",
    cons: [
      "Cerca de 5 coelhos bestante são soltos (entram em Ameaças já revelados).",
      "Eles caçam os tributos até matá-los.",
      "Cada coelho possui 50 pontos de vida e 2 ataques (Mordida Predadora e Investida Selvagem).",
    ],
    mech: [
      "🐇 Ao iniciar, os coelhos são criados em Ameaças; o narrador controla os ataques e os tributos atacam de volta.",
      "🌀 Dano de sanidade do evento: 15% (o terror de ser caçado).",
    ],
    resolve(c, o){
      const r = newRes();
      r.sanity = this.sanity;
      r.fx.push(fxd(o, { l: "Caçado pelos coelhos bestante", bad: 1, min: o.minutes, tag: "cacado" }));
      r.lines.push("Está sendo caçado pelos coelhos bestante: fugir ou achar um lugar seguro.");
      return r;
    },
  },

  // ---------------------------------------------------------------- Tempestade de Cinzas
  { id: "cinzas", name: "Tempestade de Cinzas", ico: "🌫️", color: "#8a8a8a", durationMin: 45, sanity: 12,
    desc: "Uma tempestade de cinzas tóxicas começa a cobrir a arena, dificultando a visão e a respiração dos tributos. Os participantes precisam encontrar abrigo antes que a tempestade se intensifique.",
    cons: [
      "Nos primeiros 10 minutos, apenas sofrem -3 em testes de Agilidade, Vigor e Força.",
      "Após isso, começam também a tomar 10 de dano a cada 5 minutos por 20 minutos.",
      "Após isso, está impossibilitado de lutar e começa a ficar asfixiado: se falhar em um teste de Vigor, cairá inconsciente.",
    ],
    mech: [
      "⛺ Lona (abrigo): o dano por cinzas cai pela metade.",
      "🌀 Dano de sanidade do evento: 12%.",
    ],
    resolve(c, o){
      const r = newRes();
      const abrigo = hasTag(c, "abrigo", o.now);
      const per = abrigo ? 5 : 10;
      r.fx.push(fxd(o, { l: "Cinzas tóxicas: -3 em Agilidade, Vigor e Força", bad: 1, min: 10, m: { agilidade: -3, vigor: -3, forca: -3 }, tag: "cinzas" }));
      const sched = [
        ...ticks(10, 5, 4, per, "Tempestade de Cinzas"),
        { afterMs: 30 * MIN, label: "Asfixia", test: { attr: "vigor", dc: "normal" },
          onPass: { msg: "aguentou a falta de ar", fx: [{ l: "Asfixiado: impossibilitado de lutar", bad: 1, min: 15, tag: "asfixia", ev: o.evId }] },
          onFail: { msg: "caiu inconsciente", fx: [{ l: "Asfixiado: impossibilitado de lutar", bad: 1, min: 15, tag: "asfixia", ev: o.evId }, { l: "Inconsciente (asfixia)", bad: 1, min: 15, tag: "inconsciente", ev: o.evId }] } },
      ];
      r.fx.push(fxd(o, { l: `Tempestade: -${per} HP a cada 5 min a partir do minuto 10`, bad: 1, dropWhenDone: 1, tag: "cinzas_hp", schedRel: sched }));
      if (abrigo) r.lines.push("Lona: dano das cinzas pela metade.");
      r.sanity = this.sanity;
      return r;
    },
  },

  // ---------------------------------------------------------------- Tsunami
  { id: "tsunami", name: "Tsunami", ico: "🌊", color: "#2f8fd6", durationMin: 15, sanity: 15,
    opts: [
      { id: "elevated", label: "alcançou um local elevado", type: "bool", def: false },
      { id: "inWater", label: "ficou dentro da água", type: "bool", def: false },
    ],
    desc: "Os Idealizadores provocam um tsunami artificial, utilizando mecanismos subterrâneos para deslocar enormes volumes de água em direção à arena. O evento começa com sinais aparentemente naturais, mas rapidamente se transforma em uma catástrofe que ameaça todos os tributos.",
    cons: [
      "Destruição de esconderijos e acampamentos.",
      "Arrastamento de tributos que não conseguiram alcançar locais elevados (25 de dano).",
      "Tributo dentro da água precisa realizar testes de resistência (Vigor) para evitar afogamento a cada ação (10 de dano cada vez que falhar).",
      "Perda de armas, mochilas e suprimentos (perde 2 itens do inventário).",
    ],
    mech: [
      "🪢 Corda (ancorado): não é arrastado pela onda.",
      "Marque quem alcançou local elevado e quem ficou na água. Quem está na água sofre 3 testes de Vigor (1 por minuto); use \"rodada de afogamento\" para mais.",
      "⛺ Lona: o abrigo montado é destruído.",
      "🌀 Dano de sanidade do evento: 15%.",
    ],
    resolve(c, o){
      const r = newRes();
      const op = o.opt || {};
      if (op.elevated) r.lines.push("Chegou a um local elevado: não foi arrastado.");
      else if (hasTag(c, "ancora", o.now)) r.lines.push("Corda: ficou ancorado e não foi arrastado.");
      else { r.dmg = 25; r.lines.push("Arrastado pela onda: -25 HP."); }
      r.destroy = 2;
      r.stripTags.push("abrigo");
      if (op.inWater) {
        const sched = Array.from({ length: 3 }, (_, i) => ({ afterMs: (i + 1) * MIN, label: "Afogamento", test: { attr: "vigor", dc: "normal" }, onPass: { msg: "segurou o fôlego" }, onFail: { dmg: 10, msg: "engoliu água" } }));
        r.fx.push(fxd(o, { l: "Dentro da água: risco de afogamento (Vigor a cada minuto)", bad: 1, dropWhenDone: 1, tag: "afogando", schedRel: sched }));
      }
      r.sanity = this.sanity;
      return r;
    },
    followUps: [
      { id: "afogamento", label: "Rodada de afogamento (Vigor, 10 de dano se falhar)", resolve(c, o){
        const r = newRes(); const t = attrTest(c, "vigor", "normal", o.now, o.rng);
        r.lines.push(tmsg(t, "Vigor contra o afogamento"));
        if (!t.success) { r.dmg = 10; r.lines.push("Engoliu água: -10 HP."); } else r.lines.push("Segurou o fôlego.");
        return r;
      } },
    ],
  },

  // ---------------------------------------------------------------- Flora Assassina
  { id: "flora", name: "Flora Assassina", ico: "🌺", color: "#b050c8", durationMin: 20, sanity: 8,
    opts: [{ id: "plant", label: "planta que atingiu", type: "plant", def: "random" }],
    desc: "Os Idealizadores dos Jogos ativam uma espécie de vegetação geneticamente modificada, espalhada previamente por determinadas regiões da arena. À primeira vista, as plantas parecem completamente naturais, com flores exuberantes, frutos coloridos e aromas agradáveis. Entretanto, escondem mecanismos de defesa extremamente perigosos, desenvolvidos para capturar, intoxicar e até devorar animais de grande porte.",
    cons: [
      "Flores do Sono: perfume adocicado que causa sonolência, tontura e perda progressiva dos sentidos.",
      "Plantas Devoradoras: plantas carnívoras gigantes com espinhos internos e paredes escorregadias.",
      "Cipós Predatórios: trepadeiras que lançam cipós em pernas, braços e pescoço quando detectam vibrações.",
      "Flores de Esporos: soltam nuvens de esporos que causam irritação, desorientação e alucinações.",
      "Frutos da Morte: frutos suculentos e cheirosos; comer causa intoxicação severa, fraqueza e perda de consciência.",
    ],
    mech: [
      "Escolha para cada tributo qual planta o atingiu (ou deixe aleatória). Cada planta tem um teste e um efeito próprio.",
      "🌀 Dano de sanidade: varia por planta (5% a 15%).",
    ],
    resolve(c, o){
      const r = newRes();
      const pid = (o.opt && o.opt.plant && o.opt.plant !== "random") ? o.opt.plant : weightedPick(PLANTS, o.rng).id;
      const P = PLANT_BY_ID[pid];
      r.lines.push(`${P.ico} ${P.name}`);
      P.resolve(c, o, r, fxd);
      return r;
    },
  },

  // ---------------------------------------------------------------- A Última Ceia
  { id: "ceia", name: "A Última Ceia", ico: "🍽️", color: "#d4af37", durationMin: 60, sanity: 0, banquet: true,
    desc: "Um banquete será dado aos jogadores como forma de recompensa: eles poderiam cessar fogo por instantes e se deliciarem com as melhores comidas oferecidas pelos fornecedores dos jogos. Porém, tudo tem um \"a mais\": as comidas estarão envenenadas com venenos de pequena escala a grande escala (sorteado quais alimentos serão), onde a cura estará na arena de maneira discreta.",
    cons: [
      "Os jogadores apresentam náuseas, vômitos, dores de cabeça, alucinações e fraquezas.",
      "Podem até mesmo morrer se não tiverem a sorte de achar o antídoto.",
      "Este é o único evento que NÃO causa dano de sanidade.",
    ],
    mech: [
      "🍽️ Ao iniciar, o banquete aparece para todos com os pratos (o veneno de cada prato fica escondido; só o narrador vê).",
      "☠️ Veneno pequeno: 5 HP + náuseas (-1 Vigor, 30 min). Médio: 10 HP + intoxicação (-2 Vigor e Força, 1 h) + 5 HP a cada 10 min por 30 min. Grande: 15 HP + envenenamento severo (-3 Vigor e Força, alucinações) + 8 HP a cada 5 min — só o Antídoto cura.",
      "💉 O Antídoto fica escondido em 2 locais da arena. O narrador revela quando alguém o encontrar.",
      "⛔ O tributo escolhe o prato e come. Só o narrador sabe se estava envenenado.",
    ],
    resolve(c, o){ const r = newRes(); r.lines.push("A Última Ceia não ataca direto: os tributos escolhem os pratos do banquete."); return r; },
  },

  // ---------------------------------------------------------------- Bomba Aérea
  { id: "bomba", name: "Bomba Aérea", ico: "💣", color: "#ff6a2e", durationMin: 15, sanity: 15,
    opts: [{ id: "zone", label: "onde estava", type: "zone", def: "seguro" }],
    desc: "Uma grande bomba será liberada de um avião (ou alguma máquina aeronáutica), gerando um impacto explosivo na arena, fazendo com que os jogadores tenham 1 minuto para correr antes do impacto da bomba. A explosão irá conter fogo, fumaça tóxica e um grande incêndio que irá prejudicar e dar dano nos jogadores.",
    cons: [
      "O fogo irá se alastrar, queimando tudo que estiver no caminho: quem pegar fogo faz teste de Agilidade para apagar, ou continua tomando 10 de dano.",
      "Quem inalar a fumaça toma 5 de dano.",
      "Quem estiver na área da explosão recebe 30 de dano pela força do impacto, e se estiver no mesmo chat (epicentro) recebe 50 de dano.",
    ],
    mech: [
      "⏱️ A explosão acontece 1 minuto depois de você aplicar o evento (os tributos têm esse tempo para correr).",
      "Marque a zona de cada tributo: seguro (só fumaça), fogo alastrou (fumaça e chamas), área da explosão (30 de dano) ou epicentro/mesmo chat (50 de dano).",
      "🔥 Quem pegar fogo faz um teste Normal de Agilidade por minuto (até 5 vezes): passou, apagou; falhou, 10 de dano.",
      "🌀 Dano de sanidade do evento: 15%.",
    ],
    resolve(c, o){
      const r = newRes();
      const zone = (o.opt && o.opt.zone) || "seguro";
      const blast = zone === "centro" ? 50 : (zone === "area" ? 30 : 0);
      const burning = zone !== "seguro";
      const burn = { l: "Em chamas (Agilidade para apagar, 10 de dano por minuto)", bad: 1, dropWhenDone: 1, tag: "fogo", ev: o.evId, schedRel: [
        { afterMs: 2000, label: "Fogo", test: { attr: "agilidade", dc: "normal" }, onPass: { clear: true, msg: "apagou o fogo" }, onFail: { dmg: 10, msg: "continua queimando" }, again: { everyMs: MIN, max: 5 } },
      ] };
      const at = { afterMs: MIN, label: "Explosão da bomba", dmg: blast + 5, msg: `${blast ? `impacto de ${blast}` : "fora do impacto"} + 5 de fumaça tóxica`, ...(burning ? { fx: [burn] } : {}) };
      r.fx.push(fxd(o, { l: "A bomba cai em 1 minuto: corra!", bad: 1, min: 2, dropWhenDone: 1, tag: "bomba", schedRel: [at] }));
      r.lines.push(`Zona: ${ZONES[zone]}. A explosão acontece em 1 minuto.`);
      r.sanity = this.sanity;
      return r;
    },
  },
];
export const EVENT_BY_ID = Object.fromEntries(ARENA_EVENTS.map((e) => [e.id, e]));

export const ZONES = { seguro: "seguro (só a fumaça)", fogo: "o fogo alastrou até ele", area: "área da explosão (30 de dano)", centro: "epicentro / mesmo chat (50 de dano)" };

// ---------------------------------------------------------------- plantas da Flora Assassina
export const PLANTS = [
  { id: "sono", w: 1, ico: "💤", name: "Flores do Sono",
    resolve(c, o, r, fxd){
      const t = attrTest(c, "vigor", "normal", o.now, o.rng); r.lines.push(tmsg(t, "Vigor contra o perfume"));
      if (!t.success) r.fx.push(fxd(o, { l: "Adormecido pelas Flores do Sono (inconsciente)", bad: 1, min: 15, tag: "inconsciente" }));
      else r.fx.push(fxd(o, { l: "Tontura das Flores do Sono (-2 Agilidade)", bad: 1, min: 10, m: { agilidade: -2 } }));
      r.sanity = 6;
    } },
  { id: "devoradora", w: 1, ico: "🪴", name: "Plantas Devoradoras",
    resolve(c, o, r, fxd){
      const t = attrTest(c, "forca", "normal", o.now, o.rng); r.lines.push(tmsg(t, "Força para escapar da planta"));
      if (!t.success) { r.dmg = 10; r.fx.push(fxd(o, { l: "Preso na Planta Devoradora (precisa de Força para sair)", bad: 1, acts: 2, tag: "preso" })); r.lines.push("Engolido pelas paredes escorregadias: -10 HP."); }
      else r.lines.push("Escapou da planta.");
      r.sanity = 10;
    } },
  { id: "cipo", w: 1, ico: "🌿", name: "Cipós Predatórios",
    resolve(c, o, r, fxd){
      const t = attrTest(c, "agilidade", "normal", o.now, o.rng); r.lines.push(tmsg(t, "Agilidade para desviar dos cipós"));
      if (!t.success) { r.dmg = 8; r.fx.push(fxd(o, { l: "Enredado por Cipós Predatórios (precisa de Força/Agilidade para se soltar)", bad: 1, acts: 2, tag: "preso" })); r.lines.push("Cipós no pescoço e nos braços: -8 HP."); }
      else r.lines.push("Desviou dos cipós.");
      r.sanity = 8;
    } },
  { id: "esporos", w: 1, ico: "🍄", name: "Flores de Esporos",
    resolve(c, o, r, fxd){
      const t = attrTest(c, "vigor", "normal", o.now, o.rng); r.lines.push(tmsg(t, "Vigor contra os esporos"));
      if (!t.success) { r.sanity = 15; r.fx.push(fxd(o, { l: "Alucinações por esporos (-3 Intelecto e Carisma)", bad: 1, min: 15, m: { intelecto: -3, carisma: -3 }, tag: "alucinacao" })); }
      else { r.sanity = 5; r.lines.push("Prendeu a respiração a tempo."); }
    } },
  { id: "frutos", w: 1, ico: "🍇", name: "Frutos da Morte",
    resolve(c, o, r, fxd){
      r.lines.push("Os frutos só ferem quem come: marque \"comeu o fruto\" para aplicar a intoxicação.");
      if (!(o.opt && o.opt.ate)) { r.sanity = 3; return; }
      r.dmg = 20;
      r.fx.push(fxd(o, { l: "Intoxicação por Frutos da Morte (-3 Vigor)", bad: 1, min: 30, m: { vigor: -3 }, tag: "veneno_fruto" }));
      const t = attrTest(c, "vigor", "normal", o.now, o.rng); r.lines.push(tmsg(t, "Vigor contra a intoxicação"));
      if (!t.success) r.fx.push(fxd(o, { l: "Inconsciente (Frutos da Morte)", bad: 1, min: 15, tag: "inconsciente" }));
      r.sanity = 10;
    } },
];
export const PLANT_BY_ID = Object.fromEntries(PLANTS.map((p) => [p.id, p]));

// ---------------------------------------------------------------- banquete da Última Ceia
export const DISHES = [
  { name: "Pernil assado com mel", ico: "🍖" }, { name: "Torta de maçã e canela", ico: "🥧" },
  { name: "Sopa cremosa de cogumelos", ico: "🍲" }, { name: "Pão trançado quente", ico: "🥖" },
  { name: "Pudim de chocolate", ico: "🍮" }, { name: "Peixe grelhado com limão", ico: "🐟" },
  { name: "Cordeiro com ervas finas", ico: "🍗" }, { name: "Salada de frutas do Capitólio", ico: "🍓" },
  { name: "Faisão recheado", ico: "🦃" }, { name: "Bolo de mel e nozes", ico: "🍰" },
];
export const POISON_LEVELS = { pequeno: "veneno pequeno", medio: "veneno médio", grande: "veneno grande" };

// sorteia quais pratos estão envenenados e em que nível
export function buildBanquet(rng = Math.random, poisonedCount = null){
  const n = poisonedCount == null ? 3 + Math.floor(rng() * 3) : poisonedCount;   // 3 a 5 pratos envenenados
  const order = DISHES.map((d, i) => ({ d, k: rng() + i * 0 })).sort((a, b) => a.k - b.k).map((x) => x.d);
  const levels = [{ id: "pequeno", w: 5 }, { id: "medio", w: 3 }, { id: "grande", w: 2 }];
  return order.map((d, i) => ({ name: d.name, ico: d.ico, qty: 3, poison: i < n ? weightedPick(levels, rng).id : null }));
}

// efeito de comer um prato envenenado
export function poisonResult(level, evId){
  const r = newRes();
  const src = "A Última Ceia";
  if (level === "pequeno") {
    r.dmg = 5; r.lines.push("Náuseas e vômitos.");
    r.fx.push({ l: "Náuseas e vômitos (-1 Vigor)", bad: 1, min: 30, m: { vigor: -1 }, tag: "veneno_leve", ev: evId });
  } else if (level === "medio") {
    r.dmg = 10; r.lines.push("Dor de cabeça, fraqueza e tontura.");
    r.fx.push({ l: "Intoxicação (-2 Vigor e Força)", bad: 1, min: 60, m: { vigor: -2, forca: -2 }, tag: "veneno", ev: evId,
      dropWhenDone: 1, schedRel: ticks(10, 10, 3, 5, "Veneno do banquete") });
  } else if (level === "grande") {
    r.dmg = 15; r.sanity = 15; r.lines.push("Alucinações, vômitos e fraqueza severa — só o Antídoto cura.");
    r.fx.push({ l: "Envenenamento severo (-3 Vigor e Força) — só o Antídoto cura", bad: 1, m: { vigor: -3, forca: -3 }, tag: "veneno", ev: evId,
      dropWhenDone: 1, schedRel: ticks(5, 5, 12, 8, "Veneno do banquete") });
  }
  r.src = src;
  return r;
}
