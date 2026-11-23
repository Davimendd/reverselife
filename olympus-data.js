// ============================================================
// REVERSE LIFE — Poderes e Presentes Divinos (sistema Percy Jackson)
// Dados extraídos do PDF "Poderes e Presentes Divinos".
//
// Convenção de dano: 1 ponto de dano = 1% de dano na ficha; cura de N = -N% de dano.
//
// Ação (act):   l rótulo · t atributo do teste · dmg dados de dano · dt tipo do dano
//   melee/ranged (arma) · attr atributo da arma · foe nº de alvos inimigos · ally nº de aliados
//   self (o conjurador pode ser alvo da cura/efeito de aliado; conta no limite de 'ally') · heal dados de cura · healS cura própria
//   stopBleed · rs {a: atributo de resistência, vs: "dc" (Normal 10+) | "c" (contra o teste do conjurador), ca}
//   apAlways efeitos em todos os alvos inimigos, mesmo que resistam
//   ap efeitos em quem FALHA na resistência (ou sempre, sem rs) · apOk efeitos em quem resiste
//   dmgFail dano só em quem falha · apAlly efeitos em aliados · apSelf efeitos no conjurador
//   cost dano (%) que o conjurador sofre · cd recarga em minutos | "c" (1x por combate) | "d" (1x por dia)
//   opt opções marcáveis [{id,l,mult,dmg,healAdd,rsPen,auto}] · note sem automação (só registra o uso)
//   opt.auto preenche a opção pelo cenário: {on:[tags]} marca se alguma tag estiver ativa; {unless:[tags]} marca se o cenário
//   tiver tags e nenhuma dessas estiver ativa · need/not: tags que o poder exige / que o impedem (aviso, o narrador decide)
// Efeito: l rótulo · m modificadores {atributo|ataque|percepcao: ±n} · min minutos · acts ações · hits ataques
//   absorb barreira · dr redução de dano por golpe · dmgBonus {melee|all: dados} · bad (debuff) · end {dmg}
// ============================================================

const E = (l, o = {}) => ({ l, ...o });
const B = (l, m, o = {}) => ({ l, m, ...o });
const entry = (id, n, tags, d, fx, acts, extra = {}) => ({ id, n, tags, d, fx, acts, ...extra });

