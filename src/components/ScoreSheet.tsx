"use client"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Trash2, Music, Keyboard, RotateCcw, Download, Pen, Eraser, Settings } from "lucide-react" // Import Settings icon
import { notations, getNotationByKey, type Notation } from "../data/notations"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

interface PlacedNotation {
  id: string
  notation: Notation
  x: number // X position relative to the left of the scoresheet area
  y: number // Y position relative to the top of the scoresheet area
  staveIndex: number // Kept for data consistency, but less visually relevant now
  octave: number // Kept for data consistency
}

interface ScorePage {
  id: string
  title: string
  notes: PlacedNotation[]
  timeSignature: { numerator: number; denominator: number }
  keySignature: string
  tempo: number
  keyboardLineSpacing: number // Vertical spacing for keyboard-placed notes
}

interface ScoreSheetProps {
  selectedNotation: Notation | null
  currentPage: ScorePage
  onAddNote: (note: PlacedNotation) => void
  onRemoveNote: (noteId: string) => void
  onClearPage: () => void
  onUpdatePageSettings: (settings: Partial<ScorePage>) => void
}

// A4 portrait dimensions in pixels at 96 DPI (approx)
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

// Initial X position for keyboard notes
const INITIAL_KEYBOARD_NOTE_X_POSITION = 170

// Visual width of a notation image (w-12 is 48px)
const NOTATION_VISUAL_WIDTH = 48

// Spacing between notations when placed by keyboard
const NOTATION_KEYBOARD_X_INCREMENT = 50 // This includes notation width + desired gap

// Define the actual rendered dimensions of the scoresheet area
const RENDERED_SCORESHEET_WIDTH = A4_WIDTH_PX * 1.3
const RENDERED_SCORESHEET_HEIGHT = A4_HEIGHT_PX * 1.3

// Define the fixed Y positions for each of the 11 allowed lines
// You can customize these Y positions to fit your scoresheet design.
const KEYBOARD_LINE_Y_POSITIONS = [
  230, // Line 1
  338, // Line 2
  446, // Line 3
  553, // Line 4
  659, // Line 5
  764, // Line 6
  872, // Line 7
  980, // Line 8
  1087, // Line 9
  1193, // Line 10
  1300, // Line 11
]

// Define horizontal boundaries for notes
const NOTE_BOUNDARY_LEFT = INITIAL_KEYBOARD_NOTE_X_POSITION
const NOTE_BOUNDARY_RIGHT = 1000 // Original value for right boundary before wrapping

// MIDI Note to Notation Mapping
const midiNoteToNotationMap: { [key: number]: string } = {
  60: "a", // Middle C -> 'a' notation
  62: "s", // D4 -> 's' notation
  64: "d", // E4 -> 'd' notation
  65: "f", // F4 -> 'f' notation
  67: "g", // G4 -> 'g' notation
  69: "h", // A4 -> 'h' notation
  71: "j", // B4 -> 'j' notation
  72: "k", // C5 -> 'k' notation
  // Add more mappings as needed
}

// Options for Key Signatures
const KEY_SIGNATURE_OPTIONS = [
  { label: "C Major / A Minor", value: "C" },
  { label: "G Major / E Minor", value: "G" },
  { label: "D Major / B Minor", value: "D" },
  { label: "F Major / D Minor", value: "F" },
  { label: "B Major / G Minor", value: "B" },
]

// Options for Time Signatures
const TIME_SIGNATURE_OPTIONS = [
  { label: "2/3", numerator: 2, denominator: 3 },
  { label: "3/4", numerator: 3, denominator: 4 },
  { label: "3/8", numerator: 3, denominator: 8 },
  { label: "5/8", numerator: 5, denominator: 8 },
  { label: "4/4", numerator: 4, denominator: 4 },
  { label: "3/3", numerator: 3, denominator: 3 },
]

