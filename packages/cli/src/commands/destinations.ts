import { Command } from "commander";
import { HookflareClient } from "../client.js";
import { output, outputTable, outputSuccess } from "../output.js";

export const destinationsCommand = new Command("destinations")
  .alias("dest")
  .description("Manage webhook destinations");

destinationsCommand
  .command("list")
  .alias("ls")
  .description("List all destinations")
  .action(async () => {
    const client = new HookflareClient();
    const res = await client.listDestinations();
    const dests = res.data as Record<string, unknown>[];
    outputTable(
      dests.map((d) => ({
        id: d.id,
        name: d.name,
        url: d.url,
        max_retries: d.max_retries,
        created_at: d.created_at,
      })),
    );
  });

destinationsCommand
  .command("get")
  .description("Get destination details")
  .argument("<id>", "Destination ID")
  .action(async (id: string) => {
    const client = new HookflareClient();
    const res = await client.getDestination(id);
    output(res.data);
  });

destinationsCommand
  .command("create")
  .description("Create a new destination")
  .requiredOption("--name <name>", "Destination name")
  .requiredOption("--url <url>", "Target URL")
  .option("--max-retries <n>", "Maximum retry attempts", "5")
  .option("--timeout-ms <n>", "Request timeout in ms", "30000")
  .action(async (opts) => {
    const client = new HookflareClient();
    const res = await client.createDestination({
      name: opts.name,
      url: opts.url,
      retry_policy: {
        max_retries: parseInt(opts.maxRetries, 10),
        timeout_ms: parseInt(opts.timeoutMs, 10),
      },
    });
    output(res.data);
    outputSuccess("Destination created");
  });

destinationsCommand
  .command("delete")
  .alias("rm")
  .description("Delete a destination")
  .argument("<id>", "Destination ID")
  .action(async (id: string) => {
    const client = new HookflareClient();
    await client.deleteDestination(id);
    outputSuccess(`Destination ${id} deleted`);
  });
