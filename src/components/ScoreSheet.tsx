"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Download, Trash2, Settings, Piano, Minus, Edit3 } from "lucide-react"
import { exportToPDF, exportCurrentPageToPDF } from "../utils/pdfExport"
import { useAudioContext } from "../hooks/useAudioContext"
import { getNotationByKey } from "../data/notations"
import type { Notation } from "../data/notations"
import type { ScorePage, PlacedNote } from "../types/music"
import type { TextElement, ArticulationElement } from "../App"
import DigitalPiano from "./DigitalPiano"

interface LineElement {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  strokeWidth: number
  color: string
}

interface ScoreSheetProps {
  selectedNotation: Notation | null
  selectedAccidental: string | null
  currentPage: ScorePage
  onAddNote: (note: PlacedNote) => void
  onRemoveNote: (noteId: string) => void
  onClearPage: () => void
  onUpdatePageSettings: (settings: any) => void
  textElements: TextElement[]
  onAddTextElement: (textElement: TextElement) => void
  onRemoveTextElement: (id: string) => void
  onUpdateTextElement: (id: string, updates: Partial<TextElement>) => void
  articulationElements: ArticulationElement[]
  onAddArticulation: (articulation: ArticulationElement) => void
  onRemoveArticulation: (id: string) => void
  selectedArticulation: string | null
  isTextMode: boolean
}

