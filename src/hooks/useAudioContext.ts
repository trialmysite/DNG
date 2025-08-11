"use client"

import { useCallback, useRef } from "react"

export const useAudioContext = () => {
  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  const playNote = useCallback((frequency: number) => {
    try {
      const audioContext = getAudioContext()
      
      // Resume context if suspended (for better browser compatibility)
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }
      
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
      oscillator.type = "triangle" // Better sound quality for musical notes

      // Improved envelope for more natural sound
      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01) // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.1, audioContext.currentTime + 0.1) // Decay
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8) // Release

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.8)
    } catch (error) {
      console.warn("Audio playback not supported:", error)
    }
  }, [getAudioContext])

  const playChord = useCallback((frequencies: number[]) => {
    frequencies.forEach(freq => playNote(freq))
  }, [playNote])

  return { playNote, playChord }
}
