/**
 * Static list of available practice topics.
 * To add a new topic: append a new object to this array.
 * No changes to session flow, question display, or evaluation logic are required.
 *
 * @type {Array<{id: string, displayName: string, enabled: boolean, emoji: string, description: string, gradient: string, glow: string}>}
 */
export const TOPICS = [
  {
    id: 'vedic_maths',
    displayName: 'Vedic Maths',
    enabled: true,
    emoji: '✖️',
    description: 'Ancient speed-maths tricks',
    gradient: 'linear-gradient(135deg, #2e1065 0%, #6d28d9 100%)',
    glow: 'rgba(109,40,217,0.6)',
  },
  {
    id: 'word_problems',
    displayName: 'Word Problems',
    enabled: true,
    emoji: '📖',
    description: 'Real-world maths stories',
    gradient: 'linear-gradient(135deg, #0c1a4a 0%, #0284c7 100%)',
    glow: 'rgba(2,132,199,0.6)',
  },
  {
    id: 'algebra',
    displayName: 'Algebra',
    enabled: true,
    emoji: '🔢',
    description: 'Equations & unknowns',
    gradient: 'linear-gradient(135deg, #052e16 0%, #16a34a 100%)',
    glow: 'rgba(22,163,74,0.6)',
  },
  {
    id: 'volumes',
    displayName: 'Volumes',
    enabled: true,
    emoji: '📦',
    description: '3D shapes & measurements',
    gradient: 'linear-gradient(135deg, #431407 0%, #ea580c 100%)',
    glow: 'rgba(234,88,12,0.6)',
  },
]
