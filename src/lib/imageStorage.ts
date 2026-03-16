import { get, set } from 'idb-keyval'

const IDB_PREFIX = 'idb://'
// A simple in-memory cache to avoid repeatedly converting the same Blob to an Object URL
const objectUrlCache = new Map<string, string>()

/**
 * Saves a File or Blob to IndexedDB and returns a custom URI string.
 */
export async function saveLocalImage(file: File | Blob): Promise<string> {
  // Generate a unique ID (e.g. UUID but simplified here)
  const id = crypto.randomUUID()
  const uri = `${IDB_PREFIX}${id}`
  
  await set(id, file)
  
  // Pre-warm the cache so immediate render is synchronous
  objectUrlCache.set(uri, URL.createObjectURL(file))
  
  return uri
}

/**
 * Given a URI, if it's an IndexedDB URI, fetches the Blob and returns an Object URL.
 * If it's a regular http/https URL, it just returns it as-is.
 */
export async function getLocalImageUrl(uri: string): Promise<string> {
  if (!uri.startsWith(IDB_PREFIX)) {
    return uri
  }
  
  if (objectUrlCache.has(uri)) {
    return objectUrlCache.get(uri)!
  }

  const id = uri.slice(IDB_PREFIX.length)
  const blob = await get<Blob>(id)
  
  if (!blob) {
    console.warn(`Local image not found in IndexedDB: ${id}`)
    return uri // Return original broken uri as fallback
  }

  const objectUrl = URL.createObjectURL(blob)
  objectUrlCache.set(uri, objectUrl)
  
  return objectUrl
}

/**
 * Helper to check if a URI points to IndexedDB
 */
export function isLocalImage(uri: string): boolean {
  return uri.startsWith(IDB_PREFIX)
}

/**
 * Resolves an image URL naturally to return its intrinsic dimensions.
 */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

/**
 * Calculates responsive width and height bounds fitting inside a max bounding box
 * while cleanly maintaining the intrinsic natural aspect ratio.
 */
export function calculateFitDimensions(width: number, height: number, maxWidth = 800, maxHeight = 600) {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height)
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}
