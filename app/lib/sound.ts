// Tiny synthesized sound effects via the Web Audio API — deliberately no
// bundled audio files (nothing to license, nothing to load). Each sound is
// a short envelope of one or two oscillator tones. Lazily creates one
// shared AudioContext on first use (browsers require a user gesture before
// audio can play, which every call site here already has — a click).

let audioContext: AudioContext | null = null
let muted = typeof window !== 'undefined' && localStorage.getItem('focusflow-sound-muted') === 'true'

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
  if (typeof window !== 'undefined') localStorage.setItem('focusflow-sound-muted', String(value))
  if (value) stopAmbientLoop()
}

export function isSoundMuted() {
  return muted
}

let musicEnabled = typeof window !== 'undefined' && localStorage.getItem('focusflow-music-enabled') === 'true'
let ambientOscillators: Array<{ osc: OscillatorNode; gain: GainNode }> = []

export function isMusicEnabled() {
  return musicEnabled
}

export function setMusicEnabled(value: boolean) {
  musicEnabled = value
  if (typeof window !== 'undefined') localStorage.setItem('focusflow-music-enabled', String(value))
  if (value && !muted) startAmbientLoop()
  else stopAmbientLoop()
}

// A few slow, quiet detuned drones looping continuously — the honest,
// license-free substitute for real background music. No audio files or
// licensed tracks exist anywhere in this codebase, and sourcing/licensing
// real music is out of scope here — this is deliberately understated
// ambience, not a real soundtrack, and labeled that way in the UI.
export function startAmbientLoop() {
  if (muted || ambientOscillators.length > 0) return
  const ctx = getContext()
  if (!ctx) return
  const frequencies = [130.81, 164.81, 196.0] // C3-E3-G3, a calm major triad drone
  for (const frequency of frequencies) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 2)
    ambientOscillators.push({ osc, gain })
  }
}

export function stopAmbientLoop() {
  const ctx = audioContext
  if (ctx) {
    for (const { osc, gain } of ambientOscillators) {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
      osc.stop(ctx.currentTime + 1.1)
    }
  }
  ambientOscillators = []
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

// The real (logged-in) app's celebration/reaction sounds — same synthesis
// approach as the landing-page demo, wired into CelebrationOverlay and
// JourneyMap so the actual product feels at least as satisfying as the
// free teaser, not less.

/** A badge/checkpoint unlocking — CelebrationOverlay's 'achievement' payload and JourneyMap's just-unlocked nodes. */
export function playAchievementSound() {
  playTones([
    { frequency: 587, startOffset: 0, duration: 0.13, type: 'square', peakGain: 0.11 },
    { frequency: 740, startOffset: 0.09, duration: 0.13, type: 'square', peakGain: 0.12 },
    { frequency: 880, startOffset: 0.18, duration: 0.13, type: 'square', peakGain: 0.13 },
    { frequency: 1175, startOffset: 0.27, duration: 0.3, type: 'square', peakGain: 0.15 },
  ])
}

/** Quiz submitted — bigger flourish for a perfect score, a warm plain completion tone otherwise. */
export function playQuizResultSound(isPerfect: boolean) {
  if (isPerfect) {
    playAchievementSound()
    return
  }
  playTones([
    { frequency: 440, startOffset: 0, duration: 0.16, type: 'triangle', peakGain: 0.1 },
    { frequency: 554, startOffset: 0.1, duration: 0.24, type: 'triangle', peakGain: 0.11 },
  ])
}

/** Satisfying low-to-high "pop open" for a treasure-chest/task-complete celebration. */
export function playChestSound() {
  playTones([
    { frequency: 260, startOffset: 0, duration: 0.08, type: 'sawtooth', peakGain: 0.08 },
    { frequency: 520, startOffset: 0.06, duration: 0.1, type: 'sawtooth', peakGain: 0.1 },
    { frequency: 780, startOffset: 0.14, duration: 0.2, type: 'square', peakGain: 0.13 },
  ])
}

/** The biggest flourish — reaching the Journey Mode goal castle. */
export function playJourneyCompleteSound() {
  playTones([
    { frequency: 523, startOffset: 0, duration: 0.14, type: 'square', peakGain: 0.12 },
    { frequency: 659, startOffset: 0.1, duration: 0.14, type: 'square', peakGain: 0.13 },
    { frequency: 784, startOffset: 0.2, duration: 0.14, type: 'square', peakGain: 0.14 },
    { frequency: 988, startOffset: 0.3, duration: 0.14, type: 'square', peakGain: 0.15 },
    { frequency: 1319, startOffset: 0.4, duration: 0.4, type: 'square', peakGain: 0.17 },
  ])
}
