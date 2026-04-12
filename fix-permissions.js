const { Client } = require('pg')

const client = new Client({
  host: 'concilio-db.postgres.database.azure.com',
  port: 5432,
  database: 'postgres',
  user: 'concilio_admin',
  password: 'h97jiSxMdkaZge9r',
  ssl: { rejectUnauthorized: false }
})

client.connect()
  .then(() => client.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO concilio_admin'))
  .then(() => client.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO concilio_admin'))
  .then(() => client.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO concilio_admin'))
  .then(() => { console.log('Permissions granted'); client.end() })
  .catch(e => { console.error(e.message); client.end() })
