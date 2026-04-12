import { defineConfig } from "prisma/config";
import * as fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf-8");
const envVars = Object.fromEntries(
  envFile.split("\n").filter(Boolean).map((line) => line.split("=", 2))
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: envVars["DATABASE_URL"],
  },
});
