/**
 * AnimatedBackground
 * Renders fixed, pointer-events-none floating SVG shapes behind all page content.
 * Shapes use CSS keyframe animations (transform-only) for zero layout reflow.
 */

const SHAPES = [
  // Stars
  { id: 's1', cls: 'anim-float-a', delay: '0s',   top: '8%',  left: '6%',  color: '#facc15', size: 48, shape: 'star',   opacity: 0.55 },
  { id: 's2', cls: 'anim-float-b', delay: '1.5s', top: '14%', left: '87%', color: '#a78bfa', size: 36, shape: 'star',   opacity: 0.50 },
  { id: 's3', cls: 'anim-float-d', delay: '3.2s', top: '70%', left: '12%', color: '#facc15', size: 28, shape: 'star',   opacity: 0.45 },
  { id: 's4', cls: 'anim-float-c', delay: '0.8s', top: '78%', left: '80%', color: '#38bdf8', size: 40, shape: 'star',   opacity: 0.50 },

  // Plus signs
  { id: 'p1', cls: 'anim-float-b', delay: '2.4s', top: '30%', left: '3%',  color: '#4ade80', size: 40, shape: 'plus',   opacity: 0.50 },
  { id: 'p2', cls: 'anim-float-a', delay: '4.1s', top: '52%', left: '92%', color: '#a78bfa', size: 32, shape: 'plus',   opacity: 0.45 },
  { id: 'p3', cls: 'anim-float-c', delay: '1.0s', top: '88%', left: '45%', color: '#4ade80', size: 24, shape: 'plus',   opacity: 0.40 },

  // Circles (ring)
  { id: 'c1', cls: 'anim-float-d', delay: '0.3s', top: '42%', left: '1%',  color: '#38bdf8', size: 36, shape: 'circle', opacity: 0.45 },
  { id: 'c2', cls: 'anim-float-a', delay: '3.7s', top: '20%', left: '75%', color: '#facc15', size: 28, shape: 'circle', opacity: 0.40 },
  { id: 'c3', cls: 'anim-float-b', delay: '5.0s', top: '60%', left: '58%', color: '#a78bfa', size: 44, shape: 'circle', opacity: 0.35 },

  // Lightning bolts
  { id: 'l1', cls: 'anim-float-c', delay: '2.0s', top: '46%', left: '95%', color: '#facc15', size: 44, shape: 'bolt',   opacity: 0.50 },
  { id: 'l2', cls: 'anim-float-d', delay: '0.6s', top: '85%', left: '26%', color: '#38bdf8', size: 32, shape: 'bolt',   opacity: 0.45 },
]

function ShapeSvg({ shape, size, color }) {
  const s = size
  switch (shape) {
    case 'star':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      )
    case 'plus':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="2" width="4" height="20" rx="2" />
          <rect x="2" y="10" width="20" height="4" rx="2" />
        </svg>
      )
    case 'circle':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
    case 'bolt':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
          <polygon points="13,2 4,14 12,14 11,22 20,10 12,10" />
        </svg>
      )
    default:
      return null
  }
}

export default function AnimatedBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      {SHAPES.map(({ id, cls, delay, top, left, color, size, shape, opacity }) => (
        <div
          key={id}
          className={cls}
          style={{
            position: 'absolute',
            top,
            left,
            opacity,
            animationDelay: delay,
            filter: `drop-shadow(0 0 6px ${color}88)`,
          }}
        >
          <ShapeSvg shape={shape} size={size} color={color} />
        </div>
      ))}
    </div>
  )
}