const ScoreSheet: React.FC<ScoreSheetProps> = ({
  selectedNotation,
  currentPage,
  onAddNote,
  onRemoveNote,
  onClearPage,
  onUpdatePageSettings,
}) => {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [showToolsDropdown, setShowToolsDropdown] = useState(false) // New state for Tools dropdown
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [keyboardEnabled, setKeyboardEnabled] = useState(true)
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([])
  const [nextNotePosition, setNextNotePosition] = useState(INITIAL_KEYBOARD_NOTE_X_POSITION)
  const [currentKeyboardLineIndex, setCurrentKeyboardLineIndex] = useState(0)
  const currentKeyboardLineY = KEYBOARD_LINE_Y_POSITIONS[currentKeyboardLineIndex]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<"none" | "pen" | "eraser">("none")
  const isInteracting = useRef(false)
  const currentLine = useRef<Array<{ x: number; y: number }>>([])
  const [drawingLines, setDrawingLines] = useState<Array<{ x: number; y: number }[]>>([])
  const [eraserSize] = useState(20) // Default eraser size

  const placeNotation = useCallback(
    (mappedNotation: Notation) => {
      let finalX = nextNotePosition
      let finalY = currentKeyboardLineY

      if (finalX + NOTATION_VISUAL_WIDTH > NOTE_BOUNDARY_RIGHT) {
        const nextLineIndex = currentKeyboardLineIndex + 1
        if (nextLineIndex < KEYBOARD_LINE_Y_POSITIONS.length) {
          setCurrentKeyboardLineIndex(nextLineIndex)
          finalX = NOTE_BOUNDARY_LEFT
          finalY = KEYBOARD_LINE_Y_POSITIONS[nextLineIndex]
        } else {
          console.warn("Reached maximum number of lines (11), cannot add more notes by wrapping.")
          return
        }
      }

      const newNote: PlacedNotation = {
        id: Date.now().toString(),
        notation: mappedNotation,
        x: finalX,
        y: finalY,
        staveIndex: 0,
        octave: 4,
      }
      onAddNote(newNote)

      setNextNotePosition(finalX + NOTATION_KEYBOARD_X_INCREMENT)
    },
    [nextNotePosition, currentKeyboardLineIndex, currentKeyboardLineY, onAddNote, KEYBOARD_LINE_Y_POSITIONS],
  )

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled || showSettingsDropdown || showKeyboardHelp || showToolsDropdown || activeTool !== "none")
        return
      const target = event.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return
      }

      const key = event.key
      const mappedNotation = getNotationByKey(key)

      if (key === "Backspace") {
        event.preventDefault()
        event.stopPropagation()
        if (currentPage.notes.length > 0) {
          const lastNote = currentPage.notes[currentPage.notes.length - 1]
          onRemoveNote(lastNote.id)
        }
        return
      }

      if (key === "Enter") {
        event.preventDefault()
        event.stopPropagation()
        setNextNotePosition(INITIAL_KEYBOARD_NOTE_X_POSITION)
        setCurrentKeyboardLineIndex((prevIndex) => {
          const newIndex = prevIndex + 1
          if (newIndex < KEYBOARD_LINE_Y_POSITIONS.length) {
            return newIndex
          } else {
            console.warn("Reached maximum number of lines (11). Cannot add more lines with Enter.")
            return prevIndex
          }
        })
        return
      }

      if (mappedNotation) {
        event.preventDefault()
        event.stopPropagation()
        placeNotation(mappedNotation)
      }
    },
    [
      keyboardEnabled,
      showSettingsDropdown,
      showKeyboardHelp,
      showToolsDropdown, // Added dependency
      activeTool,
      currentPage.notes,
      onRemoveNote,
      placeNotation,
      KEYBOARD_LINE_Y_POSITIONS,
    ],
  )

  const handleMidiMessage = useCallback(
    (event: MIDIMessageEvent) => {
      if (!midiEnabled || showSettingsDropdown || showKeyboardHelp || showToolsDropdown || activeTool !== "none") return

      if (!event.data) {
        console.warn("MIDI message data is null.")
        return
      }

      const status = event.data[0]
      const note = event.data[1]
      const velocity = event.data[2]

      const NOTE_ON = 0x90
      if ((status & 0xf0) === NOTE_ON && velocity > 0) {
        const mappedAlphabet = midiNoteToNotationMap[note]
        if (mappedAlphabet) {
          const mappedNotation = getNotationByKey(mappedAlphabet)
          if (mappedNotation) {
            placeNotation(mappedNotation)
          }
        }
      }
    },
    [midiEnabled, showSettingsDropdown, showKeyboardHelp, showToolsDropdown, activeTool, placeNotation],
  )

  useEffect(() => {
    if (keyboardEnabled) {
      const handleKeyDown = (e: KeyboardEvent) => handleKeyPress(e)
      document.addEventListener("keydown", handleKeyDown, true)
      window.addEventListener("keydown", handleKeyDown, true)
      return () => {
        document.removeEventListener("keydown", handleKeyDown, true)
        window.removeEventListener("keydown", handleKeyDown, true)
      }
    }
  }, [handleKeyPress, keyboardEnabled])

  useEffect(() => {
    if (currentPage.notes.length > 0) {
      const lastNote = currentPage.notes[currentPage.notes.length - 1]
      setNextNotePosition(lastNote.x + NOTATION_KEYBOARD_X_INCREMENT)
      const lastNoteLineIndex = KEYBOARD_LINE_Y_POSITIONS.indexOf(lastNote.y)
      if (lastNoteLineIndex !== -1) {
        setCurrentKeyboardLineIndex(lastNoteLineIndex)
      } else {
        setCurrentKeyboardLineIndex(0)
      }
    } else {
      setNextNotePosition(INITIAL_KEYBOARD_NOTE_X_POSITION)
      setCurrentKeyboardLineIndex(0)
    }
  }, [currentPage.notes, KEYBOARD_LINE_Y_POSITIONS])

  useEffect(() => {
    if (keyboardEnabled) {
      document.body.focus()
      document.body.setAttribute("tabindex", "0")
      return () => {
        document.body.removeAttribute("tabindex")
      }
    }
  }, [keyboardEnabled])

  useEffect(() => {
    if (midiEnabled) {
      if (!navigator.requestMIDIAccess) {
        console.warn("Web MIDI API is not supported in this browser.")
        setMidiEnabled(false)
        return
      }

      const enableMidi = async () => {
        try {
          const midiAccess = await navigator.requestMIDIAccess()
          const inputs: MIDIInput[] = []
          midiAccess.inputs.forEach((input) => {
            inputs.push(input)
            input.addEventListener("midimessage", handleMidiMessage)
          })
          setMidiInputs(inputs)
          console.log("MIDI enabled. Listening for messages.")
        } catch (error) {
          console.error("Failed to access MIDI devices:", error)
          setMidiEnabled(false)
        }
      }

      enableMidi()

      return () => {
        midiInputs.forEach((input) => {
          input.removeEventListener("midimessage", handleMidiMessage)
        })
        setMidiInputs([])
      }
    } else {
      midiInputs.forEach((input) => {
        input.removeEventListener("midimessage", handleMidiMessage)
      })
      setMidiInputs([])
    }
  }, [midiEnabled, handleMidiMessage])

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "none") {
      console.log("A tool is active. Cannot place notations by click.")
      return
    }
    if (!selectedNotation) {
      console.log("No notation selected. Please select one from the palette first.")
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const newNote: PlacedNotation = {
      id: Date.now().toString(),
      notation: selectedNotation,
      x: Math.max(20, Math.min(x, rect.width - 20)),
      y: Math.max(20, Math.min(y, rect.height - 20)),
      staveIndex: 0,
      octave: 4,
    }
    console.log("Placing selected notation:", newNote)
    onAddNote(newNote)
  }

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, line: { x: number; y: number }[]) => {
    if (line.length < 2) return
    ctx.beginPath()
    ctx.moveTo(line[0].x, line[0].y)
    for (let i = 1; i < line.length; i++) {
      ctx.lineTo(line[i].x, line[i].y)
    }
    ctx.stroke()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "black"
    ctx.globalCompositeOperation = "source-over"

    drawingLines.forEach((line) => drawLine(ctx, line))
  }, [drawingLines, drawLine])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool === "none" || !canvasRef.current) return
      isInteracting.current = true
      const rect = canvasRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) return

      if (activeTool === "pen") {
        currentLine.current = [{ x, y }]
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.strokeStyle = "black"
        ctx.globalCompositeOperation = "source-over"
      } else if (activeTool === "eraser") {
        ctx.globalCompositeOperation = "destination-out"
        ctx.beginPath()
        ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [activeTool, eraserSize],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isInteracting.current || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) return

      if (activeTool === "pen") {
        ctx.lineTo(x, y)
        ctx.stroke()
        currentLine.current.push({ x, y })
      } else if (activeTool === "eraser") {
        ctx.beginPath()
        ctx.arc(x, y, eraserSize / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [activeTool, eraserSize],
  )

  const handleMouseUp = useCallback(() => {
    if (!isInteracting.current) return
    isInteracting.current = false
    const ctx = canvasRef.current?.getContext("2d")
    if (ctx) {
      ctx.globalCompositeOperation = "source-over"
    }

    if (activeTool === "pen") {
      if (currentLine.current.length > 1) {
        setDrawingLines((prev) => [...prev, currentLine.current])
      }
      currentLine.current = []
    }
  }, [activeTool])

  const handleClearAll = () => {
    onClearPage()
    setDrawingLines([])
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const exportToPDF = async () => {
    const scoresheetElement = document.querySelector(".scoresheet-area") as HTMLElement
    if (!scoresheetElement) return

    try {
      const canvas = await html2canvas(scoresheetElement, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
        width: scoresheetElement.offsetWidth,
        height: scoresheetElement.offsetHeight,
      })

      const imgData = canvas.toDataURL("image/png")

      const pxToMm = 25.4 / 96
      const imgWidthMm = canvas.width * pxToMm
      const imgHeightMm = canvas.height * pxToMm

      const pdf = new jsPDF({
        orientation: imgWidthMm > imgHeightMm ? "landscape" : "portrait",
        unit: "mm",
        format: [imgWidthMm, imgHeightMm],
      })

      pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, imgHeightMm)
      pdf.save(`${currentPage.title}.pdf`)
    } catch (error) {
      console.error("Error exporting to PDF:", error)
    }
  }

  const handleToolToggle = (tool: "pen" | "eraser") => {
    setActiveTool((prev) => (prev === tool ? "none" : tool))
    setShowToolsDropdown(false) // Close dropdown after selection
  }

  const getCursorStyle = useCallback(() => {
    if (activeTool === "pen") return "crosshair"
    if (activeTool === "eraser") return 'url("/placeholder.svg?width=24&height=24"), auto'
    if (selectedNotation && activeTool === "none" && !keyboardEnabled && !midiEnabled) return "crosshair"
    return "default"
  }, [activeTool, selectedNotation, keyboardEnabled, midiEnabled])

  return (
    <div
      className="flex-1 bg-gray-100 overflow-auto"
      onClick={() => {
        if (keyboardEnabled && activeTool === "none") {
          document.body.focus()
        }
      }}
      tabIndex={keyboardEnabled && activeTool === "none" ? 0 : -1}
    >
      <div className="max-w-7xl mx-auto p-8">
        {/* Compact Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">{currentPage.title}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    <span>{currentPage.notes.length} notations</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Keyboard className="w-3 h-3" />
                    <span className={keyboardEnabled ? "text-green-600 font-medium" : "text-red-600"}>
                      Keyboard {keyboardEnabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    <span className={midiEnabled ? "text-green-600 font-medium" : "text-red-600"}>
                      MIDI {midiEnabled ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Score Settings Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 bg-gray-600 text-white hover:bg-gray-700"
                >
                  <Settings className="w-3 h-3" />
                  Score Settings
                </button>
                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-56 p-2 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    <div className="px-2 py-1 text-sm font-semibold text-gray-700">Key Signature</div>
                    <div className="my-1 h-px bg-gray-200" />
                    <div className="space-y-1">
                      {KEY_SIGNATURE_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-sm cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="keySignature"
                            value={option.value}
                            checked={currentPage.keySignature === option.value}
                            onChange={() => onUpdatePageSettings({ keySignature: option.value })}
                            className="form-radio h-4 w-4 text-purple-600"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>

                    <div className="my-2 h-px bg-gray-200" />
                    <div className="px-2 py-1 text-sm font-semibold text-gray-700">Time Signature</div>
                    <div className="my-1 h-px bg-gray-200" />
                    <div className="space-y-1">
                      {TIME_SIGNATURE_OPTIONS.map((option) => (
                        <label
                          key={`${option.numerator}/${option.denominator}`}
                          className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-sm cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="timeSignature"
                            value={`${option.numerator}/${option.denominator}`}
                            checked={
                              currentPage.timeSignature.numerator === option.numerator &&
                              currentPage.timeSignature.denominator === option.denominator
                            }
                            onChange={() =>
                              onUpdatePageSettings({
                                timeSignature: { numerator: option.numerator, denominator: option.denominator },
                              })
                            }
                            className="form-radio h-4 w-4 text-purple-600"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>

                    <div className="my-2 h-px bg-gray-200" />
                    <div className="px-2 py-1 text-sm font-semibold text-gray-700">Tempo ({currentPage.tempo} BPM)</div>
                    <div className="my-1 h-px bg-gray-200" />
                    <div className="px-2 py-1">
                      <input
                        type="range"
                        min={40}
                        max={240}
                        step={1}
                        value={currentPage.tempo}
                        onChange={(e) => onUpdatePageSettings({ tempo: Number(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tools Dropdown - New consolidated dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Settings className="w-3 h-3" />
                  Tools
                </button>
                {showToolsDropdown && (
                  <div className="absolute right-0 mt-2 w-48 p-2 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    <div className="px-2 py-1 text-sm font-semibold text-gray-700">Actions</div>
                    <div className="my-1 h-px bg-gray-200" />
                    <button
                      onClick={() => {
                        setShowKeyboardHelp(true)
                        setShowToolsDropdown(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-sm"
                    >
                      <Keyboard className="w-3 h-3" />
                      Key Map
                    </button>
                    <button
                      onClick={() => {
                        exportToPDF()
                        setShowToolsDropdown(false)
                      }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-sm"
                    >
                      <Download className="w-3 h-3" />
                      Export PDF
                    </button>
                    <button
                      onClick={() => {
                        handleClearAll()
                        setShowToolsDropdown(false)
                      }}
                      disabled={currentPage.notes.length === 0 && drawingLines.length === 0}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>

                    <div className="my-2 h-px bg-gray-200" />
                    <div className="px-2 py-1 text-sm font-semibold text-gray-700">Drawing Tools</div>
                    <div className="my-1 h-px bg-gray-200" />
                    <button
                      onClick={() => handleToolToggle("pen")}
                      className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded-sm ${
                        activeTool === "pen" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Pen className="w-3 h-3" />
                      Pen {activeTool === "pen" && "(Active)"}
                    </button>
                    <button
                      onClick={() => handleToolToggle("eraser")}
                      className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded-sm ${
                        activeTool === "eraser" ? "bg-red-100 text-red-700" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Eraser className="w-3 h-3" />
                      Eraser {activeTool === "eraser" && "(Active)"}
                    </button>
                  </div>
                )}
              </div>

              {/* Keyboard and MIDI toggles remain separate */}
              <button
                onClick={() => setKeyboardEnabled(!keyboardEnabled)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  keyboardEnabled
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                <Keyboard className="w-3 h-3" />
                Keyboard
              </button>
              <button
                onClick={() => setMidiEnabled(!midiEnabled)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  midiEnabled
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                <Music className="w-3 h-3" />
                MIDI
              </button>
              <button
                onClick={() => {
                  setNextNotePosition(INITIAL_KEYBOARD_NOTE_X_POSITION)
                  setCurrentKeyboardLineIndex(0)
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-xs font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Pos
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard Status Banner */}
        {(keyboardEnabled || midiEnabled) && activeTool === "none" && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-blue-800">
                {keyboardEnabled && <Keyboard className="w-4 h-4" />}
                {midiEnabled && <Music className="w-4 h-4" />}
                <span className="font-medium">
                  {keyboardEnabled && midiEnabled
                    ? "Keyboard & MIDI Modes Active"
                    : keyboardEnabled
                      ? "Keyboard Mode Active"
                      : "MIDI Mode Active"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Score Sheet Area - Main content area with background image */}
        <div
          className="relative bg-white shadow-xl mx-auto scoresheet-area"
          style={{
            width: `${RENDERED_SCORESHEET_WIDTH}px`,
            height: `${RENDERED_SCORESHEET_HEIGHT}px`,
            border: "1px solid #dadada",
          }}
        >
          {/* Background Image */}
          <img
            src="/images/DNGLines.jpg"
            alt="Music Scoresheet Background"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Score Sheet Info Display */}
          <div className="absolute top-10 left-10 z-20 text-gray-800 font-semibold text-lg">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl">{currentPage.timeSignature.numerator}</span>
              <span className="text-2xl leading-none">{currentPage.timeSignature.denominator}</span>
            </div>
            <div className="text-sm mt-1">
              Key:{" "}
              {KEY_SIGNATURE_OPTIONS.find((k) => k.value === currentPage.keySignature)?.label ||
                currentPage.keySignature}
            </div>
            <div className="text-sm">Tempo: {currentPage.tempo} BPM</div>
          </div>

          {/* Overlay for click events, note placement, and drawing */}
          <div
            className="absolute inset-0 z-10"
            onClick={activeTool === "none" ? handleImageClick : undefined}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              cursor: getCursorStyle(),
            }}
          >
            {/* Canvas for drawing (on top of notes) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-30"
              width={RENDERED_SCORESHEET_WIDTH}
              height={RENDERED_SCORESHEET_HEIGHT}
            />

            {/* Placed notations */}
            {currentPage.notes.map((placedNote) => (
              <div
                key={placedNote.id}
                className="absolute group cursor-pointer z-20"
                style={{
                  left: `${placedNote.x}px`,
                  top: `${placedNote.y}px`,
                  transform: "translateX(-50%)",
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  console.log("Playing notation:", placedNote.notation.name)
                }}
              >
                <div className="relative">
                  <img
                    src={placedNote.notation.image || "/placeholder.svg"}
                    alt={placedNote.notation.name}
                    className="w-[72px] h-[72px] object-contain drop-shadow-md"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveNote(placedNote.id)
                    }}
                    className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}

            {/* Next note position indicator for keyboard input */}
            {(keyboardEnabled || midiEnabled) && activeTool === "none" && (
              <div
                className="absolute w-px h-6 bg-blue-400 opacity-100 animate-blink z-20 translate-y-1/2"
                style={{
                  left: `${nextNotePosition}px`,
                  top: `${currentKeyboardLineY}px`,
                }}
              />
            )}

            {/* Help text for notation placement */}
            {currentPage.notes.length === 0 && activeTool === "none" && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center text-gray-500 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 shadow-lg">
                  <Music className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                  <p className="text-xl font-semibold mb-2">
                    {keyboardEnabled
                      ? "Press keyboard keys to place notations"
                      : midiEnabled
                        ? "Press keys on your MIDI device to place notations"
                        : "Click on the sheet to place notations"}
                  </p>
                  <p className="text-sm">
                    {keyboardEnabled
                      ? "Keyboard mode is active - press any letter key (a-z, A-Z) or Enter for new line"
                      : midiEnabled
                        ? "MIDI mode is active - connect a MIDI device and play!"
                        : selectedNotation
                          ? `Selected: ${selectedNotation.name} (${selectedNotation.alphabet})`
                          : "Select a notation from the palette first"}
                  </p>
                </div>
              </div>
            )}

            {/* Help text for drawing mode */}
            {activeTool === "pen" && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center text-gray-500 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 shadow-lg">
                  <Pen className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <p className="text-xl font-semibold mb-2">Draw on the sheet with your mouse</p>
                  <p className="text-sm">
                    Click and drag to draw freehand lines. Click the Pen button again to exit drawing mode.
                  </p>
                </div>
              </div>
            )}

            {/* Help text for eraser mode */}
            {activeTool === "eraser" && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center text-gray-500 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 shadow-lg">
                  <Eraser className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-xl font-semibold mb-2">Erase drawings on the sheet</p>
                  <p className="text-sm">
                    Click and drag to erase parts of your drawings. Click the Eraser button again to exit erasing mode.
                  </p>
                </div>
              </div>
            )}

            {/* Visual indicator for selected notation */}
            {activeTool === "none" && !keyboardEnabled && !midiEnabled && selectedNotation && (
              <div className="absolute top-4 right-4 bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full flex items-center gap-2 shadow-md z-20">
                <Music className="w-4 h-4" />
                <span>Selected: {selectedNotation.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-blue-900 mb-4 text-lg">How to use DNG Studios:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Select notations from the palette on the left
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Click on the sheet to place notations manually
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Press keyboard keys (a-z, A-Z) to auto-place notations
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Each key maps to a different notation (uppercase vs lowercase)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Toggle MIDI mode ON to use a connected MIDI keyboard
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                MIDI notes are mapped to specific notations (see Key Map for details)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Click the "Pen" button to enable freehand drawing on the sheet.
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Click the "Eraser" button to erase drawings on the sheet.
              </li>
            </ul>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Use "Play All" to hear your composition
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Toggle keyboard mode on/off as needed
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                View keyboard mapping with "Key Map" button
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Your work is automatically saved
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Press Backspace to delete the most recent notation
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Press Enter to move to the next line
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Notations will automatically wrap to the next line
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[80vh] overflow-auto border border-gray-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Keyboard Mapping</h2>
                <button
                  onClick={() => setShowKeyboardHelp(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {notations.map((notation) => (
                  <div key={notation.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <kbd
                        className={`px-2 py-1 rounded text-sm font-mono ${
                          notation.alphabet >= "A" && notation.alphabet <= "Z"
                            ? "bg-purple-800 text-white"
                            : "bg-gray-800 text-white"
                        }`}
                      >
                        {notation.alphabet}
                      </kbd>
                      <img
                        src={notation.image || "/placeholder.svg"}
                        alt={notation.name}
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      <div className="font-medium truncate">{notation.name}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Press any mapped key to place the corresponding notation on the sheet</li>
                  <li>
                    • <kbd className="px-1 py-0.5 bg-gray-800 text-white rounded font-mono text-xs">a-z</kbd> keys place
                    lowercase notations
                  </li>
                  <li>
                    • <kbd className="px-1 py-0.5 bg-purple-800 text-white rounded font-mono text-xs">A-Z</kbd> keys
                    place uppercase notations (different symbols)
                  </li>
                  <li>• Notations are placed automatically from left to right</li>
                  <li>• Use "Reset Position" to start placing notations from the beginning again</li>
                  <li>• Toggle keyboard mode off to use manual placement</li>
                  <li>
                    • Press <kbd className="px-1 py-0.5 bg-gray-800 text-white rounded font-mono text-xs">Enter</kbd> to
                    move to the next line
                  </li>
                  <li>• Notations will automatically wrap to the next line when the current line is full.</li>
                </ul>
                <h3 className="font-semibold text-blue-900 mt-4 mb-2">MIDI Mapping:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  {Object.entries(midiNoteToNotationMap).map(([midiNote, alphabetKey]) => {
                    const notation = getNotationByKey(alphabetKey)
                    return (
                      <li key={midiNote}>
                        • MIDI Note {midiNote} ({notation?.name || "Unknown"}) maps to keyboard key{" "}
                        <kbd className="px-1 py-0.5 bg-gray-800 text-white rounded font-mono text-xs">
                          {alphabetKey}
                        </kbd>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScoreSheet
