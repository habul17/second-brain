"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

// The Web Speech API isn't in TypeScript's DOM types yet; this is the part we use.
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noop = () => () => {}

/**
 * Turns what you say into text, live, using the browser's speech recognition
 * (Chrome, Edge and Safari; not Firefox).
 */
export function useSpeechRecognition() {
  const supported = useSyncExternalStore(noop, () => getCtor() !== null, () => false)
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState("")
  const [interim, setInterim] = useState("")
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const wanted = useRef(false)

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    rec.current?.abort()
    const r = new Ctor()
    r.continuous = true
    r.interimResults = true
    r.lang = "en-US"
    r.onresult = (e) => {
      let done = ""
      let live = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) done += res[0].transcript + " "
        else live += res[0].transcript
      }
      if (done) setFinalText((t) => t + done)
      setInterim(live)
    }
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wanted.current = false
        setError("Microphone blocked. Allow it in the browser, or tick the points yourself.")
      } else if (e.error === "network") {
        setError("Voice needs an internet connection.")
      }
    }
    // Browsers stop listening after a pause; keep going until the user taps Stop.
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start()
          return
        } catch {}
      }
      setListening(false)
      setInterim("")
    }
    rec.current = r
    wanted.current = true
    setError(null)
    setListening(true)
    r.start()
  }, [])

  const stop = useCallback(() => {
    wanted.current = false
    rec.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    wanted.current = false
    rec.current?.abort()
    setListening(false)
    setFinalText("")
    setInterim("")
    setError(null)
  }, [])

  useEffect(
    () => () => {
      wanted.current = false
      rec.current?.abort()
    },
    [],
  )

  return { supported, listening, transcript: (finalText + interim).trim(), error, start, stop, reset }
}
