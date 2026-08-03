const fs = require("fs/promises")
const path = require("path")
const crypto = require("crypto")

const UPLOAD_DIR = path.join(__dirname, "..", "..", "static", "uploads")

/**
 * Raster formats only. SVG is deliberately not accepted: it can carry script
 * and is served from the same origin as the admin panel.
 */
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
}

const MAX_BYTES = 5 * 1024 * 1024

/** Magic-byte check so a renamed file can't sneak past the declared mime type. */
const sniffType = (buffer) => {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  const riff = buffer.subarray(0, 4).toString("ascii")
  if (riff === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp"
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp" && buffer.subarray(8, 12).toString("ascii").startsWith("avif")) {
    return "image/avif"
  }
  const gif = buffer.subarray(0, 6).toString("ascii")
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif"
  return null
}

const publicUrl = (filename) =>
  `${(process.env.BACKEND_URL || "http://127.0.0.1:9000").replace(/\/$/, "")}/static/uploads/${filename}`

/** Saves one uploaded buffer and returns its public URL. */
const saveImage = async (file) => {
  if (!file?.buffer?.length) {
    const error = new Error("Empty file.")
    error.status = 400
    throw error
  }
  if (file.buffer.length > MAX_BYTES) {
    const error = new Error(`"${file.originalname}" is larger than 5 MB.`)
    error.status = 400
    throw error
  }

  const type = sniffType(file.buffer)
  if (!type || !ALLOWED[type]) {
    const error = new Error(`"${file.originalname}" is not a supported image (JPG, PNG, WebP, AVIF or GIF).`)
    error.status = 400
    throw error
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  const filename = `${crypto.randomUUID()}.${ALLOWED[type]}`
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer)
  return publicUrl(filename)
}

/** Deletes an uploaded file by URL. Ignores anything outside the uploads dir. */
const deleteImage = async (url) => {
  const filename = path.basename(String(url || ""))
  const target = path.join(UPLOAD_DIR, filename)
  if (!target.startsWith(UPLOAD_DIR + path.sep)) return false
  try {
    await fs.unlink(target)
    return true
  } catch {
    return false
  }
}

module.exports = { saveImage, deleteImage, MAX_BYTES }
