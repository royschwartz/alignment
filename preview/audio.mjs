import {stretchVoice} from './audio-stretch.mjs';
const attributeNames=['money','rapture','hunger','disquiet','choice'];
const cueKinds=['gain','loss','reveal'];
const soundNames=[...cueKinds,...attributeNames.flatMap(stat=>cueKinds.map(kind=>`${stat}-${kind}`))];
export const attributeSound=(stat,kind)=>attributeNames.includes(stat)?`${stat}-${kind}`:kind;
export class StackAudio {
  constructor({bank='retro'}={}) { this.bank=['original','silent'].includes(bank)?bank:'retro'; }
  _enabled = true;
  get enabled() { return this.bank!=='silent'&&this._enabled; }
  set enabled(value) { this._enabled=!!value; }
  context = null;
  buffers = {};
  sources = new Set();
  generation = 0;
  loading = null;
  resuming = null;
  originalCues = new Set();
  prepare() {
    if(this.bank==='silent')return Promise.resolve();
    if(this.loading)return this.loading;
    try {this.context ||= new (window.AudioContext || window.webkitAudioContext)();}
    catch {return Promise.resolve();}
    const names=this.bank==='retro'?[...soundNames,'feeding']:soundNames;
    this.loading=Promise.all(names.map(async kind=>{
      const paths=this.bank==='retro'?[`retro/${kind}.wav`,`${kind}.wav`]:[`${kind}.wav`];
      for(const path of paths)try {
        if(kind==='feeding'&&!path.startsWith('retro/'))break;
        const response=await fetch(new URL(`./sounds/${path}`,import.meta.url));
        if(!response.ok)continue;
        this.buffers[kind]=await this.context.decodeAudioData(await response.arrayBuffer());
        if(!path.startsWith('retro/'))this.originalCues.add(kind);
        break;
      } catch { /* Audio cannot block a choice or its save. */ }
    }));
    return this.loading;
  }
  unlock() {
    if (!this.enabled) return;
    try { this.prepare(); this.resuming=this.context?.resume().catch(() => {}); }
    catch { /* The story remains playable when audio is unavailable. */ }
  }
  stop() { this.cancelCues();this.context?.suspend().catch(() => {}); }
  cancelCues() {
    this.generation++;
    for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}
    this.sources.clear();
  }
  async attribute(kind,{stat,duration=.45,volume=.24,delay=0}={}) {
    if(!this.enabled)return;
    const generation=this.generation;
    await this.prepare();await this.resuming;
    if(!this.enabled||generation!==this.generation||!this.context||this.context.state!=='running')return;
    const requested=attributeSound(stat,kind),cue=this.buffers[requested]?requested:kind;
    const buffer=this.buffers[cue];if(!buffer)return;
    const c=this.context,t=c.currentTime+Math.max(0,delay),source=c.createBufferSource(),gain=c.createGain();
    duration=Math.max(.2,Math.min(1.1,duration));volume=Math.max(.0001,Math.min(.4,volume));
    // The CD-ROM bank keeps its register at every change size. Preserve the
    // old bank's coin treatment when auditioning it or using a fallback.
    const original=this.bank==='original'||this.originalCues.has(cue);
    if(!original||(cue!==kind&&cue!=='money-gain')) {
      const samples=stretchVoice(buffer.getChannelData(0),duration*buffer.sampleRate,buffer.sampleRate);
      const fitted=c.createBuffer(1,samples.length,buffer.sampleRate);fitted.copyToChannel(samples,0);source.buffer=fitted;source.playbackRate.value=1;
    } else {source.buffer=buffer;source.playbackRate.value=buffer.duration/duration;}
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.012);
    gain.gain.setValueAtTime(volume,t+Math.max(.013,duration-.075));gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(gain).connect(c.destination);this.sources.add(source);
    source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};
    source.start(t);source.stop(t+duration+.015);
  }
  beep(frequency = 660, duration = 0.045) {
    if (!this.enabled || !this.context) return;
    const c = this.context, t = c.currentTime, oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.024, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain).connect(c.destination); oscillator.start(t); oscillator.stop(t + duration + 0.01);
  }
  async feed() {
    if(!this.enabled)return;
    const generation=this.generation;
    await this.prepare();await this.resuming;
    if(!this.enabled||generation!==this.generation||this.context?.state!=='running')return;
    if(this.buffers.feeding) {
      const c=this.context,t=c.currentTime,source=c.createBufferSource(),gain=c.createGain();
      source.buffer=this.buffers.feeding;
      const duration=source.buffer.duration;
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.24,t+.025);
      gain.gain.setValueAtTime(.24,t+Math.max(.026,duration-.12));gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      source.connect(gain).connect(c.destination);this.sources.add(source);
      source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};
      source.start(t);source.stop(t+duration+.015);return;
    }
    this.originalFeed();
  }
  originalFeed() {
    if (!this.enabled || !this.context) return;
    const c = this.context, duration = 1.65, buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate), values = buffer.getChannelData(0);
    let seed = 1933;
    for (let i = 0; i < values.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      values[i] = ((seed / 4294967296) * 2 - 1) * (0.45 + 0.55 * Math.sin(i / c.sampleRate * 71) ** 2);
    }
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(), motor = c.createOscillator(), motorGain = c.createGain(), t = c.currentTime;
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(1100, t); filter.frequency.exponentialRampToValueAtTime(380, t + duration);
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.085, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    motor.type = 'sawtooth'; motor.frequency.setValueAtTime(74, t); motor.frequency.linearRampToValueAtTime(52, t + duration * 0.75); motor.frequency.exponentialRampToValueAtTime(28, t + duration);
    motorGain.gain.setValueAtTime(0.0001, t); motorGain.gain.exponentialRampToValueAtTime(0.023, t + 0.09); motorGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    motor.connect(motorGain).connect(c.destination); motor.start(t); motor.stop(t + duration);
    source.connect(filter).connect(gain).connect(c.destination); source.start(); source.stop(t + duration);
    for(const node of [motor,source]){this.sources.add(node);node.onended=()=>{this.sources.delete(node);node.disconnect();};}
  }
}
