"use client"
import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Trash2,
  Music,
  Keyboard,
  RotateCcw,
  Download,
  Pen,
  Eraser,
  Settings,
  Type,
  Bold,
  Italic,
  Underline,
} from "lucide-react"
import { notations, getNotationByKey, type Notation } from "../data/notations"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import type { TextElement, ArticulationElement } from "../App"

interface PlacedNotation {
  id: string
  notation: Notation
  x: number
  y: number
  staveIndex: number
  octave: number
}

interface ScorePage {
  id: string
  title: string
  notes: PlacedNotation[]
  timeSignature: { numerator: number; denominator: number }
  keySignature: string
  tempo: number
  keyboardLineSpacing: number
  keySignaturePosition?: { x: number; y: number }
  tempoPosition?: { x: number; y: number }
  timeSignaturePosition?: { x: number; y: number }
}

interface ScoreSheetProps {
  selectedNotation: Notation | null
  currentPage: ScorePage
  onAddNote: (note: PlacedNotation) => void
  onRemoveNote: (noteId: string) => void
  onClearPage: () => void
  onUpdatePageSettings: (settings: Partial<ScorePage>) => void
  textElements: TextElement[]
  onAddTextElement: (textElement: TextElement) => void
  onRemoveTextElement: (id: string) => void
  onUpdateTextElement: (id: string, updates: Partial<TextElement>) => void
  articulationElements: ArticulationElement[]
  onAddArticulation: (articulation: ArticulationElement) => void
  onRemoveArticulation: (id: string) => void
  // Optional: parent can implement to persist articulation drag moves
  onUpdateArticulation?: (id: string, updates: Partial<ArticulationElement>) => void
  selectedArticulation: string | null
  isTextMode: boolean
}

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123
const INITIAL_KEYBOARD_NOTE_X_POSITION = 170
const NOTATION_VISUAL_WIDTH = 48
const NOTATION_KEYBOARD_X_INCREMENT = 50
const RENDERED_SCORESHEET_WIDTH = A4_WIDTH_PX * 1.3
const RENDERED_SCORESHEET_HEIGHT = A4_HEIGHT_PX * 1.3

const KEYBOARD_LINE_Y_POSITIONS = [230, 338, 446, 553, 659, 764, 872, 980, 1087, 1193, 1300]

const NOTE_BOUNDARY_LEFT = INITIAL_KEYBOARD_NOTE_X_POSITION
const NOTE_BOUNDARY_RIGHT = 1000

// Default positions if not provided by currentPage
const DEFAULT_TIME_SIGNATURE_POS = { x: 150, y: 130 }
const DEFAULT_KEY_POS = { x: 150, y: 170 }
const DEFAULT_TEMPO_POS = { x: 150, y: 200 }

// Updated MIDI mapping: a-z (26 keys) then A-S (19 keys) = 45 total keys
const midiNoteToNotationMap: { [key: number]: string } = {
  // a-z mapping (C3 to D5)
  48: "a",
  49: "b",
  50: "c",
  51: "d",
  52: "e",
  53: "f",
  54: "g",
  55: "h",
  56: "i",
  57: "j",
  58: "k",
  59: "l",
  60: "m",
  61: "n",
  62: "o",
  63: "p",
  64: "q",
  65: "r",
  66: "s",
  67: "t",
  68: "u",
  69: "v",
  70: "w",
  71: "x",
  72: "y",
  73: "z",
  // A-S mapping (D#5 to A#6)
  74: "A",
  75: "B",
  76: "C",
  77: "D",
  78: "E",
  79: "F",
  80: "G",
  81: "H",
  82: "I",
  83: "J",
  84: "K",
  85: "L",
  86: "M",
  87: "N",
  88: "O",
  89: "P",
  90: "Q",
  91: "R",
  92: "S",
}

