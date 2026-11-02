/**
 * Browser-side photo preparation. Drawing the photo onto a canvas and exporting it again
 * drops EXIF (including location), applies the camera's rotation, and shrinks the file.
 * Nothing here is uploaded or stored: pages live in memory until the Reader has read them.
 */

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.8

export const UNSUPPORTED_MESSAGE =
  "This photo type can't be opened on this device. Use the camera button, or save the photo as a JPEG and try again."

/** Decode a File into a canvas no larger than MAX_SIDE, with EXIF orientation applied. */
export async function fileToCanvas(file) {
  let bitmap
  try {
    bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(UNSUPPORTED_MESSAGE)
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas
}

/**
 * Apply rotation (0/90/180/270 clockwise) and edge trims (fractions 0..0.4) to a source canvas.
 * @returns {HTMLCanvasElement}
 */
export function renderPage(source, rotation = 0, trim = { top: 0, bottom: 0, left: 0, right: 0 }) {
  const sx = Math.round(source.width * trim.left)
  const sy = Math.round(source.height * trim.top)
  const sw = Math.max(1, Math.round(source.width * (1 - trim.left - trim.right)))
  const sh = Math.max(1, Math.round(source.height * (1 - trim.top - trim.bottom)))
  const turned = rotation % 180 !== 0
  const out = document.createElement('canvas')
  out.width = turned ? sh : sw
  out.height = turned ? sw : sh
  const ctx = out.getContext('2d')
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(source, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh)
  return out
}

export function canvasToDataUri(canvas) {
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
