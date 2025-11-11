import { getCachedDesktop, saveDesktopState } from '../services/saveService'

// Simple sound effects system using Web Audio API, now server-persisted enable state
class SoundEffects {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true

  constructor() {
    // Initialize from cached server state if available
    if (typeof window !== 'undefined') {
      const cached = getCachedDesktop()
      if (cached && typeof cached.soundEffectsEnabled === 'boolean') {
        this.enabled = cached.soundEffectsEnabled
      } else {
        this.enabled = true
      }
    }
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  private playTone(frequency: number, duration: number, volume: number = 0.1) {
    if (!this.enabled) return

    try {
      const ctx = this.getContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(volume, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  click() {
    this.playTone(800, 0.05, 0.08)
  }

  hover() {
    this.playTone(600, 0.03, 0.04)
  }

  windowOpen() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Smooth legato chord for window open
      const notes = [
        { freq: 261.63, time: 0, duration: 0.3 },    // C4
        { freq: 329.63, time: 0.08, duration: 0.25 }, // E4
        { freq: 392, time: 0.15, duration: 0.2 }      // G4
      ]

      notes.forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.frequency.value = freq
        osc.type = 'sine'

        const startTime = ctx.currentTime + time
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.06, startTime + 0.02)
        gain.gain.linearRampToValueAtTime(0.01, startTime + duration)

        osc.start(startTime)
        osc.stop(startTime + duration)
      })
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  windowClose() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Smooth descending legato chord for window close
      const notes = [
        { freq: 392, time: 0, duration: 0.3 },        // G4
        { freq: 329.63, time: 0.08, duration: 0.25 }, // E4
        { freq: 261.63, time: 0.15, duration: 0.2 }   // C4
      ]

      notes.forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.frequency.value = freq
        osc.type = 'sine'

        const startTime = ctx.currentTime + time
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.06, startTime + 0.02)
        gain.gain.linearRampToValueAtTime(0.01, startTime + duration)

        osc.start(startTime)
        osc.stop(startTime + duration)
      })
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  minimize() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Quick descending dyad for minimize
      const notes = [
        { freq: 329.63, time: 0, duration: 0.15 },  // E4
        { freq: 261.63, time: 0.05, duration: 0.12 } // C4
      ]

      notes.forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.frequency.value = freq
        osc.type = 'sine'

        const startTime = ctx.currentTime + time
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.05, startTime + 0.01)
        gain.gain.linearRampToValueAtTime(0.01, startTime + duration)

        osc.start(startTime)
        osc.stop(startTime + duration)
      })
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  maximize() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Quick ascending dyad for maximize
      const notes = [
        { freq: 261.63, time: 0, duration: 0.15 },  // C4
        { freq: 329.63, time: 0.05, duration: 0.12 } // E4
      ]

      notes.forEach(({ freq, time, duration }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.frequency.value = freq
        osc.type = 'sine'

        const startTime = ctx.currentTime + time
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.05, startTime + 0.01)
        gain.gain.linearRampToValueAtTime(0.01, startTime + duration)

        osc.start(startTime)
        osc.stop(startTime + duration)
      })
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  error() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Harsh error sound
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = 200
      oscillator.type = 'square'

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.2)
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  login() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Legato flowing chord progression - smooth overlapping notes
      const chordSequence = [
        { freq: 174.61, time: 0, duration: 1.2, type: 'sine' as OscillatorType },      // F3
        { freq: 220, time: 0.15, duration: 1.1, type: 'sine' as OscillatorType },      // A3
        { freq: 261.63, time: 0.3, duration: 1.0, type: 'sine' as OscillatorType },    // C4
        { freq: 329.63, time: 0.45, duration: 0.9, type: 'sine' as OscillatorType },   // E4
        { freq: 392, time: 0.6, duration: 0.8, type: 'sine' as OscillatorType }        // G4
      ]

      // Smooth legato bass foundation
      const bassNotes = [
        { freq: 87.31, time: 0, duration: 0.9, type: 'triangle' as OscillatorType },   // F2
        { freq: 110, time: 0.4, duration: 0.8, type: 'triangle' as OscillatorType }    // A2
      ]

      // Bass layer - smooth and sustained
      bassNotes.forEach(({ freq, time, duration, type }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscillator.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.frequency.value = freq
        oscillator.type = type
        filter.type = 'lowpass'
        filter.frequency.value = freq * 3
        filter.Q.value = 1

        const startTime = ctx.currentTime + time
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.15)
        gainNode.gain.linearRampToValueAtTime(0.10, startTime + duration * 0.7)
        gainNode.gain.linearRampToValueAtTime(0.01, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      })

      // Chord layer - flowing and legato
      chordSequence.forEach(({ freq, time, duration, type }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscillator.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.frequency.value = freq
        oscillator.type = type
        filter.type = 'lowpass'
        filter.frequency.value = freq * 2
        filter.Q.value = 0.5

        const startTime = ctx.currentTime + time
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.08, startTime + 0.2)
        gainNode.gain.linearRampToValueAtTime(0.06, startTime + duration * 0.8)
        gainNode.gain.linearRampToValueAtTime(0.01, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      })
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  logout() {
    const ctx = this.getContext()
    if (!this.enabled) return

    try {
      // Legato descending chord - smooth fade to silence
      const chordSequence = [
        { freq: 392, time: 0, duration: 1.2, type: 'sine' as OscillatorType },         // G4
        { freq: 329.63, time: 0.15, duration: 1.1, type: 'sine' as OscillatorType },   // E4
        { freq: 293.66, time: 0.3, duration: 1.0, type: 'sine' as OscillatorType },    // D4
        { freq: 246.94, time: 0.45, duration: 0.9, type: 'sine' as OscillatorType },   // B3
        { freq: 196, time: 0.6, duration: 0.8, type: 'sine' as OscillatorType }        // G3
      ]

      // Smooth legato bass descent
      const bassNotes = [
        { freq: 110, time: 0, duration: 0.9, type: 'triangle' as OscillatorType },     // A2
        { freq: 87.31, time: 0.4, duration: 1.0, type: 'triangle' as OscillatorType }  // F2
      ]

      // Bass layer - smooth descent
      bassNotes.forEach(({ freq, time, duration, type }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscillator.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.frequency.value = freq
        oscillator.type = type
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(freq * 3, ctx.currentTime + time)
        filter.frequency.linearRampToValueAtTime(freq * 1.5, ctx.currentTime + time + duration)
        filter.Q.value = 1

        const startTime = ctx.currentTime + time
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.15)
        gainNode.gain.linearRampToValueAtTime(0.08, startTime + duration * 0.5)
        gainNode.gain.linearRampToValueAtTime(0.01, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      })

      // Chord layer - flowing descent
      chordSequence.forEach(({ freq, time, duration, type }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        const filter = ctx.createBiquadFilter()

        oscillator.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.frequency.value = freq
        oscillator.type = type
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(freq * 2, ctx.currentTime + time)
        filter.frequency.linearRampToValueAtTime(freq * 1.2, ctx.currentTime + time + duration)
        filter.Q.value = 0.5

        const startTime = ctx.currentTime + time
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.08, startTime + 0.2)
        gainNode.gain.linearRampToValueAtTime(0.05, startTime + duration * 0.7)
        gainNode.gain.linearRampToValueAtTime(0.01, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      })
    } catch (err) {
      console.warn('Sound playback failed:', err)
    }
  }

  toggle() {
    this.enabled = !this.enabled
    // Persist to server-backed state
    saveDesktopState({ soundEffectsEnabled: this.enabled }).catch(() => {})
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }
}

export const sounds = new SoundEffects()