export const GODS = [
  // ------------------------------------------------------------ ZEUS
  {
    id: "zeus", n: "Zeus", ico: "⚡", color: "#f5d34f", tit: "Rei dos Deuses", dom: "Céu, raio e trovão",
    powers: [
      entry("descarga", "Descarga Elétrica", "Combate · Ofensivo", "Eletricidade nas mãos disparada contra um inimigo, com contrações musculares involuntárias.",
        ["2d8 de dano elétrico (dobra se o alvo estiver úmido)", "Falhou em Vigor: -5 em Agilidade por 1 hora", "Teste: Intelecto · Recarga: 10 min"],
        [{ id: "a", l: "Disparar descarga", t: "intelecto", foe: 1, dmg: "2d8", dt: "elétrico", rs: { a: "vigor", vs: "dc" },
          ap: [B("Músculos comprometidos (-5 Agilidade)", { agilidade: -5 }, { min: 60, bad: 1 })], cd: 10,
          opt: [{ id: "wet", l: "Alvo úmido (dano dobra)", mult: 2, auto: { on: ["chuva", "tempestade"] } }] }]),
      entry("correntes", "Correntes Celestes", "Combate · Defesa · Mobilidade", "Rajada de ar que afasta adversários, desvia projéteis leves ou impulsiona o corpo.",
        ["Empurra até 2 inimigos em até 12 m (Força do semideus contra Vigor do alvo)", "Ou reduz o impacto de uma queda / salto de até 10 m", "Teste: Intelecto · Recarga: 15 min"],
        [{ id: "a", l: "Empurrar inimigos", t: "intelecto", foe: 2, rs: { a: "vigor", vs: "c", ca: "forca" }, ap: [E("Empurrado (até 12 m)", { acts: 1, bad: 1 })], cd: 15 },
         { id: "b", l: "Salto / amortecer queda", t: "intelecto", note: true, cd: 15 }]),
    ],
    ult: entry("ira", "Ira do Olimpo", "Especial · Ultimate · Área", "Nuvens se fecham e relâmpagos atingem a área escolhida.",
      ["3 relâmpagos em até 3 alvos: 2d10 elétrico cada; os alvos perdem os itens que carregam (eletrizados por 10 min)", "Falhou em Vigor: atordoado (perde a próxima ação)", "Custo: +15% de dano para o semideus · Recarga: 5 h"],
      [{ id: "a", l: "Invocar relâmpagos", t: "intelecto", foe: 3, dmg: "2d10", dt: "elétrico", rs: { a: "vigor", vs: "dc" },
        ap: [E("Atordoado (perde a próxima ação)", { acts: 1, bad: 1 })], apAlways: [E("Itens eletrizados (10 min)", { min: 10, bad: 1 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("egide_t", "Égide Tempestuosa", "Defesa · Proteção", "Broche de bronze celestial que vira um escudo circular com símbolos de raios.",
        ["Barreira elétrica que absorve até 15 de dano", "Quem atacar corpo a corpo recebe 1d8 de dano elétrico", "Dura até absorver os 15 pontos ou 30 min · Recarga: 1 h"],
        [{ id: "a", l: "Ativar Égide", apSelf: [E("Égide Tempestuosa (barreira 15; rebate 1d8 elétrico)", { absorb: 15, min: 30 })], cd: 60 }]),
      entry("asas_eolo", "Asas de Éolo", "Mobilidade · Exploração", "Sandálias de couro escuro com pequenas asas douradas; invocam correntes de vento.",
        ["Deslocamentos aéreos curtos, saltos de até 12 m; pode rerrolar uma esquiva que falhou", "Uma vez: anula o dano de uma queda de até 15 m", "Dura 15 min · Recarga: 40 min"],
        [{ id: "a", l: "Calçar as Asas", apSelf: [E("Asas de Éolo (salto 12 m; rerrola 1 esquiva)", { min: 15 })], cd: 40 }]),
      entry("selo_trovao", "Selo do Trovão", "Combate · Rastreamento", "Medalhão de bronze celestial com um raio gravado; cria uma conexão elétrica com o alvo.",
        ["Marca um alvo visível por 10 min: sente direção e distância, mesmo atrás de obstáculos", "Uma vez no período: descarga de 2d8 elétrico e o alvo fica atordoado 1 ação", "Alcance da marcação: 30 m · Recarga: 1 h"],
        [{ id: "a", l: "Marcar alvo", foe: 1, ap: [E("Marcado pelo Selo do Trovão (10 min)", { min: 10, bad: 1 })], cd: 60 },
         { id: "b", l: "Descarga no marcado", foe: 1, dmg: "2d8", dt: "elétrico", ap: [E("Atordoado (1 ação)", { acts: 1, bad: 1 })], cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ POSEIDON
  {
    id: "poseidon", n: "Poseidon", ico: "🔱", color: "#2f9bd6", tit: "Senhor dos Mares", dom: "Oceanos, tempestades e terremotos",
    powers: [
      entry("pressao", "Pressão Abissal", "Combate", "Água comprimida liberada em um jato capaz de atravessar defesas.",
        ["2d8 de dano aquático (1d8 sem fonte de água por perto)", "Falhou em Força: arremessado até 4 m e derrubado", "Recarga: 15 min"],
        [{ id: "a", l: "Disparar jato", foe: 1, dmg: "2d8", dt: "aquático", rs: { a: "forca", vs: "dc" }, ap: [E("Derrubado (arremessado 4 m)", { acts: 1, bad: 1 })], cd: 15,
          opt: [{ id: "dry", l: "Sem fonte de água próxima (dano 1d8)", dmg: "1d8", auto: { unless: ["agua", "chuva"] } }] }]),
      entry("mares", "Revitalização das Marés", "Cura", "Água luminosa que envolve o corpo e acelera a recuperação.",
        ["Recupera 2d8 de vida do semideus ou de um aliado (+1d8 em contato com água natural)", "Remove queimaduras leves, sangramentos superficiais e exaustão moderada", "Recarga: 20 min"],
        [{ id: "a", l: "Revitalizar", ally: 1, self: true, heal: "2d8", stopBleed: true, cd: 20, opt: [{ id: "water", l: "Em contato com água natural (+1d8)", healAdd: "1d8", auto: { on: ["agua"] } }] }]),
    ],
    ult: entry("cataclismo", "Cólera dos Sete Mares", "Ultimate", "Uma coluna aquática serpentina se rompe em uma onda colossal.",
      ["Inimigos em 12 m: 4d10 aquático (2d10 em ambiente seco); falhou em Força: arrastado 8 m e derrubado", "O semideus e até 3 aliados: barreira de 12, que dura os 2 próximos ataques", "Cura: semideus 2d8, aliados 1d8 · Custo: 20 PV · Recarga: 5 h"],
      [{ id: "a", l: "Liberar a onda", foe: 8, dmg: "4d10", dt: "aquático", rs: { a: "forca", vs: "dc" }, ap: [E("Arrastado e derrubado (sem deslocar na próxima ação)", { acts: 1, bad: 1 })],
        ally: 4, self: true, apAlly: [E("Corrente protetora (barreira 12)", { absorb: 12, hits: 2 })], healS: "2d8", heal: "1d8", cost: 20, cd: 300,
        opt: [{ id: "dry", l: "Ambiente completamente seco (dano 2d10)", dmg: "2d10", auto: { on: ["seco"] } }] }]),
    gifts: [
      entry("tridente", "Tridente das Profundezas", "Arma · Água", "Arma de bronze celestial e minerais abissais; suas pontas permanecem úmidas.",
        ["Causa 1d10 de dano em ataques físicos", "Uma vez por combate: coluna de água, 2d8 de dano e arremesso de 5 m", "Fincado em fonte natural: controla uma corrente em 15 m"],
        [{ id: "a", l: "Atacar com o Tridente", t: "forca", melee: true, foe: 1, dmg: "1d10" },
         { id: "b", l: "Coluna de água", foe: 1, dmg: "2d8", dt: "aquático", cd: "c" },
         { id: "c", l: "Controlar corrente", note: true }]),
      entry("perola", "Pérola de Anfitrite", "Suporte · Água", "Pérola azulada guardada em um relicário de conchas e prata.",
        ["Respirar debaixo d'água e suportar grandes profundidades", "Uma vez por dia: onda que recupera 2d10 de vida de até 3 aliados em contato com água", "Submerso: +5 em Agilidade e Vigor"],
        [{ id: "a", l: "Onda revitalizante", ally: 3, heal: "2d10", cd: "d" },
         { id: "b", l: "Mergulhar (+5 Agilidade e Vigor)", apSelf: [B("Pérola: submerso (+5 Agilidade e Vigor)", { agilidade: 5, vigor: 5 }, { min: 30 })] }]),
      entry("manopla_abismo", "Manopla do Abismo", "Arma · Defesa", "Manopla de bronze celestial coberta por escamas marinhas.",
        ["Solidifica a água em lâminas, lanças e escudos", "Uma vez por combate: armadura líquida, -10 em todo dano durante 2 ataques sofridos", "Absorve o impacto de queda de até 15 m · não impede efeitos mentais, venenos ou ataques que ignorem defesas"],
        [{ id: "a", l: "Armadura líquida", apSelf: [E("Armadura líquida (-10 em todo dano)", { dr: 10, hits: 2 })], cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ HADES
  {
    id: "hades", n: "Hades", ico: "💀", color: "#7a5cc0", tit: "Rei dos Mortos", dom: "Submundo, sombras e riquezas da terra",
    powers: [
      entry("maos", "Mãos do Submundo", "Combate · Controle", "Braços esqueléticos envoltos em sombras emergem da terra e agarram os inimigos.",
        ["Até 3 mãos prendem inimigos: 1d8 de dano necrótico e imobilizado", "O alvo pode fazer um teste de Força para escapar", "Dura até 10 min · Recarga: 15 min"],
        [{ id: "a", l: "Invocar as mãos", foe: 3, dmg: "1d8", dt: "necrótico", rs: { a: "forca", vs: "dc" }, ap: [E("Imobilizado pelas mãos (10 min)", { min: 10, bad: 1 })], cd: 15 }]),
      entry("manto", "Manto da Escuridão", "Mobilidade · Furtividade", "O corpo se envolve em sombras densas, difícil de perceber.",
        ["Desloca-se entre duas áreas escuras em até 12 m", "O primeiro ataque após o deslocamento recebe +3 no teste", "Dura até o deslocamento ou 10 min · Recarga: 15 min"],
        [{ id: "a", l: "Atravessar as sombras", need: ["sombra"], apSelf: [B("Manto da Escuridão (+3 no primeiro ataque)", { ataque: 3 }, { min: 10, acts: 1 })], cd: 15 }]),
    ],
    ult: entry("julgamento", "Julgamento do Rei dos Mortos", "Ultimate", "O chão se abre em rachaduras negras e mãos espectrais surgem ao redor dos inimigos.",
      ["Inimigos em 12 m: 2d10 de dano necrótico; falhou em Vigor: preso por 2 ações e -3 em Agilidade", "Convoca até 2 guerreiros espectrais por 2 ações (1d8 necrótico por ataque)", "Custo: 20 PV · Recarga: 5 h"],
      [{ id: "a", l: "Proferir o julgamento", foe: 8, dmg: "2d10", dt: "necrótico", rs: { a: "vigor", vs: "dc" },
        ap: [B("Preso por correntes sombrias (-3 Agilidade; imóvel)", { agilidade: -3 }, { acts: 2, bad: 1 })],
        apSelf: [E("Guerreiros espectrais (2 ações; 1d8 necrótico cada)", { acts: 2 })], cost: 20, cd: 300 }]),
    gifts: [
      entry("bidente", "Bidente do Rei", "Arma · Necrótico", "Arma de duas pontas em ferro estígio, com inscrições dos portões do Submundo.",
        ["Causa 1d10 de dano em ataques físicos", "Uma vez por combate: onda necrótica em 5 m, 2d8 de dano", "Ao derrotar uma criatura: recupera 1d6 de vida (não vale contra invocados, autômatos ou seres sem energia vital)"],
        [{ id: "a", l: "Atacar com o Bidente", t: "forca", melee: true, foe: 1, dmg: "1d10" },
         { id: "b", l: "Onda necrótica", foe: 8, dmg: "2d8", dt: "necrótico", cd: "c" },
         { id: "c", l: "Absorver energia vital", self: true, healS: "1d6" }]),
      entry("elmo_trevas", "Elmo das Trevas", "Furtividade", "Coroa de aparência discreta, de material negro como obsidiana.",
        ["Invisível, inclusive em presença física e espiritual", "Uma vez por combate: invisível por até 2 ações, mesmo em áreas iluminadas", "Atacar ou usar habilidades ofensivas encerra a invisibilidade"],
        [{ id: "a", l: "Ficar invisível", apSelf: [E("Invisível (2 ações)", { acts: 2 })], cd: "c" }]),
      entry("anima", "Ânima de Érebo", "Sobrenatural", "Cristal negro com uma chama espectral, guardado em um relicário de prata.",
        ["Enxerga espíritos, rastros de almas e manifestações sobrenaturais", "Uma vez por dia: convoca o espírito de um morto recente, que responde até 3 perguntas simples", "Uma vez por combate: anula um ataque espectral hostil"],
        [{ id: "a", l: "Convocar espírito", note: true, cd: "d" }, { id: "b", l: "Absorver manifestação hostil", note: true, cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ HÉCATE
  {
    id: "hecate", n: "Hécate", ico: "🌙", color: "#b04fd8", tit: "Deusa da Magia", dom: "Magia, encruzilhadas e noite",
    powers: [
      entry("grilhoes", "Grilhões Arcanos", "Combate · Controle", "Correntes mágicas violeta surgem do chão e prendem um adversário.",
        ["Prende um inimigo; ele ainda pode atacar com os braços livres", "Intelecto do conjurador contra Força do alvo", "Dura até 10 min · Recarga: 15 min"],
        [{ id: "a", l: "Conjurar grilhões", t: "intelecto", foe: 1, rs: { a: "forca", vs: "c", ca: "intelecto" }, ap: [E("Preso por grilhões arcanos (10 min)", { min: 10, bad: 1 })], cd: 15 }]),
      entry("veu", "Véu das Sombras", "Defesa · Furtividade", "Distorção visual que torna o semideus imperceptível.",
        ["Imperceptível enquanto parado ou lento; pode ocultar parcialmente um aliado", "Atacar, correr ou movimentos bruscos desfazem o efeito", "Dura até 10 min · Recarga: 15 min"],
        [{ id: "a", l: "Erguer o véu", t: "intelecto", ally: 1, apSelf: [E("Véu das Sombras (imperceptível)", { min: 10 })], apAlly: [E("Ocultado pelo Véu das Sombras", { min: 10 })], cd: 15 }]),
    ],
    ult: entry("encruzilhada", "Domínio da Encruzilhada", "Ultimate · Controle de área", "Três caminhos de energia mágica surgem no chão, com chamas violetas e sombras vivas.",
      ["Área de 10 m: até 3 inimigos recebem 2d8 de dano mágico; falhou em Intelecto: ilusão e perde a próxima ação", "Sombras bloqueiam uma passagem ou protegem até 2 aliados de ataques à distância (-15 de dano)", "Dura 20 min · Custo: 12 de dano · Recarga: 5 h"],
      [{ id: "a", l: "Abrir a encruzilhada", t: "intelecto", foe: 3, dmg: "2d8", dt: "mágico", rs: { a: "intelecto", vs: "dc" }, ap: [E("Preso em ilusão (perde a próxima ação)", { acts: 1, bad: 1 })],
        ally: 2, apAlly: [E("Sombras protetoras (-15 em ataques à distância)", { dr: 15, min: 20 })], cost: 12, cd: 300 }]),
    gifts: [
      entry("chave", "Chave dos Mistérios", "Utilidade · Investigação", "Chave de bronze celestial com uma ametista no cabo.",
        ["Destranca fechaduras convencionais e mágicas de complexidade moderada", "Revela passagens secretas, portas ilusórias e compartimentos em 5 m (1 min)", "Teste: Intelecto, se a fechadura for complexa · Recarga: 30 min"],
        [{ id: "a", l: "Destrancar", t: "intelecto", note: true }, { id: "b", l: "Revelar passagens ocultas", note: true, cd: 30 }]),
      entry("lamparina", "Lamparina de Hécate", "Defesa · Investigação", "Lamparina de bronze escurecido com uma chama violeta impossível de apagar.",
        ["Revela criaturas invisíveis, rastros mágicos, presenças sobrenaturais e ilusões em 8 m", "Contra uma criatura sobrenatural: explosão de 1d6 de dano mágico", "Dura 30 min por ativação · Recarga: 1 h"],
        [{ id: "a", l: "Acender a lamparina", apSelf: [E("Lamparina acesa (revela o oculto em 8 m)", { min: 30 })], cd: 60 },
         { id: "b", l: "Explosão contra sobrenatural", foe: 1, dmg: "1d6", dt: "mágico" }]),
      entry("grimorio_h", "Grimório das Três Faces", "Combate · Suporte · Magia", "Livro de capa negra com três luas crescentes; guarda três feitiços.",
        ["Chama Espectral 1d8 mágico · Manto Protetor (absorve 10) · Passo Sombrio (6 m)", "Teste: Intelecto, se houver pressão", "2 cargas; recarrega 1 h depois de esgotadas"],
        [{ id: "a", l: "Chama Espectral", t: "intelecto", foe: 1, dmg: "1d8", dt: "mágico" },
         { id: "b", l: "Manto Protetor", ally: 1, self: true, apAlly: [E("Manto Protetor (absorve 10)", { absorb: 10, min: 20 })] },
         { id: "c", l: "Passo Sombrio", note: true }], { pool: { n: 2, rec: 60 } }),
    ],
  },
  // ------------------------------------------------------------ DEMÉTER
  {
    id: "demeter", n: "Deméter", ico: "🌾", color: "#6fb04a", tit: "Deusa da Colheita", dom: "Natureza, plantas e fertilidade",
    powers: [
      entry("raizes", "Raízes Aprisionadoras", "Combate · Controle", "Raízes e vegetação crescem e prendem as pernas de um adversário.",
        ["Aprisiona um inimigo e dificulta sua esquiva; ele ainda ataca com os braços", "Para escapar à força, o alvo vence um teste de Força contra o Intelecto do semideus", "Dura até 10 min · exige solo natural ou vegetação · Recarga: 15 min"],
        [{ id: "a", l: "Prender com raízes", not: ["artificial"], t: "intelecto", foe: 1, rs: { a: "forca", vs: "c", ca: "intelecto" }, ap: [E("Preso pelas raízes (10 min)", { min: 10, bad: 1 })], cd: 15 }]),
      entry("essencia", "Essência Revigorante", "Suporte · Cura", "Energia vegetal extraída de plantas próximas, em forma de luz esverdeada.",
        ["Recupera 1d8 de vida do alvo (contato físico)", "Remove exaustão leve; não cura doenças nem ferimentos graves", "Não funciona em morto ou inconsciente por perda total de vida · Recarga: 20 min"],
        [{ id: "a", l: "Revigorar", need: ["vegetacao"], t: "intelecto", ally: 1, self: true, heal: "1d8", cd: 20 }]),
    ],
    ult: entry("mae_terra", "Despertar da Mãe-Terra", "Ultimate · Área", "Raízes gigantescas rompem o solo e vinhas avançam pelo campo de batalha.",
      ["Até 4 inimigos em 12 m: 2d10 de dano; falhou em Força: imobilizado por 20 min", "Até 2 aliados na área: proteção de raízes que absorve 10", "Custo: 15 de dano · Recarga: 5 h · exige solo natural ou vegetação"],
      [{ id: "a", l: "Despertar a natureza", need: ["vegetacao"], not: ["artificial"], t: "intelecto", foe: 4, dmg: "2d10", dt: "natural", rs: { a: "forca", vs: "dc" }, ap: [E("Imobilizado pelas raízes (20 min)", { min: 20, bad: 1 })],
        ally: 2, apAlly: [E("Raízes protetoras (absorve 10)", { absorb: 10, min: 20 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("foice", "Foice da Colheita", "Arma · Natureza", "Pequena foice com lâmina de bronze celestial e detalhes de espigas de trigo.",
        ["Corpo a corpo: 1d8 de dano por ataque", "Corte no ar: lâmina de energia vegetal até 6 m, 1d6 de dano", "Teste: Agilidade (ataques) e Intelecto (lâmina) · Recarga: 30 min"],
        [{ id: "a", l: "Golpe de foice", t: "agilidade", melee: true, foe: 1, dmg: "1d8" },
         { id: "b", l: "Corte de energia vegetal", t: "intelecto", foe: 1, dmg: "1d6", dt: "natural", cd: 30 }]),
      entry("semente", "Semente da Renovação", "Suporte · Cura", "Semente dourada em um recipiente de madeira entalhada.",
        ["Plantada e ativada, recupera 2d8 de dano de um aliado ou de si mesmo", "Remove uma condição leve de toxinas naturais", "Uma única utilização · Recarga: 3 h"],
        [{ id: "a", l: "Plantar e ativar", not: ["artificial"], ally: 1, self: true, heal: "2d8", cd: 180 }]),
      entry("manto_est", "Manto das Estações", "Defesa · Utilidade", "Manto de tecido natural com folhas douradas que mudam com as estações.",
        ["Resiste a frio e calor extremos e reduz tempestades naturais (30 min)", "Folhas e galhos absorvem 12 de dano de um ataque físico (20 min)", "Não protege contra fogo mágico · Recarga: 1 h"],
        [{ id: "a", l: "Envolver-se em folhas", apSelf: [E("Folhas protetoras (absorve 12)", { absorb: 12, min: 20 })], cd: 60 }]),
    ],
  },
  // ------------------------------------------------------------ ARES
  {
    id: "ares", n: "Ares", ico: "⚔️", color: "#d63b3b", tit: "Deus da Guerra", dom: "Guerra, fúria e combate",
    powers: [
      entry("furia", "Fúria de Batalha", "Combate · Aprimoramento", "O instinto guerreiro desperta; adrenalina e golpes mais fortes.",
        ["+5 em testes de Força para ataques e manobras; ataques corpo a corpo causam +2d6", "-2 em Intelecto enquanto durar (sem concentração delicada)", "Dura 20 min · Recarga: 30 min"],
        [{ id: "a", l: "Entrar em fúria", apSelf: [B("Fúria de Batalha (+5 Força; +2d6 corpo a corpo; -2 Intelecto)", { forca: 5, intelecto: -2 }, { min: 20, dmgBonus: { melee: "2d6" } })], cd: 30 }]),
      entry("resist_g", "Resistência do Guerreiro", "Defesa · Sobrevivência", "Ignora parte da dor e dos efeitos dos ferimentos.",
        ["Reduz em 2d10 o dano do próximo ataque físico", "Vantagem em um teste de Vigor para resistir a efeitos (10 min)", "Não reduz dano mental, mágico ou sobrenatural · Recarga: 15 min"],
        [{ id: "a", l: "Resistir", apSelf: [E("Resistência do Guerreiro (-2d10 no próximo ataque físico)", { dr: "2d10", hits: 1 }), E("Vantagem em Vigor (10 min)", { min: 10 })], cd: 15 }]),
    ],
    ult: entry("carnificina", "Carnificina de Ares", "Ultimate · Combate", "Fúria absoluta: olhos avermelhados e uma aura carmesim.",
      ["+10 em Força e Vigor (combate) · ataques físicos +2d8 · reduz 3d10 do dano físico recebido", "Uma vez: golpe devastador de 3d10 (alvo precisa vencer Vigor para não cair)", "Dura 30 min · ao encerrar, recebe 20 de dano · não recua do combate sem teste de Intelecto · Recarga: 5 h"],
      [{ id: "a", l: "Entrar em carnificina", apSelf: [B("Carnificina de Ares (+10 Força/Vigor; +2d8; -3d10 físico recebido)", { forca: 10, vigor: 10 }, { min: 30, dmgBonus: { all: "2d8" }, dr: "3d10", end: { dmg: 20 } })], cd: 300 },
       { id: "b", l: "Golpe devastador", t: "forca", foe: 1, dmg: "3d10", rs: { a: "vigor", vs: "dc" }, ap: [E("Derrubado (golpe devastador)", { acts: 1, bad: 1 })] }]),
    gifts: [
      entry("lanca_d", "Lança da Discórdia", "Arma · Ofensivo", "Lança de bronze celestial com lâmina avermelhada, sempre ansiosa por batalha.",
        ["Corpo a corpo: 1d10 de dano", "Arremesso de até 12 m: 2d6; a lança retorna às mãos; o alvo recebe -5 no próximo teste", "Recarga do arremesso: 30 min"],
        [{ id: "a", l: "Golpe de lança", t: "forca", melee: true, foe: 1, dmg: "1d10" },
         { id: "b", l: "Arremessar a lança", t: "agilidade", ranged: true, foe: 1, dmg: "2d6", ap: [B("Desorientado (-5 no próximo teste)", { ataque: -5 }, { acts: 1, bad: 1 })], cd: 30 }]),
      entry("elmo_c", "Elmo do Conquistador", "Defesa · Intimidação", "Elmo de bronze celestial com crista vermelha e marcas de batalhas.",
        ["Vantagem em Vigor e imunidade a efeitos mentais (enquanto equipado)", "Presença ameaçadora em 5 m: teste de Carisma ou -5 em ataques por 15 min", "Carisma do portador contra Carisma dos alvos · Recarga: 1 h"],
        [{ id: "a", l: "Presença ameaçadora", t: "carisma", foe: 8, rs: { a: "carisma", vs: "c", ca: "carisma" }, ap: [B("Intimidado (-5 nos ataques)", { ataque: -5 }, { min: 15, bad: 1 })], cd: 60 }]),
      entry("bracadeiras", "Braçadeiras do Gladiador", "Aprimoramento · Desarmado", "Braçadeiras de bronze celestial com marcas de armas antigas.",
        ["Golpes desarmados causam 1d8 de dano", "Soco concentrado: 2d8 e empurra 9 m se falhar em Vigor", "Só em ataques desarmados · Recarga: 40 min"],
        [{ id: "a", l: "Soco das braçadeiras", t: "forca", melee: true, foe: 1, dmg: "1d8" },
         { id: "b", l: "Soco concentrado", t: "forca", melee: true, foe: 1, dmg: "2d8", rs: { a: "vigor", vs: "dc" }, ap: [E("Empurrado (9 m)", { acts: 1, bad: 1 })], cd: 40 }]),
    ],
  },
  // ------------------------------------------------------------ APOLO
  {
    id: "apolo", n: "Apolo", ico: "☀️", color: "#f2a93b", tit: "Deus do Sol", dom: "Sol, música, cura e profecia",
    powers: [
      entry("flecha", "Flecha Solar", "Combate · Longo alcance", "Flecha de energia solar que explode em luz dourada.",
        ["1d10 de dano radiante", "Falhou em Vigor: ofuscado, -3 em Agilidade por 10 min", "Teste: Agilidade · Recarga: 15 min"],
        [{ id: "a", l: "Disparar flecha solar", t: "agilidade", foe: 1, dmg: "1d10", dt: "radiante", rs: { a: "vigor", vs: "dc" }, ap: [B("Ofuscado (-3 Agilidade)", { agilidade: -3 }, { min: 10, bad: 1 })], cd: 15 }]),
      entry("asclepio", "Toque de Asclépio", "Suporte · Cura", "Energia dourada nas mãos que fecha cortes e ameniza lesões.",
        ["Recupera 1d8 de vida de si ou de um aliado (contato físico)", "Estabiliza um personagem inconsciente por perda de vida", "Teste: Intelecto · Recarga: 20 min"],
        [{ id: "a", l: "Curar", t: "intelecto", ally: 1, self: true, heal: "1d8", cd: 20 }]),
    ],
    ult: entry("apoteose_solar", "Apoteose Solar", "Ultimate · Área", "Explosão de luz e calor que atinge todos os adversários próximos.",
      ["Inimigos em 10 m: 3d10 de dano radiante; falhou em Vigor: cego, -5 em Agilidade e ataques visuais por 20 min", "Aliados na área recuperam 3d8 de vida e são protegidos da cegueira", "Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Libertar a luz do sol", t: "intelecto", foe: 8, dmg: "3d10", dt: "radiante", rs: { a: "vigor", vs: "dc" }, ap: [B("Cego (-5 Agilidade e ataques)", { agilidade: -5, ataque: -5 }, { min: 20, bad: 1 })],
        ally: 8, heal: "3d8", cost: 15, cd: 300 }]),
    gifts: [
      entry("arco_delfos", "Arco de Delfos", "Arma · Precisão", "Arco de bronze celestial que vibra como uma corda musical.",
        ["Flechas de energia luminosa, sem munição: 1d8 por disparo", "Flecha especial: +5 no teste de Agilidade e 2d8 de dano", "Recarga do disparo especial: 30 min"],
        [{ id: "a", l: "Disparar", t: "agilidade", ranged: true, foe: 1, dmg: "1d8" },
         { id: "b", l: "Flecha especial (+5)", t: "agilidade", ranged: true, foe: 1, dmg: "2d8", tb: 5, cd: 30 }]),
      entry("lira", "Lira de Orfeu", "Suporte · Controle", "Pequena lira dourada de cordas encantadas.",
        ["Até 2 aliados: tranquilidade e concentração, +10 em Intelecto e Carisma", "Ou melodia dissonante: até 2 inimigos fazem teste de Intelecto ou -5 em ataques (10 min)", "Dura 20 min · Teste: Carisma · Recarga: 1 h"],
        [{ id: "a", l: "Melodia de tranquilidade", t: "carisma", ally: 2, apAlly: [B("Lira: tranquilidade (+10 Intelecto e Carisma)", { intelecto: 10, carisma: 10 }, { min: 20 })], cd: 60 },
         { id: "b", l: "Melodia dissonante", t: "carisma", foe: 2, rs: { a: "intelecto", vs: "dc" }, ap: [B("Dissonância (-5 nos ataques)", { ataque: -5 }, { min: 10, bad: 1 })], cd: 60 }]),
      entry("laurel", "Laurel de Asclépio", "Cura · Resistência", "Coroa de folhas douradas com detalhes em bronze celestial.",
        ["Identifica doenças, venenos e alterações físicas por contato", "Neutraliza um veneno/doença convencional e recupera 2d6 de vida", "Teste: Intelecto · Recarga: 1 h"],
        [{ id: "a", l: "Curar com o Laurel", t: "intelecto", ally: 1, self: true, heal: "2d6", cd: 60 }]),
    ],
  },
  // ------------------------------------------------------------ ÍRIS
  {
    id: "iris", n: "Íris", ico: "🌈", color: "#e06fb0", tit: "Deusa do Arco-Íris", dom: "Arco-íris, luz e mensagens",
    powers: [
      entry("refracao", "Refração Cromática", "Combate", "Um clarão de cores intensas que atinge a visão dos adversários.",
        ["1d8 de dano luminoso e pode ofuscar por 10 min", "Falhou em Vigor: -3 em testes que dependem da visão", "Recarga: 15 min"],
        [{ id: "a", l: "Clarão cromático", foe: 1, dmg: "1d8", dt: "luminoso", rs: { a: "vigor", vs: "dc" }, ap: [B("Ofuscado (-3 em testes de visão)", { percepcao: -3 }, { min: 10, bad: 1 })], cd: 15 }]),
      entry("passagem", "Passagem Prismática", "Defesa · Ilusão", "Distorce a luz ao redor do corpo, criando imagens ilusórias.",
        ["Até 2 imagens luminosas; o primeiro ataque contra o semideus atinge uma imagem e erra", "Dura 10 min · Recarga: 20 min"],
        [{ id: "a", l: "Criar imagens", apSelf: [E("Imagens luminosas (o primeiro ataque erra)", { min: 10, acts: 1 })], cd: 20 }]),
    ],
    ult: entry("apoteose_arco", "Apoteose do Arco-Íris", "Ultimate", "Um imenso arco-íris sobre o campo de batalha, em ondas de energia divina.",
      ["Inimigos em 8 m: 3d10 de dano luminoso; falhou em Vigor: ofuscado por 10 min", "Até 3 aliados: barreira prismática que absorve 10", "Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Invocar o arco-íris", foe: 8, dmg: "3d10", dt: "luminoso", rs: { a: "vigor", vs: "dc" }, ap: [B("Ofuscado (-3 em testes de visão)", { percepcao: -3 }, { min: 10, bad: 1 })],
        ally: 3, apAlly: [E("Barreira prismática (absorve 10)", { absorb: 10 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("arco_pris", "Arco Prismático", "Arma · Luz", "Arco translúcido que reflete as cores do arco-íris; flechas de luz condensada.",
        ["Flechas de 1d10 de dano luminoso", "Uma vez por combate: flecha que se divide em 3 projéteis (até 3 alvos, 1d6 cada)"],
        [{ id: "a", l: "Disparar", t: "agilidade", ranged: true, foe: 1, dmg: "1d10" },
         { id: "b", l: "Flecha tripla", t: "agilidade", ranged: true, foe: 3, dmg: "1d6", cd: "c" }]),
      entry("pingente", "Pingente da Íris", "Comunicação", "Cristal multicolorido que transmite mensagens por reflexos luminosos.",
        ["Envia mensagem visual ou sonora a uma pessoa conhecida", "Uma vez por dia: comunicação a grandes distâncias (mesmo plano de existência)"],
        [{ id: "a", l: "Enviar mensagem", note: true }, { id: "b", l: "Comunicação a distância", note: true, cd: "d" }]),
      entry("espelho_c", "Espelho das Mil Cores", "Defesa · Investigação", "Espelho de moldura dourada que nunca reflete a mesma imagem duas vezes.",
        ["Enxerga através de ilusões visuais e disfarces mágicos simples", "Uma vez por combate: reflete ataque luminoso ou mágico, reduzindo seu dano em 1d10", "Não funciona contra ataques físicos"],
        [{ id: "a", l: "Refletir ataque", apSelf: [E("Espelho das Mil Cores (-1d10 no próximo ataque luminoso/mágico)", { dr: "1d10", hits: 1 })], cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ CIRCE
  {
    id: "circe", n: "Circe", ico: "🧪", color: "#3fbfa6", tit: "Feiticeira de Eéia", dom: "Feitiçaria, poções e metamorfose",
    powers: [
      entry("metamorfose_f", "Metamorfose Forçada", "Combate · Controle", "Transforma um adversário em um pequeno animal, como fez com os companheiros de Odisseu.",
        ["Alvo vira rato, sapo ou corvo (vida reduzida em ⅔); não usa armas nem habilidades da forma original", "Vigor do alvo contra o Intelecto do semideus", "Dura 10 min · criaturas muito poderosas sofrem só transformação parcial · Recarga: 30 min"],
        [{ id: "a", l: "Transformar", t: "intelecto", foe: 1, rs: { a: "vigor", vs: "c", ca: "intelecto" }, ap: [E("Transformado em animal (vida -⅔; sem armas)", { min: 10, bad: 1 })], cd: 30 }]),
      entry("encantamento", "Encantamento de Circe", "Combate · Mente", "Palavras arcanas que alteram a percepção e o comportamento de um adversário.",
        ["Confusão: o alvo não distingue aliados de inimigos", "Intelecto do alvo contra o Carisma do semideus; falhou: -3 em ataques por 10 min", "Não controla as ações do alvo · Recarga: 20 min"],
        [{ id: "a", l: "Encantar", t: "carisma", foe: 1, rs: { a: "intelecto", vs: "c", ca: "carisma" }, ap: [B("Confuso (-3 nos ataques)", { ataque: -3 }, { min: 10, bad: 1 })], cd: 20 }]),
    ],
    ult: entry("grande_feitico", "Grande Feitiço da Feiticeira", "Ultimate", "Névoa dourada e violeta com símbolos arcanos ao redor dos pés da feiticeira.",
      ["Inimigos em 8 m (Vigor contra o Intelecto): transformação parcial, -5 em ataques e Agilidade por 20 min", "Até 3 aliados: -5 em cada ataque recebido por 20 min", "Já afetados pela Metamorfose Forçada: -5 na resistência · Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Lançar o grande feitiço", t: "intelecto", foe: 8, rs: { a: "vigor", vs: "c", ca: "intelecto" }, ap: [B("Transformação parcial (-5 ataques e Agilidade)", { ataque: -5, agilidade: -5 }, { min: 20, bad: 1 })],
        ally: 3, apAlly: [E("Proteção mágica (-5 em cada ataque)", { dr: 5, min: 20 })], cost: 15, cd: 300,
        opt: [{ id: "meta", l: "Alvos já afetados pela Metamorfose Forçada (-5 na resistência)", rsPen: -5 }] }]),
    gifts: [
      entry("cajado_m", "Cajado da Metamorfose", "Arma · Arcano", "Cajado de madeira escura com serpentes entalhadas e uma pedra violeta.",
        ["Descarga mágica de 1d8 de dano arcano", "Uma vez por combate: transforma uma parte do corpo do inimigo, -2 em Agilidade por 20 min (Vigor resiste)"],
        [{ id: "a", l: "Descarga mágica", t: "intelecto", foe: 1, dmg: "1d8", dt: "arcano" },
         { id: "b", l: "Transformar um membro", foe: 1, rs: { a: "vigor", vs: "dc" }, ap: [B("Membro transformado (-2 Agilidade)", { agilidade: -2 }, { min: 20, bad: 1 })], cd: "c" }]),
      entry("frasco", "Frasco das Mil Faces", "Utilidade · Disfarce", "Frasco de vidro encantado com uma poção que nunca tem a mesma cor.",
        ["Assume a aparência de outra pessoa ou criatura humanoide de tamanho semelhante (30 min)", "Muda só a aparência: não concede habilidades nem atributos"],
        [{ id: "a", l: "Beber a poção", apSelf: [E("Disfarçado (outra aparência)", { min: 30 })] }]),
      entry("grimorio_e", "Grimório de Eéia", "Alquimia", "Antigo livro de receitas alquímicas e encantamentos.",
        ["Poção Revigorante (+1d8 de vida) · Elixir Paralisante (paralisia 5 min; Vigor resiste) · Essência de Invisibilidade (10 min parado)", "Cada receita: 1 uso por dia (restaurado ao amanhecer)"],
        [{ id: "a", l: "Poção Revigorante", ally: 1, self: true, heal: "1d8", cd: "d" },
         { id: "b", l: "Elixir Paralisante", foe: 1, rs: { a: "vigor", vs: "dc" }, ap: [E("Paralisado (5 min)", { min: 5, bad: 1 })], cd: "d" },
         { id: "c", l: "Essência de Invisibilidade", apSelf: [E("Invisível (parado, sem atacar)", { min: 10 })], cd: "d" }]),
    ],
  },
  // ------------------------------------------------------------ HEFESTO
  {
    id: "hefesto", n: "Hefesto", ico: "🔨", color: "#e8782e", tit: "Deus das Forjas", dom: "Fogo, forja e engenhocas",
    powers: [
      entry("punhos", "Punhos Incandescentes", "Combate · Fogo", "Calor de forja divina nos punhos; golpes capazes de deformar metais.",
        ["Ataques corpo a corpo causam +1d8 de dano por fogo", "Falhou em Vigor: queimadura de +1d6", "Dura 10 min · Recarga: 20 min"],
        [{ id: "a", l: "Incendiar os punhos", apSelf: [E("Punhos incandescentes (+1d8 de fogo corpo a corpo)", { min: 10, dmgBonus: { melee: "1d8" } })], cd: 20 }]),
      entry("magnetismo", "Magnetismo Metálico", "Controle · Defesa", "Força magnética que atrai ou repele objetos metálicos próximos.",
        ["Puxa uma arma metálica das mãos de um adversário ou move objetos leves", "Repele arma metálica: +3 no teste de Agilidade para esquivar", "Não funciona contra objetos presos ou artefatos divinos · Recarga: 15 min"],
        [{ id: "a", l: "Repelir metal (+3 esquiva)", apSelf: [B("Magnetismo (+3 para esquivar arma metálica)", { agilidade: 3 }, { acts: 1 })], cd: 15 },
         { id: "b", l: "Puxar arma metálica", note: true, cd: 15 }]),
    ],
    ult: entry("grande_forja", "Cólera da Grande Forja", "Ultimate", "Fissuras incandescentes e uma onda de fogo e metal derretido em todas as direções.",
      ["Inimigos em 8 m: 3d10 de dano por fogo; falhou em Agilidade: derrubado, perde a próxima reação", "Armadura de metal incandescente: -5 em todo dano por 20 min", "Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Explodir a forja", foe: 8, dmg: "3d10", dt: "fogo", rs: { a: "agilidade", vs: "dc" }, ap: [E("Derrubado (perde a próxima reação)", { acts: 1, bad: 1 })],
        apSelf: [E("Armadura incandescente (-5 em todo dano)", { dr: 5, min: 20 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("martelo", "Martelo de Hefesto", "Arma · Impacto", "Martelo de forja de metais divinos que adapta o peso às mãos do portador.",
        ["Causa 1d10 de dano em ataques físicos", "Uma vez por combate: onda de impacto, 1d8 de dano e empurra inimigos em 3 m"],
        [{ id: "a", l: "Golpe de martelo", t: "forca", melee: true, foe: 1, dmg: "1d10" }, { id: "b", l: "Onda de impacto", foe: 8, dmg: "1d8", dt: "impacto", cd: "c" }]),
      entry("automato", "Autômato de Bronze", "Utilidade · Reconhecimento", "Pequena criatura mecânica (coruja, cão...) que obedece ao dono.",
        ["Reconhece ambientes, acha objetos escondidos e transmite o que percebe", "Uma vez por combate: descarga elétrica de 1d8 em um inimigo próximo", "Resistência limitada: pode ser desativado"],
        [{ id: "a", l: "Reconhecimento", note: true }, { id: "b", l: "Descarga elétrica", foe: 1, dmg: "1d8", dt: "elétrico", cd: "c" }]),
      entry("manoplas", "Manoplas da Forja", "Utilidade · Fogo", "Manoplas de bronze celestial que brilham em contato com o calor.",
        ["Aquecem e moldam pequenos objetos metálicos sem forja", "Uma vez por combate: descarga térmica de 2d8 de fogo em um alvo", "Exige as duas manoplas equipadas"],
        [{ id: "a", l: "Descarga térmica", foe: 1, dmg: "2d8", dt: "fogo", cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ AFRODITE
  {
    id: "afrodite", n: "Afrodite", ico: "💖", color: "#f08aa8", tit: "Deusa do Amor", dom: "Amor, beleza e desejo",
    powers: [
      entry("encanto", "Encanto Irresistível", "Controle · Mente", "Presença e voz que influenciam a percepção de uma pessoa.",
        ["O alvo fica fascinado e não ataca diretamente o semideus", "Intelecto do alvo contra o Carisma do semideus", "Dura 10 min · Recarga: 20 min"],
        [{ id: "a", l: "Encantar", t: "carisma", foe: 1, rs: { a: "intelecto", vs: "c", ca: "carisma" }, ap: [E("Fascinado (não ataca o semideus)", { min: 10, bad: 1 })], cd: 20 }]),
      entry("coracao", "Coração Partido", "Combate · Emoção", "Intensifica ciúme, insegurança, tristeza ou raiva no coração do adversário.",
        ["-10 em testes de Intelecto e Agilidade por 10 min", "Vigor do alvo contra o Carisma do semideus", "Só intensifica emoções que já existem · Recarga: 20 min"],
        [{ id: "a", l: "Partir o coração", t: "carisma", foe: 1, rs: { a: "vigor", vs: "c", ca: "carisma" }, ap: [B("Coração partido (-10 Intelecto e Agilidade)", { intelecto: -10, agilidade: -10 }, { min: 10, bad: 1 })], cd: 20 }]),
    ],
    ult: entry("euforia", "Euforia de Afrodite", "Ultimate", "Onda de energia rosada na qual sentimentos e desejos ficam intensamente perceptíveis.",
      ["Inimigos: Intelecto contra o Carisma do semideus; falhou: fascinado, sem atacar nem usar habilidades ofensivas por 10 min", "Até 3 aliados: +3d8 de vida e +10 contra encantamentos por 20 min", "Atacar um fascinado encerra o encantamento · Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Liberar a euforia", t: "carisma", foe: 8, rs: { a: "intelecto", vs: "c", ca: "carisma" }, ap: [E("Fascinado (sem atacar; 10 min)", { min: 10, bad: 1 })],
        ally: 3, heal: "3d8", apAlly: [E("Inspiração (+10 contra encantamentos)", { min: 20 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("adaga_eros", "Adaga de Eros", "Arma · Emoção", "Adaga delicada com pedras rosadas, encantada para ferir o corpo e as emoções.",
        ["Causa 1d8 de dano em ataques físicos", "Uma vez por combate: ao acertar, distração emocional (-10 no próximo ataque do alvo)"],
        [{ id: "a", l: "Golpe com a Adaga", t: "agilidade", melee: true, foe: 1, dmg: "1d8" },
         { id: "b", l: "Golpe distrativo", t: "agilidade", melee: true, foe: 1, dmg: "1d8", ap: [B("Distraído (-10 no próximo ataque)", { ataque: -10 }, { acts: 1, bad: 1 })], cd: "c" }]),
      entry("rosa", "Rosa de Peônia", "Investigação · Emoção", "Pingente em forma de rosa, de ouro e cristal rosado.",
        ["Identifica a emoção predominante de uma pessoa", "Uma vez por dia: revela se alguém está sob encantamento emocional ou manipulação mágica"],
        [{ id: "a", l: "Sentir emoções", note: true }, { id: "b", l: "Revelar encantamento", note: true, cd: "d" }]),
      entry("espelho_n", "Espelho de Narciso", "Ilusão · Disfarce", "Espelho de moldura dourada com brilho rosado que manipula a percepção visual.",
        ["Altera a própria aparência por até 1 hora", "Uma vez por combate: duplicata ilusória que confunde um adversário (não ataca nem interage)"],
        [{ id: "a", l: "Alterar aparência", apSelf: [E("Aparência alterada (até 1 h)", { min: 60 })] }, { id: "b", l: "Criar duplicata", note: true, cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ HERMES
  {
    id: "hermes", n: "Hermes", ico: "🪽", color: "#7fc4e6", tit: "Mensageiro dos Deuses", dom: "Velocidade, viagens e ladinagem",
    powers: [
      entry("velocidade", "Velocidade Mercurial", "Mobilidade", "Movimentos extraordinariamente rápidos, com um rastro dourado.",
        ["Deslocamento instantâneo de até 15 m, sem ataques de oportunidade", "Ao se aproximar de um inimigo: +10 no próximo ataque corpo a corpo", "Não atravessa paredes · Recarga: 15 min"],
        [{ id: "a", l: "Deslocar-se", apSelf: [B("Velocidade Mercurial (+10 no próximo ataque corpo a corpo)", { ataque: 10 }, { acts: 1 })], cd: 15 }]),
      entry("maos_lig", "Mãos Ligeiras", "Furtividade · Destreza", "Rouba, esconde ou desarma objetos pequenos sem ser percebido.",
        ["Em combate, tenta desarmar um inimigo: Agilidade contra Agilidade do alvo", "Contato físico · Recarga: 15 min"],
        [{ id: "a", l: "Desarmar / furtar", t: "agilidade", foe: 1, rs: { a: "agilidade", vs: "c", ca: "agilidade" }, ap: [E("Desarmado / furtado", { acts: 1, bad: 1 })], cd: 15 }]),
    ],
    ult: entry("transcendencia", "Transcendência de Mercúrio", "Ultimate", "Movimentos além dos limites humanos; parece desaparecer e reaparecer.",
      ["Até 3 ataques (alvos diferentes ou um só): 1d10 de dano cada", "+10 em Agilidade para esquivar · desloca até 30 m", "Dura 20 min · Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Atacar em velocidade", foe: 3, dmg: "1d10", apSelf: [B("Transcendência (+10 Agilidade para esquivar)", { agilidade: 10 }, { min: 20 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("talarias", "Talárias de Hermes", "Mobilidade", "Sandálias douradas com pequenas asas, muito leves.",
        ["+5 em testes de Agilidade de deslocamento, saltos e equilíbrio (enquanto calçadas)", "Uma vez por combate: salto de até 15 m na horizontal ou 8 m na vertical"],
        [{ id: "a", l: "Salto extraordinário", note: true, cd: "c" }]),
      entry("caduceu", "Caduceu do Mensageiro", "Comunicação · Negociação", "Versão pequena do bastão de Hermes com duas serpentes entrelaçadas.",
        ["Mensagens mentais para até 3 pessoas conhecidas a até 2 km", "Uma vez por dia: neutraliza paralisia ou imobilização mágica sobre o portador ou um aliado"],
        [{ id: "a", l: "Mensagem mental", note: true }, { id: "b", l: "Neutralizar paralisia", note: true, cd: "d" }]),
      entry("adagas_l", "Adagas do Ladrão", "Arma · Furtividade", "Par de adagas de bronze celestial que somem e reaparecem nas mãos do dono.",
        ["Cada adaga causa 1d6 de dano em ataques físicos", "Uma vez por combate: arremessa as duas em até 2 alvos (1d8 cada) e elas retornam"],
        [{ id: "a", l: "Golpe com adaga", t: "agilidade", melee: true, foe: 1, dmg: "1d6" },
         { id: "b", l: "Arremessar as duas", t: "agilidade", ranged: true, foe: 2, dmg: "1d8", cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ DIONÍSIO
  {
    id: "dionisio", n: "Dionísio", ico: "🍇", color: "#9b3fa3", tit: "Deus do Vinho", dom: "Vinho, festas, loucura e vegetação",
    powers: [
      entry("delirio", "Delírio Báquico", "Combate · Mente", "Distorce a percepção do adversário com imagens, vozes e sensações que não existem.",
        ["-5 em ataques e percepção nos próximos 2 ataques do alvo", "Intelecto do alvo contra o Carisma do semideus", "Não controla diretamente o alvo · Recarga: 15 min"],
        [{ id: "a", l: "Provocar delírio", t: "carisma", foe: 1, rs: { a: "intelecto", vs: "c", ca: "carisma" }, ap: [B("Alucinações (-5 ataque e percepção)", { ataque: -5, percepcao: -5 }, { acts: 2, bad: 1 })], cd: 15 }]),
      entry("vinhas", "Vinhas Carnívoras", "Combate · Controle", "Vinhas grossas e retorcidas com movimentos próprios.",
        ["Até 2 inimigos: 1d8 de dano e membros inferiores presos", "Falhou em Força: imobilizado por 5 min", "Exige superfície com contato com o solo · Recarga: 15 min"],
        [{ id: "a", l: "Invocar as vinhas", foe: 2, dmg: "1d8", dt: "natural", rs: { a: "forca", vs: "dc" }, ap: [E("Preso pelas vinhas (5 min)", { min: 5, bad: 1 })], cd: 15 }]),
    ],
    ult: entry("orgia", "Orgia de Baco", "Ultimate", "Névoa arroxeada, flautas, risadas e tambores; os sentidos ficam pouco confiáveis.",
      ["Inimigos em 10 m: Intelecto contra o Carisma; falhou: -10 em ataques e Agilidade nas 2 próximas ações e 3d8 de dano psíquico", "Até 3 aliados: +2d8 de vida e -5 no dano físico dos 2 próximos ataques", "Duração: 2 ações · Custo: 15 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Liberar a orgia", t: "carisma", foe: 8, dmg: "3d8", dt: "psíquico", dmgFail: true, rs: { a: "intelecto", vs: "c", ca: "carisma" },
        ap: [B("Alucinações intensas (-10 ataque e Agilidade)", { ataque: -10, agilidade: -10 }, { acts: 2, bad: 1 })],
        ally: 3, heal: "2d8", apAlly: [E("Vinhas protetoras (-5 de dano físico)", { dr: 5, hits: 2 })], cost: 15, cd: 300 }]),
    gifts: [
      entry("tirso", "Tirso de Baco", "Arma · Natureza", "Bastão cerimonial de madeira antiga com hera e uma pinha.",
        ["Causa 1d8 de dano em ataques físicos", "Uma vez por combate: raízes e vinhas em 4 m; -5 em Agilidade por 2 ações"],
        [{ id: "a", l: "Golpe de tirso", t: "forca", melee: true, foe: 1, dmg: "1d8" },
         { id: "b", l: "Vinhas no chão", foe: 8, ap: [B("Preso nas vinhas (-5 Agilidade)", { agilidade: -5 }, { acts: 2, bad: 1 })], cd: "c" }]),
      entry("mascara_t", "Máscara de Tália", "Ilusão · Disfarce", "Máscara teatral dourada (comédia e tragédia) que muda com as emoções de quem a usa.",
        ["Altera voz, expressão e aparência superficial (30 min)", "Uma vez por combate: cópia ilusória que se move até 10 m (10 min); some ao receber qualquer ataque"],
        [{ id: "a", l: "Disfarçar-se", apSelf: [E("Disfarçado (30 min)", { min: 30 })] }, { id: "b", l: "Projetar cópia", apSelf: [E("Cópia ilusória ativa (10 min)", { min: 10 })], cd: "c" }]),
      entry("calice", "Cálice do Êxtase", "Suporte · Ilusão", "Cálice de ouro com videiras e pedras arroxeadas, sempre cheio.",
        ["Quem bebe recupera 1d8 de vida e resiste a medo por 20 min", "Uma vez por dia: névoa ilusória de 5 m, -10 em percepção nas 2 próximas ações", "Recarga: 1 h"],
        [{ id: "a", l: "Beber do cálice", ally: 1, self: true, heal: "1d8", apAlly: [E("Resistência a medo (20 min)", { min: 20 })], cd: 60 },
         { id: "b", l: "Derramar a névoa", foe: 8, ap: [B("Névoa ilusória (-10 percepção)", { percepcao: -10 }, { acts: 2, bad: 1 })], cd: "d" }]),
    ],
  },
  // ------------------------------------------------------------ ATENA
  {
    id: "atena", n: "Atena", ico: "🦉", color: "#7f9fb8", tit: "Deusa da Sabedoria", dom: "Sabedoria, estratégia e guerra justa",
    powers: [
      entry("analise", "Análise Absoluta", "Estratégia · Combate", "Analisa instantaneamente o ambiente, os adversários e as possibilidades.",
        ["Escolhe até 3 inimigos: por 2 ações, +3 em Intelecto de batalha e +5 em ataques contra eles", "Identifica uma vulnerabilidade: o próximo ataque causa +1d8", "Decifra mecanismos e armadilhas fora de combate · Recarga: 15 min"],
        [{ id: "a", l: "Analisar", foe: 3, apSelf: [B("Análise Absoluta (+3 Intelecto; +5 ataques nos alvos analisados)", { intelecto: 3, ataque: 5 }, { acts: 2 })], cd: 15 }]),
      entry("arsenal", "Arsenal da Deusa", "Combate · Técnica", "Compreensão extraordinária de armas e técnicas de combate.",
        ["Por 3 ações: +5 em Força ou Agilidade nos ataques e manobras com armas", "Uma manobra por rodada: Desarme · Contra-ataque (1d8) · Golpe Preciso (+1d8)", "Recarga: 20 min"],
        [{ id: "a", l: "Ativar o arsenal", apSelf: [B("Arsenal da Deusa (+5 Força e Agilidade em ataques)", { forca: 5, agilidade: 5 }, { acts: 3 })], cd: 20 }]),
    ],
    ult: entry("campo_perfeito", "Campo de Batalha Perfeito", "Ultimate", "Um elmo e uma coruja espectrais surgem sobre a cabeça e linhas luminosas mostram o campo de batalha.",
      ["O semideus e até 4 aliados: +5 em ataque, esquiva e resistência a manobras por 20 min", "Previsão de movimentos: esquiva com +10 · Ponto de ruptura: +2d10 no próximo ataque contra um alvo · Coordenação: 1 movimento extra", "Custo: 20 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Impor o campo de batalha", t: "intelecto", ally: 5, self: true, apAlly: [B("Campo de Batalha Perfeito (+5 ataque, esquiva e resistência)", { ataque: 5, agilidade: 5 }, { min: 20 })], cost: 20, cd: 300 }]),
    gifts: [
      entry("egide_a", "Égide de Atena", "Defesa · Contra-ataque", "Escudo lendário de bronze celestial com a cabeça de Medusa.",
        ["Absorve até 20 de dano por combate", "Uma vez por combate: onda aterrorizante em 5 m; falhou em Vigor: petrificado por 1 ação", "Ao bloquear corpo a corpo: contra-ataque de 1d10"],
        [{ id: "a", l: "Erguer a Égide", apSelf: [E("Égide de Atena (absorve 20)", { absorb: 20 })], cd: "c" },
         { id: "b", l: "Reflexo da Górgona", foe: 8, rs: { a: "vigor", vs: "dc" }, ap: [E("Petrificado (1 ação)", { acts: 1, bad: 1 })], cd: "c" },
         { id: "c", l: "Contra-ataque da Égide", foe: 1, dmg: "1d10", dt: "energia" }]),
      entry("lanca_p", "Lança de Palas", "Arma · Marcial", "Lança de bronze celestial cujo peso se adapta ao portador.",
        ["1d10 por ataque · arremesso que retorna às mãos", "Perfuração Estratégica (uma vez por combate): +2d8 no próximo ataque", "Pode ser lança curta ou longa"],
        [{ id: "a", l: "Golpe de lança", t: "forca", melee: true, foe: 1, dmg: "1d10" },
         { id: "b", l: "Arremesso perfeito", t: "agilidade", ranged: true, foe: 1, dmg: "1d10" },
         { id: "c", l: "Perfuração Estratégica", t: "forca", melee: true, foe: 1, dmg: "1d10+2d8", cd: "c" }]),
      entry("elmo_coruja", "Elmo da Coruja", "Investigação · Percepção", "Elmo de bronze celestial que dá aos olhos um brilho prateado.",
        ["+5 em Intelecto e Agilidade de percepção e investigação (enquanto equipado)", "Identifica armadilhas, passagens secretas e pontos vulneráveis", "Uma vez por combate: +10 no próximo teste de esquiva · vê criaturas escondidas em 15 m"],
        [{ id: "a", l: "Instinto defensivo", apSelf: [B("Instinto defensivo (+10 na próxima esquiva)", { agilidade: 10 }, { acts: 1 })], cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ HIPNOS
  {
    id: "hipnos", n: "Hipnos", ico: "💤", color: "#6d79b8", tit: "Deus do Sono", dom: "Sono, sonhos e pesadelos",
    powers: [
      entry("sonolencia", "Sonolência Divina", "Combate · Controle", "Energia sonífera que enfraquece a consciência dos adversários.",
        ["Vigor do alvo contra o Intelecto do semideus", "Falhou: -5 em ataque, Agilidade e percepção por 2 ações (debilitado pode dormir 5 min)", "Resistiu: -1 em Agilidade até o fim do combate · Recarga: 15 min"],
        [{ id: "a", l: "Provocar sonolência", t: "intelecto", foe: 1, rs: { a: "vigor", vs: "c", ca: "intelecto" },
          ap: [B("Sonolência (-5 ataque, Agilidade e percepção)", { ataque: -5, agilidade: -5, percepcao: -5 }, { acts: 2, bad: 1 })],
          apOk: [B("Resistiu ao sono (-1 Agilidade)", { agilidade: -1 }, { min: 60, bad: 1 })], cd: 15 }]),
      entry("ilusao_s", "Ilusão dos Sonhos", "Ilusão · Controle", "Invade a percepção dos adversários e cria ilusões do mundo dos sonhos.",
        ["Até 3 adversários em 10 m: Intelecto do alvo contra o Carisma do semideus", "Falhou: vê a ilusão como real por 2 ações, -5 em ataques e percepção", "Resistiu: -1 em percepção no combate · Recarga: 15 min"],
        [{ id: "a", l: "Criar a ilusão", t: "carisma", foe: 3, rs: { a: "intelecto", vs: "c", ca: "carisma" },
          ap: [B("Ilusão (-5 ataque e percepção)", { ataque: -5, percepcao: -5 }, { acts: 2, bad: 1 })],
          apOk: [B("Desconfiado (-1 percepção)", { percepcao: -1 }, { min: 60, bad: 1 })], cd: 15 }]),
    ],
    ult: entry("pesadelo", "Pesadelo Absoluto", "Ultimate", "Névoa escura e prateada que transforma o campo de batalha em um mundo onírico.",
      ["Inimigos: Intelecto contra o Intelecto do semideus; falhou: 3d10 de dano psíquico e -5 em ataques e Agilidade por 3 ações", "Falha por 5 ou mais: dorme 15 min (dano acorda)", "Até 3 aliados: -5 em dano psíquico e +10 contra medo/ilusões · Custo: 20 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Lançar o pesadelo", t: "intelecto", foe: 8, dmg: "3d10", dt: "psíquico", dmgFail: true, rs: { a: "intelecto", vs: "c", ca: "intelecto" },
        ap: [B("Pesadelo (-5 ataque e Agilidade)", { ataque: -5, agilidade: -5 }, { acts: 3, bad: 1 })],
        ally: 3, apAlly: [E("Proteção Onírica (-5 psíquico; +10 contra medo/ilusões)", { dr: 5, hits: 2 })], cost: 20, cd: 300 }]),
    gifts: [
      entry("cajado_h", "Cajado de Hipnos", "Arma · Sono", "Cajado de madeira escura com papoulas e detalhes prateados.",
        ["1d8 de dano mágico por golpe", "Névoa Sonífera (uma vez por combate): 5 m, falhou em Vigor: -2 em ataques e Agilidade por 2 ações", "Sono Induzido (uma vez por dia): alvo falha em Vigor e dorme até 5 min"],
        [{ id: "a", l: "Golpe do cajado", t: "forca", melee: true, foe: 1, dmg: "1d8" },
         { id: "b", l: "Névoa Sonífera", foe: 8, rs: { a: "vigor", vs: "dc" }, ap: [B("Névoa sonífera (-2 ataque e Agilidade)", { ataque: -2, agilidade: -2 }, { acts: 2, bad: 1 })], cd: "c" },
         { id: "c", l: "Sono Induzido", foe: 1, rs: { a: "vigor", vs: "dc" }, ap: [E("Adormecido (até 5 min)", { min: 5, bad: 1 })], cd: "d" }]),
      entry("mascara_m", "Máscara de Morfeu", "Ilusão · Sonhos", "Máscara prateada com símbolos lunares, feita de fragmentos dos sonhos de Morfeu.",
        ["Disfarce Onírico: aparência, roupas, rosto e voz por até 30 min", "Pesadelo Particular (uma vez por combate): falhou em Intelecto: -3 no próximo ataque e não localiza o portador por 10 min", "Sonho Compartilhado (uma vez por dia): até 2 aliados no mesmo sonho"],
        [{ id: "a", l: "Disfarce onírico", apSelf: [E("Disfarce onírico (30 min)", { min: 30 })] },
         { id: "b", l: "Pesadelo particular", foe: 1, rs: { a: "intelecto", vs: "dc" }, ap: [B("Pesadelo particular (-3 no próximo ataque)", { ataque: -3 }, { min: 10, bad: 1 })], cd: "c" },
         { id: "c", l: "Sonho compartilhado", note: true, cd: "d" }]),
      entry("ampulheta", "Ampulheta do Último Sonho", "Suporte · Memória", "Ampulheta de prata com areia brilhante que nunca termina de cair.",
        ["Sono Restaurador (uma vez por dia): até 3 aliados recuperam 2d8 de vida", "Memória Onírica (uma vez por dia): acessa lembrança recente de uma criatura adormecida", "Areia do Esquecimento (uma vez por combate): 8 m, falhou em Intelecto: desorientado, perde a próxima reação"],
        [{ id: "a", l: "Sono Restaurador", ally: 3, heal: "2d8", cd: "d" },
         { id: "b", l: "Memória Onírica", note: true, cd: "d" },
         { id: "c", l: "Areia do Esquecimento", foe: 1, rs: { a: "intelecto", vs: "dc" }, ap: [E("Desorientado (perde a próxima reação)", { acts: 1, bad: 1 })], cd: "c" }]),
    ],
  },
  // ------------------------------------------------------------ MORFEU
  {
    id: "morfeu", n: "Morfeu", ico: "🌀", color: "#a58bd0", tit: "Deus dos Sonhos", dom: "Sonhos, formas e imaginação",
    powers: [
      entry("metamorfose_o", "Metamorfose Onírica", "Transformação", "Assume a aparência de qualquer pessoa ou criatura já observada, com voz, movimentos e cheiro.",
        ["Assume a aparência de pessoa, animal ou criatura de tamanho semelhante (não copia poderes)", "Transformação parcial: ataque adicional de 2d8 · escamas: -5 no próximo golpe", "Dura 20 min · Recarga: 30 min"],
        [{ id: "a", l: "Transformar-se", apSelf: [E("Metamorfose Onírica (forma alterada)", { min: 20 })], cd: 30 },
         { id: "b", l: "Garra bestial (ataque adicional)", t: "forca", foe: 1, dmg: "2d8" },
         { id: "c", l: "Escamas protetoras", apSelf: [E("Escamas (-5 no próximo golpe)", { dr: 5, hits: 1 })] }]),
      entry("arquitetura", "Arquitetura Onírica", "Criação · Controle", "Molda elementos da imaginação em manifestações oníricas com consistência mágica.",
        ["Até 2 manifestações: arma (1d8 mágico), estrutura (absorve 10), criatura ilusória (1d8 por ação) ou obstáculo (Força contra Intelecto)", "Dura 10 min · Recarga: 20 min"],
        [{ id: "a", l: "Criar arma / criatura", t: "intelecto", foe: 1, dmg: "1d8", dt: "mágico", cd: 20 },
         { id: "b", l: "Criar estrutura", apSelf: [E("Estrutura onírica (absorve 10)", { absorb: 10, min: 10 })], cd: 20 },
         { id: "c", l: "Criar obstáculo", t: "intelecto", foe: 1, rs: { a: "forca", vs: "c", ca: "intelecto" }, ap: [E("Preso pelo obstáculo onírico (10 min)", { min: 10, bad: 1 })], cd: 20 }]),
    ],
    ult: entry("criador", "O Criador dos Sonhos", "Ultimate", "O ambiente vira uma representação da imaginação do semideus.",
      ["Até 3 manifestações poderosas: criaturas (2d8 mágico por ação), armas (2d10), estruturas (absorvem 20)", "Metamorfose Suprema: +5 em Força e Agilidade e -5 no dano recebido", "Dura 20 min · Custo: 20 de vida · Recarga: 5 h"],
      [{ id: "a", l: "Erguer o domínio onírico", t: "intelecto", foe: 3, dmg: "2d8", dt: "mágico", apSelf: [B("Metamorfose Suprema (+5 Força e Agilidade; -5 dano)", { forca: 5, agilidade: 5 }, { dr: 5, min: 20 })], cost: 20, cd: 300 }]),
    gifts: [
      entry("mascara_mf", "Máscara das Mil Faces", "Disfarce", "Máscara prateada cuja superfície mostra rostos diferentes a quem a observa.",
        ["Assume o rosto, a voz e a altura de qualquer pessoa conhecida", "Em um meio-sangue: rouba seus atributos e dois poderes simples, com danos e curas -3", "Uma vez por dia: mantém a aparência por até 1 hora"],
        [{ id: "a", l: "Metamorfose perfeita", apSelf: [E("Identidade copiada (1 h)", { min: 60 })], cd: "d" }]),
      entry("tear", "Tear de Morfeu", "Criação · Controle", "Tear dourado com fios de cores diferentes, cada um uma possibilidade da imaginação.",
        ["Uma vez por combate: cria uma arma (2d8 mágico), um escudo (absorve 15) ou uma prisão (2 alvos, Força contra Intelecto)", "As criações somem após 30 min em combate ou 10 fora dele"],
        [{ id: "a", l: "Arma dos Sonhos", t: "intelecto", foe: 1, dmg: "2d8", dt: "mágico", cd: "c" },
         { id: "b", l: "Escudo Imaginário", apSelf: [E("Escudo imaginário (absorve 15)", { absorb: 15, min: 30 })], cd: "c" },
         { id: "c", l: "Prisão Onírica", t: "intelecto", foe: 2, rs: { a: "forca", vs: "c", ca: "intelecto" }, ap: [E("Imobilizado (1 ação)", { acts: 1, bad: 1 })], cd: "c" }]),
      entry("espelho_o", "Espelho do Reino Onírico", "Ilusão · Sonhos", "Espelho oval de prata cujo reflexo nunca corresponde à realidade.",
        ["Portal dos Sonhos (uma vez por dia): até 2 aliados em um ambiente onírico por até 10 min", "Projeção Imaginária (uma vez por combate): ilusão de até 3 criaturas em 10 m", "Aprisionamento Reflexivo (uma vez por dia): falhou em Intelecto: incapaz de agir por 1 ação"],
        [{ id: "a", l: "Portal dos Sonhos", note: true, cd: "d" },
         { id: "b", l: "Projeção Imaginária", foe: 3, rs: { a: "intelecto", vs: "dc" }, note: true, cd: "c" },
         { id: "c", l: "Aprisionamento Reflexivo", foe: 1, rs: { a: "intelecto", vs: "dc" }, ap: [E("Aprisionado no espelho (1 ação)", { acts: 1, bad: 1 })], cd: "d" }]),
    ],
  },
];

// ---------- consultas ----------
export const GOD_BY_ID = Object.fromEntries(GODS.map((g) => [g.id, g]));

// todas as entradas de um deus (poderes, ultimate e presentes) com o tipo
export function godEntries(godId){
  const g = GOD_BY_ID[godId];
  if (!g) return [];
  return [
    ...g.powers.map((e) => ({ kind: "comum", entry: e })),
    { kind: "ultimate", entry: g.ult },
    ...g.gifts.map((e) => ({ kind: "presente", entry: e })),
  ];
}

export function giftOf(godId, giftId){
  const g = GOD_BY_ID[godId];
  return g ? g.gifts.find((x) => x.id === giftId) || null : null;
}

// chave única de presente em toda a campanha (um presente só pode ser escolhido por 1 ficha)
export const giftKey = (godId, giftId) => `${godId}:${giftId}`;
