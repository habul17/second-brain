/**
 * Checks which key points a spoken answer covered.
 * Speech-to-text is messy, so matching is forgiving: small words are ignored, word endings are
 * trimmed ("caching" = "cache"), digits match words ("2" = "two"), and one-letter typos pass.
 */

const STOP = new Set(
  "a an the of to in on for and or but is are was were be been being it its this that these those with as by at from into than then so if do does did can could will would should may might must you your i we they them their there here what which who whom how why when where not no yes very just also more most less such each every any all some only own same other about over under again once both few nor too out up down off".split(
    " ",
  ),
)

const NUMBERS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
  "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
}

function stem(word: string) {
  for (const suffix of ["ing", "ed", "es", "ly", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length)
  }
  return word
}

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/\*\*|`/g, "")
    .replace(/o\s*\(\s*n\s*(\^\s*2|²)\s*\)/g, " o n squared ")
    .replace(/o\s*\(\s*([a-z0-9 ]+)\s*\)/g, " o $1 ")
    .replace(/²/g, " squared ")
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => NUMBERS[w] ?? w)
}

const contentWords = (text: string) => {
  const all = tokens(text)
  const content = all.filter((w) => !STOP.has(w))
  return (content.length ? content : all).map(stem)
}

/** True when a and b differ by at most one letter (insert, delete or swap). */
function nearlySame(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** For each key point: did the answer cover it? (At least 60% of its meaningful words were said.) */
export function matchKeyPoints(answer: string, keyPoints: string[]) {
  const said = new Set(contentWords(answer))
  const saidList = [...said]
  const heard = (w: string) => said.has(w) || (w.length >= 4 && saidList.some((s) => s.length >= 4 && nearlySame(s, w)))
  return keyPoints.map((point) => {
    const words = [...new Set(contentWords(point))]
    if (!words.length) return false
    const hits = words.filter(heard).length
    return hits / words.length >= 0.6
  })
}

/** Rating suggested from how much was covered: 1 Forgot, 2 Shaky, 3 Nailed it. */
export function suggestRating(score: number): 1 | 2 | 3 {
  if (score >= 0.8) return 3
  if (score >= 0.45) return 2
  return 1
}

/** The **bold** words of a markdown text: what a specific question's answer must mention. */
export function boldWords(markdown: string) {
  return [...markdown.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim()).filter(Boolean)
}
