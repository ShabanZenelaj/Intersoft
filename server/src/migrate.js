const fs = require("fs")
const path = require("path")
const { pool } = require("./db")

const run = async () => {
  await pool.query(`create table if not exists migrations (
    name text primary key, run_at timestamptz not null default now()
  )`)

  const dir = path.join(__dirname, "migrations")
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()

  for (const file of files) {
    const { rows } = await pool.query("select 1 from migrations where name = $1", [file])
    if (rows.length) continue
    const sql = fs.readFileSync(path.join(dir, file), "utf8")
    const client = await pool.connect()
    try {
      await client.query("begin")
      await client.query(sql)
      await client.query("insert into migrations (name) values ($1)", [file])
      await client.query("commit")
      console.log(`applied ${file}`)
    } catch (error) {
      await client.query("rollback")
      console.error(`failed ${file}: ${error.message}`)
      process.exitCode = 1
      break
    } finally {
      client.release()
    }
  }
  await pool.end()
}

run()
