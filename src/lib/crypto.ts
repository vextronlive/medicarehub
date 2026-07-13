import crypto from "crypto"

const ALGO = "aes-256-cbc"
// In production this would come from env; for the sandbox we derive a stable key.
const SECRET =
  process.env.ENCRYPTION_KEY ||
  "z-ai-health-encryption-key-32bytes!!" // 32 bytes

const KEY = crypto.createHash("sha256").update(SECRET).digest()

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return iv.toString("hex") + ":" + encrypted
}

export function decrypt(payload: string): string {
  const [ivHex, data] = payload.split(":")
  if (!ivHex || !data) return ""
  const iv = Buffer.from(ivHex, "hex")
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv)
  let decrypted = decipher.update(data, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

// Hash a password using Node's built-in scrypt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const verify = crypto.scryptSync(password, salt, 64).toString("hex")
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verify, "hex"))
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function generateTokenNumber(sequence: number): string {
  // 6-digit number where the last 2-4 digits are chronological
  const prefix = Math.floor(100 + Math.random() * 900) // 3-digit random prefix
  const seqStr = String(sequence).padStart(3, "0")
  return `${prefix}${seqStr}`
}
