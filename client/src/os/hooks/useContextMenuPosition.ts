import { useEffect, useRef, useState } from 'react'

/**
 * Hook to position a context menu near the cursor while clamping it inside the viewport.
 * Handles late measurement after mount to avoid initial flicker and ensures padding from edges.
 */
export function useContextMenuPosition(x: number, y: number, padding: number = 8) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useEffect(() => {
    setPos({ left: x, top: y })
    const frame = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const { offsetWidth, offsetHeight } = el
      let nextLeft = x
      let nextTop = y
      if (nextLeft + offsetWidth + padding > window.innerWidth) {
        nextLeft = Math.max(padding, window.innerWidth - offsetWidth - padding)
      }
      if (nextTop + offsetHeight + padding > window.innerHeight) {
        nextTop = Math.max(padding, window.innerHeight - offsetHeight - padding)
      }
      if (nextLeft < padding) nextLeft = padding
      if (nextTop < padding) nextTop = padding
      setPos({ left: nextLeft, top: nextTop })
    })
    return () => cancelAnimationFrame(frame)
  }, [x, y, padding])

  return { ref, pos }
}
