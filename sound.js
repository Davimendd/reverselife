// ============================================================
// REVERSE LIFE — efeitos sonoros
// Todos os sons são sintetizados na hora via Web Audio API,
// sem depender de nenhum arquivo de áudio externo.
// ============================================================

let audioCtx = null;
let muted = localStorage.getItem("rl_muted") === "1";

function ctx(){
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function isMuted(){
  return muted;
}

export function setMuted(value){
  muted = value;
  localStorage.setItem("rl_muted", value ? "1" : "0");
}

// pequeno "clique" seco, tipo dado batendo na mesa — chamado
// repetidas vezes durante a animação de rolagem.
export function playDiceTick(){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;

  const duration = 0.045;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700 + Math.random() * 900;
  filter.Q.value = 1.1;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter).connect(gain).connect(c.destination);
  noise.start(now);
  noise.stop(now + duration);
}

// alarme de terminal: dois bipes graves seguidos de um agudo curto,
// disparado quando o resultado é o pior possível (🔴).
export function playDeathAlert(){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;

  const beeps = [
    { freq: 200, start: 0.00, len: 0.16 },
    { freq: 200, start: 0.22, len: 0.16 },
    { freq: 760, start: 0.44, len: 0.22 }
  ];

  beeps.forEach(({ freq, start, len }) => {
    const t = now + start;
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);

    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + len + 0.02);
  });
}

// ============================================================
// SONS DO SISTEMA PERCY JACKSON — um timbre por deus, tudo sintetizado
// ============================================================

// rajada de ruído filtrado (trovão, água, vento, faíscas...)
function noise(c, t, dur, { type = "bandpass", f = 1000, to = null, q = 1, g = 0.25, shape = "decay" } = {}){
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const env = shape === "swell" ? Math.sin(Math.PI * i / n) : 1 - i / n;
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  fl.Q.value = q;
  const gn = c.createGain();
  gn.gain.setValueAtTime(g, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(fl).connect(gn).connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

// nota simples com envelope (sinos, graves, drones)
function tone(c, t, { type = "sine", f = 440, to = null, dur = 0.4, g = 0.15, delay = 0, vib = 0 } = {}){
  const s = t + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, s);
  if (to) o.frequency.exponentialRampToValueAtTime(to, s + dur);
  const gn = c.createGain();
  gn.gain.setValueAtTime(0.0001, s);
  gn.gain.exponentialRampToValueAtTime(g, s + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  if (vib) {
    const lfo = c.createOscillator();
    lfo.frequency.value = 6;
    const lg = c.createGain();
    lg.gain.value = vib;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(s);
    lfo.stop(s + dur + 0.05);
  }
  o.connect(gn).connect(c.destination);
  o.start(s);
  o.stop(s + dur + 0.05);
}

// famílias de som: (contexto, início, big 0|1 para ultimates, altura)
const SFX = {
  thunder(c, t, big){
    noise(c, t, 0.7 + big * 0.5, { type: "lowpass", f: 2400, to: 120, g: 0.5 });
    for (let i = 0; i < 5; i++) noise(c, t + i * 0.05, 0.04, { type: "highpass", f: 3000 + Math.random() * 3000, g: 0.3 });
    tone(c, t, { type: "sawtooth", f: 70, to: 35, dur: 0.8 + big * 0.5, g: 0.2 });
  },
  water(c, t, big){
    noise(c, t, 0.8 + big * 0.5, { f: 300, to: 1800, q: 0.8, g: 0.3, shape: "swell" });
    [0, 0.12, 0.26].forEach((d, i) => tone(c, t, { f: 500 + i * 220, to: 900 + i * 260, dur: 0.14, g: 0.07, delay: d }));
    tone(c, t, { f: 90, to: 60, dur: 0.9, g: 0.2 });
  },
  shadow(c, t, big){
    tone(c, t, { type: "sawtooth", f: 140, to: 45, dur: 1 + big * 0.6, g: 0.12 });
    tone(c, t, { f: 60, to: 30, dur: 1.1 + big * 0.6, g: 0.28 });
    noise(c, t, 0.9, { type: "lowpass", f: 500, to: 80, g: 0.2, shape: "swell" });
  },
  arcane(c, t, big, p = 1){
    [1, 1.25, 1.5, 2].forEach((r, i) => tone(c, t, { type: "triangle", f: 300 * p * r, to: 330 * p * r, dur: 0.7 + big * 0.4, g: 0.07, delay: i * 0.07, vib: 4 }));
    noise(c, t, 0.5, { type: "highpass", f: 4000, g: 0.08, shape: "swell" });
  },
  nature(c, t){
    noise(c, t, 0.7, { f: 2500, to: 900, q: 0.7, g: 0.18, shape: "swell" });
    [0, 0.1, 0.2].forEach((d, i) => tone(c, t, { type: "triangle", f: 330 * (1 + i * 0.25), dur: 0.2, g: 0.1, delay: d }));
    tone(c, t, { f: 110, dur: 0.7, g: 0.15 });
  },
  war(c, t, big){
    noise(c, t, 0.12, { type: "highpass", f: 1500, g: 0.5 });
    tone(c, t, { type: "square", f: 180, to: 90, dur: 0.25, g: 0.16 });
    tone(c, t, { f: 55, to: 35, dur: 0.5 + big * 0.4, g: 0.35 });
    noise(c, t + 0.02, 0.5, { f: 900, q: 4, g: 0.1 });
  },
  forge(c, t, big){
    tone(c, t, { type: "square", f: 420, to: 400, dur: 0.5 + big * 0.3, g: 0.09 });
    tone(c, t, { type: "square", f: 630, dur: 0.45, g: 0.05 });
    noise(c, t, 0.08, { type: "highpass", f: 2500, g: 0.45 });
    noise(c, t + 0.05, 0.7, { type: "highpass", f: 5000, g: 0.1, shape: "swell" });
    tone(c, t, { f: 70, to: 45, dur: 0.5, g: 0.3 });
  },
  chime(c, t, big, p = 1){
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, t, { f: f * p, dur: 0.55 + big * 0.3, g: 0.09, delay: i * 0.08 }));
  },
  wind(c, t, big){
    noise(c, t, 0.55 + big * 0.3, { f: 500, to: 4500, q: 1.2, g: 0.3, shape: "swell" });
    tone(c, t, { f: 700, to: 1400, dur: 0.3, g: 0.05 });
  },
  dream(c, t, big, p = 1){
    [196, 247, 294].forEach((f, i) => tone(c, t, { f: f * p, to: f * p * 0.97, dur: 1 + big * 0.5, g: 0.08, delay: i * 0.1, vib: 3 }));
    noise(c, t, 1, { type: "lowpass", f: 900, to: 200, g: 0.1, shape: "swell" });
  },
};

