"use client"

import { useEffect, useRef } from "react"
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"

// Same black-and-white colors as the read-only code blocks (the --sh-* vars in globals.css).
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.modifier], fontWeight: "700" },
  { tag: t.comment, color: "var(--sh-comment)", fontStyle: "italic" },
  { tag: [t.string, t.character], color: "var(--sh-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--sh-property)" },
  { tag: [t.processingInstruction, t.meta], color: "var(--muted-foreground)" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--sh-sign)" },
])

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--foreground)", fontSize: "0.86rem" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7", fontVariantLigatures: "none" },
  ".cm-content, .cm-gutter": { minHeight: "var(--min-h)" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--foreground)" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--muted-foreground)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 12px" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--muted) 70%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--foreground) 18%, transparent)",
  },
  "&.cm-focused .cm-matchingBracket": { backgroundColor: "color-mix(in oklab, var(--foreground) 15%, transparent)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
})

/** CodeMirror with C++ colors, line numbers, auto-indent and bracket closing. Loaded only on the client. */
export default function CppEditor({
  value,
  onChange,
  placeholder: hint,
  label,
}: {
  value: string
  onChange: (code: string) => void
  placeholder?: string
  label?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          // 4 spaces, like LeetCode and the saved starter code.
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          // Tab indents (like LeetCode). Esc then Tab still leaves the editor.
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          cpp(),
          syntaxHighlighting(highlight),
          theme,
          ...(hint ? [placeholder(hint)] : []),
          EditorView.contentAttributes.of(label ? { "aria-label": label } : {}),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => editor.destroy()
    // Built once; later value changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Outside changes (e.g. the note reloads) replace the text.
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={host} />
}
