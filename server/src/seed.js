require("dotenv").config()
const { pool, query, tx } = require("./db")
const { hashPassword } = require("./lib/auth")
const { CATEGORIES, PRODUCTS, flattenCategories } = require("./seed-data")

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:9000"

// A few Albanian translations to demonstrate the metadata-based product i18n.
const ALBANIAN = {
  "titan-gaming-pc": {
    title_sq: "Titan PC Gaming",
    description_sq:
      "Konfigurimi ynë më i shitur për lojëra: Ryzen 7 7800X3D, GeForce RTX 4070, 32GB DDR5-6000 dhe SSD NVMe 1TB Gen4. I montuar, i testuar dhe gati për të luajtur.",
  },
  "apex-gaming-laptop-15": {
    title_sq: "Laptop Gaming Apex 15",
    description_sq:
      'Laptop gaming 15.6" QHD 165Hz me Intel Core i7-13700H dhe GeForce RTX 4060. Tastierë RGB, SSD NVMe 1TB dhe ftohje e avancuar.',
  },
  "geforce-rtx-4070-12gb": {
    title_sq: "GeForce RTX 4070 12GB",
    description_sq:
      "Performancë e shkëlqyer në 1440p me 12GB GDDR6X, DLSS 3 dhe konsum shumë i ulët energjie. Dizajn me tre ventilatorë.",
  },
  "980-pro-nvme-ssd": {
    title_sq: "SSD NVMe 980 PRO",
    description_sq:
      "Shpejtësi PCIe 4.0 deri në 7000 MB/s me 5 vjet garanci. Ideal si disk sistemi ose për bibliotekën e lojërave.",
  },
}

// Albanian is the storefront's primary language; category names live in metadata.
const CATEGORY_NAMES_SQ = {
  laptops: "Laptopë",
  "desktop-pcs": "PC Desktop",
  components: "Komponentë",
  processors: "Procesorë",
  "graphics-cards": "Karta Grafike",
  motherboards: "Pllaka Amë",
  memory: "Memorie (RAM)",
  storage: "Ruajtje (SSD/HDD)",
  "power-supplies": "Furnizues Energjie",
  "pc-cases": "Kasa PC",
  cooling: "Ftohje",
  peripherals: "Periferikë",
  monitors: "Monitorë",
  keyboards: "Tastiera",
  mice: "Mausë",
  headsets: "Kufje",
  webcams: "Kamera Web",
  networking: "Rrjeti",
  accessories: "Aksesorë",
}

