/**
 * Static list of available practice topics.
 * To add a new topic: append a new object to this array.
 * No changes to session flow, question display, or evaluation logic are required.
 *
 * @type {Array<{id: string, displayName: string, enabled: boolean}>}
 */
export const TOPICS = [
  { id: 'vedic_maths', displayName: 'Vedic Maths', enabled: true },
  { id: 'word_problems', displayName: 'Word Problems', enabled: true },
  { id: 'algebra', displayName: 'Algebra', enabled: true },
  { id: 'volumes', displayName: 'Volumes', enabled: true },
]
