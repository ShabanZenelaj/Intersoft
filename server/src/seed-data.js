/**
 * Demo catalog for Intersoft (PC & electronics).
 * Shared by the seed script and by tools/generate-images.js (CommonJS on purpose).
 */

const CATEGORIES = [
  {
    name: "Laptops",
    handle: "laptops",
    description: "Gaming, business and everyday laptops",
    icon: "💻",
    palette: ["#1e293b", "#334155"],
  },
  {
    name: "Desktop PCs",
    handle: "desktop-pcs",
    description: "Pre-built gaming, creator and office desktops",
    icon: "🖥️",
    palette: ["#0f172a", "#1e3a5f"],
  },
  {
    name: "Components",
    handle: "components",
    description: "Everything you need to build or upgrade your PC",
    icon: "🛠️",
    palette: ["#312e81", "#4338ca"],
    children: [
      { name: "Processors", handle: "processors", description: "AMD and Intel CPUs", icon: "⚙️", palette: ["#7c2d12", "#9a3412"] },
      { name: "Graphics Cards", handle: "graphics-cards", description: "NVIDIA and AMD GPUs", icon: "🎮", palette: ["#14532d", "#166534"] },
      { name: "Motherboards", handle: "motherboards", description: "AM5, LGA1700 and more", icon: "🔩", palette: ["#134e4a", "#0f766e"] },
      { name: "Memory", handle: "memory", description: "DDR4 and DDR5 RAM kits", icon: "💾", palette: ["#581c87", "#7e22ce"] },
      { name: "Storage", handle: "storage", description: "NVMe SSDs and hard drives", icon: "💽", palette: ["#1e3a8a", "#1d4ed8"] },
      { name: "Power Supplies", handle: "power-supplies", description: "Reliable, efficient PSUs", icon: "🔌", palette: ["#713f12", "#a16207"] },
      { name: "PC Cases", handle: "pc-cases", description: "Mid towers, full towers and ITX", icon: "📦", palette: ["#334155", "#475569"] },
      { name: "Cooling", handle: "cooling", description: "Air and liquid cooling", icon: "❄️", palette: ["#0c4a6e", "#0369a1"] },
    ],
  },
  {
    name: "Peripherals",
    handle: "peripherals",
    description: "Monitors, keyboards, mice and more",
    icon: "⌨️",
    palette: ["#3f3f46", "#52525b"],
    children: [
      { name: "Monitors", handle: "monitors", description: "Gaming and office displays", icon: "🖥️", palette: ["#18181b", "#3f3f46"] },
      { name: "Keyboards", handle: "keyboards", description: "Mechanical and wireless keyboards", icon: "⌨️", palette: ["#365314", "#4d7c0f"] },
      { name: "Mice", handle: "mice", description: "Gaming and ergonomic mice", icon: "🖱️", palette: ["#701a75", "#a21caf"] },
      { name: "Headsets", handle: "headsets", description: "Gaming headsets and headphones", icon: "🎧", palette: ["#7f1d1d", "#b91c1c"] },
      { name: "Webcams", handle: "webcams", description: "Streaming and conference cameras", icon: "📷", palette: ["#1c1917", "#44403c"] },
    ],
  },
  {
    name: "Networking",
    handle: "networking",
    description: "Routers, switches and WiFi gear",
    icon: "📡",
    palette: ["#164e63", "#0e7490"],
  },
  {
    name: "Accessories",
    handle: "accessories",
    description: "Bags, hubs, chargers and cables",
    icon: "🎒",
    palette: ["#404040", "#525252"],
  },
]

