"use client"

import React, { useState, useEffect } from "react"
import { X, Circle, Square } from "lucide-react"

interface DigitalPianoProps {
  onClose: () => void
  pressedKeys: Set<number>
  onNotePlay: (note: number) => void
  onRecordNote?: (note: number) => void
}

const DigitalPiano: React.FC<DigitalPianoProps> = ({
  onClose,
  pressedKeys,
  onNotePlay,
  onRecordNote,
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [localPressedKeys, setLocalPressedKeys] = useState<Set<number>>(new Set())

  // Piano key configuration (C4 to C6)
  const whiteKeys = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84] // C4 to C6
  const blackKeys = [61, 63, 66, 68, 70, 73, 75, 78, 80, 82] // C#4 to A#5

  const getKeyName = (midiNote: number): string => {
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    const octave = Math.floor(midiNote / 12) - 1
    const noteName = noteNames[midiNote % 12]
    return `${noteName}${octave}`
  }

  const handleKeyPress = (midiNote: number) => {
    setLocalPressedKeys(prev => new Set(prev).add(midiNote))
    onNotePlay(midiNote)
    
    if (isRecording && onRecordNote) {
      onRecordNote(midiNote)
    }
    
    // Auto-release after 200ms for visual feedback
    setTimeout(() => {
      setLocalPressedKeys(prev => {
        const newSet = new Set(prev)
        newSet.delete(midiNote)
        return newSet
      })
    }, 200)
  }

  const isKeyPressed = (midiNote: number): boolean => {
    return pressedKeys.has(midiNote) || localPressedKeys.has(midiNote)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMap: { [key: string]: number } = {
        'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66,
        'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71, 'k': 72, 'o': 73,
        'l': 74, 'p': 75, ';': 76, "'": 77, ']': 78
      }
      
      const midiNote = keyMap[event.key.toLowerCase()]
      if (midiNote && !localPressedKeys.has(midiNote)) {
        handleKeyPress(midiNote)
      }
      
      // Close on Escape
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [localPressedKeys, onClose])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">♪</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Digital Piano</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                isRecording
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {isRecording ? "Stop Recording" : "Record to Score"}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Piano Keys */}
        <div className="p-6">
          <div className="relative bg-gray-100 rounded-lg p-4">
            {/* White Keys */}
            <div className="flex gap-1">
              {whiteKeys.map((midiNote) => (
                <button
                  key={midiNote}
                  onMouseDown={() => handleKeyPress(midiNote)}
                  className={`relative w-12 h-32 rounded-b-lg border-2 border-gray-300 transition-all duration-100 ${
                    isKeyPressed(midiNote)
                      ? "bg-purple-200 border-purple-400 transform scale-95"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-600">
                    {getKeyName(midiNote)}
                  </div>
                </button>
              ))}
            </div>

            {/* Black Keys */}
            <div className="absolute top-4 left-4 flex">
              {whiteKeys.map((whiteNote, index) => {
                const blackNote = whiteNote + 1
                const hasBlackKey = blackKeys.includes(blackNote)
                
                if (!hasBlackKey) {
                  return <div key={`spacer-${index}`} className="w-12" />
                }

                return (
                  <div key={blackNote} className="relative w-12">
                    <button
                      onMouseDown={() => handleKeyPress(blackNote)}
                      className={`absolute left-1/2 transform -translate-x-1/2 w-8 h-20 rounded-b-lg border border-gray-400 transition-all duration-100 ${
                        isKeyPressed(blackNote)
                          ? "bg-purple-800 transform scale-95"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-white">
                        {getKeyName(blackNote)}
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <div className="font-medium mb-2">How to use:</div>
              <div className="space-y-1">
                <div>• Click piano keys to play notes</div>
                <div>• Use keyboard shortcuts: A-L keys for white keys, W-P for black keys</div>
                <div>• Connect MIDI keyboard for real-time input</div>
                <div>• Enable "Record to Score" to automatically place played notes on the score</div>
                <div>• Press Escape to close</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DigitalPiano