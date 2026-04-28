# Local Postgres For Tests

The test runner uses a local Postgres database so Round 1 smoke tests cannot reach Azure. `.env.local` stays unchanged for normal app development.

Local test URL:

```text
postgresql://concilio_dev:concilio_dev_local@localhost:5432/concilio_test
```

Reset the local database:

```powershell
$env:PGPASSWORD = "<postgres-superuser-password>"
& "C:\Program Files\PostgreSQL\18\bin\dropdb.exe" -h localhost -U postgres --if-exists concilio_test
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h localhost -U postgres -O concilio_dev concilio_test
$env:PGPASSWORD = "concilio_dev_local"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U concilio_dev -d concilio_test -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
$env:DATABASE_URL = "postgresql://concilio_dev:concilio_dev_local@localhost:5432/concilio_test"
npx prisma migrate deploy
```

Tests load `.env.test` through `test/setup-local-env.cjs`. The guard fails immediately if `DATABASE_URL` points at Azure or any non-local host.
