// Tiny synthesized sound effects via the Web Audio API — deliberately no
// bundled audio files (nothing to license, nothing to load). Each sound is
// a short envelope of one or two oscillator tones. Lazily creates one
// shared AudioContext on first use (browsers require a user gesture before
// audio can play, which every call site here already has — a click).

let audioContext: AudioContext | null = null
let muted = false

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioContext = new Ctor()
  }
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

export function setSoundMuted(value: boolean) {
  muted = value
}

export function isSoundMuted() {
  return muted
}

interface Tone {
  frequency: number
  startOffset: number
  duration: number
  type?: OscillatorType
  peakGain?: number
}

function playTones(tones: Array<Tone>) {
  if (muted) return
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime

  for (const tone of tones) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type ?? 'sine'
    osc.frequency.setValueAtTime(tone.frequency, now + tone.startOffset)
    const peak = tone.peakGain ?? 0.15
    gain.gain.setValueAtTime(0, now + tone.startOffset)
    gain.gain.linearRampToValueAtTime(peak, now + tone.startOffset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.startOffset + tone.duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + tone.startOffset)
    osc.stop(now + tone.startOffset + tone.duration + 0.02)
  }
}

/** Light blip when selecting/jumping — plays on every attempt, correct or not. */
export function playJumpSound() {
  playTones([{ frequency: 320, startOffset: 0, duration: 0.1, type: 'triangle', peakGain: 0.1 }])
}

/** Cheerful ascending chime for a correct answer. */
export function playCorrectSound() {
  playTones([
    { frequency: 523, startOffset: 0, duration: 0.14, type: 'square', peakGain: 0.12 },
    { frequency: 659, startOffset: 0.08, duration: 0.14, type: 'square', peakGain: 0.12 },
    { frequency: 784, startOffset: 0.16, duration: 0.22, type: 'square', peakGain: 0.14 },
  ])
}

/** Soft, non-harsh descending tone for a wrong answer — a nudge, not a punishment. */
export function playWrongSound() {
  playTones([
    { frequency: 300, startOffset: 0, duration: 0.16, type: 'sine', peakGain: 0.1 },
    { frequency: 220, startOffset: 0.1, duration: 0.22, type: 'sine', peakGain: 0.09 },
  ])
}

/** Fuller celebratory flourish for completing a real Mission. */
export function playMissionCompleteSound() {
  playTones([
    { frequency: 523, startOffset: 0, duration: 0.12, type: 'square', peakGain: 0.11 },
    { frequency: 659, startOffset: 0.1, duration: 0.12, type: 'square', peakGain: 0.11 },
    { frequency: 784, startOffset: 0.2, duration: 0.12, type: 'square', peakGain: 0.13 },
    { frequency: 1047, startOffset: 0.3, duration: 0.32, type: 'square', peakGain: 0.15 },
  ])
}

// Breathing-exercise cues — deliberately slower, softer, and sine-only
// (vs. the peppier square-wave arcade sounds above) to match a calming
// register rather than a game-score register. Never tied to XP or any
// achievement — this stays a pure wellbeing feature per Principle 1
// (XP only for verified learning actions).
export function playBreatheInSound() {
  playTones([{ frequency: 220, startOffset: 0, duration: 1.2, type: 'sine', peakGain: 0.07 }])
}

export function playBreatheHoldSound() {
  playTones([{ frequency: 330, startOffset: 0, duration: 0.6, type: 'sine', peakGain: 0.05 }])
}

export function playBreatheOutSound() {
  playTones([{ frequency: 196, startOffset: 0, duration: 1.6, type: 'sine', peakGain: 0.06 }])
}

/** Gentle two-note close when a few full breathing cycles are complete. */
export function playCalmCompleteSound() {
  playTones([
    { frequency: 392, startOffset: 0, duration: 0.5, type: 'sine', peakGain: 0.08 },
    { frequency: 523, startOffset: 0.3, duration: 0.7, type: 'sine', peakGain: 0.09 },
  ])
}
