"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

const noop = () => () => {}
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window

/** Reads text aloud with the browser's built-in voice. */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  // false on the server, the real answer in the browser.
  const canSpeak = useSyncExternalStore(noop, supported, () => false)

  useEffect(
    () => () => {
      if (supported()) window.speechSynthesis.cancel()
    },
    [],
  )

  const speak = useCallback((text: string) => {
    if (!supported()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if (supported()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { supported: canSpeak, speaking, speak, stop }
}
