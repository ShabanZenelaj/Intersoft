require("dotenv").config()
const { Pool } = require("pg")

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/** Parameterized query helper — always use $1-style params, never interpolate. */
const query = (text, params) => pool.query(text, params)

/** Runs fn inside a transaction with a dedicated client. */
const tx = async (fn) => {
  const client = await pool.connect()
  try {
    await client.query("begin")
    const result = await fn(client)
    await client.query("commit")
    return result
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

module.exports = { pool, query, tx }
