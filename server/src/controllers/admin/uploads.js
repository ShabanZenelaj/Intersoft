const { check } = require("../../lib/util")
const { saveImage, deleteImage } = require("../../services/uploads")

/** Multipart "files" (wired up in the route table); returns public URLs. */
const create = async (req, res) => {
  check(req.files?.length, "No files uploaded.")
  const urls = []
  for (const file of req.files) {
    urls.push(await saveImage(file))
  }
  res.status(201).json({ urls })
}

const remove = async (req, res) => {
  const { url } = req.body
  res.json({ deleted: await deleteImage(url) })
}

module.exports = { create, remove }
