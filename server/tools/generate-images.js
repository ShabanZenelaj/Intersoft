/**
 * Generates SVG placeholder images for the demo catalog into backend/static,
 * which Medusa serves at http://localhost:9000/static/*.
 *
 * Run from backend/:  node tools/generate-images.js
 */
const fs = require("fs")
const path = require("path")
const { PRODUCTS, flattenCategories } = require("../src/seed-data.js")

const STATIC_DIR = path.join(__dirname, "..", "static")

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[ch]))

const wrapTitle = (title, maxChars = 22) => {
  const words = title.split(" ")
  const lines = [""]
  for (const word of words) {
    const current = lines[lines.length - 1]
    if ((current + " " + word).trim().length > maxChars && current) {
      lines.push(word)
    } else {
      lines[lines.length - 1] = (current + " " + word).trim()
    }
  }
  return lines.slice(0, 3)
}

const productSvg = ({ title, icon, palette, variantShift = 0 }) => {
  const [c1, c2] = palette
  const lines = wrapTitle(title)
  const titleText = lines
    .map(
      (line, index) =>
        `<text x="400" y="${620 + index * 44}" text-anchor="middle" font-family="-apple-system, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="600" fill="rgba(255,255,255,0.92)">${escapeXml(line)}</text>`
    )
    .join("\n  ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="${38 + variantShift}%" r="45%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.16)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#glow)"/>
  <g stroke="rgba(255,255,255,0.06)" stroke-width="1">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 80}" y1="0" x2="${(i + 1) * 80}" y2="800"/>`).join("")}
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${(i + 1) * 80}" x2="800" y2="${(i + 1) * 80}"/>`).join("")}
  </g>
  <text x="400" y="${400 + variantShift * 4}" text-anchor="middle" font-size="220" dominant-baseline="middle">${icon}</text>
  ${titleText}
  <text x="400" y="756" text-anchor="middle" font-family="-apple-system, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" letter-spacing="6" fill="rgba(255,255,255,0.45)">INTERSOFT</text>
</svg>
`
}

const categorySvg = ({ name, icon, palette }) => {
  const [c1, c2] = palette
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="30%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <rect width="1200" height="900" fill="url(#glow)"/>
  <g stroke="rgba(255,255,255,0.05)" stroke-width="1">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${(i + 1) * 100}" y1="0" x2="${(i + 1) * 100}" y2="900"/>`).join("")}
    ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${(i + 1) * 100}" x2="1200" y2="${(i + 1) * 100}"/>`).join("")}
  </g>
  <text x="600" y="420" text-anchor="middle" font-size="280" dominant-baseline="middle">${icon}</text>
  <text x="600" y="850" text-anchor="middle" font-family="-apple-system, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="700" letter-spacing="8" fill="rgba(255,255,255,0.4)">INTERSOFT</text>
</svg>
`
}

const categories = flattenCategories()
const paletteByCategory = new Map(categories.map((cat) => [cat.handle, cat.palette]))

fs.mkdirSync(path.join(STATIC_DIR, "products"), { recursive: true })
fs.mkdirSync(path.join(STATIC_DIR, "categories"), { recursive: true })

for (const product of PRODUCTS) {
  const palette = paletteByCategory.get(product.category) || ["#1e293b", "#334155"]
  fs.writeFileSync(
    path.join(STATIC_DIR, "products", `${product.handle}.svg`),
    productSvg({ title: product.title, icon: product.icon, palette })
  )
  fs.writeFileSync(
    path.join(STATIC_DIR, "products", `${product.handle}-2.svg`),
    productSvg({ title: product.title, icon: product.icon, palette: [...palette].reverse(), variantShift: 14 })
  )
}

for (const category of categories) {
  fs.writeFileSync(path.join(STATIC_DIR, "categories", `${category.handle}.svg`), categorySvg(category))
}

console.log(`Generated ${PRODUCTS.length * 2} product images and ${categories.length} category images in ${STATIC_DIR}`)