const GOD_SFX = {
  zeus: ["thunder"], poseidon: ["water"], hades: ["shadow"], hecate: ["arcane", 1], demeter: ["nature"], ares: ["war"],
  apolo: ["chime", 1], iris: ["chime", 1.5], circe: ["arcane", 1.35], hefesto: ["forge"], afrodite: ["chime", 0.8],
  hermes: ["wind"], dionisio: ["nature"], atena: ["chime", 0.66], hipnos: ["dream", 0.8], morfeu: ["dream", 1.25],
};

// som do poder de um deus; big = ultimate (mais grave e longo, com um estrondo no fim)
export function playGodSfx(godId, big = false){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;
  const [fam, pitch] = GOD_SFX[godId] || ["chime", 1];
  SFX[fam](c, now, big ? 1 : 0, pitch || 1);
  if (big) {
    tone(c, now + 0.05, { f: 50, to: 26, dur: 1.2, g: 0.35 });
    noise(c, now, 1, { type: "lowpass", f: 700, to: 60, g: 0.18, shape: "swell" });
  }
}

// 20 natural: arpejo cintilante subindo + batida grave
export function playCritSfx(){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;
  [660, 880, 1175, 1568, 2093].forEach((f, i) => tone(c, now, { f, dur: 0.35, g: 0.1, delay: i * 0.06 }));
  tone(c, now, { f: 120, to: 55, dur: 0.4, g: 0.3 });
  noise(c, now + 0.28, 0.5, { type: "highpass", f: 6000, g: 0.08, shape: "swell" });
}

// ============================================================
// Jogos Vorazes: canhão, paraquedas e ambiente dos eventos (tudo sintetizado, volume baixo)
// ============================================================

// canhão que anuncia a morte de um tributo: estrondo grave, eco e um sino distante
export function playCannon(){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;
  [0, 0.95].forEach((d, i) => {
    const g = i ? 0.5 : 1;
    tone(c, now + d, { f: 150, to: 28, dur: 1.1, g: 0.5 * g });
    tone(c, now + d, { type: "triangle", f: 62, to: 30, dur: 1.4, g: 0.35 * g });
    noise(c, now + d, 0.9, { type: "lowpass", f: 1800, to: 80, g: 0.45 * g });
  });
  tone(c, now + 1.9, { f: 392, dur: 1.6, g: 0.05, vib: 2 });
}

// paraquedas de patrocinador: assobio suave descendo e dois sininhos prateados
export function playParachute(){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;
  noise(c, now, 2.2, { type: "bandpass", f: 2600, to: 500, g: 0.06, shape: "swell", q: 0.8 });
  [1318, 1760, 2093].forEach((f, i) => tone(c, now + 1.3, { f, dur: 1.1, g: 0.07, delay: i * 0.13 }));
}

// ambiente curto de cada evento da arena (3 a 4 s, bem baixinho)
export function playEventAmbient(id){
  if (muted) return;
  const c = ctx();
  const now = c.currentTime;
  switch (id) {
    case "chuva": noise(c, now, 3.5, { type: "highpass", f: 3500, g: 0.05, shape: "swell" }); tone(c, now, { f: 90, dur: 2.5, g: 0.05 }); break;
    case "nevasca": noise(c, now, 3.5, { type: "bandpass", f: 700, to: 1400, g: 0.07, shape: "swell", q: 0.7 }); break;
    case "cinzas": noise(c, now, 3.5, { type: "lowpass", f: 900, to: 300, g: 0.08, shape: "swell" }); break;
    case "terremoto":
      tone(c, now, { type: "sawtooth", f: 46, to: 32, dur: 2.6, g: 0.12, vib: 6 });
      noise(c, now, 2.6, { type: "lowpass", f: 300, to: 60, g: 0.25, shape: "swell" }); break;
    case "tsunami": noise(c, now, 3.8, { type: "lowpass", f: 400, to: 1800, g: 0.14, shape: "swell" }); tone(c, now + 1.6, { f: 60, to: 34, dur: 1.8, g: 0.15 }); break;
    case "canarios": for (let i = 0; i < 7; i++) tone(c, now, { f: 2300 + Math.random() * 900, to: 3300, dur: 0.12, g: 0.04, delay: i * 0.22 }); break;
    case "predadores": tone(c, now, { type: "sawtooth", f: 78, to: 52, dur: 2.2, g: 0.09, vib: 14 }); break;
    case "flora": noise(c, now, 3, { type: "bandpass", f: 1200, g: 0.04, shape: "swell", q: 3 }); tone(c, now, { f: 330, to: 294, dur: 2.4, g: 0.04, vib: 3 }); break;
    case "ceia": [880, 1175, 1568].forEach((f, i) => tone(c, now, { f, dur: 1.2, g: 0.06, delay: i * 0.18 })); break;
    case "bomba": for (let i = 0; i < 4; i++) tone(c, now, { type: "triangle", f: i % 2 ? 560 : 820, dur: 0.38, g: 0.1, delay: i * 0.4 }); break;
    case "vulcao":
      tone(c, now, { type: "sawtooth", f: 40, to: 28, dur: 3.4, g: 0.13, vib: 5 });
      noise(c, now, 3.6, { type: "lowpass", f: 500, to: 90, g: 0.3, shape: "swell" });
      for (let i = 0; i < 6; i++) noise(c, now + 0.4 + i * 0.45, 0.12, { type: "highpass", f: 2500, g: 0.12 });   // estalos de lava
      break;
    case "passaros":
      for (let i = 0; i < 12; i++) tone(c, now, { type: "sawtooth", f: 900 + Math.random() * 900, to: 500 + Math.random() * 500, dur: 0.14, g: 0.035, delay: Math.random() * 2.6, vib: 25 });
      noise(c, now, 3, { type: "bandpass", f: 3000, g: 0.03, shape: "swell", q: 1.2 });
      break;
    case "bomba_impacto":
      tone(c, now, { f: 90, to: 22, dur: 1.6, g: 0.6 });
      noise(c, now, 1.8, { type: "lowpass", f: 2600, to: 60, g: 0.6 });
      noise(c, now + 0.1, 0.5, { type: "highpass", f: 4000, g: 0.25 }); break;
    default: break;
  }
}
