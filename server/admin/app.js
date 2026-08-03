/* Intersoft Admin — vanilla JS SPA, no build step.
   All dynamic values are escaped with esc() before touching innerHTML. */
(() => {
  "use strict"

  const $ = (sel, root = document) => root.querySelector(sel)
  const main = $("#main")

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]))

  const eur = (value) => {
    const num = Number(value || 0)
    const [int, dec] = num.toFixed(2).split(".")
    return `€${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`
  }
  const when = (value) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })

  const icon = (name, className = "ico") => `<svg class="${className}" viewBox="0 0 24 24"><use href="#i-${name}"/></svg>`

  let toastTimer
  const toast = (message, isError = false) => {
    const el = $("#toast")
    el.innerHTML = `${icon(isError ? "warn" : "check", "ico sm")}<span></span>`
    el.querySelector("span").textContent = message
    el.className = `toast${isError ? " error" : ""}`
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.add("hidden"), 4000)
  }

  // ---------------------------------------------------------------- modals
  //
  // Everything that used to be a browser alert/prompt/confirm goes through
  // here: proper dialogs with labelled fields, ESC/backdrop to cancel, and a
  // promise that resolves with the answer (or null when dismissed).

  const openModal = ({ title, message, iconName = "warn", danger = false, body = "", confirmLabel = "Confirm",
                      cancelLabel = "Cancel", wide = false, onOpen, collect }) =>
    new Promise((resolve) => {
      const root = $("#modal-root")
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
            <div class="modal-head">
              <span class="modal-icon ${danger ? "danger" : ""}">${icon(iconName)}</span>
              <div>
                <h2>${esc(title)}</h2>
                ${message ? `<p>${esc(message)}</p>` : ""}
              </div>
            </div>
            ${body ? `<div class="modal-body">${body}</div>` : ""}
            <div class="modal-foot">
              <button class="btn" data-modal="cancel">${esc(cancelLabel)}</button>
              <button class="btn ${danger ? "danger-solid" : "primary"}" data-modal="confirm">${esc(confirmLabel)}</button>
            </div>
          </div>
        </div>`

      const close = (value) => {
        document.removeEventListener("keydown", onKey)
        root.innerHTML = ""
        resolve(value)
      }
      const onKey = (event) => {
        if (event.key === "Escape") close(null)
        if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
          const confirmButton = root.querySelector('[data-modal="confirm"]')
          if (confirmButton) confirmButton.click()
        }
      }
      document.addEventListener("keydown", onKey)

      root.querySelector(".modal-backdrop").addEventListener("mousedown", (event) => {
        if (event.target.classList.contains("modal-backdrop")) close(null)
      })
      root.querySelector('[data-modal="cancel"]').addEventListener("click", () => close(null))
      root.querySelector('[data-modal="confirm"]').addEventListener("click", () => {
        if (!collect) return close(true)
        const value = collect(root)
        if (value === undefined) return // invalid — collect() showed the reason
        close(value)
      })

      onOpen?.(root)
      root.querySelector("input, textarea, select")?.focus()
    })

  /** Replaces window.confirm. Resolves true only when the manager confirms. */
  const confirmDialog = ({ title, message, confirmLabel = "Delete", danger = true }) =>
    openModal({ title, message, danger, confirmLabel, iconName: danger ? "warn" : "check" }).then(Boolean)

  const modalError = (root, text) => {
    const holder = root.querySelector(".modal-error")
    if (holder) {
      holder.textContent = text
      holder.classList.remove("hidden")
    }
  }

  // ---------------------------------------------------------------- api

  const getToken = () => localStorage.getItem("intersoft_admin_token")

  const api = async (path, options = {}) => {
    const res = await fetch(`/api/admin${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        authorization: `Bearer ${getToken()}`,
        ...(options.headers || {}),
      },
      body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    })
    if (res.status === 401) {
      showLogin()
      throw new Error("Signed out")
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`)
    return data
  }

  // ---------------------------------------------------------------- auth shell

  const showLogin = () => {
    $("#app").classList.add("hidden")
    $("#login").classList.remove("hidden")
  }

  const showApp = (admin) => {
    $("#login").classList.add("hidden")
    $("#app").classList.remove("hidden")
    $("#admin-email").textContent = admin.email
    $("#admin-initial").textContent = (admin.name || admin.email || "A").trim().charAt(0)
    route()
  }

  // Mobile: the sidebar slides over the content.
  $("#sidebar-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"))
  $("#nav").addEventListener("click", () => $("#sidebar").classList.remove("open"))

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault()
    const form = new FormData(event.target)
    const errorEl = $("#login-error")
    const submit = $("#login-submit")
    errorEl.classList.add("hidden")
    submit.disabled = true
    submit.textContent = "Signing in…"
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Login failed")
      localStorage.setItem("intersoft_admin_token", data.token)
      const me = await api("/auth/me")
      showApp(me.admin)
    } catch (error) {
      errorEl.textContent =
        error.message === "Wrong email or password." ? "That email and password do not match." : error.message
      errorEl.classList.remove("hidden")
    } finally {
      submit.disabled = false
      submit.textContent = "Sign in"
    }
  })

  $("#logout").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Sign out of the admin?",
      message: "You will need your email and password to get back in.",
      confirmLabel: "Sign out",
      danger: false,
    })
    if (!ok) return
    localStorage.removeItem("intersoft_admin_token")
    showLogin()
  })

  // ---------------------------------------------------------------- helpers

  /** Plain-language order status, so nobody has to decode "fulfillment_status". */
  const STATUS_LABEL = {
    pending: "New — not started",
    processing: "Being prepared",
    shipped: "On its way",
    delivered: "Delivered",
    canceled: "Canceled",
  }
  const PAYMENT_LABEL = {
    awaiting: "Not paid yet",
    paid: "Paid",
    partially_refunded: "Partly refunded",
    refunded: "Refunded",
  }

  const statusBadge = (status) => {
    const color =
      { pending: "amber", processing: "blue", shipped: "blue", delivered: "green", canceled: "red" }[status] || ""
    return `<span class="badge ${color}"><span class="dot"></span>${esc(STATUS_LABEL[status] || status)}</span>`
  }
  const payBadge = (status) => {
    const color = { awaiting: "amber", paid: "green", refunded: "red", partially_refunded: "red" }[status] || ""
    return `<span class="badge ${color}">${esc(PAYMENT_LABEL[status] || String(status).replaceAll("_", " "))}</span>`
  }
  const yesNo = (value) => (value ? `<span class="badge green">Yes</span>` : `<span class="badge">No</span>`)

  /** Friendly empty state — always says what to do next. */
  const emptyState = ({ title, hint, action }) => `
    <div class="empty">
      ${icon("empty")}
      <h3>${esc(title)}</h3>
      <p>${esc(hint)}</p>
      ${action ? `<a class="btn primary" href="${action.href}">${icon("plus", "ico sm")}${esc(action.label)}</a>` : ""}
    </div>`

  const searchBox = (id, placeholder, value = "") => `
    <div class="search">${icon("search", "ico sm")}
      <input type="search" id="${id}" placeholder="${esc(placeholder)}" value="${esc(value)}" />
    </div>`

  const pager = (count, offset, limit, go) => {
    if (count <= limit) return ""
    const page = Math.floor(offset / limit) + 1
    const pages = Math.ceil(count / limit)
    const from = offset + 1
    const to = Math.min(offset + limit, count)
    setTimeout(() => {
      $("#pager-prev")?.addEventListener("click", () => go(Math.max(0, offset - limit)))
      $("#pager-next")?.addEventListener("click", () => go(offset + limit))
    })
    return `<div class="pager">
      <span class="muted">Showing ${from}–${to} of ${count}</span>
      <span class="row">
        <button class="btn small" id="pager-prev" ${page <= 1 ? "disabled" : ""}>Previous</button>
        <span class="muted">Page ${page} of ${pages}</span>
        <button class="btn small" id="pager-next" ${page >= pages ? "disabled" : ""}>Next</button>
      </span>
    </div>`
  }

  const skeletonPage = () => `
    <div class="page-head"><div><div class="skeleton sk-line" style="width:180px;height:22px"></div>
      <div class="skeleton sk-line" style="width:260px"></div></div></div>
    <div class="card">
      ${Array.from({ length: 6 })
        .map(
          () => `<div class="sk-row">
            <div class="skeleton" style="width:38px;height:38px;border-radius:7px"></div>
            <div class="skeleton" style="flex:1"></div>
            <div class="skeleton" style="width:90px"></div>
            <div class="skeleton" style="width:60px"></div>
          </div>`
        )
        .join("")}
    </div>`

  /** Replaces images that fail to load with a visible "broken" note. */
  const wireImageFallbacks = (root = main) => {
    root.querySelectorAll("img[data-fallback]").forEach((img) => {
      img.addEventListener("error", () => {
        const holder = img.parentElement
        img.remove()
        if (holder && !holder.querySelector(".broken")) {
          const note = document.createElement("span")
          note.className = "broken"
          note.textContent = "Image not available"
          holder.appendChild(note)
        }
      })
    })
  }

  const uploadFiles = async (files) => {
    const formData = new FormData()
    for (const file of files) formData.append("files", file)
    const { urls } = await api("/uploads", { method: "POST", body: formData })
    return urls
  }

  const isUploadedFile = (url) => String(url).includes("/static/uploads/")

  /**
   * Image picker used by products (gallery) and categories (single image).
   * Handles drag & drop, file picking, ordering, main image and deletion —
   * the store manager never has to touch a URL.
   */
  const createImageManager = (initial = [], { multiple = true } = {}) => {
    let images = [...(initial || [])].filter(Boolean)
    let root = null
    let busy = false

    const setBusy = (value) => {
      busy = value
      const status = root.querySelector(".uploading")
      if (status) status.textContent = value ? "Uploading…" : ""
    }

    const handleFiles = async (fileList) => {
      const files = [...fileList].filter((file) => file.type.startsWith("image/"))
      if (!files.length) return
      setBusy(true)
      try {
        const urls = await uploadFiles(multiple ? files : files.slice(0, 1))
        images = multiple ? [...images, ...urls] : urls.slice(0, 1)
        render()
        toast(`${urls.length} image${urls.length > 1 ? "s" : ""} uploaded.`)
      } catch (error) {
        toast(error.message, true)
      } finally {
        setBusy(false)
      }
    }

    const removeAt = async (index) => {
      const [url] = images.splice(index, 1)
      render()
      if (isUploadedFile(url)) {
        api("/uploads", { method: "DELETE", body: { url } }).catch(() => {})
      }
    }

    const dropzoneHtml = `
      <div class="dropzone" tabindex="0">
        <strong>Drop image${multiple ? "s" : ""} here or click to choose</strong>
        <span class="hint">JPG, PNG, WebP, AVIF or GIF · up to 5 MB each</span>
        <input type="file" accept="image/*" ${multiple ? "multiple" : ""} class="hidden file-input" />
      </div>
      <div class="row" style="margin-top:8px">
        <input type="url" class="url-input" placeholder="…or paste an image URL" style="max-width:340px" />
        <button type="button" class="btn small add-url">Add URL</button>
        <span class="uploading"></span>
      </div>`

    const render = () => {
      if (multiple) {
        root.innerHTML = `
          ${
            images.length
              ? `<div class="image-grid">${images
                  .map(
                    (url, index) => `
                    <div class="image-tile ${index === 0 ? "is-main" : ""}">
                      <div class="frame"><img src="${esc(url)}" alt="" data-fallback /></div>
                      <div class="actions">
                        ${index === 0 ? `<span class="main-flag">Main</span>` : `<button type="button" data-act="main" data-i="${index}" title="Use as main image">★</button>`}
                        <span>
                          <button type="button" data-act="left" data-i="${index}" title="Move left" ${index === 0 ? "disabled" : ""}>←</button>
                          <button type="button" data-act="right" data-i="${index}" title="Move right" ${index === images.length - 1 ? "disabled" : ""}>→</button>
                          <button type="button" class="danger" data-act="del" data-i="${index}" title="Remove">✕</button>
                        </span>
                      </div>
                    </div>`
                  )
                  .join("")}</div>`
              : `<p class="muted" style="margin-top:0">No images yet — the storefront will show a placeholder.</p>`
          }
          ${dropzoneHtml}`
      } else {
        root.innerHTML = `
          <div class="image-single">
            <div class="preview">
              ${images[0] ? `<img src="${esc(images[0])}" alt="" data-fallback />` : `<span class="muted" style="font-size:12px">No image</span>`}
            </div>
            <div style="flex:1">
              ${dropzoneHtml}
              ${images[0] ? `<button type="button" class="btn small danger" data-act="del" data-i="0" style="margin-top:8px">Remove image</button>` : ""}
            </div>
          </div>`
      }
      bind()
      wireImageFallbacks(root)
    }

    const bind = () => {
      const dropzone = root.querySelector(".dropzone")
      const fileInput = root.querySelector(".file-input")
      dropzone.addEventListener("click", () => fileInput.click())
      dropzone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          fileInput.click()
        }
      })
      fileInput.addEventListener("change", () => {
        if (fileInput.files.length) handleFiles(fileInput.files)
      })
      ;["dragenter", "dragover"].forEach((type) =>
        dropzone.addEventListener(type, (event) => {
          event.preventDefault()
          dropzone.classList.add("dragover")
        })
      )
      ;["dragleave", "drop"].forEach((type) =>
        dropzone.addEventListener(type, (event) => {
          event.preventDefault()
          dropzone.classList.remove("dragover")
        })
      )
      dropzone.addEventListener("drop", (event) => {
        if (event.dataTransfer?.files?.length) handleFiles(event.dataTransfer.files)
      })

      root.querySelector(".add-url").addEventListener("click", () => {
        const input = root.querySelector(".url-input")
        const url = input.value.trim()
        if (!url) return
        images = multiple ? [...images, url] : [url]
        render()
      })

      root.querySelectorAll("[data-act]").forEach((button) =>
        button.addEventListener("click", () => {
          const index = Number(button.dataset.i)
          const action = button.dataset.act
          if (action === "del") return removeAt(index)
          if (action === "main") {
            const [url] = images.splice(index, 1)
            images.unshift(url)
          }
          if (action === "left" && index > 0) {
            ;[images[index - 1], images[index]] = [images[index], images[index - 1]]
          }
          if (action === "right" && index < images.length - 1) {
            ;[images[index + 1], images[index]] = [images[index], images[index + 1]]
          }
          render()
        })
      )
    }

    return {
      mount(element) {
        root = element
        render()
      },
      get images() {
        return images
      },
      get busy() {
        return busy
      },
    }
  }

  const priceRange = (product) => {
    const prices = (product.variants || []).map((v) => v.calculated_price?.calculated_amount).filter((p) => p != null)
    if (!prices.length) return "—"
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? eur(min) : `${eur(min)} – ${eur(max)}`
  }

  // ---------------------------------------------------------------- dashboard

  /** Last 14 days of revenue as a simple bar chart — no chart library needed. */
  const revenueChart = (days) => {
    if (!days.length) {
      return `<div class="card-body muted">No sales in the last 14 days yet.</div>`
    }
    const max = Math.max(...days.map((day) => day.revenue), 1)
    return `<div class="card-body">
      <div class="chart">
        ${days
          .map((day) => {
            const date = new Date(day.day)
            const label = `${date.getDate()}/${date.getMonth() + 1}`
            return `<div class="bar" title="${esc(label)} · ${eur(day.revenue)} · ${day.orders} order${day.orders === 1 ? "" : "s"}">
              <div class="fill" style="height:${Math.max(3, (day.revenue / max) * 100)}%"></div>
              <span class="tick">${esc(label)}</span>
            </div>`
          })
          .join("")}
      </div>
    </div>`
  }

  const dashboardView = async () => {
    const stats = await api("/stats")
    const hasOrders = stats.recent_orders.length > 0

    main.innerHTML = `
      <div class="page-head">
        <div><h1>Welcome back</h1>
          <p class="sub">Here is how the shop is doing. Click any order or product to open it.</p></div>
        <div class="row">
          <a href="#/products/new" class="btn">${icon("plus", "ico sm")}New product</a>
          <a href="#/campaigns" class="btn primary">${icon("campaigns", "ico sm")}New campaign</a>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="label">Sales (last 30 days)</div><div class="value">${eur(stats.revenue_30d)}</div>
          <div class="foot muted">${stats.orders_30d} order${stats.orders_30d === 1 ? "" : "s"}</div></div>
        <div class="kpi link" data-go="#/orders?status=pending"><div class="label">Waiting for payment</div>
          <div class="value">${stats.awaiting_payment}</div>
          <div class="foot muted">${stats.awaiting_payment ? "Mark them paid once collected" : "Everything is settled"}</div></div>
        <div class="kpi link" data-go="#/customers"><div class="label">Customers</div><div class="value">${stats.customers}</div>
          <div class="foot muted">Registered accounts</div></div>
        <div class="kpi"><div class="label">Low stock items</div><div class="value">${stats.low_stock.length}</div>
          <div class="foot muted">${stats.low_stock.length ? "Restock them soon" : "Stock levels are healthy"}</div></div>
      </div>

      <div class="card">
        <div class="card-head">Sales over the last 14 days</div>
        ${revenueChart(stats.revenue_by_day || [])}
      </div>

      <div class="card">
        <div class="card-head">Latest orders <a href="#/orders" class="btn small ghost">See all orders</a></div>
        ${
          hasOrders
            ? `<table><thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th class="num">Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>${stats.recent_orders
                .map(
                  (order) => `<tr class="click" data-id="${esc(order.id)}">
                    <td class="cell-title">#${order.display_id}</td>
                    <td class="muted">${esc(when(order.created_at))}</td>
                    <td>${esc(order.email)}</td>
                    <td class="num">${eur(order.total)}</td>
                    <td>${payBadge(order.payment_status)}</td><td>${statusBadge(order.status)}</td>
                  </tr>`
                )
                .join("")}</tbody></table>`
            : emptyState({
                title: "No orders yet",
                hint: "Orders placed in the shop appear here. Share your shop link to get the first one.",
                action: { href: "#/products", label: "Check your products" },
              })
        }
      </div>

      <div class="card">
        <div class="card-head">Running low on stock <span class="muted">5 items or fewer left</span></div>
        ${
          stats.low_stock.length
            ? `<table><thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th class="num">Left</th></tr></thead>
               <tbody>${stats.low_stock
                 .map(
                   (row) => `<tr class="click" data-product="${esc(row.product_id)}">
                     <td class="cell-title">${esc(row.product_title)}</td>
                     <td class="muted">${esc(row.variant_title)}</td>
                     <td class="muted">${esc(row.sku || "—")}</td>
                     <td class="num"><span class="badge ${row.stock === 0 ? "red" : "amber"}">${row.stock}</span></td></tr>`
                 )
                 .join("")}</tbody></table>`
            : `<div class="card-body muted">Nothing is running low — every product has stock.</div>`
        }
      </div>`

    main.querySelectorAll("tr.click").forEach((row) =>
      row.addEventListener("click", () => {
        location.hash = row.dataset.product ? `#/products/${row.dataset.product}` : `#/orders/${row.dataset.id}`
      })
    )
    main.querySelectorAll(".kpi.link").forEach((tile) =>
      tile.addEventListener("click", () => (location.hash = tile.dataset.go.split("?")[0]))
    )
  }

  // ---------------------------------------------------------------- products

  const productsView = async (params = {}) => {
    const offset = Number(params.offset) || 0
    const q = params.q || ""
    const status = params.status || ""
    const data = await api(
      `/products?limit=25&offset=${offset}&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}`
    )
    const isFiltered = Boolean(q || status)
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Products</h1><p class="sub">${data.count} product${data.count === 1 ? "" : "s"} in your shop. Click one to edit it.</p></div>
        <a href="#/products/new" class="btn primary">${icon("plus", "ico sm")}New product</a>
      </div>
      <div class="toolbar">
        ${searchBox("q", "Search by name, brand or tag…", q)}
        <select id="status-filter">
          <option value="">All products</option>
          <option value="published" ${status === "published" ? "selected" : ""}>Visible in the shop</option>
          <option value="draft" ${status === "draft" ? "selected" : ""}>Hidden (draft)</option>
        </select>
      </div>
      <div class="card">
        ${
          data.products.length
            ? `<table><thead><tr><th></th><th>Product</th><th>Category</th><th>Delivery</th><th class="num">Price</th><th class="num">In stock</th><th>Visibility</th></tr></thead>
              <tbody>${data.products
                .map((product) => {
                  const stock = (product.variants || []).reduce(
                    (sum, variant) => sum + (variant.manage_inventory ? variant.inventory_quantity : 0), 0)
                  return `<tr class="click" data-id="${esc(product.id)}">
                    <td>${product.thumbnail ? `<img class="thumb" src="${esc(product.thumbnail)}" alt="" data-fallback />` : `<span class="thumb"></span>`}</td>
                    <td><span class="cell-title">${esc(product.title)}</span>
                      ${product.brand ? `<span class="cell-sub">${esc(product.brand)}</span>` : ""}</td>
                    <td>${esc(product.categories?.[0]?.name || "—")}</td>
                    <td>${product.shipping_method ? `<span class="badge blue">${esc(product.shipping_method.name)}</span>` : '<span class="muted">—</span>'}</td>
                    <td class="num">${priceRange(product)}</td>
                    <td class="num">${stock === 0 ? `<span class="badge red">Sold out</span>` : stock}</td>
                    <td>${product.status === "published" ? `<span class="badge green">Visible</span>` : `<span class="badge">Hidden</span>`}</td>
                  </tr>`
                })
                .join("")}</tbody></table>
              ${pager(data.count, offset, 25, (nextOffset) => productsView({ q, status, offset: nextOffset }))}`
            : isFiltered
              ? emptyState({ title: "No products match", hint: "Try a different search word, or clear the filter to see everything." })
              : emptyState({
                  title: "No products yet",
                  hint: "Add your first product, or bring your whole catalogue in from an Excel file.",
                  action: { href: "#/products/new", label: "Add your first product" },
                })
        }
      </div>`
    $("#q").addEventListener("change", (event) => productsView({ q: event.target.value, status }))
    $("#status-filter").addEventListener("change", (event) => productsView({ q, status: event.target.value }))
    main.querySelectorAll("tr.click").forEach((row) =>
      row.addEventListener("click", () => (location.hash = `#/products/${row.dataset.id}`))
    )
    wireImageFallbacks()
  }

  /**
   * Variants & options editor.
   *
   * The manager describes options in plain words ("Memory" → "16GB, 32GB")
   * and the combinations are generated for them; each row only asks for
   * price, sale price, stock and SKU. No JSON anywhere.
   */
  const createVariantEditor = (product) => {
    let options = (product.options || [])
      .filter((option) => option.title && option.title !== "Default")
      .map((option) => ({
        title: option.title,
        values: (option.values || []).map((value) => (typeof value === "string" ? value : value.value)).filter(Boolean),
      }))

    let variants = (product.variants || []).map((variant) => ({
      id: variant.id || null,
      options: { ...(variant.options || {}) },
      sku: variant.sku || "",
      price: variant.price ?? "",
      sale_price: variant.sale_price ?? "",
      stock: variant.stock ?? 0,
      manage_stock: variant.manage_stock !== false,
    }))
    if (!variants.length) variants = [{ id: null, options: {}, sku: "", price: "", sale_price: "", stock: 0, manage_stock: true }]

    let root = null
    const comboKey = (values) => values.join(" ▸ ")
    const variantKey = (variant) => comboKey(options.map((option) => variant.options[option.title] || ""))
    const variantLabel = (variant) => {
      const parts = options.map((option) => variant.options[option.title]).filter(Boolean)
      return parts.length ? parts.join(" / ") : "Standard"
    }

    /** Cartesian product of the option values. */
    const combinations = () =>
      options.reduce(
        (acc, option) => acc.flatMap((combo) => option.values.map((value) => [...combo, value])),
        [[]]
      )

    /** Rebuilds the variant rows after the options changed, keeping prices. */
    const syncVariants = () => {
      if (!options.length) {
        variants = [variants[0] || { id: null, options: {}, sku: "", price: "", sale_price: "", stock: 0, manage_stock: true }]
        variants[0].options = {}
        return { added: 0, removed: 0 }
      }
      const existing = new Map(variants.map((variant) => [variantKey(variant), variant]))
      const template = variants[0] || {}
      let added = 0
      const next = combinations().map((values) => {
        const found = existing.get(comboKey(values))
        if (found) {
          existing.delete(comboKey(values))
          return found
        }
        added++
        return {
          id: null,
          options: Object.fromEntries(options.map((option, index) => [option.title, values[index]])),
          sku: "",
          price: template.price ?? "",
          sale_price: "",
          stock: 0,
          manage_stock: true,
        }
      })
      const removed = existing.size
      variants = next
      return { added, removed }
    }

    const readInputs = () => {
      root.querySelectorAll("[data-variant-index]").forEach((row) => {
        const index = Number(row.dataset.variantIndex)
        const variant = variants[index]
        if (!variant) return
        const get = (name) => row.querySelector(`[name="${name}"]`)
        variant.sku = get("v_sku").value.trim()
        variant.price = get("v_price").value
        variant.sale_price = get("v_sale").value
        variant.stock = get("v_stock").value
        variant.manage_stock = get("v_manage").checked
      })
    }

    const render = () => {
      root.innerHTML = `
        <div class="card">
          <div class="card-head">Options
            <span class="muted">Only if the product comes in choices, like memory size or colour</span></div>
          <div class="card-body">
            <div class="option-builder" id="option-rows">
              ${
                options.length
                  ? options
                      .map(
                        (option, index) => `
                        <div class="option-row" data-option-index="${index}">
                          <label>Option name
                            <input name="o_title" value="${esc(option.title)}" placeholder="Memory" /></label>
                          <label>Choices <span class="help">Separate with commas</span>
                            <input name="o_values" value="${esc(option.values.join(", "))}" placeholder="16GB, 32GB" /></label>
                          <button type="button" class="btn small danger remove-option" title="Remove this option">✕</button>
                        </div>`
                      )
                      .join("")
                  : `<p class="muted" style="margin:0">This product is sold as a single item. Add an option only if customers must choose between versions.</p>`
              }
            </div>
            <div class="row" style="margin-top:12px">
              <button type="button" class="btn small" id="add-option">${icon("plus", "ico sm")}Add an option</button>
              ${options.length ? `<button type="button" class="btn small primary" id="apply-options">Update the list below</button>` : ""}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${options.length ? "Price &amp; stock per version" : "Price &amp; stock"}
            <span class="muted">Prices in euro, tax included</span></div>
          <div class="card-body">
            <table class="variant-table">
              <thead><tr>
                <th>${options.length ? "Version" : "Item"}</th><th>Product code (SKU)</th>
                <th style="width:120px">Price €</th><th style="width:120px">Sale price €</th>
                <th style="width:110px">In stock</th><th style="width:90px">Track stock</th>
              </tr></thead>
              <tbody>
                ${variants
                  .map(
                    (variant, index) => `
                    <tr data-variant-index="${index}">
                      <td><span class="variant-name">${esc(variantLabel(variant))}
                        ${variant.id ? "" : `<span class="muted">new</span>`}</span></td>
                      <td><input name="v_sku" value="${esc(variant.sku)}" placeholder="optional" /></td>
                      <td><input name="v_price" type="number" step="0.01" min="0" value="${esc(variant.price)}" /></td>
                      <td><input name="v_sale" type="number" step="0.01" min="0" value="${esc(variant.sale_price)}" placeholder="—" /></td>
                      <td><input name="v_stock" type="number" step="1" min="0" value="${esc(variant.stock)}" /></td>
                      <td style="text-align:center"><input name="v_manage" type="checkbox" ${variant.manage_stock ? "checked" : ""} /></td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <p class="field-note">Leave <strong>Sale price</strong> empty unless the item is discounted — it must be lower than the price.
              Untick <strong>Track stock</strong> for items you never run out of.</p>
          </div>
        </div>`

      root.querySelector("#add-option")?.addEventListener("click", () => {
        readInputs()
        readOptions()
        options.push({ title: "", values: [] })
        render()
      })

      root.querySelector("#apply-options")?.addEventListener("click", () => {
        readInputs()
        readOptions()
        const invalid = options.find((option) => !option.title || !option.values.length)
        if (invalid) return toast("Give every option a name and at least one choice.", true)
        const { added, removed } = syncVariants()
        render()
        toast(
          added || removed
            ? `Versions updated — ${added} added${removed ? `, ${removed} removed` : ""}.`
            : "Versions are already up to date."
        )
      })

      root.querySelectorAll(".remove-option").forEach((button) =>
        button.addEventListener("click", () => {
          readInputs()
          readOptions()
          options.splice(Number(button.closest("[data-option-index]").dataset.optionIndex), 1)
          syncVariants()
          render()
        })
      )
    }

    const readOptions = () => {
      options = [...root.querySelectorAll("[data-option-index]")].map((row) => ({
        title: row.querySelector('[name="o_title"]').value.trim(),
        values: row
          .querySelector('[name="o_values"]')
          .value.split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }))
    }

    return {
      mount(element) {
        root = element
        render()
      },
      /** Product payload pieces: options definition + variant rows. */
      collect() {
        readInputs()
        readOptions()
        const cleanOptions = options.filter((option) => option.title && option.values.length)
        return {
          options: cleanOptions.map((option) => ({ title: option.title, values: option.values })),
          variants: variants.map((variant) => ({
            id: variant.id || undefined,
            title: variantLabel(variant) === "Standard" ? "Default" : variantLabel(variant),
            sku: variant.sku || null,
            options: cleanOptions.length ? variant.options : {},
            price: Number(variant.price),
            sale_price: variant.sale_price === "" || variant.sale_price === null ? null : Number(variant.sale_price),
            stock: Number(variant.stock) || 0,
            manage_stock: variant.manage_stock,
          })),
        }
      },
    }
  }

  const productEditView = async (id) => {
    const isNew = id === "new"
    const [{ categories }, { suppliers }, { shipping_methods }, aiStatus] = await Promise.all([
      api("/categories"),
      api("/suppliers"),
      api("/shipping-methods"),
      api("/ai/status"),
    ])
    const product = isNew
      ? { title: "", status: "published", images: [], tags: [], variants: [{}], metadata: {} }
      : (await api(`/products/${id}`)).product

    const categoryOptions = categories
      .map(
        (category) =>
          `<option value="${esc(category.id)}" ${category.id === product.category_id ? "selected" : ""}>
            ${esc(category.parent_category_id ? "— " : "")}${esc(category.name)}</option>`
      )
      .join("")
    const supplierOptions = suppliers
      .map((s) => `<option value="${esc(s.id)}" ${s.id === product.supplier_id ? "selected" : ""}>${esc(s.name)}</option>`)
      .join("")
    const shippingOptions = shipping_methods
      .filter((method) => method.is_active || method.id === product.shipping_method_id)
      .map(
        (method) =>
          `<option value="${esc(method.id)}" ${method.id === product.shipping_method_id ? "selected" : ""}>
            ${esc(method.name)} — ${eur(method.price)}</option>`
      )
      .join("")
    const supplierShipping = new Map(suppliers.map((s) => [s.id, s.shipping_method_id]))
    const images = createImageManager(product.images || [], { multiple: true })

    const variantEditor = createVariantEditor(product)

    main.innerHTML = `
      <a class="back-link" href="#/products">${icon("back", "ico sm")}All products</a>
      <div class="page-head">
        <div><h1>${isNew ? "New product" : esc(product.title)}</h1>
          ${isNew
            ? `<p class="sub">Fill in the name and price — everything else is optional and can be added later.</p>`
            : `<p class="sub">Shop address: <a href="http://localhost:3000/product/${esc(product.handle)}" target="_blank" rel="noreferrer">/product/${esc(product.handle)}</a></p>`}</div>
        <div class="row">
          ${isNew ? "" : `<button class="btn danger" id="delete-product">Delete product</button>`}
          <button class="btn primary" id="save-product">${isNew ? "Create product" : "Save changes"}</button>
        </div>
      </div>

      <div class="card"><div class="card-head">Basics</div><div class="card-body form-grid">
        <label class="span2">Product name
          <input id="p_title" value="${esc(product.title)}" placeholder="e.g. GeForce RTX 4070 12GB" /></label>
        <label>Visibility
          <select id="p_status">
            <option value="published" ${product.status === "published" ? "selected" : ""}>Visible in the shop</option>
            <option value="draft" ${product.status === "draft" ? "selected" : ""}>Hidden — still working on it</option>
          </select></label>
        <label>Brand <input id="p_brand" value="${esc(product.brand || "")}" placeholder="e.g. NVIDIA" /></label>
        <label>Category <select id="p_category"><option value="">Not in a category</option>${categoryOptions}</select></label>
        <label>Supplier <select id="p_supplier"><option value="">No supplier</option>${supplierOptions}</select>
          <span class="help">Who you buy it from. Picking one fills in their delivery option.</span></label>
        <label class="span2">Delivery option
          <select id="p_shipping">${shippingOptions}</select>
          <span class="help">What the customer pays for delivery of this product.</span></label>
        <label class="span2">Description
          <textarea id="p_description" rows="5" placeholder="What is it, who is it for, key specs…">${esc(product.description || "")}</textarea></label>
        <label>Search tags <input id="p_tags" value="${esc((product.tags || []).join(", "))}" placeholder="gpu, nvidia, gaming" />
          <span class="help">Words customers might search for. Separate with commas.</span></label>
        <label>Weight in grams <input id="p_weight" type="number" value="${esc(product.weight ?? "")}" placeholder="optional" /></label>
        <label class="checkbox span2"><input id="p_featured" type="checkbox" ${product.metadata?.featured === "true" ? "checked" : ""} />
          Show this product on the shop's home page</label>
      </div></div>

      <div class="card"><div class="card-head">Photos <span class="muted">The first photo is the one customers see first</span></div>
        <div class="card-body" id="p_images"></div>
      </div>

      <div id="variant-editor"></div>

      <div class="card"><div class="card-head">Albanian text
          <span class="muted">Leave empty to show the English text to Albanian shoppers</span></div>
        <div class="card-body form-grid">
        <label class="span2">Product name in Albanian <input id="p_title_sq" value="${esc(product.metadata?.title_sq || "")}" /></label>
        <label class="span2">Description in Albanian <textarea id="p_desc_sq" rows="4">${esc(product.metadata?.description_sq || "")}</textarea></label>
      </div></div>

      <div class="card"><div class="card-head">Write it for me ${icon("campaigns", "ico sm")}</div><div class="card-body" id="ai-panel">
        ${
          aiStatus.configured
            ? `<p class="muted" style="margin-top:0">Let the assistant draft the text. Nothing is saved until you review it and press Save.</p>
              <div class="row">
                <label class="checkbox"><input type="checkbox" id="ai_f_title" /> Name</label>
                <label class="checkbox"><input type="checkbox" id="ai_f_desc" checked /> Description</label>
                <label class="checkbox"><input type="checkbox" id="ai_f_tags" checked /> Search tags</label>
                <select id="ai_lang" style="width:auto"><option value="sq">In Albanian</option><option value="en">In English</option></select>
                <button class="btn" id="ai-generate" ${isNew ? "disabled title='Save the product first'" : ""}>Write a draft</button>
              </div>
              ${isNew ? `<p class="field-note">Save the product first, then the assistant can use its details.</p>` : ""}
              <div id="ai-result"></div>`
            : `<span class="muted">This is switched off. To enable it, add an OpenAI key (OPENAI_API_KEY) to the server settings file.</span>`
        }
      </div></div>`

    images.mount($("#p_images"))
    variantEditor.mount($("#variant-editor"))

    // Picking a supplier suggests their shipping option (still overridable).
    $("#p_supplier").addEventListener("change", (event) => {
      const methodId = supplierShipping.get(event.target.value)
      if (methodId) $("#p_shipping").value = methodId
    })

    const collect = () => {
      const { options, variants } = variantEditor.collect()
      return {
        title: $("#p_title").value.trim(),
        status: $("#p_status").value,
        brand: $("#p_brand").value.trim(),
        category_id: $("#p_category").value || null,
        supplier_id: $("#p_supplier").value || null,
        shipping_method_id: $("#p_shipping").value || null,
        description: $("#p_description").value,
        tags: $("#p_tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
        weight: $("#p_weight").value || null,
        images: images.images,
        options,
        variants,
        metadata: {
          ...(product.metadata || {}),
          featured: $("#p_featured").checked ? "true" : undefined,
          title_sq: $("#p_title_sq").value.trim() || undefined,
          description_sq: $("#p_desc_sq").value.trim() || undefined,
        },
      }
    }

    const saveButton = $("#save-product")
    saveButton.addEventListener("click", async () => {
      const body = collect()
      // Catch the two mistakes people actually make, in their own words.
      if (!body.title) return toast("Give the product a name first.", true)
      const badPrice = body.variants.find((variant) => !Number.isFinite(variant.price) || variant.price <= 0)
      if (badPrice) return toast("Every version needs a price above zero.", true)

      saveButton.disabled = true
      saveButton.textContent = "Saving…"
      try {
        const saved = isNew
          ? await api("/products", { method: "POST", body })
          : await api(`/products/${id}`, { method: "PATCH", body })
        toast(isNew ? "Product created." : "Changes saved.")
        if (isNew) location.hash = `#/products/${saved.product.id}`
        else productEditView(id)
      } catch (error) {
        toast(error.message, true)
        saveButton.disabled = false
        saveButton.textContent = "Save changes"
      }
    })

    $("#delete-product")?.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: `Delete “${product.title}”?`,
        message: "It disappears from the shop straight away. Past orders keep their copy of it. This cannot be undone.",
        confirmLabel: "Delete product",
      })
      if (!ok) return
      await api(`/products/${id}`, { method: "DELETE" })
      toast("Product deleted.")
      location.hash = "#/products"
    })

    $("#ai-generate")?.addEventListener("click", async () => {
      const fields = [
        $("#ai_f_title").checked && "title",
        $("#ai_f_desc").checked && "description",
        $("#ai_f_tags").checked && "tags",
      ].filter(Boolean)
      if (!fields.length) return toast("Pick at least one field.", true)
      const button = $("#ai-generate")
      button.disabled = true
      button.textContent = "Generating..."
      try {
        const { suggestions } = await api("/ai/enhance", {
          method: "POST",
          body: { product_id: id, fields, language: $("#ai_lang").value },
        })
        const language = $("#ai_lang").value
        $("#ai-result").innerHTML = Object.entries(suggestions)
          .map(
            ([field, value]) => `<div class="suggestion">
              <strong>${esc(field)}</strong>: ${esc(Array.isArray(value) ? value.join(", ") : value)}
              <div class="row"><button class="btn small use-suggestion" data-field="${esc(field)}" data-lang="${esc(language)}">Use</button></div>
              <textarea class="hidden" data-raw="${esc(field)}">${esc(Array.isArray(value) ? value.join(", ") : value)}</textarea>
            </div>`
          )
          .join("")
        $("#ai-result").querySelectorAll(".use-suggestion").forEach((useButton) =>
          useButton.addEventListener("click", () => {
            const field = useButton.dataset.field
            const value = $(`#ai-result textarea[data-raw="${field}"]`).value
            const sq = useButton.dataset.lang === "sq"
            if (field === "title") (sq ? $("#p_title_sq") : $("#p_title")).value = value
            if (field === "description") (sq ? $("#p_desc_sq") : $("#p_description")).value = value
            if (field === "tags") $("#p_tags").value = value
            toast("Suggestion applied to the form — review and Save.")
          })
        )
      } catch (error) {
        toast(error.message, true)
      } finally {
        button.disabled = false
        button.textContent = "Generate suggestions"
      }
    })
  }

  // ---------------------------------------------------------------- categories

  const categoriesView = async (editId = null) => {
    const { categories } = await api("/categories")
    const editing = categories.find((category) => category.id === editId) || null
    const parentOptions = (excludeId) =>
      categories
        .filter((category) => !category.parent_category_id && category.id !== excludeId)
        .map(
          (category) =>
            `<option value="${esc(category.id)}" ${editing?.parent_category_id === category.id ? "selected" : ""}>${esc(category.name)}</option>`
        )
        .join("")

    const ordered = [
      ...categories.filter((c) => !c.parent_category_id).flatMap((parent) => [
        parent,
        ...categories.filter((child) => child.parent_category_id === parent.id).map((child) => ({ ...child, __child: true })),
      ]),
    ]

    main.innerHTML = `
      <div class="page-head"><div><h1>Categories</h1><p class="sub">${categories.length} categories</p></div></div>
      <div class="card"><div class="card-head">${editing ? `Edit: ${esc(editing.name)}` : "Add category"}</div>
        <div class="card-body form-grid" id="cat-form">
          <label>Name (English) <input id="c_name" value="${esc(editing?.name || "")}" /></label>
          <label>Parent <select id="c_parent"><option value="">— top level</option>${parentOptions(editId)}</select></label>
          <label>Emri (Albanian) <input id="c_name_sq" value="${esc(editing?.metadata?.name_sq || "")}" placeholder="shown as the storefront default" /></label>
          <label>Përshkrimi (Albanian) <input id="c_desc_sq" value="${esc(editing?.metadata?.description_sq || "")}" /></label>
          <label class="span2">Description (English) <input id="c_desc" value="${esc(editing?.description || "")}" /></label>
          <div class="span2">
            <span style="font-weight:500;font-size:13px">Image <span class="muted">— shown on the home page category cards</span></span>
            <div id="c_image" style="margin-top:6px"></div>
          </div>
          <label class="checkbox"><input id="c_active" type="checkbox" ${editing?.is_active === false ? "" : "checked"} /> Active</label>
          <div class="row">
            <button class="btn primary" id="c_save">${editing ? "Save" : "Add"}</button>
            ${editing ? `<a class="btn" href="#/categories">Cancel</a>` : ""}
          </div>
        </div></div>
      <div class="card">
        <table><thead><tr><th></th><th>Name</th><th>Handle</th><th>Products</th><th>Active</th><th></th></tr></thead>
        <tbody>${ordered
          .map(
            (category) => `<tr>
            <td>${category.metadata?.image ? `<img class="thumb" src="${esc(category.metadata.image)}" alt="" data-fallback />` : ""}</td>
            <td>${category.__child ? '<span class="muted">— </span>' : ""}${esc(category.name)}</td>
            <td class="muted">${esc(category.handle)}</td>
            <td>${category.product_count}</td>
            <td>${category.is_active ? '<span class="badge green">yes</span>' : '<span class="badge">no</span>'}</td>
            <td class="row">
              <a class="btn small" href="#/categories/${esc(category.id)}">Edit</a>
              <button class="btn small danger del-cat" data-id="${esc(category.id)}" data-name="${esc(category.name)}">Delete</button>
            </td></tr>`
          )
          .join("")}</tbody></table>
      </div>`

    const categoryImage = createImageManager(editing?.metadata?.image ? [editing.metadata.image] : [], {
      multiple: false,
    })
    categoryImage.mount($("#c_image"))
    wireImageFallbacks()

    $("#c_save").addEventListener("click", async () => {
      const body = {
        name: $("#c_name").value,
        name_sq: $("#c_name_sq").value,
        parent_id: $("#c_parent").value || null,
        description: $("#c_desc").value,
        description_sq: $("#c_desc_sq").value,
        image_url: categoryImage.images[0] || null,
        is_active: $("#c_active").checked,
      }
      try {
        if (editing) await api(`/categories/${editing.id}`, { method: "PATCH", body })
        else await api("/categories", { method: "POST", body })
        toast("Category saved.")
        location.hash = "#/categories"
        categoriesView()
      } catch (error) {
        toast(error.message, true)
      }
    })
    main.querySelectorAll(".del-cat").forEach((button) =>
      button.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Delete the “${button.dataset.name}” category?`,
          message: "Products inside it stay in the shop — they simply lose this category.",
          confirmLabel: "Delete category",
        })
        if (!ok) return
        await api(`/categories/${button.dataset.id}`, { method: "DELETE" })
        categoriesView()
      })
    )
  }

  // ---------------------------------------------------------------- orders

  const ordersView = async (params = {}) => {
    const offset = Number(params.offset) || 0
    const status = params.status || ""
    const q = params.q || ""
    const data = await api(`/orders?limit=25&offset=${offset}${status ? `&status=${status}` : ""}&q=${encodeURIComponent(q)}`)
    main.innerHTML = `
      <div class="page-head"><div><h1>Orders</h1>
        <p class="sub">${data.count} order${data.count === 1 ? "" : "s"}. Open one to mark it paid, sent or delivered.</p></div></div>
      <div class="toolbar">
        ${searchBox("q", "Search by email or order number…", q)}
        <select id="status-filter">
          <option value="">All orders</option>
          ${["pending", "processing", "shipped", "delivered", "canceled"]
            .map((s) => `<option value="${s}" ${status === s ? "selected" : ""}>${esc(STATUS_LABEL[s])}</option>`)
            .join("")}
        </select>
      </div>
      <div class="card">
        ${
          data.orders.length
            ? `<table><thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th class="num">Items</th><th class="num">Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>${data.orders
                .map(
                  (order) => `<tr class="click" data-id="${esc(order.id)}">
                    <td class="cell-title">#${order.display_id}</td>
                    <td class="muted">${esc(when(order.created_at))}</td>
                    <td>${esc(order.email)}</td>
                    <td class="num">${order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td class="num">${eur(order.total)}</td>
                    <td>${payBadge(order.payment_status)}</td><td>${statusBadge(order.status)}</td>
                  </tr>`
                )
                .join("")}</tbody></table>
              ${pager(data.count, offset, 25, (nextOffset) => ordersView({ status, q, offset: nextOffset }))}`
            : (q || status)
              ? emptyState({ title: "No orders match", hint: "Try another search word, or switch the filter back to “All orders”." })
              : emptyState({ title: "No orders yet", hint: "As soon as someone buys something in the shop, their order shows up here." })
        }
      </div>`
    $("#q").addEventListener("change", (event) => ordersView({ status, q: event.target.value }))
    $("#status-filter").addEventListener("change", (event) => ordersView({ q, status: event.target.value }))
    main.querySelectorAll("tr.click").forEach((row) =>
      row.addEventListener("click", () => (location.hash = `#/orders/${row.dataset.id}`))
    )
  }

  const orderDetailView = async (id) => {
    const { order } = await api(`/orders/${id}`)
    const address = order.shipping_address || {}
    const nextStatuses = { pending: ["processing", "canceled"], processing: ["shipped", "canceled"], shipped: ["delivered"], delivered: [], canceled: [] }[order.status] || []
    const remaining = order.total - order.refunded_total

    main.innerHTML = `
      <div class="page-head">
        <div><h1>Order #${order.display_id}</h1><p class="sub">${esc(when(order.created_at))} · ${esc(order.email)}</p></div>
        <a href="#/orders" class="btn">Back</a>
      </div>

      <div class="card"><div class="card-head">
          <span>${statusBadge(order.status)} ${payBadge(order.payment_status)}
            <span class="badge">${esc(order.payment_method)}</span></span>
          <span class="row">
            ${nextStatuses.map((s) => `<button class="btn small set-status" data-status="${s}">${s === "canceled" ? "Cancel order" : `Mark ${s}`}</button>`).join("")}
            ${order.payment_status === "awaiting" && order.status !== "canceled" ? `<button class="btn small primary" id="capture">Mark paid</button>` : ""}
            ${remaining > 0 && order.payment_status !== "awaiting" && order.status !== "canceled" ? `<button class="btn small danger" id="refund">Refund…</button>` : ""}
          </span>
        </div>
        <table><thead><tr><th></th><th>Product</th><th>SKU</th><th>Unit</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${order.items
          .map(
            (item) => `<tr>
              <td>${item.thumbnail ? `<img class="thumb" src="${esc(item.thumbnail)}" alt="" data-fallback />` : ""}</td>
              <td>${esc(item.product_title)}${item.variant_title && item.variant_title !== "Default" ? ` <span class="muted">/ ${esc(item.variant_title)}</span>` : ""}</td>
              <td class="muted">${esc(item.sku || "—")}</td>
              <td>${eur(item.unit_price)}</td><td>${item.quantity}</td><td>${eur(item.total)}</td>
            </tr>`
          )
          .join("")}</tbody></table>
        <div class="card-body totals">
          <div><span class="muted">Subtotal</span><span>${eur(order.subtotal)}</span></div>
          ${order.discount_total > 0 ? `<div><span class="muted">Discount ${order.promo_code ? `(${esc(order.promo_code)})` : ""}</span><span>−${eur(order.discount_total)}</span></div>` : ""}
          ${order.shipping_methods
            .map(
              (shipment) =>
                `<div><span class="muted">Shipping — ${esc(shipment.name)}</span><span>${eur(shipment.amount)}</span></div>`
            )
            .join("")}
          ${order.refunded_total > 0 ? `<div><span class="muted">Refunded</span><span>−${eur(order.refunded_total)}</span></div>` : ""}
          <div class="grand"><span>Total</span><span>${eur(order.total)}</span></div>
        </div>
      </div>

      <div class="card"><div class="card-head">Customer & delivery</div><div class="card-body">
        <p>${esc(address.first_name)} ${esc(address.last_name)}${order.customer ? ` · <a href="#/customers/${esc(order.customer.id)}">registered customer</a>` : " · guest"}</p>
        <p class="muted">${esc(address.address_1)}, ${esc(address.city)} ${esc(address.postal_code)}, ${esc(String(address.country_code || "").toUpperCase())}${address.phone ? ` · ${esc(address.phone)}` : ""}</p>
        ${order.shipping_methods
          .map(
            (shipment) => `<p style="margin-bottom:0"><span class="badge blue">${esc(shipment.name)}</span>
              <span class="muted">${esc((shipment.products || []).join(", "))}</span></p>`
          )
          .join("")}
      </div></div>

      <div class="card"><div class="card-head">Timeline</div><div class="card-body">
        <div class="row" style="margin-bottom:12px">
          <input id="note-input" placeholder="Add an internal note..." style="max-width:400px" />
          <button class="btn small" id="add-note">Add note</button>
        </div>
        <ul class="timeline">${(order.events || [])
          .map((event) => {
            const data = event.data || {}
            const text =
              event.type === "placed" ? `Order placed (${esc(data.payment_method)})`
              : event.type === "status_changed" ? `Status: ${esc(data.from)} → ${esc(data.to)}${data.restocked ? " (items restocked)" : ""}`
              : event.type === "payment_captured" ? `Payment captured by ${esc(data.by)}`
              : event.type === "refunded" ? `Refunded ${eur(data.amount)}${data.reason ? ` — ${esc(data.reason)}` : ""}${data.restock ? " (restocked)" : ""} by ${esc(data.by)}`
              : event.type === "note" ? `📝 ${esc(data.note)} <span class="muted">— ${esc(data.by)}</span>`
              : esc(event.type)
            return `<li>${text}<div class="when">${esc(when(event.created_at))}</div></li>`
          })
          .join("")}</ul>
      </div></div>`

    wireImageFallbacks()

    main.querySelectorAll(".set-status").forEach((button) =>
      button.addEventListener("click", async () => {
        const status = button.dataset.status
        if (status === "canceled") {
          const ok = await confirmDialog({
            title: `Cancel order #${order.display_id}?`,
            message: "The items go back into stock and the customer is emailed about the cancellation.",
            confirmLabel: "Cancel this order",
          })
          if (!ok) return
        }
        try {
          await api(`/orders/${id}/status`, { method: "POST", body: { status } })
          toast(`Customer notified — order marked ${STATUS_LABEL[status].toLowerCase()}.`)
          orderDetailView(id)
        } catch (error) {
          toast(error.message, true)
        }
      })
    )

    $("#capture")?.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Mark this order as paid?",
        message: `Confirm you received ${eur(order.total)} from the customer. They get a payment confirmation email.`,
        confirmLabel: "Yes, money received",
        danger: false,
      })
      if (!ok) return
      await api(`/orders/${id}/capture`, { method: "POST" })
      toast("Payment recorded and customer notified.")
      orderDetailView(id)
    })

    $("#refund")?.addEventListener("click", async () => {
      const result = await openModal({
        title: `Refund order #${order.display_id}`,
        message: `You can refund up to ${eur(remaining)}. The customer receives an email about it.`,
        iconName: "warn",
        danger: true,
        confirmLabel: "Send refund",
        wide: true,
        body: `
          <label>How much are you refunding?
            <input id="rf_amount" type="number" step="0.01" min="0.01" max="${remaining}" value="${remaining.toFixed(2)}" />
            <span class="help">Full amount is filled in — change it for a partial refund.</span>
          </label>
          <label>Reason <span class="help">Saved in the order history for your records</span>
            <input id="rf_reason" placeholder="e.g. Customer returned the item" />
          </label>
          <label class="checkbox"><input id="rf_restock" type="checkbox" checked />
            Put the items back into stock</label>
          <label class="checkbox"><input id="rf_notify" type="checkbox" checked />
            Email the customer about this refund</label>
          <p class="form-error modal-error hidden"></p>`,
        collect: (root) => {
          const amount = Number(root.querySelector("#rf_amount").value)
          if (!Number.isFinite(amount) || amount <= 0) {
            modalError(root, "Enter how much you are refunding.")
            return undefined
          }
          if (amount > remaining + 0.001) {
            modalError(root, `That is more than the ${eur(remaining)} still refundable.`)
            return undefined
          }
          return {
            amount,
            reason: root.querySelector("#rf_reason").value.trim(),
            restock: root.querySelector("#rf_restock").checked,
            notify: root.querySelector("#rf_notify").checked,
          }
        },
      })
      if (!result) return
      try {
        await api(`/orders/${id}/refund`, { method: "POST", body: result })
        toast(`Refund of ${eur(result.amount)} recorded.`)
        orderDetailView(id)
      } catch (error) {
        toast(error.message, true)
      }
    })
    $("#add-note").addEventListener("click", async () => {
      const note = $("#note-input").value.trim()
      if (!note) return
      await api(`/orders/${id}/notes`, { method: "POST", body: { note } })
      orderDetailView(id)
    })
  }

  // ---------------------------------------------------------------- customers

  const customersView = async (params = {}) => {
    const offset = Number(params.offset) || 0
    const q = params.q || ""
    const data = await api(`/customers?limit=25&offset=${offset}&q=${encodeURIComponent(q)}`)
    main.innerHTML = `
      <div class="page-head"><div><h1>Customers</h1>
        <p class="sub">${data.count} registered customer${data.count === 1 ? "" : "s"}. Open one to see their orders or put them in a group.</p></div></div>
      <div class="toolbar">${searchBox("q", "Search by name or email…", q)}</div>
      <div class="card">
        ${
          data.customers.length
            ? `<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="num">Orders</th><th class="num">Total spent</th><th>Customer since</th></tr></thead>
        <tbody>${data.customers
          .map(
            (customer) => `<tr class="click" data-id="${esc(customer.id)}">
              <td class="cell-title">${esc(customer.first_name)} ${esc(customer.last_name)}</td>
              <td>${esc(customer.email)}</td><td class="muted">${esc(customer.phone || "—")}</td>
              <td class="num">${customer.order_count}</td><td class="num">${eur(customer.total_spent)}</td>
              <td class="muted">${esc(new Date(customer.created_at).toLocaleDateString("en-GB"))}</td>
            </tr>`
          )
          .join("")}</tbody></table>
        ${pager(data.count, offset, 25, (nextOffset) => customersView({ q, offset: nextOffset }))}`
            : q
              ? emptyState({ title: "Nobody matches", hint: "Try part of their name or email address." })
              : emptyState({ title: "No customers yet", hint: "People who create an account in the shop appear here. Guests who order without an account show up under Orders." })
        }
      </div>`
    $("#q").addEventListener("change", (event) => customersView({ q: event.target.value }))
    main.querySelectorAll("tr.click").forEach((row) =>
      row.addEventListener("click", () => (location.hash = `#/customers/${row.dataset.id}`))
    )
  }

  const customerDetailView = async (id) => {
    const [{ customer, orders, group_ids, price_lists }, { customer_groups }] = await Promise.all([
      api(`/customers/${id}`),
      api("/customer-groups"),
    ])
    const memberOf = new Set(group_ids)

    main.innerHTML = `
      <div class="page-head">
        <div><h1>${esc(customer.first_name)} ${esc(customer.last_name)}</h1>
          <p class="sub">${esc(customer.email)}${customer.phone ? ` · ${esc(customer.phone)}` : ""}</p></div>
        <a href="#/customers" class="btn">Back</a>
      </div>

      <div class="card"><div class="card-head">Groups & pricing</div><div class="card-body">
        <p class="muted" style="margin-top:0">Groups decide which price lists this customer gets.</p>
        <div class="multi-select" style="max-width:420px">
          ${
            customer_groups.length
              ? customer_groups
                  .map(
                    (group) => `<label><input type="checkbox" class="cust-group" value="${esc(group.id)}"
                      ${memberOf.has(group.id) ? "checked" : ""} /> ${esc(group.name)}</label>`
                  )
                  .join("")
              : `<span class="muted">No groups yet — create one under Customer Groups.</span>`
          }
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn small primary" id="save-groups">Save groups</button>
          ${
            price_lists.length
              ? `<span class="muted">Active price lists: ${price_lists.map((list) => esc(list.name)).join(", ")}</span>`
              : `<span class="muted">No price list applies to this customer yet.</span>`
          }
        </div>
      </div></div>

      <div class="card"><div class="card-head">Orders (${orders.length})</div>
        <table><thead><tr><th>#</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>${orders
          .map(
            (order) => `<tr class="click" data-id="${esc(order.id)}">
              <td>#${order.display_id}</td><td>${esc(when(order.created_at))}</td>
              <td>${eur(order.total)}</td><td>${payBadge(order.payment_status)}</td><td>${statusBadge(order.status)}</td>
            </tr>`
          )
          .join("")}</tbody></table>
      </div>`

    $("#save-groups").addEventListener("click", async () => {
      const groupIds = [...main.querySelectorAll(".cust-group:checked")].map((input) => input.value)
      try {
        await api(`/customers/${id}/groups`, { method: "PUT", body: { group_ids: groupIds } })
        toast("Groups updated.")
        customerDetailView(id)
      } catch (error) {
        toast(error.message, true)
      }
    })

    main.querySelectorAll("tr.click").forEach((row) =>
      row.addEventListener("click", () => (location.hash = `#/orders/${row.dataset.id}`))
    )
  }

  // ---------------------------------------------------------------- customer groups

  const groupsView = async (editId = null) => {
    const { customer_groups } = await api("/customer-groups")
    const editing = customer_groups.find((group) => group.id === editId) || null

    main.innerHTML = `
      <div class="page-head"><div><h1>Customer groups</h1>
        <p class="sub">Put customers in a group, then give the group its own price list — that's how B2B / reseller pricing works.</p></div></div>
      <div class="card"><div class="card-head">${editing ? `Edit ${esc(editing.name)}` : "Add group"}</div>
        <div class="card-body form-grid">
          <label>Name <input id="g_name" value="${esc(editing?.name || "")}" placeholder="Wholesale" /></label>
          <label>Description <input id="g_desc" value="${esc(editing?.description || "")}" /></label>
          <div class="row span2">
            <button class="btn primary" id="g_save">${editing ? "Save" : "Add"}</button>
            ${editing ? `<a class="btn" href="#/groups">Cancel</a>` : ""}
          </div>
        </div></div>
      <div class="card">
        <table><thead><tr><th>Name</th><th>Description</th><th>Members</th><th>Price lists</th><th></th></tr></thead>
        <tbody>${customer_groups
          .map(
            (group) => `<tr>
              <td><strong>${esc(group.name)}</strong></td>
              <td class="muted">${esc(group.description || "—")}</td>
              <td>${group.member_count}</td>
              <td>${group.price_list_count}</td>
              <td class="row">
                <a class="btn small" href="#/groups/${esc(group.id)}">Edit</a>
                <button class="btn small danger del" data-id="${esc(group.id)}" data-name="${esc(group.name)}">Delete</button>
              </td></tr>`
          )
          .join("")}</tbody></table>
      </div>`

    $("#g_save").addEventListener("click", async () => {
      const body = { name: $("#g_name").value, description: $("#g_desc").value }
      try {
        if (editing) await api(`/customer-groups/${editing.id}`, { method: "PATCH", body })
        else await api("/customer-groups", { method: "POST", body })
        toast("Group saved.")
        location.hash = "#/groups"
        groupsView()
      } catch (error) {
        toast(error.message, true)
      }
    })
    main.querySelectorAll(".del").forEach((button) =>
      button.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Delete the “${button.dataset.name}” group?`,
          message: "Customers stay in the shop, but any price list made for this group is deleted with it.",
          confirmLabel: "Delete group",
        })
        if (!ok) return
        await api(`/customer-groups/${button.dataset.id}`, { method: "DELETE" })
        groupsView()
      })
    )
  }

  // ---------------------------------------------------------------- price lists

  const priceListsView = async () => {
    const { price_lists } = await api("/price-lists")
    const targetLabel = (list) =>
      list.customer_email
        ? `<span class="badge blue">Customer: ${esc(list.customer_email)}</span>`
        : list.group_name
          ? `<span class="badge blue">Group: ${esc(list.group_name)}</span>`
          : `<span class="badge">Everyone</span>`

    main.innerHTML = `
      <div class="page-head">
        <div><h1>Price lists</h1>
          <p class="sub">Prices that beat the base price for everyone, a customer group, or one customer. Quantity tiers give volume pricing.</p></div>
        <a href="#/price-lists/new" class="btn primary">New price list</a>
      </div>
      <div class="card">
        <table><thead><tr><th>Name</th><th>Applies to</th><th>Type</th><th>Prices</th><th>Priority</th><th>Active</th></tr></thead>
        <tbody>${price_lists
          .map(
            (list) => `<tr class="click" data-id="${esc(list.id)}">
              <td><strong>${esc(list.name)}</strong>${list.description ? `<br><span class="muted" style="font-size:12px">${esc(list.description)}</span>` : ""}</td>
              <td>${targetLabel(list)}</td>
              <td><span class="badge cap ${list.type === "override" ? "amber" : "green"}">${esc(list.type)}</span></td>
              <td>${list.price_count}</td>
              <td>${list.priority}</td>
              <td>${list.is_active ? '<span class="badge green">yes</span>' : '<span class="badge">no</span>'}</td>
            </tr>`
          )
          .join("")}</tbody></table>
      </div>
      <div class="card"><div class="card-body hint-box">
        <strong>How a price wins:</strong> highest priority first, then the most specific target (one customer beats a group, a group beats everyone),
        then the lowest price. A <strong>sale</strong> list shows as a discount on the storefront; an <strong>override</strong> list is simply "your price".
      </div></div>`

    main.querySelectorAll("tr.click").forEach((row) =>
      row.addEventListener("click", () => (location.hash = `#/price-lists/${row.dataset.id}`))
    )
  }

  const priceListEditView = async (id) => {
    const isNew = id === "new"
    const [{ customer_groups }, { customers }, { categories }] = await Promise.all([
      api("/customer-groups"),
      api("/customers?limit=200"),
      api("/categories"),
    ])

    let list = { name: "", type: "sale", priority: 0, is_active: true }
    let prices = []
    if (!isNew) {
      const data = await api(`/price-lists/${id}`)
      list = data.price_list
      prices = data.prices
    }

    const target = list.customer_id ? "customer" : list.customer_group_id ? "group" : "everyone"
    const dateValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "")

    main.innerHTML = `
      <div class="page-head">
        <div><h1>${isNew ? "New price list" : esc(list.name)}</h1></div>
        <div class="row">
          ${isNew ? "" : `<button class="btn danger" id="pl_delete">Delete</button>`}
          <a href="#/price-lists" class="btn">Back</a>
          <button class="btn primary" id="pl_save">Save</button>
        </div>
      </div>

      <div class="card"><div class="card-head">Settings</div><div class="card-body form-grid">
        <label>Name <input id="pl_name" value="${esc(list.name)}" placeholder="Wholesale pricing" /></label>
        <label>Type
          <select id="pl_type">
            <option value="sale" ${list.type !== "override" ? "selected" : ""}>Sale — shown as a discount</option>
            <option value="override" ${list.type === "override" ? "selected" : ""}>Override — negotiated "your price"</option>
          </select></label>
        <label class="span2">Description <input id="pl_desc" value="${esc(list.description || "")}" /></label>

        <label>Applies to
          <select id="pl_target">
            <option value="everyone" ${target === "everyone" ? "selected" : ""}>Everyone</option>
            <option value="group" ${target === "group" ? "selected" : ""}>A customer group</option>
            <option value="customer" ${target === "customer" ? "selected" : ""}>One customer</option>
          </select></label>
        <div id="pl_target_field"></div>

        <label>Priority <input id="pl_priority" type="number" value="${esc(list.priority ?? 0)}" />
          <span class="muted" style="font-weight:400;font-size:11.5px">Higher wins when several lists match.</span></label>
        <label class="checkbox" style="align-self:end"><input id="pl_active" type="checkbox" ${list.is_active === false ? "" : "checked"} /> Active</label>
        <label>Starts <input id="pl_starts" type="date" value="${dateValue(list.starts_at)}" /></label>
        <label>Ends <input id="pl_ends" type="date" value="${dateValue(list.ends_at)}" /></label>
      </div></div>

      ${
        isNew
          ? `<div class="card"><div class="card-body muted">Save the list first, then add prices.</div></div>`
          : `
      <div class="card"><div class="card-head">Prices <span class="muted">${prices.length} entries</span></div>
        <div class="card-body">
          <div class="form-grid" style="margin-bottom:14px">
            <label class="span2">Find a product or SKU
              <input id="pl_search" placeholder="Type at least 2 characters…" /></label>
            <div class="span2" id="pl_results"></div>
          </div>
          <div class="hint-box" style="margin-bottom:14px">
            <strong>Bulk fill:</strong> apply a percentage off the base price to a whole category.
            <div class="row" style="margin-top:8px">
              <select id="pl_bulk_cat" style="max-width:220px">
                <option value="">Whole catalog</option>
                ${categories.map((category) => `<option value="${esc(category.id)}">${esc(category.parent_category_id ? "— " : "")}${esc(category.name)}</option>`).join("")}
              </select>
              <input id="pl_bulk_percent" type="number" min="1" max="99" step="0.5" placeholder="% off" style="max-width:110px" />
              <input id="pl_bulk_qty" type="number" min="1" value="1" title="Minimum quantity" style="max-width:110px" />
              <button class="btn small" id="pl_bulk">Apply</button>
            </div>
          </div>
          <table><thead><tr><th>Product</th><th>SKU</th><th>Base</th><th>List price</th><th>Min qty</th><th></th></tr></thead>
          <tbody>${
            prices.length
              ? prices
                  .map(
                    (price) => `<tr>
                      <td>${esc(price.product_title)}${price.variant_title && price.variant_title !== "Default" ? ` <span class="muted">/ ${esc(price.variant_title)}</span>` : ""}</td>
                      <td class="muted">${esc(price.sku || "—")}</td>
                      <td class="muted">${eur(price.base_price)}</td>
                      <td><strong>${eur(price.price)}</strong>
                        <span class="muted">(−${Math.round((1 - price.price / price.base_price) * 100)}%)</span></td>
                      <td>${price.min_quantity > 1 ? `${price.min_quantity}+` : "—"}</td>
                      <td><button class="btn small danger del-price" data-variant="${esc(price.variant_id)}" data-qty="${price.min_quantity}">Remove</button></td>
                    </tr>`
                  )
                  .join("")
              : `<tr><td colspan="6" class="muted">No prices yet — search for a product above, or use bulk fill.</td></tr>`
          }</tbody></table>
        </div>
      </div>`
      }`

    const renderTargetField = () => {
      const value = $("#pl_target").value
      const holder = $("#pl_target_field")
      if (value === "group") {
        holder.innerHTML = `<label>Group <select id="pl_group">
          ${customer_groups.map((group) => `<option value="${esc(group.id)}" ${group.id === list.customer_group_id ? "selected" : ""}>${esc(group.name)}</option>`).join("")}
        </select></label>`
      } else if (value === "customer") {
        holder.innerHTML = `<label>Customer <select id="pl_customer">
          ${customers.map((customer) => `<option value="${esc(customer.id)}" ${customer.id === list.customer_id ? "selected" : ""}>${esc(customer.email)}</option>`).join("")}
        </select></label>`
      } else {
        holder.innerHTML = `<div class="muted" style="align-self:end;font-size:12.5px">Applies to every shopper.</div>`
      }
    }
    renderTargetField()
    $("#pl_target").addEventListener("change", renderTargetField)

    const collect = () => {
      const targetType = $("#pl_target").value
      return {
        name: $("#pl_name").value,
        description: $("#pl_desc").value,
        type: $("#pl_type").value,
        customer_group_id: targetType === "group" ? $("#pl_group")?.value || null : null,
        customer_id: targetType === "customer" ? $("#pl_customer")?.value || null : null,
        priority: $("#pl_priority").value,
        is_active: $("#pl_active").checked,
        starts_at: $("#pl_starts").value || null,
        ends_at: $("#pl_ends").value || null,
      }
    }

    $("#pl_save").addEventListener("click", async () => {
      try {
        const body = collect()
        const saved = isNew
          ? await api("/price-lists", { method: "POST", body })
          : await api(`/price-lists/${id}`, { method: "PATCH", body })
        toast("Price list saved.")
        if (isNew) location.hash = `#/price-lists/${saved.price_list.id}`
      } catch (error) {
        toast(error.message, true)
      }
    })

    $("#pl_delete")?.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: `Delete the “${list.name}” price list?`,
        message: "Every special price in it is removed, and those products go back to their normal price.",
        confirmLabel: "Delete price list",
      })
      if (!ok) return
      await api(`/price-lists/${id}`, { method: "DELETE" })
      location.hash = "#/price-lists"
    })

    // ---- prices editor (existing lists only)
    const search = $("#pl_search")
    if (search) {
      let timer
      search.addEventListener("input", () => {
        clearTimeout(timer)
        const term = search.value.trim()
        if (term.length < 2) {
          $("#pl_results").innerHTML = ""
          return
        }
        timer = setTimeout(async () => {
          const { variants } = await api(`/variants?q=${encodeURIComponent(term)}`)
          $("#pl_results").innerHTML = `<div class="search-results">${
            variants.length
              ? variants
                  .map(
                    (variant) => {
                      const label = `${variant.product_title}${variant.variant_title !== "Default" ? ` · ${variant.variant_title}` : ""}`
                      return `<div data-id="${esc(variant.id)}" data-price="${variant.price}" data-label="${esc(label)}">
                        <span>${esc(label)} <span class="muted">${esc(variant.sku || "")}</span></span>
                        <span class="muted">${eur(variant.price)}</span>
                      </div>`
                    }
                  )
                  .join("")
              : `<div class="muted">No matches.</div>`
          }</div>`

          $("#pl_results").querySelectorAll("[data-id]").forEach((row) =>
            row.addEventListener("click", async () => {
              const basePrice = Number(row.dataset.price)
              const result = await openModal({
                title: "Set the price for this product",
                message: `${row.dataset.label} — normally ${eur(basePrice)}.`,
                iconName: "pricelists",
                danger: false,
                confirmLabel: "Add this price",
                body: `
                  <label>Price in this list €
                    <input id="plp_price" type="number" step="0.01" min="0" value="${(basePrice * 0.9).toFixed(2)}" />
                    <span class="help">Suggested: 10% below the normal price. Change it to whatever you agreed.</span>
                  </label>
                  <label>Applies from this quantity
                    <input id="plp_qty" type="number" step="1" min="1" value="1" />
                    <span class="help">Leave at 1 for a normal price. Use e.g. 10 for a "buy 10 or more" rate.</span>
                  </label>
                  <p class="form-error modal-error hidden"></p>`,
                collect: (root) => {
                  const price = Number(root.querySelector("#plp_price").value)
                  if (!Number.isFinite(price) || price < 0) {
                    modalError(root, "Enter a price.")
                    return undefined
                  }
                  return { price, min_quantity: Math.max(1, Math.floor(Number(root.querySelector("#plp_qty").value) || 1)) }
                },
              })
              if (!result) return
              try {
                await api(`/price-lists/${id}/prices`, {
                  method: "POST",
                  body: { variant_id: row.dataset.id, ...result },
                })
                toast("Price added to the list.")
                priceListEditView(id)
              } catch (error) {
                toast(error.message, true)
              }
            })
          )
        }, 250)
      })

      $("#pl_bulk").addEventListener("click", async () => {
        const percent = Number($("#pl_bulk_percent").value)
        if (!percent) return toast("Enter a percentage.", true)
        try {
          const result = await api(`/price-lists/${id}/bulk`, {
            method: "POST",
            body: {
              percent_off: percent,
              category_id: $("#pl_bulk_cat").value || null,
              min_quantity: Number($("#pl_bulk_qty").value) || 1,
            },
          })
          toast(`${result.updated} prices written.`)
          priceListEditView(id)
        } catch (error) {
          toast(error.message, true)
        }
      })

      main.querySelectorAll(".del-price").forEach((button) =>
        button.addEventListener("click", async () => {
          await api(`/price-lists/${id}/prices`, {
            method: "DELETE",
            body: { variant_id: button.dataset.variant, min_quantity: Number(button.dataset.qty) },
          })
          priceListEditView(id)
        })
      )
    }
  }

  // ---------------------------------------------------------------- campaigns / shipping / suppliers

  const campaignsView = async (editId = null) => {
    const [{ campaigns }, { customer_groups }, { categories }, productsData] = await Promise.all([
      api("/campaigns"),
      api("/customer-groups"),
      api("/categories"),
      api("/products?limit=200"),
    ])
    const editing = campaigns.find((promo) => promo.id === editId) || null
    const dateValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "")

    const scopeLabel = (promo) => {
      if (promo.type === "free_shipping" || promo.applies_to === "shipping") return "Free shipping"
      if (promo.applies_to === "category") return `${promo.category_ids.length} categories`
      if (promo.applies_to === "product") return `${promo.product_ids.length} products`
      return "Whole order"
    }

    main.innerHTML = `
      <div class="page-head"><div><h1>Campaigns</h1>
        <p class="sub">Discounts with conditions. A code is entered by the shopper; an automatic campaign applies on its own.</p></div></div>

      <div class="card"><div class="card-head">${editing ? `Edit ${esc(editing.name || editing.code)}` : "Add campaign"}</div>
        <div class="card-body form-grid">
          <label>Internal name <input id="pr_name" value="${esc(editing?.name || "")}" placeholder="Summer laptops -10%" /></label>
          <label class="checkbox" style="align-self:end">
            <input id="pr_auto" type="checkbox" ${editing?.is_automatic ? "checked" : ""} /> Automatic (no code needed)</label>

          <label>Code <input id="pr_code" value="${esc(editing?.code || "")}" placeholder="WELCOME10" /></label>
          <label>Discount type <select id="pr_type">
            <option value="percentage" ${editing?.type === "percentage" || !editing ? "selected" : ""}>Percentage (%)</option>
            <option value="fixed" ${editing?.type === "fixed" ? "selected" : ""}>Fixed amount (€)</option>
            <option value="free_shipping" ${editing?.type === "free_shipping" ? "selected" : ""}>Free shipping</option>
          </select></label>

          <label>Value <input id="pr_value" type="number" step="0.01" min="0" value="${esc(editing?.value ?? "")}" /></label>
          <label>Applies to <select id="pr_applies">
            <option value="order" ${editing?.applies_to === "order" || !editing ? "selected" : ""}>Whole order</option>
            <option value="category" ${editing?.applies_to === "category" ? "selected" : ""}>Products in categories</option>
            <option value="product" ${editing?.applies_to === "product" ? "selected" : ""}>Specific products</option>
          </select></label>

          <div class="span2" id="pr_scope"></div>

          <label>Only for group <select id="pr_group">
            <option value="">Everyone</option>
            ${customer_groups.map((group) => `<option value="${esc(group.id)}" ${group.id === editing?.customer_group_id ? "selected" : ""}>${esc(group.name)}</option>`).join("")}
          </select></label>
          <label>Minimum subtotal € <input id="pr_min" type="number" step="0.01" min="0" value="${esc(editing?.min_subtotal ?? 0)}" /></label>
          <label>Minimum items <input id="pr_minqty" type="number" min="0" value="${esc(editing?.min_quantity ?? 0)}" /></label>
          <label>Total uses (blank = unlimited) <input id="pr_limit" type="number" min="1" value="${esc(editing?.usage_limit ?? "")}" /></label>
          <label>Uses per customer <input id="pr_limit_cust" type="number" min="1" value="${esc(editing?.usage_limit_per_customer ?? "")}" /></label>
          <label class="checkbox" style="align-self:end"><input id="pr_active" type="checkbox" ${editing?.is_active === false ? "" : "checked"} /> Active</label>
          <label>Starts <input id="pr_starts" type="date" value="${dateValue(editing?.starts_at)}" /></label>
          <label>Ends <input id="pr_ends" type="date" value="${dateValue(editing?.ends_at)}" /></label>

          <div class="row span2">
            <button class="btn primary" id="pr_save">${editing ? "Save" : "Add"}</button>
            ${editing ? `<a class="btn" href="#/campaigns">Cancel</a>` : ""}
          </div>
        </div></div>

      <div class="card"><div class="card-head">Storefront banner
          <span class="muted">Shown on the home page and at the top of the campaign page</span></div>
        <div class="card-body form-grid">
          <div class="span2" id="pr_banner"></div>
          <label>Headline (Albanian) <input id="pr_btitle_sq" value="${esc(editing?.banner_title_sq || "")}" placeholder="Ulje vere deri në 30%" /></label>
          <label>Headline (English) <input id="pr_btitle" value="${esc(editing?.banner_title || "")}" /></label>
          <label>Subtitle (Albanian) <input id="pr_bsub_sq" value="${esc(editing?.banner_subtitle_sq || "")}" /></label>
          <label>Subtitle (English) <input id="pr_bsub" value="${esc(editing?.banner_subtitle || "")}" /></label>
          <label class="checkbox span2"><input id="pr_home" type="checkbox" ${editing?.show_on_home ? "checked" : ""} />
            Show this banner on the home page (needs an image — several banners rotate at random)</label>
          <div class="hint-box span2">
            Clicking the banner opens <strong>/campaign/${esc(editing?.handle || "…")}</strong> with the products this
            campaign covers. If the campaign is limited to a customer group, the banner and the page stay hidden
            from everyone outside it.
          </div>
        </div></div>

      <div class="card">
        <table><thead><tr><th>Banner</th><th>Campaign</th><th>Discount</th><th>Applies to</th><th>Conditions</th><th>Used</th><th>Active</th><th></th></tr></thead>
        <tbody>${campaigns
          .map((promo) => {
            const conditions = [
              promo.group_name && `group: ${promo.group_name}`,
              promo.min_subtotal > 0 && `min ${eur(promo.min_subtotal)}`,
              promo.min_quantity > 0 && `min ${promo.min_quantity} items`,
              promo.usage_limit_per_customer && `${promo.usage_limit_per_customer}/customer`,
              promo.ends_at && `until ${when(promo.ends_at).split(",")[0]}`,
            ].filter(Boolean)
            return `<tr>
              <td>${promo.banner_image ? `<img class="thumb" src="${esc(promo.banner_image)}" alt="" data-fallback />` : '<span class="muted">—</span>'}</td>
              <td><strong>${esc(promo.name || promo.code)}</strong><br>
                ${promo.is_automatic ? '<span class="badge blue">automatic</span>' : `<span class="badge">${esc(promo.code)}</span>`}
                ${promo.show_on_home ? '<span class="badge green">on home</span>' : ""}
                <br><a class="muted" style="font-size:11.5px" href="/campaign/${esc(promo.handle)}" target="_blank">/campaign/${esc(promo.handle)}</a></td>
              <td>${promo.type === "percentage" ? `${promo.value}%` : promo.type === "fixed" ? eur(promo.value) : "shipping"}</td>
              <td>${esc(scopeLabel(promo))}</td>
              <td class="muted">${esc(conditions.join(" · ") || "—")}</td>
              <td>${promo.used_count}${promo.usage_limit ? ` / ${promo.usage_limit}` : ""}</td>
              <td>${promo.is_active ? '<span class="badge green">yes</span>' : '<span class="badge">no</span>'}</td>
              <td class="row">
                <a class="btn small" href="#/campaigns/${esc(promo.id)}">Edit</a>
                <button class="btn small danger del" data-id="${esc(promo.id)}" data-name="${esc(promo.name || promo.code)}">Delete</button>
              </td></tr>`
          })
          .join("")}</tbody></table>
      </div>`

    const selectedCategories = new Set(editing?.category_ids || [])
    const selectedProducts = new Set(editing?.product_ids || [])

    const bannerImage = createImageManager(editing?.banner_image ? [editing.banner_image] : [], { multiple: false })
    bannerImage.mount($("#pr_banner"))
    wireImageFallbacks()

    const renderScope = () => {
      const value = $("#pr_applies").value
      const holder = $("#pr_scope")
      if (value === "category") {
        holder.innerHTML = `<span style="font-weight:500;font-size:13px">Categories</span>
          <div class="multi-select">${categories
            .map(
              (category) => `<label><input type="checkbox" class="scope-cat" value="${esc(category.id)}"
                ${selectedCategories.has(category.id) ? "checked" : ""} />
                ${esc(category.parent_category_id ? "— " : "")}${esc(category.name)}</label>`
            )
            .join("")}</div>`
      } else if (value === "product") {
        holder.innerHTML = `<span style="font-weight:500;font-size:13px">Products</span>
          <div class="multi-select">${productsData.products
            .map(
              (product) => `<label><input type="checkbox" class="scope-prod" value="${esc(product.id)}"
                ${selectedProducts.has(product.id) ? "checked" : ""} /> ${esc(product.title)}</label>`
            )
            .join("")}</div>`
      } else {
        holder.innerHTML = ""
      }
    }
    renderScope()
    $("#pr_applies").addEventListener("change", renderScope)

    const syncType = () => {
      const isShipping = $("#pr_type").value === "free_shipping"
      $("#pr_value").disabled = isShipping
      $("#pr_applies").disabled = isShipping
    }
    syncType()
    $("#pr_type").addEventListener("change", syncType)

    const syncAuto = () => {
      $("#pr_code").disabled = $("#pr_auto").checked
      $("#pr_code").placeholder = $("#pr_auto").checked ? "not needed" : "WELCOME10"
    }
    syncAuto()
    $("#pr_auto").addEventListener("change", syncAuto)

    $("#pr_save").addEventListener("click", async () => {
      const isShipping = $("#pr_type").value === "free_shipping"
      const body = {
        name: $("#pr_name").value,
        code: $("#pr_code").value,
        type: $("#pr_type").value,
        value: isShipping ? 100 : $("#pr_value").value,
        applies_to: isShipping ? "shipping" : $("#pr_applies").value,
        category_ids: [...main.querySelectorAll(".scope-cat:checked")].map((input) => input.value),
        product_ids: [...main.querySelectorAll(".scope-prod:checked")].map((input) => input.value),
        customer_group_id: $("#pr_group").value || null,
        min_subtotal: $("#pr_min").value,
        min_quantity: $("#pr_minqty").value,
        usage_limit: $("#pr_limit").value || null,
        usage_limit_per_customer: $("#pr_limit_cust").value || null,
        is_active: $("#pr_active").checked,
        is_automatic: $("#pr_auto").checked,
        starts_at: $("#pr_starts").value || null,
        ends_at: $("#pr_ends").value || null,
        banner_image: bannerImage.images[0] || null,
        banner_title: $("#pr_btitle").value,
        banner_title_sq: $("#pr_btitle_sq").value,
        banner_subtitle: $("#pr_bsub").value,
        banner_subtitle_sq: $("#pr_bsub_sq").value,
        show_on_home: $("#pr_home").checked,
      }
      try {
        if (editing) await api(`/campaigns/${editing.id}`, { method: "PATCH", body })
        else await api("/campaigns", { method: "POST", body })
        toast("Campaign saved.")
        location.hash = "#/campaigns"
        campaignsView()
      } catch (error) {
        toast(error.message, true)
      }
    })

    main.querySelectorAll(".del").forEach((button) =>
      button.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Delete the “${button.dataset.name}” campaign?`,
          message: "Its banner disappears from the shop and the discount stops applying. Past orders keep what they were given.",
          confirmLabel: "Delete campaign",
        })
        if (!ok) return
        await api(`/campaigns/${button.dataset.id}`, { method: "DELETE" })
        campaignsView()
      })
    )
  }

  const shippingView = async (editId = null) => {
    const { shipping_methods } = await api("/shipping-methods")
    const editing = shipping_methods.find((method) => method.id === editId) || null
    main.innerHTML = `
      <div class="page-head"><div><h1>Shipping methods</h1>
        <p class="sub">Options you can assign to products (usually via their supplier). A cart pays each distinct option once.</p></div></div>
      <div class="card"><div class="card-head">${editing ? `Edit ${esc(editing.name)}` : "Add method"}</div>
        <div class="card-body form-grid">
          <label>Name (English) <input id="s_name" value="${esc(editing?.name || "")}" /></label>
          <label>Price € <input id="s_price" type="number" step="0.01" min="0" value="${esc(editing?.price ?? "")}" /></label>
          <label>Emri (Albanian) <input id="s_name_sq" value="${esc(editing?.name_sq || "")}" placeholder="shown at checkout by default" /></label>
          <label>Përshkrimi (Albanian) <input id="s_desc_sq" value="${esc(editing?.description_sq || "")}" /></label>
          <label class="span2">Description (English) <input id="s_desc" value="${esc(editing?.description || "")}" /></label>
          <label class="checkbox"><input id="s_active" type="checkbox" ${editing?.is_active === false ? "" : "checked"} /> Active</label>
          <div class="row span2">
            <button class="btn primary" id="s_save">${editing ? "Save" : "Add"}</button>
            ${editing ? `<a class="btn" href="#/shipping">Cancel</a>` : ""}
          </div>
        </div></div>
      <div class="card">
        <table><thead><tr><th>Name</th><th>Emri (sq)</th><th>Price</th><th>Active</th><th></th></tr></thead>
        <tbody>${shipping_methods
          .map(
            (method) => `<tr>
              <td>${esc(method.name)}</td><td class="muted">${esc(method.name_sq || "—")}</td>
              <td>${eur(method.price)}</td>
              <td>${method.is_active ? '<span class="badge green">yes</span>' : '<span class="badge">no</span>'}</td>
              <td class="row">
                <a class="btn small" href="#/shipping/${esc(method.id)}">Edit</a>
                <button class="btn small danger del" data-id="${esc(method.id)}" data-name="${esc(method.name)}">Delete</button>
              </td></tr>`
          )
          .join("")}</tbody></table>
      </div>`
    $("#s_save").addEventListener("click", async () => {
      const body = {
        name: $("#s_name").value,
        name_sq: $("#s_name_sq").value,
        description: $("#s_desc").value,
        description_sq: $("#s_desc_sq").value,
        price: $("#s_price").value,
        is_active: $("#s_active").checked,
      }
      try {
        if (editing) await api(`/shipping-methods/${editing.id}`, { method: "PATCH", body })
        else await api("/shipping-methods", { method: "POST", body })
        toast("Shipping method saved.")
        location.hash = "#/shipping"
        shippingView()
      } catch (error) {
        toast(error.message, true)
      }
    })
    main.querySelectorAll(".del").forEach((button) =>
      button.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Delete the “${button.dataset.name}” delivery option?`,
          message: "Products using it fall back to the cheapest remaining option.",
          confirmLabel: "Delete option",
        })
        if (!ok) return
        await api(`/shipping-methods/${button.dataset.id}`, { method: "DELETE" })
        shippingView()
      })
    )
  }

  const suppliersView = async (editId = null) => {
    const [{ suppliers }, { shipping_methods }] = await Promise.all([api("/suppliers"), api("/shipping-methods")])
    const editing = suppliers.find((supplier) => supplier.id === editId) || null
    const shippingOptions = shipping_methods
      .map(
        (method) =>
          `<option value="${esc(method.id)}" ${method.id === editing?.shipping_method_id ? "selected" : ""}>
            ${esc(method.name)} — ${eur(method.price)}</option>`
      )
      .join("")

    main.innerHTML = `
      <div class="page-head"><div><h1>Suppliers</h1>
        <p class="sub">Who fulfills each product. A supplier's shipping option becomes the default for its products.</p></div></div>
      <div class="card"><div class="card-head">${editing ? `Edit ${esc(editing.name)}` : "Add supplier"}</div>
        <div class="card-body form-grid">
          <label>Name <input id="su_name" value="${esc(editing?.name || "")}" /></label>
          <label>Default shipping option
            <select id="su_shipping"><option value="">—</option>${shippingOptions}</select></label>
          <label>Email <input id="su_email" type="email" value="${esc(editing?.email || "")}" /></label>
          <label>Phone <input id="su_phone" value="${esc(editing?.phone || "")}" /></label>
          <label class="span2">Notes <textarea id="su_notes" rows="2">${esc(editing?.notes || "")}</textarea></label>
          ${
            editing
              ? `<label class="checkbox span2"><input id="su_apply" type="checkbox" />
                   Apply this shipping option to all ${editing.product_count} products of this supplier</label>`
              : ""
          }
          <div class="row span2">
            <button class="btn primary" id="su_save">${editing ? "Save" : "Add"}</button>
            ${editing ? `<a class="btn" href="#/suppliers">Cancel</a>` : ""}
          </div>
        </div></div>
      <div class="card">
        <table><thead><tr><th>Name</th><th>Shipping</th><th>Email</th><th>Phone</th><th>Products</th><th></th></tr></thead>
        <tbody>${suppliers
          .map(
            (supplier) => `<tr>
              <td>${esc(supplier.name)}</td>
              <td>${supplier.shipping_method_name ? `<span class="badge blue">${esc(supplier.shipping_method_name)}</span>` : '<span class="muted">—</span>'}</td>
              <td>${esc(supplier.email || "—")}</td>
              <td>${esc(supplier.phone || "—")}</td><td>${supplier.product_count}</td>
              <td class="row">
                <a class="btn small" href="#/suppliers/${esc(supplier.id)}">Edit</a>
                <button class="btn small danger del" data-id="${esc(supplier.id)}" data-name="${esc(supplier.name)}">Delete</button>
              </td></tr>`
          )
          .join("")}</tbody></table>
      </div>`
    $("#su_save").addEventListener("click", async () => {
      const body = {
        name: $("#su_name").value,
        email: $("#su_email").value || null,
        phone: $("#su_phone").value || null,
        notes: $("#su_notes").value,
        shipping_method_id: $("#su_shipping").value || null,
        apply_to_products: $("#su_apply")?.checked || false,
      }
      try {
        if (editing) {
          const result = await api(`/suppliers/${editing.id}`, { method: "PATCH", body })
          if (result.updated_products) toast(`Updated shipping on ${result.updated_products} products.`)
        } else {
          await api("/suppliers", { method: "POST", body })
        }
        toast("Supplier saved.")
        location.hash = "#/suppliers"
        suppliersView()
      } catch (error) {
        toast(error.message, true)
      }
    })
    main.querySelectorAll(".del").forEach((button) =>
      button.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: `Delete the supplier “${button.dataset.name}”?`,
          message: "Their products stay in the shop and simply have no supplier assigned.",
          confirmLabel: "Delete supplier",
        })
        if (!ok) return
        await api(`/suppliers/${button.dataset.id}`, { method: "DELETE" })
        suppliersView()
      })
    )
  }

  // ---------------------------------------------------------------- import

  const importView = () => {
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Import products</h1>
          <p class="sub">Upload an .xlsx file — rows are matched by handle (create or update). Missing categories and
            suppliers are created; <strong>shipping_method</strong> sets the product's shipping option (falls back to the
            supplier's default). Sale prices go to the Sale price list.</p></div>
        <button class="btn" id="dl-template">Download template</button>
      </div>
      <div class="card"><div class="card-body">
        <div class="row">
          <input type="file" id="import-file" accept=".xlsx" style="max-width:340px" />
          <button class="btn primary" id="do-import">Import</button>
        </div>
        <div id="import-result" style="margin-top:16px"></div>
      </div></div>`

    $("#dl-template").addEventListener("click", async () => {
      const res = await fetch("/api/admin/import/template", { headers: { authorization: `Bearer ${getToken()}` } })
      const blob = await res.blob()
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = "intersoft-product-import-template.xlsx"
      link.click()
      URL.revokeObjectURL(link.href)
    })

    $("#do-import").addEventListener("click", async () => {
      const file = $("#import-file").files[0]
      if (!file) return toast("Choose an .xlsx file first.", true)
      const button = $("#do-import")
      button.disabled = true
      button.textContent = "Importing..."
      try {
        const formData = new FormData()
        formData.append("file", file)
        const result = await api("/import/products", { method: "POST", body: formData })
        const issues = [
          ...(result.errors || []).map((issue) => ({ ...issue, kind: "Error" })),
          ...(result.warnings || []).map((issue) => ({ ...issue, kind: "Warning" })),
        ]
        $("#import-result").innerHTML = `
          <p><strong>Created:</strong> ${result.created} · <strong>Updated:</strong> ${result.updated} · <strong>Failed:</strong> ${result.failed}</p>
          ${
            issues.length
              ? `<table><thead><tr><th>Type</th><th>Row</th><th>Message</th></tr></thead>
                 <tbody>${issues
                   .map((issue) => `<tr><td>${esc(issue.kind)}</td><td>${issue.row ?? "—"}</td><td>${esc(issue.message)}</td></tr>`)
                   .join("")}</tbody></table>`
              : ""
          }`
        toast("Import finished.")
      } catch (error) {
        toast(error.message, true)
      } finally {
        button.disabled = false
        button.textContent = "Import"
      }
    })
  }

  // ---------------------------------------------------------------- settings

  const settingsView = async () => {
    const [me, aiStatus] = await Promise.all([api("/auth/me"), api("/ai/status")])

    main.innerHTML = `
      <div class="page-head">
        <div><h1>Settings</h1><p class="sub">Your sign-in details and what the shop can do.</p></div>
      </div>

      <div class="card"><div class="card-head">Your account</div><div class="card-body form-grid">
        <label>Email <input value="${esc(me.admin.email)}" disabled />
          <span class="help">This is the address you sign in with.</span></label>
        <div></div>
        <label>New password <input id="set_pw" type="password" autocomplete="new-password" placeholder="At least 8 characters" /></label>
        <label>Repeat new password <input id="set_pw2" type="password" autocomplete="new-password" /></label>
        <div class="row span2">
          <button class="btn primary" id="set_save">Change password</button>
          <span class="muted">You stay signed in on this device.</span>
        </div>
      </div></div>

      <div class="card"><div class="card-head">What is switched on</div><div class="card-body">
        <table>
          <tbody>
            <tr><td class="cell-title">Order emails</td>
              <td class="muted">Customers are emailed when an order is placed, paid, sent and delivered.</td>
              <td class="num"><span class="badge green">On</span></td></tr>
            <tr><td class="cell-title">“Write it for me” assistant</td>
              <td class="muted">Drafts product descriptions and tags for you.</td>
              <td class="num">${aiStatus.configured ? `<span class="badge green">On</span>` : `<span class="badge">Off</span>`}</td></tr>
            <tr><td class="cell-title">Card payments online</td>
              <td class="muted">Cash on delivery and card-on-delivery always work. Online card payment needs your bank's details.</td>
              <td class="num"><span class="badge amber">Test mode</span></td></tr>
          </tbody>
        </table>
        <p class="field-note">These are set up once by your developer in the server settings file. Ask them if you need one turned on.</p>
      </div></div>`

    $("#set_save").addEventListener("click", async () => {
      const password = $("#set_pw").value
      const repeat = $("#set_pw2").value
      if (password.length < 8) return toast("Use at least 8 characters.", true)
      if (password !== repeat) return toast("The two passwords are not the same.", true)
      try {
        await api("/auth/password", { method: "POST", body: { password } })
        $("#set_pw").value = ""
        $("#set_pw2").value = ""
        toast("Password changed.")
      } catch (error) {
        toast(error.message, true)
      }
    })
  }

  // ---------------------------------------------------------------- router

  const routes = [
    { pattern: /^#?\/?$/, view: () => dashboardView(), nav: "dashboard" },
    { pattern: /^#\/orders$/, view: () => ordersView(), nav: "orders" },
    { pattern: /^#\/orders\/([0-9a-f-]{36})$/, view: (id) => orderDetailView(id), nav: "orders" },
    { pattern: /^#\/products$/, view: () => productsView(), nav: "products" },
    { pattern: /^#\/products\/(new|[0-9a-f-]{36})$/, view: (id) => productEditView(id), nav: "products" },
    { pattern: /^#\/categories$/, view: () => categoriesView(), nav: "categories" },
    { pattern: /^#\/categories\/([0-9a-f-]{36})$/, view: (id) => categoriesView(id), nav: "categories" },
    { pattern: /^#\/customers$/, view: () => customersView(), nav: "customers" },
    { pattern: /^#\/customers\/([0-9a-f-]{36})$/, view: (id) => customerDetailView(id), nav: "customers" },
    { pattern: /^#\/groups$/, view: () => groupsView(), nav: "groups" },
    { pattern: /^#\/groups\/([0-9a-f-]{36})$/, view: (id) => groupsView(id), nav: "groups" },
    { pattern: /^#\/price-lists$/, view: () => priceListsView(), nav: "price-lists" },
    { pattern: /^#\/price-lists\/(new|[0-9a-f-]{36})$/, view: (id) => priceListEditView(id), nav: "price-lists" },
    { pattern: /^#\/campaigns$/, view: () => campaignsView(), nav: "campaigns" },
    { pattern: /^#\/campaigns\/([0-9a-f-]{36})$/, view: (id) => campaignsView(id), nav: "campaigns" },
    { pattern: /^#\/shipping$/, view: () => shippingView(), nav: "shipping" },
    { pattern: /^#\/shipping\/([0-9a-f-]{36})$/, view: (id) => shippingView(id), nav: "shipping" },
    { pattern: /^#\/suppliers$/, view: () => suppliersView(), nav: "suppliers" },
    { pattern: /^#\/suppliers\/([0-9a-f-]{36})$/, view: (id) => suppliersView(id), nav: "suppliers" },
    { pattern: /^#\/import$/, view: () => importView(), nav: "import" },
    { pattern: /^#\/settings$/, view: () => settingsView(), nav: "settings" },
  ]

  const PAGE_TITLES = {
    dashboard: "Dashboard",
    orders: "Orders",
    products: "Products",
    categories: "Categories",
    customers: "Customers",
    groups: "Customer groups",
    "price-lists": "Price lists",
    campaigns: "Campaigns",
    shipping: "Shipping",
    suppliers: "Suppliers",
    import: "Import from Excel",
    settings: "Settings",
  }

  const route = async () => {
    const hash = location.hash || "#/"
    const match = routes.find((entry) => entry.pattern.test(hash))
    document.querySelectorAll("#nav a").forEach((link) =>
      link.classList.toggle("active", link.dataset.route === match?.nav)
    )
    if (!match) {
      location.hash = "#/"
      return
    }
    $("#topbar-title").textContent = PAGE_TITLES[match.nav] || "Intersoft"
    document.title = `${PAGE_TITLES[match.nav] || "Intersoft"} · Intersoft Admin`
    window.scrollTo({ top: 0 })
    main.innerHTML = skeletonPage()
    try {
      await match.view(hash.match(match.pattern)[1])
    } catch (error) {
      if (error.message !== "Signed out") {
        main.innerHTML = `<div class="card"><div class="empty">
          ${icon("warn")}
          <h3>That did not load</h3>
          <p>${esc(error.message)}</p>
          <button class="btn" onclick="location.reload()">Try again</button>
        </div></div>`
      }
    }
  }

  window.addEventListener("hashchange", route)

  // ---------------------------------------------------------------- boot

  const boot = async () => {
    if (!getToken()) return showLogin()
    try {
      const me = await api("/auth/me")
      showApp(me.admin)
    } catch {
      /* showLogin already triggered by 401 */
    }
  }
  boot()
})()
