export class StackAudio {
  enabled = true;
  context = null;
  unlock() {
    if (!this.enabled) return;
    try { this.context ||= new (window.AudioContext || window.webkitAudioContext)(); this.context.resume().catch(() => {}); }
    catch { /* The story remains playable when audio is unavailable. */ }
  }
  stop() { this.context?.suspend().catch(() => {}); }
  beep(frequency = 660, duration = 0.045) {
    if (!this.enabled || !this.context) return;
    const c = this.context, t = c.currentTime, oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.024, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain).connect(c.destination); oscillator.start(t); oscillator.stop(t + duration + 0.01);
  }
  feed() {
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
  }
}
