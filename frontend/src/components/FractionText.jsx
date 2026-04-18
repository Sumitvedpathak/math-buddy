/**
 * FractionText
 * Parses a string and renders any "a/b" patterns as proper stacked fractions
 * (numerator over denominator with a horizontal bar), matching the image notation.
 * All other text is rendered as-is.
 *
 * Handles:
 *   - Simple fractions:  "1/6"  → stacked
 *   - Mixed numbers:     "2 1/4" → "2" + stacked fraction
 *   - Fractions in sentences: "Add 1/2 and 3/4 together"
 */

const FRAC_RE = /(\d+\/\d+)/g

function StackedFraction({ numerator, denominator, fontSize = '0.82em' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        verticalAlign: 'middle',
        lineHeight: 1.1,
        margin: '0 3px',
        fontSize,
      }}
    >
      <span style={{ borderBottom: '1.5px solid currentColor', paddingBottom: '1px', paddingLeft: '2px', paddingRight: '2px' }}>
        {numerator}
      </span>
      <span style={{ paddingLeft: '2px', paddingRight: '2px' }}>
        {denominator}
      </span>
    </span>
  )
}

/**
 * @param {{ text: string, fontSize?: string }} props
 */
export default function FractionText({ text, fontSize }) {
  if (!text) return null

  const parts = text.split(FRAC_RE)

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^(\d+)\/(\d+)$/)
        if (match) {
          return (
            <StackedFraction
              key={i}
              numerator={match[1]}
              denominator={match[2]}
              fontSize={fontSize}
            />
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
