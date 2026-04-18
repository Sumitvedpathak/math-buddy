import { useRef, useCallback } from 'react'
import { ReactSketchCanvas } from 'react-sketch-canvas'

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
          className="rounded-button px-3 py-1 text-xs font-bold transition hover:opacity-80 active:scale-95"
          style={{
            background: 'rgba(167,139,250,0.15)',
            color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.3)',
          }}
          aria-label="Clear canvas"
        >
          🧹 Clear
        </button>
      </div>
    </div>
  )
}
