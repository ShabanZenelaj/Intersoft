const { check } = require("../../lib/util")
const { importXlsx, buildTemplate } = require("../../services/import")

/** Single "file" upload (multer is wired up in the route table). */
const importProducts = async (req, res) => {
  check(req.file?.buffer, "Upload an .xlsx file in the 'file' field.")
  res.json(await importXlsx(req.file.buffer))
}

const downloadTemplate = async (_req, res) => {
  const buffer = await buildTemplate()
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  res.setHeader("Content-Disposition", 'attachment; filename="intersoft-product-import-template.xlsx"')
  res.send(Buffer.from(buffer))
}

module.exports = { importProducts, downloadTemplate }
