export interface Notation {
  id: string
  name: string
  alphabet: string // keyboard key to press
  image: string
}

// All available notations with their keyboard mappings
export const notations: Notation[] = [
  // Lowercase letters
  { id: "note-a", name: "Note 1", alphabet: "a", image: "Notes/aa.png" },
  { id: "note-b", name: "Note 2", alphabet: "b", image: "Notes/bb.png" },
  { id: "note-c", name: "Note 3", alphabet: "c", image: "Notes/cc.png" },
  { id: "note-d", name: "Note 4", alphabet: "d", image: "Notes/dd.png" },
  { id: "note-e", name: "Note 5", alphabet: "e", image: "Notes/ee.png" },
  { id: "note-f", name: "Note 6", alphabet: "f", image: "Notes/ff.png" },
  { id: "note-g", name: "Note 7", alphabet: "g", image: "Notes/gg.png" },
  { id: "note-h", name: "Note 8", alphabet: "h", image: "Notes/hh.png" },
  { id: "note-i", name: "Note 9", alphabet: "i", image: "Notes/ii.png" },
  { id: "note-j", name: "Note 10", alphabet: "j", image: "Notes/jj.png" },
  { id: "note-k", name: "Note 11", alphabet: "k", image: "Notes/kk.png" },
  { id: "note-l", name: "Note 12", alphabet: "l", image: "Notes/ll.png" },
  { id: "note-m", name: "Note 13", alphabet: "m", image: "Notes/mm.png" },
  { id: "note-n", name: "Note 14", alphabet: "n", image: "Notes/nn.png" },
  { id: "note-o", name: "Note 15", alphabet: "o", image: "Notes/oo.png" },
  { id: "note-p", name: "Note 16", alphabet: "p", image: "Notes/pp.png" },
  { id: "note-q", name: "Note 17", alphabet: "q", image: "Notes/qq.png" },
  { id: "note-r", name: "Note 18", alphabet: "r", image: "Notes/rr.png" },
  { id: "note-s", name: "Note 19", alphabet: "s", image: "Notes/ss.png" },
  { id: "note-t", name: "Note 20", alphabet: "t", image: "Notes/tt.png" },
  { id: "note-u", name: "Note 21", alphabet: "u", image: "Notes/uu.png" },
  { id: "note-v", name: "Note 22", alphabet: "v", image: "Notes/vv.png" },
  { id: "note-w", name: "Note 23", alphabet: "w", image: "Notes/ww.png" },
  { id: "note-x", name: "Note 24", alphabet: "x", image: "Notes/xx.png" },
  { id: "note-y", name: "Note 25", alphabet: "y", image: "Notes/yy.png" },
  { id: "note-z", name: "Note 26", alphabet: "z", image: "Notes/zz.png" },

  // Uppercase letters - different notations
  // Uppercase letters
  { id: "note-A", name: "Note 27", alphabet: "A", image: "Notes/A.png" },
  { id: "note-B", name: "Note 28", alphabet: "B", image: "Notes/B.png" },
  { id: "note-C", name: "Note 29", alphabet: "C", image: "Notes/C.png" },
  { id: "note-D", name: "Note 30", alphabet: "D", image: "Notes/D.png" },
  { id: "note-E", name: "Note 31", alphabet: "E", image: "Notes/E.png" },
  { id: "note-F", name: "Note 32", alphabet: "F", image: "Notes/F.png" },
  { id: "note-G", name: "Note 33", alphabet: "G", image: "Notes/G.png" },
  { id: "note-H", name: "Note 34", alphabet: "H", image: "Notes/H.png" },
  { id: "note-I", name: "Note 35", alphabet: "I", image: "Notes/I.png" },
  { id: "note-J", name: "Note 36", alphabet: "J", image: "Notes/J.png" },
  { id: "note-K", name: "Note 37", alphabet: "K", image: "Notes/K.png" },
  { id: "note-L", name: "Note 38", alphabet: "L", image: "Notes/L.png" },
  { id: "note-M", name: "Note 39", alphabet: "M", image: "Notes/M.png" },
  { id: "note-N", name: "Note 40", alphabet: "N", image: "Notes/N.png" },
  { id: "note-O", name: "Note 41", alphabet: "O", image: "Notes/O.png" },
  { id: "note-P", name: "Note 42", alphabet: "P", image: "Notes/P.png" },
  { id: "note-Q", name: "Note 43", alphabet: "Q", image: "Notes/Q.png" },
  { id: "note-R", name: "Note 44", alphabet: "R", image: "Notes/R.png" },
  { id: "note-S", name: "Note 45", alphabet: "S", image: "Notes/S.png" },
]

// Create keyboard mapping for quick lookup
export const keyboardMapping: { [key: string]: Notation } = {}
notations.forEach((notation) => {
  keyboardMapping[notation.alphabet] = notation
})

// Helper function to get notation by keyboard key
export const getNotationByKey = (key: string): Notation | null => {
  return keyboardMapping[key] || null
}

// Helper function to get all notations for a specific case
export const getLowercaseNotations = (): Notation[] => {
  return notations.filter((notation) => notation.alphabet >= "a" && notation.alphabet <= "z")
}

export const getUppercaseNotations = (): Notation[] => {
  return notations.filter((notation) => notation.alphabet >= "A" && notation.alphabet <= "Z")
}
