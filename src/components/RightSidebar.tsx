"use client"

import type React from "react"
import { useState } from "react"
import { Type, Settings, Volume2, VolumeX, Play, Pause, Eraser } from "lucide-react"

interface RightSidebarProps {
  selectedArticulation: string | null
  onArticulationSelect: (articulation: string) => void
  isTextMode: boolean
  onTextModeToggle: (enabled: boolean) => void
  currentPage: any
  onUpdatePageSettings: (settings: any) => void
}

const articulations = [
  { id: "staccato", name: "Staccato", symbol: "." },
  { id: "accent", name: "Accent", symbol: ">" },
  { id: "tenuto", name: "Tenuto", symbol: "—" },
  { id: "marcato", name: "Marcato", symbol: "^" },
  { id: "fermata", name: "Fermata", symbol: "𝄐" },
  { id: "trill", name: "Trill", symbol: "tr" },
  { id: "mordent", name: "Mordent", symbol: "𝄽" },
  { id: "turn", name: "Turn", symbol: "𝄾" },
  { id: "slur", name: "Slur", symbol: "⌒" },
  { id: "tie", name: "Tie", symbol: "⌒" },
  { id: "black-dot", name: "Black Dot", symbol: "●" },
  { id: "outline-dot", name: "Outline Dot", symbol: "○" },
]

