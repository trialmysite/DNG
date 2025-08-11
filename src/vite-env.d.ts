/// <reference types="vite/client" />

// MIDI API types
declare global {
  interface Navigator {
    requestMIDIAccess(): Promise<WebMidi.MIDIAccess>
  }
}

declare namespace WebMidi {
  interface MIDIAccess {
    inputs: MIDIInputMap
    outputs: MIDIOutputMap
  }

  interface MIDIInputMap extends Map<string, MIDIInput> {
    forEach(callback: (input: MIDIInput) => void): void
  }

  interface MIDIOutputMap extends Map<string, MIDIOutput> {
    forEach(callback: (output: MIDIOutput) => void): void
  }

  interface MIDIInput {
    onmidimessage: ((event: MIDIMessageEvent) => void) | null
  }

  interface MIDIOutput {
    send(data: Uint8Array): void
  }

  interface MIDIMessageEvent {
    data: Uint8Array
  }
}

export {}