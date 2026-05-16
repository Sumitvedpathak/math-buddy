import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { ReactSketchCanvas } from 'react-sketch-canvas'

/** Tiny pencil / eraser pointers for the sketch surface (hotspot then CSS fallback). */
const CURSOR_PENCIL = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#1e293b" stroke="#fff" stroke-width="1" d="M12 2l6 6-9 9H3v-6l9-9z"/><path fill="#facc15" d="M11 3l1 1-7 7H4V9l7-7z"/></svg>'
)}") 3 17, crosshair`

const CURSOR_ERASER = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="7" rx="1" fill="#fda4af" stroke="#9f1239" stroke-width="0.75" transform="rotate(-18 10 12.5)"/><rect x="6" y="6" width="9" height="4" rx="0.5" fill="#fecdd3" transform="rotate(-18 10 12.5)"/></svg>'
)}") 10 15, crosshair`

/**
 * SketchCanvas — SVG-backed freehand drawing surface.
 * aspect-[5/2] gives ~40% less height than 4/3 while filling full card width.
 *
 * @param {Object} props
 * @param {string} props.questionId - Unique question ID (used as a key)
 * @param {(dataUrl: string) => void} props.onExport - Called with base64 image when strokes change
 * @param {string} [props.className]
 */
export default function SketchCanvas({ questionId, onExport, className = '' }) {
  const canvasRef = useRef(null)
  const [tool, setTool] = useState('draw')

  /** Unique SVG root id so masks/refs don't collide when multiple questions are on one page. */
  const sketchSvgId = useMemo(
    () => `sketch-${String(questionId).replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    [questionId]
  )

  useEffect(() => {
    canvasRef.current?.eraseMode(tool === 'erase')
  }, [tool, questionId])

  const handleClear = useCallback(async () => {
    if (canvasRef.current) {
      await canvasRef.current.clearCanvas()
      canvasRef.current.eraseMode(false)
      setTool('draw')
      if (onExport) onExport('')
    }
  }, [onExport])

  const handleStroke = useCallback(async () => {
    if (!canvasRef.current || !onExport) return
    try {
      const dataUrl = await canvasRef.current.exportImage('png')
      onExport(dataUrl)
    } catch {
      // canvas not yet ready
    }
  }, [onExport])

  const inactiveToolStyle = {
    background: 'rgba(167,139,250,0.15)',
    color: '#a78bfa',
    border: '1px solid rgba(167,139,250,0.3)',
  }
  const activeToolStyle = {
    background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
    color: 'white',
    border: '1px solid rgba(167,139,250,0.5)',
    boxShadow: '0 0 10px rgba(167,139,250,0.4)',
  }

  return (
    <div className={`relative w-full ${className}`}>
      {/* aspect-[5/2]: ~40% shorter than 4/3, full card width */}
      <div
        className="aspect-[5/2] w-full overflow-hidden rounded-card"
        style={{
          border: '2px solid rgba(167,139,250,0.4)',
          background: '#f8f7ff',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <ReactSketchCanvas
          ref={canvasRef}
          key={questionId}
          id={sketchSvgId}
          strokeWidth={3}
          strokeColor="#1e293b"
          backgroundImage=""
          exportWithBackgroundImage={false}
          style={{
            width: '100%',
            height: '100%',
            cursor: tool === 'erase' ? CURSOR_ERASER : CURSOR_PENCIL,
          }}
          aria-label="Drawing canvas for your answer"
          onStroke={handleStroke}
        />
      </div>
      <div
        className="mt-2 flex flex-wrap items-center justify-end gap-2"
        role="group"
        aria-label="Canvas actions"
      >
        <button
          type="button"
          onClick={() => setTool('draw')}
          aria-pressed={tool === 'draw'}
          className="rounded-button px-3 py-1 text-xs font-bold transition hover:opacity-80 active:scale-95"
          style={tool === 'draw' ? activeToolStyle : inactiveToolStyle}
          aria-label="Draw with pen"
        >
          ✏️ Draw
        </button>
        <button
          type="button"
          onClick={() => setTool('erase')}
          aria-pressed={tool === 'erase'}
          className="rounded-button px-3 py-1 text-xs font-bold transition hover:opacity-80 active:scale-95"
          style={tool === 'erase' ? activeToolStyle : inactiveToolStyle}
          aria-label="Erase part of sketch"
        >
          🧽 Eraser
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-button px-3 py-1 text-xs font-bold transition hover:opacity-80 active:scale-95"
          style={inactiveToolStyle}
          aria-label="Clear canvas"
        >
          🧹 Clear
        </button>
      </div>
    </div>
  )
}