const ScoreSheet: React.FC<ScoreSheetProps> = ({
  selectedNotation,
  selectedAccidental,
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
  selectedArticulation,
  isTextMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { playNote } = useAudioContext()
  
  // State management
  const [showPiano, setShowPiano] = useState(false)
  const [lineElements, setLineElements] = useState<LineElement[]>([])
  const [isDrawingLine, setIsDrawingLine] = useState(false)
  const [currentLine, setCurrentLine] = useState<LineElement | null>(null)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<"none" | "eraser" | "line">("none")
  
  // MIDI state - Enhanced for better performance
  const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null)
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())

  // Initialize MIDI with improved error handling
  useEffect(() => {
    const initMIDI = async () => {
      try {
        if (navigator.requestMIDIAccess) {
          const access = await navigator.requestMIDIAccess()
          setMidiAccess(access)
          
          // Set up MIDI input handlers with optimized callbacks
          access.inputs.forEach((input) => {
            input.onmidimessage = handleMIDIMessage
          })
          
          console.log("MIDI initialized successfully")
        }
      } catch (error) {
        console.warn("MIDI not available:", error)
      }
    }
    
    initMIDI()
  }, [handleMIDIMessage])

  // MIDI message handler with enhanced performance and latency reduction
  const handleMIDIMessage = useCallback((message: WebMidi.MIDIMessageEvent) => {
    const [command, note, velocity] = message.data
    const channel = command & 0xf
    const messageType = command & 0xf0

    if (messageType === 0x90 && velocity > 0) {
      // Note on - optimized for minimal latency
      setPressedKeys(prev => new Set(prev).add(note))
      
      // Play note immediately with optimized frequency calculation
      const frequency = 440 * Math.pow(2, (note - 69) / 12)
      playNote(frequency)
      
      // Auto-place note if notation is selected with improved positioning
      if (selectedNotation && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = Math.max(100, Math.min(rect.width - 100, 100 + (note - 60) * 25))
        const y = Math.max(150, Math.min(250, 200 - (note - 60) * 3))
        
        placeNoteAtPosition(x, y)
      }
    } else if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
      // Note off - clean state management
      setPressedKeys(prev => {
        const newSet = new Set(prev)
        newSet.delete(note)
        return newSet
      })
    }
  }, [selectedNotation, playNote, placeNoteAtPosition])

  // Tool event listener
  useEffect(() => {
    const handleToolChange = (event: CustomEvent) => {
      setActiveTool(event.detail.tool)
    }
    
    window.addEventListener("dng:tool", handleToolChange as EventListener)
    return () => window.removeEventListener("dng:tool", handleToolChange as EventListener)
  }, [])

  // Keyboard event handler for note placement
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (editingTextId) return // Don't place notes while editing text
      
      const notation = getNotationByKey(event.key)
      if (notation && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        placeNoteAtPosition(centerX, centerY, notation)
      }
      
      // Delete key for removing selected elements
      if (event.key === "Delete" && selectedElement) {
        handleDeleteElement(selectedElement)
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [editingTextId, selectedElement])

  // Place note at specific position
  const placeNoteAtPosition = (x: number, y: number, notation?: Notation) => {
    const noteToPlace = notation || selectedNotation
    if (!noteToPlace) return

    const staffLine = Math.round((y - 150) / 20)
    const octave = Math.max(1, Math.min(8, Math.round((300 - y) / 50)))

    const newNote: PlacedNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      note: {
        id: noteToPlace.id,
        name: noteToPlace.name,
        value: 1,
        symbol: noteToPlace.name,
        frequency: 440,
        pitch: noteToPlace.alphabet,
        image: noteToPlace.image,
        octave,
      },
      x,
      y,
      staffLine,
      accidental: selectedAccidental as any,
      octave,
    }

    onAddNote(newNote)
    
    // Play the note
    const frequency = 440 * Math.pow(2, (octave - 4))
    playNote(frequency)
  }

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Check if clicking on existing elements first - improved hit detection
    const clickedElement = findElementAtPosition(x, y)
    
    if (clickedElement) {
      setSelectedElement(clickedElement.id)
      if (clickedElement.type === "text") {
        setDragOffset({ x: x - clickedElement.x, y: y - clickedElement.y })
      }
      return
    }

    // Clear selection if clicking empty space
    setSelectedElement(null)
    setEditingTextId(null)

    // Handle different tools
    if (activeTool === "eraser") {
      handleEraserClick(x, y)
    } else if (activeTool === "line") {
      handleLineToolClick(x, y)
    } else if (isTextMode) {
      handleTextPlacement(x, y)
    } else if (selectedNotation) {
      placeNoteAtPosition(x, y)
    } else if (selectedArticulation) {
      handleArticulationPlacement(x, y)
    }
  }

  // Find element at position
  const findElementAtPosition = (x: number, y: number) => {
    // Check text elements with improved hit detection
    for (const textEl of textElements) {
      const textWidth = textEl.text.length * (textEl.fontSize * 0.6) // Approximate text width
      if (x >= textEl.x - 5 && x <= textEl.x + textWidth + 5 && 
          y >= textEl.y - textEl.fontSize - 5 && y <= textEl.y + 5) {
        return { id: textEl.id, x: textEl.x, y: textEl.y, type: "text" }
      }
    }
    
    // Check articulation elements
    for (const artEl of articulationElements) {
      if (Math.abs(x - artEl.x) < 25 && Math.abs(y - artEl.y) < 25) {
        return { id: artEl.id, x: artEl.x, y: artEl.y, type: "articulation" }
      }
    }
    
    // Check line elements
    for (const lineEl of lineElements) {
      const distToLine = distanceToLineSegment(x, y, lineEl.x1, lineEl.y1, lineEl.x2, lineEl.y2)
      if (distToLine < 10) {
        return { id: lineEl.id, x: lineEl.x1, y: lineEl.y1, type: "line" }
      }
    }
    
    // Check notes
    for (const note of currentPage.notes) {
      if (Math.abs(x - note.x) < 25 && Math.abs(y - note.y) < 25) {
        return { id: note.id, x: note.x, y: note.y, type: "note" }
      }
    }
    
    return null
  }

  // Distance to line segment helper
  const distanceToLineSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.sqrt(dx * dx + dy * dy)
    
    if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)))
    const projX = x1 + t * dx
    const projY = y1 + t * dy
    
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
  }

  // Handle eraser tool
  const handleEraserClick = (x: number, y: number) => {
    const element = findElementAtPosition(x, y)
    if (element) {
      handleDeleteElement(element.id)
    }
  }

  // Handle line tool
  const handleLineToolClick = (x: number, y: number) => {
    if (!isDrawingLine) {
      // Start drawing line
      const newLine: LineElement = {
        id: `line-${Date.now()}`,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        strokeWidth: 2,
        color: "#333"
      }
      setCurrentLine(newLine)
      setIsDrawingLine(true)
    } else {
      // Finish drawing line
      if (currentLine) {
        setLineElements(prev => [...prev, { ...currentLine, x2: x, y2: y }])
      }
      setCurrentLine(null)
      setIsDrawingLine(false)
    }
  }

  // Handle text placement
  const handleTextPlacement = (x: number, y: number) => {
    const newTextElement: TextElement = {
      id: `text-${Date.now()}`,
      text: "New Text",
      x,
      y,
      fontSize: 16,
      bold: false,
      italic: false,
      underline: false,
    }
    onAddTextElement(newTextElement)
    setEditingTextId(newTextElement.id)
  }

  // Handle articulation placement
  const handleArticulationPlacement = (x: number, y: number) => {
    if (!selectedArticulation) return
    
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
    
    const articulation = articulations.find(a => a.id === selectedArticulation)
    if (!articulation) return

    const newArticulation: ArticulationElement = {
      id: `articulation-${Date.now()}`,
      type: selectedArticulation,
      name: articulation.name,
      symbol: articulation.symbol,
      x,
      y,
    }
    onAddArticulation(newArticulation)
  }

  // Handle double click for text editing
  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Find and edit text elements on double-click
    const textElement = textElements.find(el => 
      x >= el.x - 5 && x <= el.x + (el.text.length * (el.fontSize * 0.6)) + 5 && 
      y >= el.y - el.fontSize - 5 && y <= el.y + 5
    )
    
    if (textElement) {
      setEditingTextId(textElement.id)
      setSelectedElement(textElement.id)
    }
  }

  // Handle mouse move for dragging and line drawing - improved performance
  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Update line drawing with smooth preview
    if (isDrawingLine && currentLine) {
      setCurrentLine(prev => prev ? { ...prev, x2: x, y2: y } : null)
    }

    // Handle dragging with improved responsiveness
    if (isDragging && selectedElement) {
      const newX = x - dragOffset.x
      const newY = y - dragOffset.y
      
      // Update text element position
      const textElement = textElements.find(el => el.id === selectedElement)
      if (textElement) {
        onUpdateTextElement(selectedElement, { x: newX, y: newY })
      }
    }
  }

  // Handle mouse down for dragging
  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    const element = findElementAtPosition(x, y)
    if (element) {
      setSelectedElement(element.id)
      if (element.type === "text") {
        setDragOffset({ x: x - element.x, y: y - element.y })
        setIsDragging(true)
      }
    }
  }

  // Handle mouse up - clean state management
  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  // Delete element
  const handleDeleteElement = (elementId: string) => {
    // Try to delete from different element types
    if (textElements.find(el => el.id === elementId)) {
      onRemoveTextElement(elementId)
    } else if (articulationElements.find(el => el.id === elementId)) {
      onRemoveArticulation(elementId)
    } else if (lineElements.find(el => el.id === elementId)) {
      setLineElements(prev => prev.filter(el => el.id !== elementId))
    } else if (currentPage.notes.find(note => note.id === elementId)) {
      onRemoveNote(elementId)
    }
    
    setSelectedElement(null)
  }

  // Draw canvas content
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw staff lines
    ctx.strokeStyle = "#666"
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const y = 150 + i * 20
      ctx.beginPath()
      ctx.moveTo(50, y)
      ctx.lineTo(canvas.width - 50, y)
      ctx.stroke()
    }

    // Draw treble clef
    ctx.font = "48px serif"
    ctx.fillStyle = "#333"
    ctx.fillText("𝄞", 20, 180)

    // Draw notes
    currentPage.notes.forEach((placedNote) => {
      if (placedNote.note.image) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, placedNote.x - 15, placedNote.y - 15, 30, 30)
        }
        img.src = placedNote.note.image
      }
      
      // Highlight selected notes
      if (selectedElement === placedNote.id) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.strokeRect(placedNote.x - 20, placedNote.y - 20, 40, 40)
      }
    })

    // Draw text elements
    textElements.forEach((textEl) => {
      // Enhanced text rendering with better font handling
      const fontStyle = `${textEl.bold ? "bold " : ""}${textEl.italic ? "italic " : ""}${textEl.fontSize}px Arial`
      ctx.font = fontStyle
      ctx.fillStyle = "#333"
      ctx.textBaseline = "top"
      ctx.fillText(textEl.text, textEl.x, textEl.y)
      
      // Highlight selected text with improved visual feedback
      if (selectedElement === textEl.id) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        const textWidth = ctx.measureText(textEl.text).width
        ctx.strokeRect(textEl.x - 3, textEl.y - 3, textWidth + 6, textEl.fontSize + 6)
        
        // Add resize handles for selected text
        ctx.fillStyle = "#3b82f6"
        ctx.fillRect(textEl.x + textWidth + 3, textEl.y + textEl.fontSize - 3, 6, 6)
      }
    })

    // Draw articulation elements
    articulationElements.forEach((artEl) => {
      ctx.font = "20px Arial"
      ctx.fillStyle = "#333"
      ctx.fillText(artEl.symbol, artEl.x, artEl.y)
      
      // Highlight selected articulations
      if (selectedElement === artEl.id) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2
        ctx.strokeRect(artEl.x - 15, artEl.y - 15, 30, 30)
      }
    })

    // Draw line elements
    lineElements.forEach((lineEl) => {
      ctx.strokeStyle = lineEl.color
      ctx.lineWidth = lineEl.strokeWidth
      ctx.beginPath()
      ctx.moveTo(lineEl.x1, lineEl.y1)
      ctx.lineTo(lineEl.x2, lineEl.y2)
      ctx.stroke()
      
      // Highlight selected lines
      if (selectedElement === lineEl.id) {
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(lineEl.x1, lineEl.y1)
        ctx.lineTo(lineEl.x2, lineEl.y2)
        ctx.stroke()
      }
    })

    // Draw current line being drawn
    if (isDrawingLine && currentLine) {
      ctx.strokeStyle = "#666"
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(currentLine.x1, currentLine.y1)
      ctx.lineTo(currentLine.x2, currentLine.y2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [currentPage.notes, textElements, articulationElements, lineElements, selectedElement, isDrawingLine, currentLine])

  return (
    <div className="flex-1 bg-white relative" ref={containerRef}>
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">{currentPage.title}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{currentPage.notes.length} notes</span>
            <span>•</span>
            <span>{currentPage.tempo} BPM</span>
            <span>•</span>
            <span>{currentPage.timeSignature.numerator}/{currentPage.timeSignature.denominator}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPiano(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            <Piano className="w-4 h-4" />
            Piano
          </button>
          
          <button
            onClick={() => setActiveTool(activeTool === "line" ? "none" : "line")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 ${
              activeTool === "line"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <Minus className="w-4 h-4" />
            Line Tool
          </button>
          
          <button
            onClick={() => exportCurrentPageToPDF({ 
              id: "current", 
              title: "Current Project", 
              composer: "Unknown", 
              pages: [currentPage], 
              currentPageId: currentPage.id, 
              createdAt: new Date(), 
              updatedAt: new Date() 
            }, currentPage.id)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          
          <button
            onClick={onClearPage}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="p-6 overflow-auto">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="border border-gray-300 rounded-lg shadow-lg bg-white cursor-crosshair"
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
        />
      </div>

      {/* Text Editing Input */}
      {editingTextId && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-xl border-2 border-purple-500 z-10">
          <div className="flex items-center gap-2 mb-3">
            <Edit3 className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Edit Text</span>
          </div>
          <input
            type="text"
            value={textElements.find(el => el.id === editingTextId)?.text || ""}
            onChange={(e) => onUpdateTextElement(editingTextId, { text: e.target.value })}
            onBlur={() => setEditingTextId(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditingTextId(null)
              if (e.key === "Escape") setEditingTextId(null)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            placeholder="Enter text..."
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setEditingTextId(null)}
              className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Digital Piano Popup */}
      {showPiano && (
        <DigitalPiano
          onClose={() => setShowPiano(false)}
          pressedKeys={pressedKeys}
          onNotePlay={(note) => {
            const frequency = 440 * Math.pow(2, (note - 69) / 12)
            playNote(frequency)
          }}
          onRecordNote={(note) => {
            if (selectedNotation && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect()
              const x = 100 + (note - 60) * 30
              const y = 200
              placeNoteAtPosition(x, y)
            }
          }}
        />
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-sm max-w-md">
        <div className="font-medium mb-2">Instructions:</div>
        <div className="space-y-1 text-xs">
          <div>• Press keyboard keys (a-z, A-Z) to place selected notations</div>
          <div>• Click to place selected notation/articulation</div>
          <div>• Double-click text to edit, drag to move</div>
          <div>• Click elements to select, drag to move</div>
          <div>• Press Delete to remove selected elements</div>
          <div>• Use Line Tool to draw extendable lines</div>
          <div>• Connect MIDI keyboard for real-time input</div>
          <div>• Use Piano button for on-screen keyboard</div>
        </div>
      </div>
    </div>
  )
}

export default ScoreSheet