const seed = async () => {
  const { rows: existing } = await query("select 1 from products limit 1")
  if (existing.length) {
    console.log("Products already exist — seed is meant for a fresh database. Aborting.")
    return
  }

  // Everything below runs as one transaction on a single connection, so a
  // failure part-way leaves the database untouched rather than half-seeded.
  // `query` is shadowed to that connection — the pool's own query would take a
  // different connection and escape the transaction.
  await tx(async (client) => {
    const query = (text, params) => client.query(text, params)

    console.log("Seeding admin user...")
    // The demo credentials are published in this repository, so they are only
    // ever used on a local machine. Any deployment anyone else can reach must
    // supply its own — see SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD below.
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@intersoft-rks.com"
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "supersecret"
    const { rows: admins } = await query("select 1 from admins where email = $1", [adminEmail])
    if (!admins.length) {
      await query("insert into admins (email, password_hash, name) values ($1, $2, $3)", [
        adminEmail,
        await hashPassword(adminPassword),
        "Intersoft Admin",
      ])
    }

    console.log("Seeding shipping methods & promotion...")
    const { rows: methods } = await query(
      `insert into shipping_methods (name, name_sq, description, description_sq, price, sort_order) values
       ('Standard Delivery', 'Dërgesë Standarde', 'Delivered in 2-4 business days.', 'Dorëzohet për 2-4 ditë pune.', 2.99, 0),
       ('Express Delivery', 'Dërgesë Ekspres', 'Delivered in 24 hours.', 'Dorëzohet brenda 24 orëve.', 6.99, 1),
       ('Bulky Item Delivery', 'Dërgesë për Artikuj Voluminozë', 'Large items, delivered in 3-5 business days.', 'Artikuj të mëdhenj, dorëzohen për 3-5 ditë pune.', 9.99, 2)
       returning id, name`
    )
    const methodIdByName = new Map(methods.map((method) => [method.name, method.id]))
    // `promotions` was renamed to `campaigns` in migration 006, and campaigns
    // carry a name and a handle because they have a public catalogue page.
    await query(
      `insert into campaigns (code, name, handle, type, value)
       values ('WELCOME10', 'Welcome 10%', 'welcome10', 'percentage', 10)
       on conflict do nothing`
    )

    const { rows: saleList } = await query(
      "insert into price_lists (name, type) values ('Sale', 'sale') returning id"
    )
    const salePriceListId = saleList[0].id

    // Intersoft resells: each supplier ships with its own courier arrangement,
    // so the shipping option lives on the product (inherited from the supplier).
    console.log("Seeding suppliers...")
    const SUPPLIERS = [
      {
        name: "TechnoTrade Sh.p.k.",
        email: "orders@technotrade.al",
        phone: "+355 4 222 3344",
        method: "Standard Delivery",
        categories: ["laptops", "components", "processors", "graphics-cards", "motherboards", "memory",
                     "storage", "power-supplies", "cooling", "networking", "accessories"],
      },
      {
        name: "Adriatik Bulk Logistics",
        email: "sales@adriatikbulk.com",
        phone: "+355 4 555 1122",
        method: "Bulky Item Delivery",
        categories: ["desktop-pcs", "monitors", "pc-cases"],
      },
      {
        name: "Fast Peripherals EU",
        email: "b2b@fastperipherals.eu",
        phone: "+389 2 300 4455",
        method: "Express Delivery",
        categories: ["peripherals", "keyboards", "mice", "headsets", "webcams"],
      },
    ]

    const supplierByCategory = new Map()
    const methodByCategory = new Map()
    for (const supplier of SUPPLIERS) {
      const methodId = methodIdByName.get(supplier.method)
      const { rows } = await query(
        "insert into suppliers (name, email, phone, shipping_method_id) values ($1,$2,$3,$4) returning id",
        [supplier.name, supplier.email, supplier.phone, methodId]
      )
      for (const handle of supplier.categories) {
        supplierByCategory.set(handle, rows[0].id)
        methodByCategory.set(handle, methodId)
      }
    }

    console.log("Seeding categories...")
    const categoryIdByHandle = new Map()
    for (const cat of flattenCategories()) {
      const { rows } = await query(
        `insert into categories (name, handle, description, parent_id, image_url, metadata)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [
          cat.name,
          cat.handle,
          cat.description || "",
          cat.parentHandle ? categoryIdByHandle.get(cat.parentHandle) : null,
          `${BACKEND_URL}/static/categories/${cat.handle}.svg`,
          JSON.stringify(CATEGORY_NAMES_SQ[cat.handle] ? { name_sq: CATEGORY_NAMES_SQ[cat.handle] } : {}),
        ]
      )
      categoryIdByHandle.set(cat.handle, rows[0].id)
    }

    console.log("Seeding products...")
    for (const product of PRODUCTS) {
      const metadata = {
        ...(product.featured ? { featured: "true" } : {}),
        ...(ALBANIAN[product.handle] || {}),
      }
      const images = [
        `${BACKEND_URL}/static/products/${product.handle}.svg`,
        `${BACKEND_URL}/static/products/${product.handle}-2.svg`,
      ]
      const options = product.options || []

      const { rows: productRows } = await query(
        `insert into products (title, handle, description, brand, category_id, tags, images, thumbnail,
                               options, weight, metadata, supplier_id, shipping_method_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [
          product.title,
          product.handle,
          product.description,
          product.brand || "",
          categoryIdByHandle.get(product.category) || null,
          product.tags || [],
          JSON.stringify(images),
          images[0],
          JSON.stringify(options),
          product.weight || null,
          JSON.stringify(metadata),
          supplierByCategory.get(product.category) || null,
          methodByCategory.get(product.category) || methodIdByName.get("Standard Delivery"),
        ]
      )
      const productId = productRows[0].id

      const variants = product.variants || [
        { title: "Default", sku: product.sku, options: {}, price: product.price },
      ]
      for (const [index, variant] of variants.entries()) {
        const { rows: variantRows } = await query(
          `insert into variants (product_id, title, sku, options, price, stock, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [
            productId,
            variant.title,
            variant.sku || null,
            JSON.stringify(variant.options || {}),
            variant.price,
            product.stock ?? 20,
            index,
          ]
        )
        // The demo sale price applies to the first variant, like before.
        if (index === 0 && product.salePrice) {
          await query(
            "insert into price_list_prices (price_list_id, variant_id, price) values ($1, $2, $3)",
            [salePriceListId, variantRows[0].id, product.salePrice]
          )
        }
      }
    }
  })

  console.log("Seed finished.")
  if (process.env.SEED_ADMIN_PASSWORD) {
    console.log(`Admin login: ${process.env.SEED_ADMIN_EMAIL || "admin@intersoft-rks.com"} / the password you supplied`)
  } else {
    console.log("Admin login: admin@intersoft-rks.com / supersecret  →  http://localhost:9000/admin")
    console.log("⚠  Those credentials are published in this repository. Fine locally; change them")
    console.log("   before anyone else can reach this deployment.")
  }
}

seed()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