const PRODUCTS = [
  // ------------------------------------------------------------- Laptops
  {
    title: "Apex Gaming Laptop 15",
    handle: "apex-gaming-laptop-15",
    sku: "LAP-APEX15",
    category: "laptops",
    brand: "Intersoft",
    icon: "💻",
    description:
      "A 15.6\" QHD 165Hz gaming laptop built around an Intel Core i7-13700H and a GeForce RTX 4060. Per-key RGB keyboard, 1TB NVMe SSD and a vapor-chamber cooler keep frame rates high and temperatures low.",
    price: 1299,
    salePrice: 1199,
    stock: 15,
    weight: 2300,
    featured: true,
    tags: ["laptop", "gaming", "rtx 4060", "intel i7", "165hz"],
    options: [{ title: "Memory", values: ["16GB", "32GB"] }],
    variants: [
      { title: "16GB", sku: "LAP-APEX15-16", options: { Memory: "16GB" }, price: 1299 },
      { title: "32GB", sku: "LAP-APEX15-32", options: { Memory: "32GB" }, price: 1449 },
    ],
  },
  {
    title: "UltraBook Air 14",
    handle: "ultrabook-air-14",
    sku: "LAP-AIR14",
    category: "laptops",
    brand: "Intersoft",
    icon: "💻",
    description:
      "Just 1.2 kg with a 14\" 2.8K OLED display, Ryzen 7 7840U and 18 hours of battery life. The perfect everyday ultrabook for work, study and travel.",
    price: 899,
    stock: 22,
    weight: 1200,
    featured: true,
    tags: ["laptop", "ultrabook", "oled", "ryzen 7", "lightweight"],
  },
  {
    title: "ProBook Business 15",
    handle: "probook-business-15",
    sku: "LAP-PRO15",
    category: "laptops",
    brand: "Intersoft",
    icon: "💻",
    description:
      "A dependable business laptop with an Intel Core i5-1340P, 16GB RAM, 512GB SSD, fingerprint reader and a full set of ports including HDMI and Ethernet.",
    price: 749,
    stock: 30,
    weight: 1700,
    tags: ["laptop", "business", "intel i5", "fingerprint"],
  },

  // ------------------------------------------------------------- Desktops
  {
    title: "Titan Gaming PC",
    handle: "titan-gaming-pc",
    sku: "PC-TITAN",
    category: "desktop-pcs",
    brand: "Intersoft",
    icon: "🖥️",
    description:
      "Our best-selling gaming build: Ryzen 7 7800X3D, GeForce RTX 4070, 32GB DDR5-6000 and a 1TB Gen4 NVMe SSD in an airflow-optimized mid tower. Assembled, stress-tested and ready to play.",
    price: 1599,
    salePrice: 1499,
    stock: 8,
    weight: 12000,
    featured: true,
    tags: ["desktop", "gaming pc", "rtx 4070", "ryzen 7", "prebuilt"],
  },
  {
    title: "Creator Workstation PC",
    handle: "creator-workstation-pc",
    sku: "PC-CREATOR",
    category: "desktop-pcs",
    brand: "Intersoft",
    icon: "🖥️",
    description:
      "Built for rendering and editing: Ryzen 9 7900, 64GB DDR5, RTX 4070 Ti Super and 2TB of NVMe storage. Whisper-quiet under load thanks to a 360mm liquid cooler.",
    price: 1899,
    stock: 5,
    weight: 13000,
    featured: true,
    tags: ["desktop", "workstation", "creator", "ryzen 9", "64gb"],
  },
  {
    title: "Office Desktop Essential",
    handle: "office-desktop-essential",
    sku: "PC-OFFICE",
    category: "desktop-pcs",
    brand: "Intersoft",
    icon: "🖥️",
    description:
      "A compact, efficient desktop for office work: Intel Core i3-13100, 8GB RAM, 256GB SSD and Windows 11 Pro preinstalled. Ideal for businesses buying in volume.",
    price: 549,
    stock: 40,
    weight: 6500,
    tags: ["desktop", "office", "intel i3", "windows 11"],
  },

  // ------------------------------------------------------------- Processors
  {
    title: "AMD Ryzen 7 7800X3D",
    handle: "amd-ryzen-7-7800x3d",
    sku: "CPU-7800X3D",
    category: "processors",
    brand: "AMD",
    icon: "⚙️",
    description:
      "The gaming CPU to beat. 8 cores / 16 threads with 96MB of 3D V-Cache deliver class-leading gaming performance on the AM5 platform.",
    price: 389,
    stock: 25,
    weight: 100,
    featured: true,
    tags: ["cpu", "amd", "ryzen 7", "am5", "gaming"],
  },
  {
    title: "Intel Core i5-14600K",
    handle: "intel-core-i5-14600k",
    sku: "CPU-14600K",
    category: "processors",
    brand: "Intel",
    icon: "⚙️",
    description:
      "14 cores (6P + 8E) up to 5.3GHz. Excellent all-round performance for gaming and productivity on LGA1700, with unlocked overclocking.",
    price: 319,
    stock: 30,
    weight: 100,
    tags: ["cpu", "intel", "core i5", "lga1700"],
  },
  {
    title: "AMD Ryzen 5 7600",
    handle: "amd-ryzen-5-7600",
    sku: "CPU-7600",
    category: "processors",
    brand: "AMD",
    icon: "⚙️",
    description:
      "6 cores / 12 threads of Zen 4 value with a Wraith Stealth cooler in the box. The smart pick for mid-range AM5 builds.",
    price: 219,
    salePrice: 199,
    stock: 35,
    weight: 100,
    tags: ["cpu", "amd", "ryzen 5", "am5", "budget"],
  },

  // ------------------------------------------------------------- Graphics cards
  {
    title: "GeForce RTX 4070 12GB",
    handle: "geforce-rtx-4070-12gb",
    sku: "GPU-RTX4070",
    category: "graphics-cards",
    brand: "NVIDIA",
    icon: "🎮",
    description:
      "Outstanding 1440p performance with 12GB GDDR6X, DLSS 3 frame generation and remarkably low power draw. Triple-fan design with idle fan stop.",
    price: 599,
    salePrice: 549,
    stock: 12,
    weight: 1200,
    featured: true,
    tags: ["gpu", "nvidia", "rtx 4070", "dlss", "1440p"],
  },
  {
    title: "GeForce RTX 4060 Ti 8GB",
    handle: "geforce-rtx-4060-ti-8gb",
    sku: "GPU-RTX4060TI",
    category: "graphics-cards",
    brand: "NVIDIA",
    icon: "🎮",
    description:
      "Efficient 1080p/1440p gaming with DLSS 3, AV1 encoding and a compact dual-fan design that fits almost any case.",
    price: 419,
    stock: 18,
    weight: 900,
    tags: ["gpu", "nvidia", "rtx 4060 ti", "dlss"],
  },
  {
    title: "Radeon RX 7800 XT 16GB",
    handle: "radeon-rx-7800-xt-16gb",
    sku: "GPU-RX7800XT",
    category: "graphics-cards",
    brand: "AMD",
    icon: "🎮",
    description:
      "16GB GDDR6 and RDNA 3 muscle for high-refresh 1440p gaming. FSR 3 support and excellent rasterization performance per euro.",
    price: 529,
    stock: 10,
    weight: 1100,
    tags: ["gpu", "amd", "rx 7800 xt", "16gb", "fsr"],
  },

  // ------------------------------------------------------------- Motherboards
  {
    title: "B650 Tomahawk WiFi",
    handle: "b650-tomahawk-wifi",
    sku: "MB-B650TOMA",
    category: "motherboards",
    brand: "MSI",
    icon: "🔩",
    description:
      "The go-to AM5 board: robust 14+2 VRM, PCIe 5.0 M.2, WiFi 6E, 2.5G LAN and easy BIOS flashback. ATX form factor.",
    price: 219,
    stock: 20,
    weight: 1500,
    tags: ["motherboard", "am5", "b650", "wifi", "msi"],
  },
  {
    title: "Z790 Gaming Plus",
    handle: "z790-gaming-plus",
    sku: "MB-Z790GP",
    category: "motherboards",
    brand: "MSI",
    icon: "🔩",
    description:
      "LGA1700 board with DDR5, four M.2 slots, 2.5G LAN and USB-C front header. Supports 14th-gen Intel Core out of the box.",
    price: 249,
    stock: 15,
    weight: 1500,
    tags: ["motherboard", "lga1700", "z790", "ddr5", "msi"],
  },

  // ------------------------------------------------------------- Memory
  {
    title: "Fury Beast DDR5 6000MHz Kit",
    handle: "fury-beast-ddr5-6000",
    sku: "RAM-FURY-D5",
    category: "memory",
    brand: "Kingston",
    icon: "💾",
    description:
      "Low-latency DDR5-6000 CL36 with EXPO and XMP 3.0 profiles. The sweet spot for Ryzen 7000 and Intel 14th-gen builds.",
    price: 129,
    stock: 40,
    weight: 100,
    tags: ["ram", "ddr5", "6000mhz", "kingston", "expo"],
    options: [{ title: "Capacity", values: ["16GB (2x8)", "32GB (2x16)", "64GB (2x32)"] }],
    variants: [
      { title: "16GB (2x8)", sku: "RAM-FURY-D5-16", options: { Capacity: "16GB (2x8)" }, price: 69 },
      { title: "32GB (2x16)", sku: "RAM-FURY-D5-32", options: { Capacity: "32GB (2x16)" }, price: 129 },
      { title: "64GB (2x32)", sku: "RAM-FURY-D5-64", options: { Capacity: "64GB (2x32)" }, price: 239 },
    ],
  },
  {
    title: "Vengeance DDR4 16GB 3200MHz",
    handle: "vengeance-ddr4-16gb-3200",
    sku: "RAM-VENG-D4-16",
    category: "memory",
    brand: "Corsair",
    icon: "💾",
    description:
      "Proven DDR4-3200 CL16 kit (2x8GB) with a low-profile heat spreader that clears large air coolers. Lifetime warranty.",
    price: 49,
    stock: 60,
    weight: 100,
    tags: ["ram", "ddr4", "3200mhz", "corsair"],
  },

  // ------------------------------------------------------------- Storage
  {
    title: "980 PRO NVMe SSD",
    handle: "980-pro-nvme-ssd",
    sku: "SSD-980PRO",
    category: "storage",
    brand: "Samsung",
    icon: "💽",
    description:
      "PCIe 4.0 speeds up to 7000 MB/s with a 5-year warranty. Ideal as a system drive or a fast game library.",
    price: 99,
    salePrice: 89,
    stock: 50,
    weight: 50,
    featured: true,
    tags: ["ssd", "nvme", "samsung", "pcie 4.0", "1tb"],
    options: [{ title: "Capacity", values: ["1TB", "2TB"] }],
    variants: [
      { title: "1TB", sku: "SSD-980PRO-1TB", options: { Capacity: "1TB" }, price: 99 },
      { title: "2TB", sku: "SSD-980PRO-2TB", options: { Capacity: "2TB" }, price: 189 },
    ],
  },
  {
    title: "Barracuda 4TB HDD",
    handle: "barracuda-4tb-hdd",
    sku: "HDD-BARRA-4TB",
    category: "storage",
    brand: "Seagate",
    icon: "💽",
    description:
      "4TB of dependable 3.5\" storage at 5400 RPM — perfect for backups, media libraries and bulk data.",
    price: 95,
    stock: 35,
    weight: 600,
    tags: ["hdd", "seagate", "4tb", "backup"],
  },

  // ------------------------------------------------------------- PSUs
  {
    title: "RM750e 750W 80+ Gold",
    handle: "rm750e-750w-gold",
    sku: "PSU-RM750E",
    category: "power-supplies",
    brand: "Corsair",
    icon: "🔌",
    description:
      "Fully modular ATX 3.0 power supply with native 12VHPWR connector, quiet 120mm fan and 80 PLUS Gold efficiency. 7-year warranty.",
    price: 109,
    stock: 25,
    weight: 1700,
    tags: ["psu", "750w", "gold", "modular", "atx 3.0"],
  },
  {
    title: "Focus GX-850 850W 80+ Gold",
    handle: "focus-gx-850",
    sku: "PSU-FOCUS850",
    category: "power-supplies",
    brand: "Seasonic",
    icon: "🔌",
    description:
      "Legendary Seasonic reliability with 850W of fully modular Gold-rated power, hybrid fan mode and a 10-year warranty.",
    price: 139,
    stock: 18,
    weight: 1800,
    tags: ["psu", "850w", "gold", "seasonic"],
  },

  // ------------------------------------------------------------- Cases
  {
    title: "H5 Flow Mid Tower",
    handle: "h5-flow-mid-tower",
    sku: "CASE-H5FLOW",
    category: "pc-cases",
    brand: "NZXT",
    icon: "📦",
    description:
      "Clean looks and serious airflow: perforated front panel, tempered glass side, USB-C front port and room for 360mm radiators.",
    price: 94,
    stock: 20,
    weight: 7000,
    tags: ["case", "mid tower", "nzxt", "airflow", "tempered glass"],
    options: [{ title: "Color", values: ["Black", "White"] }],
    variants: [
      { title: "Black", sku: "CASE-H5FLOW-B", options: { Color: "Black" }, price: 94 },
      { title: "White", sku: "CASE-H5FLOW-W", options: { Color: "White" }, price: 94 },
    ],
  },
  {
    title: "O11 Dynamic EVO",
    handle: "o11-dynamic-evo",
    sku: "CASE-O11EVO",
    category: "pc-cases",
    brand: "Lian Li",
    icon: "📦",
    description:
      "The showcase case: dual-chamber layout, three tempered glass panels and support for up to three 360mm radiators.",
    price: 149,
    stock: 12,
    weight: 9500,
    tags: ["case", "lian li", "dual chamber", "showcase"],
  },

  // ------------------------------------------------------------- Cooling
  {
    title: "Kraken 240 AIO Liquid Cooler",
    handle: "kraken-240-aio",
    sku: "COOL-KRAKEN240",
    category: "cooling",
    brand: "NZXT",
    icon: "❄️",
    description:
      "240mm all-in-one liquid cooler with a customizable LCD display, quiet Asetek pump and two 120mm static-pressure fans.",
    price: 129,
    stock: 15,
    weight: 1400,
    tags: ["cooler", "aio", "240mm", "nzxt", "lcd"],
  },
  {
    title: "Peerless Assassin 120 SE",
    handle: "peerless-assassin-120-se",
    sku: "COOL-PA120SE",
    category: "cooling",
    brand: "Thermalright",
    icon: "❄️",
    description:
      "The value king of air cooling: dual-tower, six heatpipes and two quiet 120mm fans that rival coolers twice the price.",
    price: 42,
    stock: 45,
    weight: 1100,
    tags: ["cooler", "air", "dual tower", "thermalright"],
  },

  // ------------------------------------------------------------- Monitors
  {
    title: "27\" QHD 165Hz Gaming Monitor",
    handle: "27-qhd-165hz-gaming-monitor",
    sku: "MON-27QHD165",
    category: "monitors",
    brand: "AOC",
    icon: "🖥️",
    description:
      "Fast IPS panel with 2560x1440 resolution, 165Hz refresh, 1ms response and Adaptive-Sync. Height-adjustable stand included.",
    price: 269,
    salePrice: 239,
    stock: 25,
    weight: 5500,
    featured: true,
    tags: ["monitor", "27 inch", "qhd", "165hz", "gaming"],
  },
  {
    title: "24\" FHD 100Hz Office Monitor",
    handle: "24-fhd-100hz-office-monitor",
    sku: "MON-24FHD100",
    category: "monitors",
    brand: "Philips",
    icon: "🖥️",
    description:
      "A comfortable 24\" IPS display with 100Hz refresh, low-blue-light mode and ultra-thin bezels — great for multi-monitor setups.",
    price: 119,
    stock: 40,
    weight: 3500,
    tags: ["monitor", "24 inch", "fhd", "office", "ips"],
  },

  // ------------------------------------------------------------- Keyboards
  {
    title: "Mech TKL Mechanical Keyboard",
    handle: "mech-tkl-keyboard",
    sku: "KB-MECHTKL",
    category: "keyboards",
    brand: "Keychron",
    icon: "⌨️",
    description:
      "Hot-swappable tenkeyless mechanical keyboard with PBT keycaps, south-facing RGB and both Bluetooth and wired modes.",
    price: 89,
    stock: 30,
    weight: 800,
    tags: ["keyboard", "mechanical", "tkl", "hot-swap", "rgb"],
    options: [{ title: "Switch", values: ["Red", "Brown", "Blue"] }],
    variants: [
      { title: "Red", sku: "KB-MECHTKL-R", options: { Switch: "Red" }, price: 89 },
      { title: "Brown", sku: "KB-MECHTKL-BR", options: { Switch: "Brown" }, price: 89 },
      { title: "Blue", sku: "KB-MECHTKL-BL", options: { Switch: "Blue" }, price: 89 },
    ],
  },
  {
    title: "Wireless Slim Keyboard",
    handle: "wireless-slim-keyboard",
    sku: "KB-SLIM",
    category: "keyboards",
    brand: "Logitech",
    icon: "⌨️",
    description:
      "Quiet, low-profile wireless keyboard with multi-device pairing and 24 months of battery life on two AAA cells.",
    price: 39,
    stock: 50,
    weight: 500,
    tags: ["keyboard", "wireless", "slim", "logitech"],
  },

  // ------------------------------------------------------------- Mice
  {
    title: "Pro Wireless Gaming Mouse",
    handle: "pro-wireless-gaming-mouse",
    sku: "MS-PROWL",
    category: "mice",
    brand: "Logitech",
    icon: "🖱️",
    description:
      "63 grams, a 25K DPI sensor and 70-hour battery life. The esports standard, now with USB-C charging.",
    price: 99,
    stock: 35,
    weight: 100,
    featured: true,
    tags: ["mouse", "wireless", "gaming", "lightweight", "logitech"],
    options: [{ title: "Color", values: ["Black", "White"] }],
    variants: [
      { title: "Black", sku: "MS-PROWL-B", options: { Color: "Black" }, price: 99 },
      { title: "White", sku: "MS-PROWL-W", options: { Color: "White" }, price: 99 },
    ],
  },
  {
    title: "Ergo Comfort Mouse",
    handle: "ergo-comfort-mouse",
    sku: "MS-ERGO",
    category: "mice",
    brand: "Logitech",
    icon: "🖱️",
    description:
      "Vertical ergonomic design that reduces wrist strain, with silent clicks and connection to three devices via Bluetooth or USB receiver.",
    price: 29,
    stock: 55,
    weight: 140,
    tags: ["mouse", "ergonomic", "silent", "bluetooth"],
  },

  // ------------------------------------------------------------- Headsets
  {
    title: "Cloud Gaming Headset 7.1",
    handle: "cloud-gaming-headset-71",
    sku: "HS-CLOUD71",
    category: "headsets",
    brand: "HyperX",
    icon: "🎧",
    description:
      "Legendary comfort with memory-foam ear cups, virtual 7.1 surround and a detachable noise-cancelling microphone.",
    price: 79,
    salePrice: 69,
    stock: 28,
    weight: 300,
    tags: ["headset", "gaming", "7.1", "hyperx", "microphone"],
  },
  {
    title: "Studio ANC Headphones",
    handle: "studio-anc-headphones",
    sku: "HS-STUDIOANC",
    category: "headsets",
    brand: "Sony",
    icon: "🎧",
    description:
      "Industry-leading active noise cancellation, 30-hour battery life and multipoint Bluetooth for switching between laptop and phone.",
    price: 199,
    stock: 20,
    weight: 250,
    tags: ["headphones", "anc", "bluetooth", "sony"],
  },

  // ------------------------------------------------------------- Webcams
  {
    title: "StreamCam Full HD 60fps",
    handle: "streamcam-full-hd-60fps",
    sku: "WC-STREAM60",
    category: "webcams",
    brand: "Logitech",
    icon: "📷",
    description:
      "1080p at 60fps with smart autofocus and auto-exposure, USB-C connection and both landscape and portrait mounting.",
    price: 89,
    stock: 25,
    weight: 220,
    tags: ["webcam", "streaming", "1080p", "60fps", "usb-c"],
  },

  // ------------------------------------------------------------- Networking
  {
    title: "AX3000 WiFi 6 Router",
    handle: "ax3000-wifi-6-router",
    sku: "NET-AX3000",
    category: "networking",
    brand: "TP-Link",
    icon: "📡",
    description:
      "Dual-band WiFi 6 with speeds up to 3 Gbps, OFDMA for busy households and four gigabit LAN ports. Easy app setup.",
    price: 89,
    stock: 30,
    weight: 700,
    tags: ["router", "wifi 6", "ax3000", "tp-link"],
  },
  {
    title: "8-Port Gigabit Switch",
    handle: "8-port-gigabit-switch",
    sku: "NET-SW8G",
    category: "networking",
    brand: "TP-Link",
    icon: "📡",
    description:
      "Plug-and-play unmanaged switch with eight gigabit ports in a fanless metal housing. Desktop or wall-mountable.",
    price: 29,
    stock: 45,
    weight: 500,
    tags: ["switch", "gigabit", "8 port", "network"],
  },

  // ------------------------------------------------------------- Accessories
  {
    title: "Laptop Backpack 15.6\"",
    handle: "laptop-backpack-156",
    sku: "ACC-BACKPACK",
    category: "accessories",
    brand: "Intersoft",
    icon: "🎒",
    description:
      "Water-resistant backpack with a padded 15.6\" laptop compartment, anti-theft back pocket and USB charging pass-through.",
    price: 39,
    stock: 60,
    weight: 800,
    tags: ["backpack", "laptop bag", "15.6", "travel"],
  },
  {
    title: "USB-C 8-in-1 Hub",
    handle: "usb-c-8-in-1-hub",
    sku: "ACC-HUB8",
    category: "accessories",
    brand: "Anker",
    icon: "🎒",
    description:
      "Adds HDMI 4K@60Hz, three USB-A ports, SD/microSD readers, gigabit Ethernet and 100W pass-through charging to any USB-C laptop.",
    price: 49,
    stock: 40,
    weight: 150,
    tags: ["hub", "usb-c", "hdmi", "adapter", "anker"],
  },
  {
    title: "65W GaN USB-C Charger",
    handle: "65w-gan-usb-c-charger",
    sku: "ACC-GAN65",
    category: "accessories",
    brand: "Anker",
    icon: "🎒",
    description:
      "Pocket-sized GaN charger that powers laptops, tablets and phones from two USB-C ports and one USB-A port.",
    price: 35,
    stock: 70,
    weight: 120,
    tags: ["charger", "gan", "65w", "usb-c"],
  },
]

const flattenCategories = () => {
  const flat = []
  const walk = (cats, parent) => {
    for (const cat of cats) {
      flat.push({ ...cat, parentHandle: parent ? parent.handle : null })
      if (cat.children) walk(cat.children, cat)
    }
  }
  walk(CATEGORIES, null)
  return flat
}

module.exports = { CATEGORIES, PRODUCTS, flattenCategories }