const RightSidebar: React.FC<RightSidebarProps> = ({
  selectedArticulation,
  onArticulationSelect,
  isTextMode,
  onTextModeToggle,
  currentPage,
  onUpdatePageSettings,
}) => {
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [metronomeInterval, setMetronomeInterval] = useState<ReturnType<typeof setInterval> | null>(null)

  // Keep eraser control here, and broadcast to the ScoreSheet via a small custom event
  const [activeTool, setActiveTool] = useState<"none" | "eraser">("none")
  const toggleEraser = () => {
    const next = activeTool === "eraser" ? "none" : "eraser"
    setActiveTool(next)
    // Optionally turn off text mode when enabling eraser to avoid conflicts
    if (next === "eraser" && isTextMode) onTextModeToggle(false)
    window.dispatchEvent(new CustomEvent("dng:tool", { detail: { tool: next } }))
  }

  const startMetronome = () => {
    if (metronomeInterval) {
      clearInterval(metronomeInterval)
    }

    const bpm = currentPage?.tempo || 120
    const intervalMs = (60 / bpm) * 1000

    // Create audio context for metronome sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    const playClick = () => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    }

    playClick() // Play immediately
    const interval = setInterval(playClick, intervalMs)
    setMetronomeInterval(interval)
    setMetronomeEnabled(true)
  }

  const stopMetronome = () => {
    if (metronomeInterval) {
      clearInterval(metronomeInterval)
      setMetronomeInterval(null)
    }
    setMetronomeEnabled(false)
  }

  const toggleMetronome = () => {
    if (metronomeEnabled) {
      stopMetronome()
    } else {
      startMetronome()
    }
  }

  return (
    <div className="w-64 h-screen bg-gradient-to-b from-slate-900 to-slate-800 border-l border-slate-700 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-white">Tools & Settings</h2>
        </div>
        <p className="text-xs text-slate-400">Articulations, text tools, drawing, and metronome</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Articulations Section */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <span className="text-lg">♪</span>
            Articulations
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {articulations.map((articulation) => (
              <button
                key={articulation.id}
                onClick={() => onArticulationSelect(selectedArticulation === articulation.id ? "" : articulation.id)}
                className={`p-3 rounded-lg border transition-all duration-200 text-center ${
                  selectedArticulation === articulation.id
                    ? "border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/20"
                    : "border-slate-600 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-700/50"
                }`}
              >
                <div className="text-xl text-white mb-1">{articulation.symbol}</div>
                <div className="text-xs text-slate-400">{articulation.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <button
              onClick={() => onArticulationSelect("")}
              disabled={!selectedArticulation}
              className={`w-full p-2 rounded-md text-sm transition ${
                selectedArticulation
                  ? "border border-slate-600 text-white hover:bg-slate-700/50"
                  : "border border-slate-700 text-slate-500 cursor-not-allowed"
              }`}
              aria-label="Deselect articulation"
              title="Deselect articulation"
            >
              Deselect articulation
            </button>
          </div>
        </div>

        {/* Text Tool Section */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Type className="w-4 h-4" />
            Text Tool
          </h3>
          <button
            onClick={() => onTextModeToggle(!isTextMode)}
            className={`w-full p-3 rounded-lg border transition-all duration-200 ${
              isTextMode
                ? "border-green-500 bg-green-500/10 text-green-400"
                : "border-slate-600 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-700/50 text-white"
            }`}
          >
            <Type className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">{isTextMode ? "Text Mode ON" : "Enable Text Mode"}</div>
            <div className="text-xs text-slate-400 mt-1">
              {isTextMode ? "Click anywhere to add text" : "Click to enable text placement"}
            </div>
          </button>

          {isTextMode && (
            <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
              <div className="text-xs text-slate-400 space-y-1">
                <div>• Click anywhere on the scoresheet to place text</div>
                <div>• Use formatting options in the text dialog</div>
                <div>• Drag text elements to reposition them</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white mb-3">Positions</h3>
          {/* Time Signature */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="col-span-2 text-xs text-slate-400">Time Signature</div>
            {(() => {
              const pos = currentPage?.timeSignaturePosition ?? { x: 10, y: 10 }
              return (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-4 text-slate-400">X</label>
                    <input
                      type="number"
                      value={pos.x}
                      onChange={(e) =>
                        onUpdatePageSettings({
                          timeSignaturePosition: { x: Number(e.target.value), y: pos.y },
                        })
                      }
                      className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-4 text-slate-400">Y</label>
                    <input
                      type="number"
                      value={pos.y}
                      onChange={(e) =>
                        onUpdatePageSettings({
                          timeSignaturePosition: { x: pos.x, y: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </>
              )
            })()}
          </div>

          {/* Key Signature */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="col-span-2 text-xs text-slate-400">Key</div>
            {(() => {
              const pos = currentPage?.keySignaturePosition ?? { x: 10, y: 50 }
              return (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-4 text-slate-400">X</label>
                    <input
                      type="number"
                      value={pos.x}
                      onChange={(e) =>
                        onUpdatePageSettings({
                          keySignaturePosition: { x: Number(e.target.value), y: pos.y },
                        })
                      }
                      className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-4 text-slate-400">Y</label>
                    <input
                      type="number"
                      value={pos.y}
                      onChange={(e) =>
                        onUpdatePageSettings({
                          keySignaturePosition: { x: pos.x, y: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </>
              )
            })()}
          </div>

          {/* Tempo */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 text-xs text-slate-400">Tempo</div>
            {(() => {
              const pos = currentPage?.tempoPosition ?? { x: 10, y: 70 }
              return (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-4 text-slate-400">X</label>
                    <input
                      type="number"
                      value={pos.x}
                      onChange={(e) =>
                        onUpdatePageSettings({
                          tempoPosition: { x: Number(e.target.value), y: pos.y },
                        })
                      }
                      className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-4 text-slate-400">Y</label>
                    <input
                      type="number"
                      value={pos.y}
                      onChange={(e) =>
                        onUpdatePageSettings({
                          tempoPosition: { x: pos.x, y: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Drawing Section (Eraser lives here) */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Eraser className="w-4 h-4" />
            Drawing
          </h3>
          <button
            onClick={toggleEraser}
            className={`w-full p-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTool === "eraser"
                ? "border-red-500 bg-red-500/10 text-red-400"
                : "border-slate-600 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-700/50 text-white"
            }`}
          >
            <Eraser className="w-5 h-5" />
            <div className="text-sm font-medium">{activeTool === "eraser" ? "Eraser ON" : "Enable Eraser"}</div>
          </button>
          <div className="mt-2 text-xs text-slate-400">
            • Eraser removes freehand drawings and articulations on contact
          </div>
        </div>

        {/* Metronome Section */}
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            {metronomeEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Metronome
          </h3>
          <button
            onClick={toggleMetronome}
            className={`w-full p-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 ${
              metronomeEnabled
                ? "border-green-500 bg-green-500/10 text-green-400"
                : "border-slate-600 hover:border-slate-500 bg-slate-800/50 hover:bg-slate-700/50 text-white"
            }`}
          >
            {metronomeEnabled ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            <div className="text-sm font-medium">{metronomeEnabled ? "Stop Metronome" : "Start Metronome"}</div>
          </button>
          <div className="mt-2 text-center text-xs text-slate-400">{currentPage?.tempo || 120} BPM</div>
        </div>
      </div>
    </div>
  )
}

export default RightSidebar