const KEY_SIGNATURE_OPTIONS = [
  { label: "C Major / A Minor", value: "C" },
  { label: "G Major / E Minor", value: "G" },
  { label: "D Major / B Minor", value: "D" },
  { label: "F Major / D Minor", value: "F" },
  { label: "B Major / G Minor", value: "B" },
]

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
  textElements,
  onAddTextElement,
  onRemoveTextElement,
  onUpdateTextElement,
  articulationElements,
  onAddArticulation,
  onRemoveArticulation,
  onUpdateArticulation,
  selectedArticulation,
  isTextMode,
}) => {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [showToolsDropdown, setShowToolsDropdown] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [keyboardEnabled, setKeyboardEnabled] = useState(true)
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([])
  const [nextNotePosition, setNextNotePosition] = useState(INITIAL_KEYBOARD_NOTE_X_POSITION)
  const [currentKeyboardLineIndex, setCurrentKeyboardLineIndex] = useState(0)
  const [showTextDialog, setShowTextDialog] = useState(false)
  const [textDialogPosition, setTextDialogPosition] = useState({ x: 0, y: 0 })
  const [newTextContent, setNewTextContent] = useState("")
  const [newTextSize, setNewTextSize] = useState(16)
  const [newTextBold, setNewTextBold] = useState(false)
  const [newTextItalic, setNewTextItalic] = useState(false)
  const [newTextUnderline, setNewTextUnderline] = useState(false)

  // Moved useState calls inside the component and initialized from currentPage or defaults
  const [timeSignaturePos, setTimeSignaturePos] = useState(
    currentPage.timeSignaturePosition || DEFAULT_TIME_SIGNATURE_POS,
  )
  const [keyPos, setKeyPos] = useState(currentPage.keySignaturePosition || DEFAULT_KEY_POS)
  const [tempoPos, setTempoPos] = useState(currentPage.tempoPosition || DEFAULT_TEMPO_POS)

  // Sync internal positions with currentPage props if they change externally
  useEffect(() => {
    setTimeSignaturePos(currentPage.timeSignaturePosition || DEFAULT_TIME_SIGNATURE_POS)
    setKeyPos(currentPage.keySignaturePosition || DEFAULT_KEY_POS)
    setTempoPos(currentPage.tempoPosition || DEFAULT_TEMPO_POS)
  }, [currentPage.timeSignaturePosition, currentPage.keySignaturePosition, currentPage.tempoPosition])

  const currentKeyboardLineY = KEYBOARD_LINE_Y_POSITIONS[currentKeyboardLineIndex]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<"none" | "pen" | "eraser">("none")
  const isInteracting = useRef(false)
  const currentLine = useRef<Array<{ x: number; y: number }>>([])
  const [drawingLines, setDrawingLines] = useState<Array<{ x: number; y: number }[]>>([])
  const [eraserSize] = useState(20)

  // Add drag state for text elements
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Drag state for articulation elements
  const [draggedArticulationId, setDraggedArticulationId] = useState<string | null>(null)
  const [articulationDragOffset, setArticulationDragOffset] = useState({ x: 0, y: 0 })

  // New drag state for score info elements
  const [draggedScoreInfoId, setDraggedScoreInfoId] = useState<"timeSignature" | "key" | "tempo" | null>(null)
  const [scoreInfoDragOffset, setScoreInfoDragOffset] = useState({ x: 0, y: 0 })

  // Keep ScoreSheet in sync with RightSidebar eraser (and future tools) via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tool: "none" | "pen" | "eraser" }>).detail
      if (!detail) return
      setActiveTool(detail.tool)
    }
    window.addEventListener("dng:tool", handler as EventListener)
    return () => window.removeEventListener("dng:tool", handler as EventListener)
  }, [])

  // Add drag handlers for text elements
  const handleTextMouseDown = useCallback(
    (e: React.MouseEvent, textId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const textElement = textElements.find((t) => t.id === textId)
      if (!textElement) return

      setDraggedTextId(textId)
      setDragOffset({
        x: e.clientX - textElement.x,
        y: e.clientY - textElement.y,
      })
    },
    [textElements],
  )

  const handleTextMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedTextId) return
      e.preventDefault()

      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y

      onUpdateTextElement(draggedTextId, { x: newX, y: newY })
    },
    [draggedTextId, dragOffset, onUpdateTextElement],
  )

  const handleTextMouseUp = useCallback(() => {
    setDraggedTextId(null)
    setDragOffset({ x: 0, y: 0 })
  }, [])

  const handleArticulationMouseDown = useCallback(
    (e: React.MouseEvent, articulationId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const art = articulationElements.find((a) => a.id === articulationId)
      if (!art) return

      setDraggedArticulationId(articulationId)
      setArticulationDragOffset({
        x: e.clientX - art.x,
        y: e.clientY - art.y,
      })
    },
    [articulationElements],
  )

  const handleArticulationMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedArticulationId) return
      e.preventDefault()
      const newX = e.clientX - articulationDragOffset.x
      const newY = e.clientY - articulationDragOffset.y
      onUpdateArticulation?.(draggedArticulationId, { x: newX, y: newY })
    },
    [draggedArticulationId, articulationDragOffset, onUpdateArticulation],
  )

  const handleArticulationMouseUp = useCallback(() => {
    setDraggedArticulationId(null)
    setArticulationDragOffset({ x: 0, y: 0 })
  }, [])

  // New drag handlers for score info elements
  const handleScoreInfoMouseDown = useCallback(
    (e: React.MouseEvent, id: "timeSignature" | "key" | "tempo") => {
      e.preventDefault()
      e.stopPropagation()
      setDraggedScoreInfoId(id)

      let currentX, currentY
      if (id === "timeSignature") {
        currentX = timeSignaturePos.x
        currentY = timeSignaturePos.y
      } else if (id === "key") {
        currentX = keyPos.x
        currentY = keyPos.y
      } else {
        // tempo
        currentX = tempoPos.x
        currentY = tempoPos.y
      }

      setScoreInfoDragOffset({
        x: e.clientX - currentX,
        y: e.clientY - currentY,
      })
    },
    [timeSignaturePos, keyPos, tempoPos],
  )

  const handleScoreInfoMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedScoreInfoId) return
      e.preventDefault()

      const newX = e.clientX - scoreInfoDragOffset.x
      const newY = e.clientY - scoreInfoDragOffset.y

      if (draggedScoreInfoId === "timeSignature") {
        setTimeSignaturePos({ x: newX, y: newY })
      } else if (draggedScoreInfoId === "key") {
        setKeyPos({ x: newX, y: newY })
      } else {
        // tempo
        setTempoPos({ x: newX, y: newY })
      }
    },
    [draggedScoreInfoId, scoreInfoDragOffset],
  )

  const handleScoreInfoMouseUp = useCallback(() => {
    if (!draggedScoreInfoId) return

    // Persist the new positions to currentPage
    if (draggedScoreInfoId === "timeSignature") {
      onUpdatePageSettings({ timeSignaturePosition: timeSignaturePos })
    } else if (draggedScoreInfoId === "key") {
      onUpdatePageSettings({ keySignaturePosition: keyPos })
    } else {
      // tempo
      onUpdatePageSettings({ tempoPosition: tempoPos })
    }

    setDraggedScoreInfoId(null)
    setScoreInfoDragOffset({ x: 0, y: 0 })
  }, [draggedScoreInfoId, timeSignaturePos, keyPos, tempoPos, onUpdatePageSettings])

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
    [nextNotePosition, currentKeyboardLineIndex, currentKeyboardLineY, onAddNote],
  )

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (
        !keyboardEnabled ||
        showSettingsDropdown ||
        showKeyboardHelp ||
        showToolsDropdown ||
        activeTool !== "none" ||
        showTextDialog
      )
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
      showToolsDropdown,
      activeTool,
      showTextDialog,
      currentPage.notes,
      onRemoveNote,
      placeNotation,
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

  const handleImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "none") {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (isTextMode) {
      setTextDialogPosition({ x, y })
      setShowTextDialog(true)
      return
    }

    if (selectedArticulation) {
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

      const articulation = articulations.find((a) => a.id === selectedArticulation)
      if (articulation) {
        const newArticulation: ArticulationElement = {
          id: Date.now().toString(),
          type: articulation.id,
          name: articulation.name,
          symbol: articulation.symbol,
          x: Math.max(20, Math.min(x, rect.width - 20)),
          y: Math.max(20, Math.min(y, rect.height - 20)),
        }
        onAddArticulation(newArticulation)
      }
      return
    }

    if (!selectedNotation) {
      return
    }

    const newNote: PlacedNotation = {
      id: Date.now().toString(),
      notation: selectedNotation,
      x: Math.max(20, Math.min(x, rect.width - 20)),
      y: Math.max(20, Math.min(y, rect.height - 20)),
      staveIndex: 0,
      octave: 4,
    }
    onAddNote(newNote)
  }

  const handleAddText = () => {
    if (!newTextContent.trim()) return

    const newTextElement: TextElement = {
      id: Date.now().toString(),
      text: newTextContent,
      x: textDialogPosition.x,
      y: textDialogPosition.y,
      fontSize: newTextSize,
      bold: newTextBold,
      italic: newTextItalic,
      underline: newTextUnderline,
    }

    onAddTextElement(newTextElement)
    setShowTextDialog(false)
    setNewTextContent("")
    setNewTextSize(16)
    setNewTextBold(false)
    setNewTextItalic(false)
    setNewTextUnderline(false)
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

  const eraseArticulationsAt = useCallback(
    (x: number, y: number) => {
      const threshold = eraserSize
      const toRemove: string[] = []
      for (const art of articulationElements) {
        const dx = x - art.x
        const dy = y - art.y
        if (Math.hypot(dx, dy) <= threshold) {
          toRemove.push(art.id)
        }
      }
      Array.from(new Set(toRemove)).forEach((id) => onRemoveArticulation(id))
    },
    [articulationElements, eraserSize, onRemoveArticulation],
  )

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
        eraseArticulationsAt(x, y)
      }
    },
    [activeTool, eraserSize, eraseArticulationsAt],
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
        eraseArticulationsAt(x, y)
      }
    },
    [activeTool, eraserSize, eraseArticulationsAt],
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
    setShowToolsDropdown(false)
  }

  const getCursorStyle = useCallback(() => {
    if (activeTool === "pen") return "crosshair"
    if (activeTool === "eraser") return 'url("/placeholder.svg?width=24&height=24"), auto'
    if (isTextMode) return "text"
    if (selectedArticulation) return "crosshair"
    if (selectedNotation && activeTool === "none" && !keyboardEnabled && !midiEnabled) return "crosshair"
    if (draggedScoreInfoId) return "grabbing" // Cursor for dragging score info
    return "default"
  }, [activeTool, selectedNotation, keyboardEnabled, midiEnabled, isTextMode, selectedArticulation, draggedScoreInfoId])

  // Event listeners setup
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
  }, [currentPage.notes])

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

              {/* Tools Dropdown (optional, still kept) */}
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

        {/* Status Banner */}
        {((keyboardEnabled || midiEnabled) && activeTool === "none") ||
          isTextMode ||
          (selectedArticulation && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-blue-800">
                  {keyboardEnabled && <Keyboard className="w-4 h-4" />}
                  {midiEnabled && <Music className="w-4 h-4" />}
                  {isTextMode && <Type className="w-4 h-4" />}
                  {selectedArticulation && <span className="text-lg">♪</span>}
                  <span className="font-medium">
                    {isTextMode
                      ? "Text Mode Active - Click anywhere to add text"
                      : selectedArticulation
                        ? `Articulation Mode Active - ${selectedArticulation}`
                        : keyboardEnabled && midiEnabled
                          ? "Keyboard & MIDI Modes Active"
                          : keyboardEnabled
                            ? "Keyboard Mode Active"
                            : "MIDI Mode Active"}
                  </span>
                </div>
              </div>
            </div>
          ))}

        {/* Score Sheet Area */}
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
            src="images/DNGLines.jpg"
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

          {/* Score Sheet Info Display with positioning */}
          <div
            className="absolute z-20 text-gray-800 font-semibold text-lg cursor-grab"
            style={{
              left: `${timeSignaturePos.x}px`,
              top: `${timeSignaturePos.y}px`,
            }}
            onMouseDown={(e) => handleScoreInfoMouseDown(e, "timeSignature")}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-2xl">{currentPage.timeSignature.numerator} /</span>
              <span className="text-2xl leading-none">{currentPage.timeSignature.denominator}</span>
            </div>
          </div>

          <div
            className="absolute z-20 text-gray-800 font-semibold text-sm cursor-grab"
            style={{
              left: `${keyPos.x}px`,
              top: `${keyPos.y}px`,
            }}
            onMouseDown={(e) => handleScoreInfoMouseDown(e, "key")}
          >
            Key:{" "}
            {KEY_SIGNATURE_OPTIONS.find((k) => k.value === currentPage.keySignature)?.label || currentPage.keySignature}
          </div>

          <div
            className="absolute z-20 text-gray-800 font-semibold text-sm cursor-grab"
            style={{
              left: `${tempoPos.x}px`,
              top: `${tempoPos.y}px`,
            }}
            onMouseDown={(e) => handleScoreInfoMouseDown(e, "tempo")}
          >
            Tempo: {currentPage.tempo} BPM
          </div>

          {/* Overlay for interactions */}
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
            {/* Canvas for drawing */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-30"
              width={RENDERED_SCORESHEET_WIDTH}
              height={RENDERED_SCORESHEET_HEIGHT}
              style={{ pointerEvents: "none" }}
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

            {/* Text elements */}
            {textElements.map((textElement) => (
              <div
                key={textElement.id}
                className="absolute group z-20 select-none"
                style={{
                  left: `${textElement.x}px`,
                  top: `${textElement.y}px`,
                  fontSize: `${textElement.fontSize}px`,
                  fontWeight: textElement.bold ? "bold" : "normal",
                  fontStyle: textElement.italic ? "italic" : "normal",
                  textDecoration: textElement.underline ? "underline" : "none",
                  cursor: draggedTextId === textElement.id ? "grabbing" : "grab",
                }}
                onMouseDown={(e) => handleTextMouseDown(e, textElement.id)}
                onMouseMove={handleTextMouseMove}
                onMouseUp={handleTextMouseUp}
              >
                <div className="relative">
                  <span className="text-gray-800 pointer-events-none">{textElement.text}</span>
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveTextElement(textElement.id)
                    }}
                    title="Delete text"
                    aria-label="Delete text"
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-100 transition-all duration-300 flex items-center justify-center text-xs font-bold shadow-lg hover:bg-red-600"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}

            {/* Articulation elements */}
            {articulationElements.map((articulation) => (
              <div
                key={articulation.id}
                className="absolute group z-20 select-none"
                style={{
                  left: `${articulation.x}px`,
                  top: `${articulation.y}px`,
                  transform: "translateX(-50%)",
                  cursor: draggedArticulationId === articulation.id ? "grabbing" : "grab",
                }}
                onMouseDown={(e) => handleArticulationMouseDown(e, articulation.id)}
                onMouseMove={handleArticulationMouseMove}
                onMouseUp={handleArticulationMouseUp}
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                <div className="relative">
                  <span className="text-2xl text-gray-800 font-bold drop-shadow-md">{articulation.symbol}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveArticulation(articulation.id)
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center text-xs font-bold shadow-lg hover:bg-red-600"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}

            {/* Next note position indicator */}
            {(keyboardEnabled || midiEnabled) && activeTool === "none" && !isTextMode && !selectedArticulation && (
              <div
                className="absolute w-px h-6 bg-blue-400 opacity-100 animate-pulse z-20 translate-y-1/2"
                style={{
                  left: `${nextNotePosition}px`,
                  top: `${currentKeyboardLineY}px`,
                }}
              />
            )}

            
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-blue-900 mb-4 text-lg">Enhanced DNG Studios Features:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Right sidebar with articulations and text tools
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Click articulations to place musical symbols
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Text tool with formatting (bold, italic, underline, size)
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Position controls for key, tempo, and time signature
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>NEW:</strong> Built-in metronome with high-quality sound
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <strong>FIXED:</strong> MIDI mapping now supports a-z then A-S (45 keys total)
              </li>
            </ul>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Keyboard input with automatic line wrapping
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                MIDI device support for real-time notation placement
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Drawing tools for freehand annotations
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Export to PDF functionality
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Drag and drop text elements for repositioning
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Real-time tempo adjustment with metronome sync
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Text Dialog Modal */}
      {showTextDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  Add Text
                </h2>
                <button
                  onClick={() => setShowTextDialog(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Content</label>
                  <textarea
                    value={newTextContent}
                    onChange={(e) => setNewTextContent(e.target.value)}
                    placeholder="Enter your text here..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font Size: {newTextSize}px</label>
                  <input
                    type="range"
                    min="12"
                    max="48"
                    value={newTextSize}
                    onChange={(e) => setNewTextSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formatting</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewTextBold(!newTextBold)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
                        newTextBold
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <Bold className="w-4 h-4" />
                      Bold
                    </button>
                    <button
                      onClick={() => setNewTextItalic(!newTextItalic)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
                        newTextItalic
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <Italic className="w-4 h-4" />
                      Italic
                    </button>
                    <button
                      onClick={() => setNewTextUnderline(!newTextUnderline)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
                        newTextUnderline
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <Underline className="w-4 h-4" />
                      Underline
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleAddText}
                    disabled={!newTextContent.trim()}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Add Text
                  </button>
                  <button
                    onClick={() => setShowTextDialog(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-all duration-200 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[80vh] overflow-auto border border-gray-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Enhanced Keyboard & MIDI Mapping</h2>
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
                          notation.alphabet >= "A" && notation.alphabet <= "S"
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
                    lowercase notations (26 keys)
                  </li>
                  <li>
                    • <kbd className="px-1 py-0.5 bg-purple-800 text-white rounded font-mono text-xs">A-S</kbd> keys
                    place uppercase notations (19 keys)
                  </li>
                  <li>• Total of 45 different notations available via keyboard/MIDI</li>
                  <li>• Notations are placed automatically from left to right with line wrapping</li>
                  <li>• Use "Reset Position" to start placing notations from the beginning again</li>
                  <li>
                    • Press <kbd className="px-1 py-0.5 bg-gray-800 text-white rounded font-mono text-xs">Enter</kbd> to
                    move to the next line
                  </li>
                  <li>
                    • Press{" "}
                    <kbd className="px-1 py-0.5 bg-gray-800 text-white rounded font-mono text-xs">Backspace</kbd> to
                    delete the last placed notation
                  </li>
                </ul>
                <h3 className="font-semibold text-blue-900 mt-4 mb-2">Enhanced MIDI Mapping (a-z then A-S):</h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
                  <div>
                    <h4 className="font-medium mb-1">a-z keys (MIDI notes 48-73):</h4>
                    <ul className="space-y-1">
                      {Object.entries(midiNoteToNotationMap)
                        .slice(0, 26)
                        .map(([midiNote, alphabetKey]) => {
                          const notation = getNotationByKey(alphabetKey)
                          return (
                            <li key={midiNote} className="text-xs">
                              • MIDI {midiNote} →{" "}
                              <kbd className="px-1 py-0.5 bg-gray-800 text-white rounded font-mono">{alphabetKey}</kbd>{" "}
                              ({notation?.name || "Unknown"})
                            </li>
                          )
                        })}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">A-S keys (MIDI notes 74-92):</h4>
                    <ul className="space-y-1">
                      {Object.entries(midiNoteToNotationMap)
                        .slice(26)
                        .map(([midiNote, alphabetKey]) => {
                          const notation = getNotationByKey(alphabetKey)
                          return (
                            <li key={midiNote} className="text-xs">
                              • MIDI {midiNote} →{" "}
                              <kbd className="px-1 py-0.5 bg-purple-800 text-white rounded font-mono">
                                {alphabetKey}
                              </kbd>{" "}
                              ({notation?.name || "Unknown"})
                            </li>
                          )
                        })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ScoreSheet
