const path = require("path");
const { loadEnvConfig } = require("@next/env");

const projectDir = path.resolve(__dirname, "..");
loadEnvConfig(projectDir, process.env.NODE_ENV === "production");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node"
  }
});
const tsConfigPaths = require("tsconfig-paths");

const tsconfig = require("../tsconfig.json");
const baseUrl = tsconfig.compilerOptions?.baseUrl ?? ".";
const absoluteBaseUrl = path.resolve(projectDir, baseUrl);
const paths = tsconfig.compilerOptions?.paths ?? {};

tsConfigPaths.register({ baseUrl: absoluteBaseUrl, paths });

const cron = require("node-cron");

const { syncReferenceCityPlaces } = require("../lib/services/sync-places");

const schedule = process.env.DEV_CRON_SCHEDULE ?? "0 * * * *"; // hourly by default
const timezone = process.env.DEV_CRON_TIMEZONE ?? "UTC";
const runImmediately = process.env.DEV_CRON_RUN_ON_START === "true";

async function runSync(label) {
  try {
    const result = await syncReferenceCityPlaces();
    console.log(
      `[cron:${label}] Synced Montevideo dataset at ${result.updatedAt} — cannabis=${result.cannabisCount}, restricted=${result.restrictedCount}`
    );
  } catch (error) {
    console.error(
      `[cron:${label}] Failed to sync Montevideo dataset`,
      error instanceof Error ? error.stack ?? error.message : error
    );
  }
}

if (runImmediately) {
  void runSync("startup");
}

cron.schedule(
  schedule,
  () => {
    void runSync("scheduled");
  },
  {
    timezone
  }
);

console.log(
  `[cron] Dev cron listening — schedule="${schedule}" timezone="${timezone}" runImmediately=${runImmediately}`
);
