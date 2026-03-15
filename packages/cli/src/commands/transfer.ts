import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { HookflareClient } from "../client.js";
import { output, outputSuccess, outputError } from "../output.js";

export const exportCommand = new Command("export")
  .description("Export all configuration (sources, destinations, subscriptions)")
  .option("-o, --output <file>", "Write to file instead of stdout")
  .action(async (opts) => {
    const client = new HookflareClient();
    const res = await client.exportConfig();

    if (opts.output) {
      writeFileSync(opts.output, JSON.stringify(res.data, null, 2) + "\n");
      outputSuccess(`Exported to ${opts.output}`);
    } else {
      // Write raw JSON to stdout (pipe-friendly)
      console.log(JSON.stringify(res.data, null, 2));
    }
  });

export const importCommand = new Command("import")
  .description("Import configuration from a JSON file or stdin")
  .option("-f, --file <file>", "Read from file")
  .option("--target <url>", "Target instance URL (overrides configured api_url)")
  .option("--target-key <key>", "Target instance API key")
  .action(async (opts) => {
    let raw: string;

    if (opts.file) {
      raw = readFileSync(opts.file, "utf-8");
    } else {
      // Read from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      raw = Buffer.concat(chunks).toString("utf-8");
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      outputError("Invalid JSON input");
      process.exit(1);
    }

    const clientOpts: { apiUrl?: string; token?: string } = {};
    if (opts.target) clientOpts.apiUrl = opts.target;
    if (opts.targetKey) clientOpts.token = opts.targetKey;

    const client = new HookflareClient(clientOpts);
    const res = await client.importConfig(data);
    const result = res.data as {
      sources: { created: number; skipped: number };
      destinations: { created: number; skipped: number };
      subscriptions: { created: number; skipped: number };
    };

    output(result);
    outputSuccess(
      `Imported: ${result.sources.created} sources, ${result.destinations.created} destinations, ${result.subscriptions.created} subscriptions`,
    );
  });

export const migrateCommand = new Command("migrate")
  .description("Migrate configuration between hookflare instances")
  .requiredOption("--from <url>", "Source instance URL")
  .requiredOption("--from-key <key>", "Source instance API key")
  .requiredOption("--to <url>", "Target instance URL")
  .requiredOption("--to-key <key>", "Target instance API key")
  .action(async (opts) => {
    // 1. Export from source
    const sourceClient = new HookflareClient({
      apiUrl: opts.from,
      token: opts.fromKey,
    });

    outputSuccess(`Exporting from ${opts.from}...`);
    const exportRes = await sourceClient.exportConfig();
    const exportData = exportRes.data;

    // 2. Import to target
    const targetClient = new HookflareClient({
      apiUrl: opts.to,
      token: opts.toKey,
    });

    outputSuccess(`Importing to ${opts.to}...`);
    const importRes = await targetClient.importConfig(exportData);
    const result = importRes.data as {
      sources: { created: number; skipped: number };
      destinations: { created: number; skipped: number };
      subscriptions: { created: number; skipped: number };
    };

    output(result);
    outputSuccess("Migration complete");
  });
