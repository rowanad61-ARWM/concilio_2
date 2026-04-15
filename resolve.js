const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].replace(/^["']|["']$/g, "");
const sql = fs.readFileSync("prisma/migrations/0_init/migration.sql", "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");
(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, NOW(), '0_init', NULL, NULL, NOW(), 1)`,
    [crypto.randomUUID(), checksum]
  );
  console.log("Rows inserted:", r.rowCount);
  await c.end();
})();
