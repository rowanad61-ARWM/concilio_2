const path = require("node:path");
const dotenv = require("dotenv");

const AZURE_PATTERNS = ["azure.com", "postgres.database.azure.com"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parseDatabaseUrl(value) {
  try {
    return new URL(value);
  } catch (error) {
    throw new Error(`[test-db-guard] DATABASE_URL is not a valid URL: ${error.message}`);
  }
}

function redactDatabaseUrl(value) {
  const parsed = parseDatabaseUrl(value);
  const username = parsed.username || "<user>";
  return `${parsed.protocol}//${username}:***@${parsed.host}${parsed.pathname}${parsed.search}`;
}

function assertSafeDatabaseUrl(value, source) {
  if (!value) {
    throw new Error(`[test-db-guard] DATABASE_URL is missing after loading ${source}`);
  }

  const lower = value.toLowerCase();
  const azurePattern = AZURE_PATTERNS.find((pattern) => lower.includes(pattern));
  if (azurePattern) {
    throw new Error(
      `[test-db-guard] Refusing to run tests against Azure database URL from ${source}; matched "${azurePattern}".`,
    );
  }

  const parsed = parseDatabaseUrl(value);
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `[test-db-guard] Refusing to run tests against non-local database host "${parsed.hostname}" from ${source}.`,
    );
  }

  return parsed;
}

if (process.env.DATABASE_URL) {
  assertSafeDatabaseUrl(process.env.DATABASE_URL, "pre-existing environment");
}

const envPath = path.resolve(__dirname, "..", ".env.test");
const result = dotenv.config({ path: envPath, override: true, quiet: true });
if (result.error) {
  throw new Error(`[test-db-guard] Failed to load .env.test: ${result.error.message}`);
}

const parsed = assertSafeDatabaseUrl(process.env.DATABASE_URL, ".env.test");

global.__CONCILIO_TEST_DATABASE__ = {
  redactedUrl: redactDatabaseUrl(process.env.DATABASE_URL),
  hostname: parsed.hostname,
  port: parsed.port || null,
  database: parsed.pathname.replace(/^\//, ""),
};
