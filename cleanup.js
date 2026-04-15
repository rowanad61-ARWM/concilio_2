const fs = require("fs");
const { Client } = require("pg");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].replace(/^["']|["']$/g, "");
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query(`DELETE FROM "_prisma_migrations" WHERE migration_name = '0_init'`);
  console.log("Rows deleted:", r.rowCount);
  await c.end();
})();
