import { useRef, useCallback } from 'react'
import { ReactSketchCanvas } from 'react-sketch-canvas'

/**
 * SketchCanvas — SVG-backed freehand drawing surface.
 * Uses ResizeObserver to handle layout changes while preserving strokes
 * via exportPaths / loadPaths round-trip.
 *
 * @param {Object} props
 * @param {string} props.questionId - Unique question ID (used as a key)
 * @param {(dataUrl: string) => void} props.onExport - Called with base64 image when strokes change
 * @param {string} [props.className]
 */
export default function SketchCanvas({ questionId, onExport, className = '' }) {
  const canvasRef = useRef(null)

  const handleClear = useCallback(async () => {
    if (canvasRef.current) {
      await canvasRef.current.clearCanvas()
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

  return (
    <div className={`relative w-full ${className}`}>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-card border-2 border-primary/30 bg-white">
        <ReactSketchCanvas
          ref={canvasRef}
          key={questionId}
          strokeWidth={3}
          strokeColor="#1e293b"
          backgroundImage=""
          exportWithBackgroundImage={false}
          style={{ width: '100%', height: '100%' }}
          aria-label="Drawing canvas for your answer"
          onStroke={handleStroke}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleClear}
          className="rounded-button bg-surface px-3 py-1 text-sm font-medium text-text-secondary shadow-sm hover:bg-primary/10 active:scale-95 transition"
          aria-label="Clear canvas"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
