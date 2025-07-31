"use client"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Trash2, Music, Keyboard, RotateCcw, Download, Pen, Eraser } from "lucide-react" // Import Pen and Eraser icons
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
}

// A4 portrait dimensions in pixels at 96 DPI (approx)
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

// Estimated dimensions of the image (DNG Book 4 Lines.jpg)
// const IMAGE_WIDTH = 595
// const IMAGE_HEIGHT = 842

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
// This maps MIDI note numbers to the 'alphabet' key of your notations.
// You can expand this map to include more MIDI notes and their corresponding notations.
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

const ScoreSheet: React.FC<ScoreSheetProps> = ({
  selectedNotation,
  currentPage,
  onAddNote,
  onRemoveNote,
  onClearPage,
}) => {
  const [showSettings] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [keyboardEnabled, setKeyboardEnabled] = useState(true)
  const [midiEnabled, setMidiEnabled] = useState(false) // New state for MIDI
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([]) // Store active MIDI inputs
  const [nextNotePosition, setNextNotePosition] = useState(INITIAL_KEYBOARD_NOTE_X_POSITION)
  const [currentKeyboardLineIndex, setCurrentKeyboardLineIndex] = useState(0) // Track current line by index
  const currentKeyboardLineY = KEYBOARD_LINE_Y_POSITIONS[currentKeyboardLineIndex] // Derived Y position

  // New states for drawing functionality
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<"none" | "pen" | "eraser">("none") // 'none', 'pen', 'eraser'
  const isInteracting = useRef(false) // Tracks if mouse is down for drawing/erasing
  const currentLine = useRef<Array<{ x: number; y: number }>>([]) // Stores points for the current pen stroke
  const [drawingLines, setDrawingLines] = useState<Array<{ x: number; y: number }[]>>([]) // Stores all completed pen strokes
  const [eraserSize, setEraserSize] = useState(20) // Default eraser size

  const placeNotation = useCallback(
    (mappedNotation: Notation) => {
      let finalX = nextNotePosition
      let finalY = currentKeyboardLineY

      // Check if note exceeds right boundary, then wrap to next line
      if (finalX + NOTATION_VISUAL_WIDTH > NOTE_BOUNDARY_RIGHT) {
        const nextLineIndex = currentKeyboardLineIndex + 1
        if (nextLineIndex < KEYBOARD_LINE_Y_POSITIONS.length) {
          setCurrentKeyboardLineIndex(nextLineIndex) // Update the state for the next line
          finalX = NOTE_BOUNDARY_LEFT // Reset X to the left boundary for the new line
          finalY = KEYBOARD_LINE_Y_POSITIONS[nextLineIndex] // Update Y to the new line's Y
        } else {
          console.warn("Reached maximum number of lines (11), cannot add more notes by wrapping.")
          return // Stop adding notes if max lines reached
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

      // Update nextNotePosition for the *next* note
      setNextNotePosition(finalX + NOTATION_KEYBOARD_X_INCREMENT)
    },
    [nextNotePosition, currentKeyboardLineIndex, currentKeyboardLineY, onAddNote, KEYBOARD_LINE_Y_POSITIONS],
  )

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardEnabled || showSettings || showKeyboardHelp || activeTool !== "none") return // Disable keyboard input if a tool is active
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
          // Cursor position will be updated by the useEffect below
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
            return prevIndex // Stay on the last line
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
      showSettings,
      showKeyboardHelp,
      activeTool, // Added dependency
      currentPage.notes,
      onRemoveNote,
      placeNotation,
      KEYBOARD_LINE_Y_POSITIONS,
    ],
  )

  // MIDI message handler
  const handleMidiMessage = useCallback(
    (event: MIDIMessageEvent) => {
      if (!midiEnabled || showSettings || showKeyboardHelp || activeTool !== "none") return // Disable MIDI input if a tool is active

      if (!event.data) {
        console.warn("MIDI message data is null.")
        return
      }

      const status = event.data[0]
      const note = event.data[1]
      const velocity = event.data[2]

      const NOTE_ON = 0x90 // Note On status byte (0x90-0x9F, channel 0-15)

      // Check for Note On event with non-zero velocity (some devices send Note On with velocity 0 instead of Note Off)
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
    [midiEnabled, showSettings, showKeyboardHelp, activeTool, placeNotation], // Added activeTool dependency
  )

  // Add keyboard event listener
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

  // Effect to update cursor position when notes change (add/remove)
  useEffect(() => {
    if (currentPage.notes.length > 0) {
      const lastNote = currentPage.notes[currentPage.notes.length - 1]
      setNextNotePosition(lastNote.x + NOTATION_KEYBOARD_X_INCREMENT)
      const lastNoteLineIndex = KEYBOARD_LINE_Y_POSITIONS.indexOf(lastNote.y)
      if (lastNoteLineIndex !== -1) {
        setCurrentKeyboardLineIndex(lastNoteLineIndex)
      } else {
        // Fallback if lastNote.y is not in predefined lines (shouldn't happen with keyboard input)
        setCurrentKeyboardLineIndex(0)
      }
    } else {
      setNextNotePosition(INITIAL_KEYBOARD_NOTE_X_POSITION)
      setCurrentKeyboardLineIndex(0)
    }
  }, [currentPage.notes, KEYBOARD_LINE_Y_POSITIONS]) // Depend on notes and line positions

  // Focus management for keyboard events
  useEffect(() => {
    if (keyboardEnabled) {
      document.body.focus()
      document.body.setAttribute("tabindex", "0")
      return () => {
        document.body.removeAttribute("tabindex")
      }
    }
  }, [keyboardEnabled])

  // MIDI Access and Event Listener Management
  useEffect(() => {
    if (midiEnabled) {
      if (!navigator.requestMIDIAccess) {
        console.warn("Web MIDI API is not supported in this browser.")
        setMidiEnabled(false) // Disable MIDI if not supported
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
          setMidiEnabled(false) // Disable MIDI on error
        }
      }

      enableMidi()

      // Cleanup function for MIDI
      return () => {
        midiInputs.forEach((input) => {
          input.removeEventListener("midimessage", handleMidiMessage)
        })
        setMidiInputs([])
        console.log("MIDI disabled. Stopped listening for messages.")
      }
    } else {
      // If midiEnabled becomes false, ensure all listeners are removed
      midiInputs.forEach((input) => {
        input.removeEventListener("midimessage", handleMidiMessage)
      })
      setMidiInputs([])
    }
  }, [midiEnabled, handleMidiMessage]) // Depend on midiEnabled and handleMidiMessage

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "none") {
      // Only allow click for notation placement if no tool is active
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
      x: Math.max(20, Math.min(x, rect.width - 20)), // Clamp X within image
      y: Math.max(20, Math.min(y, rect.height - 20)), // Clamp Y within image
      staveIndex: 0, // Not visually distinct staves anymore, default to 0
      octave: 4, // Default
    }
    console.log("Placing selected notation:", newNote)
    onAddNote(newNote)
  }

  // Drawing functions
  const drawLine = useCallback((ctx: CanvasRenderingContext2D, line: { x: number; y: number }[]) => {
    if (line.length < 2) return
    ctx.beginPath()
    ctx.moveTo(line[0].x, line[0].y)
    for (let i = 1; i < line.length; i++) {
      ctx.lineTo(line[i].x, line[i].y)
    }
    ctx.stroke()
  }, [])

  // This useEffect redraws all committed lines whenever drawingLines state changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height) // Clear canvas
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "black"
    ctx.globalCompositeOperation = "source-over" // Ensure default drawing mode

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
        ctx.globalCompositeOperation = "destination-out" // Makes new shapes "erase" existing ones
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
      ctx.globalCompositeOperation = "source-over" // Reset to default drawing mode
    }

    if (activeTool === "pen") {
      if (currentLine.current.length > 1) {
        // Only add if it's a valid line
        setDrawingLines((prev) => [...prev, currentLine.current])
      }
      currentLine.current = []
    }
  }, [activeTool])

  const handleClearAll = () => {
    onClearPage() // Clears notations
    setDrawingLines([]) // Clears drawings
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height) // Clear canvas visually
      }
    }
  }

  const exportToPDF = async () => {
    const scoresheetElement = document.querySelector(".scoresheet-area") as HTMLElement
    if (!scoresheetElement) return

    try {
      const canvas = await html2canvas(scoresheetElement, {
        backgroundColor: "#ffffff",
        scale: 3, // Higher scale for better quality
        useCORS: true,
        width: scoresheetElement.offsetWidth,
        height: scoresheetElement.offsetHeight,
      })

      const imgData = canvas.toDataURL("image/png")

      // Calculate dimensions in millimeters based on 96 DPI
      const pxToMm = 25.4 / 96
      const imgWidthMm = canvas.width * pxToMm
      const imgHeightMm = canvas.height * pxToMm

      // Initialize jsPDF with custom dimensions matching the screenshot
      const pdf = new jsPDF({
        orientation: imgWidthMm > imgHeightMm ? "landscape" : "portrait", // Determine orientation based on screenshot
        unit: "mm",
        format: [imgWidthMm, imgHeightMm], // Set PDF page size to exact screenshot dimensions
      })

      // Add the image to the PDF, filling the entire page
      pdf.addImage(imgData, "PNG", 0, 0, imgWidthMm, imgHeightMm)
      pdf.save(`${currentPage.title}.pdf`)
    } catch (error) {
      console.error("Error exporting to PDF:", error)
    }
  }

  const handleToolToggle = (tool: "pen" | "eraser") => {
    setActiveTool((prev) => (prev === tool ? "none" : tool))
  }

  const getCursorStyle = useCallback(() => {
    if (activeTool === "pen") return "crosshair"
    if (activeTool === "eraser") return 'url("/placeholder.svg?width=24&height=24"), auto' // Custom eraser cursor
    if (selectedNotation && activeTool === "none" && !keyboardEnabled && !midiEnabled) return "crosshair"
    return "default"
  }, [activeTool, selectedNotation, keyboardEnabled, midiEnabled])

  return (
    <div
      className="flex-1 bg-gray-100 overflow-auto"
      onClick={() => {
        if (keyboardEnabled && activeTool === "none") {
          // Only focus body if keyboard is enabled and no tool is active
          document.body.focus()
        }
      }}
      tabIndex={keyboardEnabled && activeTool === "none" ? 0 : -1}
    >
      <div className="max-w-7xl mx-auto p-8">
        {/* Compact Header (retained for functionality) */}
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
                    <Music className="w-3 h-3" /> {/* Using Music icon for MIDI */}
                    <span className={midiEnabled ? "text-green-600 font-medium" : "text-red-600"}>
                      MIDI {midiEnabled ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleToolToggle("pen")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  activeTool === "pen"
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                <Pen className="w-3 h-3" />
                Pen
              </button>
              <button
                onClick={() => handleToolToggle("eraser")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  activeTool === "eraser"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-600 text-white hover:bg-gray-700"
                }`}
              >
                <Eraser className="w-3 h-3" />
                Eraser
              </button>
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
                onClick={() => setShowKeyboardHelp(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-xs font-medium"
              >
                <Keyboard className="w-3 h-3" />
                Key Map
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all duration-200 text-xs font-medium"
              >
                <Download className="w-3 h-3" />
                Export PDF
              </button>
              <button
                onClick={handleClearAll} // Use the new handleClearAll function
                disabled={currentPage.notes.length === 0 && drawingLines.length === 0} // Disable if no notes and no drawings
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 text-xs font-medium"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard Status Banner */}
        {(keyboardEnabled || midiEnabled) &&
          activeTool === "none" && ( // Hide if a tool is active
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
                <button
                  onClick={() => {
                    setNextNotePosition(INITIAL_KEYBOARD_NOTE_X_POSITION)
                    setCurrentKeyboardLineIndex(0) // Reset line index
                  }}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Position
                </button>
              </div>
            </div>
          )}

        {/* Score Sheet Area - Main content area with background image */}
        <div
          className="relative bg-white shadow-xl mx-auto scoresheet-area"
          style={{
            width: `${RENDERED_SCORESHEET_WIDTH}px`, // Use rendered width
            height: `${RENDERED_SCORESHEET_HEIGHT}px`, // Use rendered height
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

          {/* Overlay for click events, note placement, and drawing */}
          <div
            className="absolute inset-0 z-10"
            onClick={activeTool === "none" ? handleImageClick : undefined} // Only allow click for notation placement if no tool is active
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // End drawing if mouse leaves the area
            style={{
              cursor: getCursorStyle(),
            }}
          >
            {/* Canvas for drawing */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-30" // Higher z-index than notes for drawing over them
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
            {(keyboardEnabled || midiEnabled) &&
              activeTool === "none" && ( // Hide if a tool is active
                <div
                  className="absolute w-px h-6 bg-blue-400 opacity-100 animate-blink z-20 translate-y-1/2" // Changed size and added animate-blink
                  style={{
                    left: `${nextNotePosition}px`,
                    top: `${currentKeyboardLineY}px`, // Use the exact Y position
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
            {activeTool === "none" &&
              !keyboardEnabled &&
              !midiEnabled &&
              selectedNotation && ( // Hide if a tool is active
                <div className="absolute top-4 right-4 bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full flex items-center gap-2 shadow-md z-20">
                  <Music className="w-4 h-4" />
                  <span>Selected: {selectedNotation.name}</span>
                </div>
              )}
          </div>
        </div>

        {/* Instructions (retained from original) */}
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
                <strong>NEW:</strong> Press Enter to move to the next line for keyboard input
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Notations will automatically wrap to the next line
              </li>
              
            </ul>
          </div>
        </div>
      </div>

      {/* Keyboard Help Modal (retained from original) */}
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
