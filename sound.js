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
