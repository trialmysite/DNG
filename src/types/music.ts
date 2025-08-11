export interface Note {
  id: string
  name: string
  value: number
  symbol: string
  frequency: number
  pitch: string
  image: string
  octave?: number
}

export interface PlacedNote {
  id: string
  note: Note
  x: number
  y: number
  staffLine: number
  accidental?: "sharp" | "flat" | "natural"
  octave: number
}

export interface ScorePage {
  id: string
  title: string
  notes: PlacedNote[]
  timeSignature: {
    numerator: number
    denominator: number
  }
  keySignature: string
  tempo: number
  createdAt: Date
}

export interface ScoreProject {
  id: string
  title: string
  composer: string
  description?: string
  pages: ScorePage[]
  currentPageId: string
  createdAt: Date
  updatedAt: Date
}

export interface ProjectSummary {
  id: string
  title: string
  composer: string
  description?: string
  pageCount: number
  noteCount: number
  createdAt: Date
  updatedAt: Date
  projectType?: "DNG" | "DNR"
}