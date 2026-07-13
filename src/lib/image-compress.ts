/**
 * Client-side image compression utility.
 *
 * WHY THIS EXISTS:
 * Camera photos on modern phones are 3-10MB+ at full resolution. When
 * base64-encoded (~33% overhead) and sent as JSON to a Next.js API route,
 * the request body blows past the hosting platform's body-size limit
 * (Vercel serverless = 4.5MB on Hobby) → HTTP 413 Request Entity Too Large.
 *
 * Gallery/storage photos are usually already-compressed JPEGs (~100KB-1MB),
 * which is why "choose from storage" works but "take a photo" fails.
 *
 * THE FIX:
 * Resize the image down to a max dimension (1600px is plenty for an AI vision
 * model to read prescription text) and re-encode as JPEG at 0.85 quality.
 * A 5-10MB camera photo typically becomes ~200-500KB — well under the limit.
 *
 * This runs entirely in the browser via Canvas. No data leaves the device
 * until the compressed result is POSTed.
 */

export interface CompressedImage {
  base64: string
  mime: string
  /** Original file size in bytes. */
  originalSize: number
  /** Compressed size in bytes (base64 payload, excluding data-url prefix). */
  compressedSize: number
  /** Final width in pixels. */
  width: number
  /** Final height in pixels. */
  height: number
  /** Whether the image was actually resized/re-encoded (false = passed through). */
  wasCompressed: boolean
}

export interface CompressOptions {
  /** Max dimension (width or height) in pixels. Default 1600. */
  maxDimension?: number
  /** JPEG quality 0-1. Default 0.85. */
  quality?: number
  /**
   * If the original file is already under this many bytes AND is a JPEG/PNG,
   * skip canvas processing and pass through as-is. Default 800KB.
   * Set to 0 to always compress.
   */
  skipIfUnderBytes?: number
  /** Output mime. Default "image/jpeg". */
  outputMime?: string
}

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.85
const DEFAULT_SKIP_IF_UNDER = 800 * 1024 // 800KB

/**
 * Load a File/Blob into an HTMLImageElement.
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not decode the image. The file may be corrupted."))
    }
    // Important for EXIF orientation on some browsers.
    img.decoding = "async"
    img.src = url
  })
}

/**
 * Compute the target dimensions, preserving aspect ratio, so that the longest
 * side is <= maxDimension. Returns the original dimensions if already small.
 */
function computeTargetSize(
  srcW: number,
  srcH: number,
  maxDimension: number
): { width: number; height: number } {
  if (srcW <= 0 || srcH <= 0) return { width: srcW, height: srcH }
  const longest = Math.max(srcW, srcH)
  if (longest <= maxDimension) return { width: srcW, height: srcH }
  const scale = maxDimension / longest
  return {
    width: Math.round(srcW * scale),
    height: Math.round(srcH * scale),
  }
}

/**
 * Estimate the byte length of a base64 string (4 chars = 3 bytes).
 */
function base64ByteLength(b64: string): number {
  const len = b64.length
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

/**
 * Compress + resize an image File entirely in the browser.
 *
 * Returns base64 (no data-url prefix) + mime, plus diagnostics.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options.quality ?? DEFAULT_QUALITY
  const skipIfUnder = options.skipIfUnderBytes ?? DEFAULT_SKIP_IF_UNDER
  const outputMime = options.outputMime ?? "image/jpeg"

  if (!file.type.startsWith("image/")) {
    throw new Error("Please provide an image file (JPG, PNG, etc).")
  }

  const originalSize = file.size

  // If the file is already small enough AND is a web-friendly format, we can
  // still pass it through canvas to normalize orientation/mime, but we skip
  // only when explicitly JPEG/PNG AND under threshold to avoid surprises with
  // huge PNGs that happen to be under the byte threshold but decode large.
  const isWebFriendly = file.type === "image/jpeg" || file.type === "image/png"

  // Load the image to know its real dimensions.
  const img = await loadImage(file)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height

  const target = computeTargetSize(srcW, srcH, maxDimension)

  // Decide whether we can skip canvas entirely.
  const canSkip =
    isWebFriendly &&
    originalSize < skipIfUnder &&
    target.width === srcW &&
    target.height === srcH &&
    (outputMime === file.type || outputMime === "image/jpeg")

  if (canSkip && outputMime === file.type) {
    // Pass through: just convert to base64 without re-encoding.
    const base64 = await fileToBase64Raw(file)
    return {
      base64,
      mime: file.type,
      originalSize,
      compressedSize: base64ByteLength(base64),
      width: srcW,
      height: srcH,
      wasCompressed: false,
    }
  }

  // Draw onto a canvas at the target size and re-encode.
  const canvas = document.createElement("canvas")
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    // Canvas not available (very rare). Fall back to raw base64.
    const base64 = await fileToBase64Raw(file)
    return {
      base64,
      mime: file.type || outputMime,
      originalSize,
      compressedSize: base64ByteLength(base64),
      width: srcW,
      height: srcH,
      wasCompressed: false,
    }
  }

  // White background so transparent PNGs don't turn into black-on-black JPEGs.
  if (outputMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, target.width, target.height)
  }
  ctx.drawImage(img, 0, 0, target.width, target.height)

  const dataUrl = canvas.toDataURL(outputMime, quality)
  const commaIdx = dataUrl.indexOf(",")
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl

  return {
    base64,
    mime: outputMime,
    originalSize,
    compressedSize: base64ByteLength(base64),
    width: target.width,
    height: target.height,
    wasCompressed: true,
  }
}

/**
 * Plain base64 conversion (no compression) — used as a fallback / for the
 * skip path. Kept here so callers don't need a separate FileReader helper.
 */
export function fileToBase64Raw(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const commaIdx = result.indexOf(",")
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.onerror = () => reject(new Error("Failed to read the file."))
    reader.readAsDataURL(file)
  })
}

/**
 * Human-readable byte size, e.g. "1.4 MB".
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
