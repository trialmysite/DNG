export interface Notation {
  id: string
  name: string
  image: string
  alphabet: string
}

export const notations: Notation[] = [
  {
    id: "whole-note",
    name: "Whole Note",
    image: "/notations/whole-note.svg",
    alphabet: "a",
  },
  {
    id: "half-note",
    name: "Half Note",
    image: "/notations/half-note.svg",
    alphabet: "s",
  },
  {
    id: "quarter-note",
    name: "Quarter Note",
    image: "/notations/quarter-note.svg",
    alphabet: "d",
  },
  {
    id: "eighth-note",
    name: "Eighth Note",
    image: "/notations/eighth-note.svg",
    alphabet: "f",
  },
  {
    id: "sixteenth-note",
    name: "Sixteenth Note",
    image: "/notations/sixteenth-note.svg",
    alphabet: "g",
  },
  {
    id: "thirtysecond-note",
    name: "Thirty-Second Note",
    image: "/notations/thirtysecond-note.svg",
    alphabet: "h",
  },
  {
    id: "sharp",
    name: "Sharp",
    image: "/notations/sharp.svg",
    alphabet: "j",
  },
  {
    id: "flat",
    name: "Flat",
    image: "/notations/flat.svg",
    alphabet: "k",
  },
  {
    id: "natural",
    name: "Natural",
    image: "/notations/natural.svg",
    alphabet: "l",
  },
  {
    id: "treble-clef",
    name: "Treble Clef",
    image: "/notations/treble-clef.svg",
    alphabet: "z",
  },
  {
    id: "bass-clef",
    name: "Bass Clef",
    image: "/notations/bass-clef.svg",
    alphabet: "x",
  },
  {
    id: "c-major",
    name: "C Major",
    image: "/notations/c-major.svg",
    alphabet: "c",
  },
  {
    id: "g-major",
    name: "G Major",
    image: "/notations/g-major.svg",
    alphabet: "v",
  },
  {
    id: "d-major",
    name: "D Major",
    image: "/notations/d-major.svg",
    alphabet: "b",
  },
  {
    id: "a-major",
    name: "A Major",
    image: "/notations/a-major.svg",
    alphabet: "n",
  },
  {
    id: "e-major",
    name: "E Major",
    image: "/notations/e-major.svg",
    alphabet: "m",
  },
  {
    id: "whole-note-upper",
    name: "Whole Note Upper",
    image: "/notations/whole-note.svg",
    alphabet: "A",
  },
  {
    id: "half-note-upper",
    name: "Half Note Upper",
    image: "/notations/half-note.svg",
    alphabet: "S",
  },
  {
    id: "quarter-note-upper",
    name: "Quarter Note Upper",
    image: "/notations/quarter-note.svg",
    alphabet: "D",
  },
  {
    id: "eighth-note-upper",
    name: "Eighth Note Upper",
    image: "/notations/eighth-note.svg",
    alphabet: "F",
  },
  {
    id: "sixteenth-note-upper",
    name: "Sixteenth Note Upper",
    image: "/notations/sixteenth-note.svg",
    alphabet: "G",
  },
  {
    id: "thirtysecond-note-upper",
    name: "Thirty-Second Note Upper",
    image: "/notations/thirtysecond-note.svg",
    alphabet: "H",
  },
  {
    id: "sharp-upper",
    name: "Sharp Upper",
    image: "/notations/sharp.svg",
    alphabet: "J",
  },
  {
    id: "flat-upper",
    name: "Flat Upper",
    image: "/notations/flat.svg",
    alphabet: "K",
  },
  {
    id: "natural-upper",
    name: "Natural Upper",
    image: "/notations/natural.svg",
    alphabet: "L",
  },
  {
    id: "treble-clef-upper",
    name: "Treble Clef Upper",
    image: "/notations/treble-clef.svg",
    alphabet: "Z",
  },
  {
    id: "bass-clef-upper",
    name: "Bass Clef Upper",
    image: "/notations/bass-clef.svg",
    alphabet: "X",
  },
  {
    id: "c-major-upper",
    name: "C Major Upper",
    image: "/notations/c-major.svg",
    alphabet: "C",
  },
  {
    id: "g-major-upper",
    name: "G Major Upper",
    image: "/notations/g-major.svg",
    alphabet: "V",
  },
  {
    id: "d-major-upper",
    name: "D Major Upper",
    image: "/notations/d-major.svg",
    alphabet: "B",
  },
  {
    id: "a-major-upper",
    name: "A Major Upper",
    image: "/notations/a-major.svg",
    alphabet: "N",
  },
  {
    id: "e-major-upper",
    name: "E Major Upper",
    image: "/notations/e-major.svg",
    alphabet: "M",
  },
]

export const getLowercaseNotations = () => {
  return notations.filter((notation) => notation.alphabet >= "a" && notation.alphabet <= "z")
}

export const getUppercaseNotations = () => {
  return notations.filter((notation) => notation.alphabet >= "A" && notation.alphabet <= "Z")
}

export const getNotationByKey = (key: string): Notation | undefined => {
  return notations.find((notation) => notation.alphabet === key)
}
