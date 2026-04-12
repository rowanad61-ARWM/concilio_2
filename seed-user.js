const { Client } = require('pg')
const { randomUUID } = require('crypto')

const client = new Client({
  host: 'concilio-db.postgres.database.azure.com',
  port: 5432,
  database: 'postgres',
  user: 'concilio_admin',
  password: 'h97jiSxMdkaZge9r',
  ssl: { rejectUnauthorized: false }
})

async function main() {
  await client.connect()
  
  console.log('Creating practice...')
  const practiceId = randomUUID()
  await client.query(`
    INSERT INTO practice (id, name, code, status)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (code) DO NOTHING
  `, [practiceId, 'Andrew Rowan Wealth Management', 'ARWM', 'active'])
  
  const { rows } = await client.query(`SELECT id FROM practice WHERE code = 'ARWM'`)
  const pid = rows[0].id

  console.log('Creating user: Andrew Rowan...')
  await client.query(`
    INSERT INTO user_account (id, practice_id, name, email, role, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO NOTHING
  `, ['00000000-0000-0000-0000-000000000001', pid, 'Andrew Rowan', 'andrew@arwm.com.au', 'owner', 'active'])

  console.log('Done')
  await client.end()
}

main().catch(e => { console.error(e.message); client.end() })
