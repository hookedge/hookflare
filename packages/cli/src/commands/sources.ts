import { Command } from "commander";
import { HookflareClient } from "../client.js";
import { output, outputTable, outputSuccess } from "../output.js";

export const sourcesCommand = new Command("sources")
  .description("Manage webhook sources");

sourcesCommand
  .command("list")
  .alias("ls")
  .description("List all sources")
  .action(async () => {
    const client = new HookflareClient();
    const res = await client.listSources();
    const sources = res.data as Record<string, unknown>[];
    outputTable(
      sources.map((s) => ({
        id: s.id,
        name: s.name,
        verification: s.verification_type ?? "none",
        created_at: s.created_at,
      })),
    );
  });

sourcesCommand
  .command("get")
  .description("Get source details")
  .argument("<id>", "Source ID")
  .action(async (id: string) => {
    const client = new HookflareClient();
    const res = await client.getSource(id);
    output(res.data);
  });

sourcesCommand
  .command("create")
  .description("Create a new source")
  .requiredOption("--name <name>", "Source name")
  .option("--verification-type <type>", "Signature verification type (hmac-sha256, hmac-sha1)")
  .option("--verification-secret <secret>", "Shared secret for signature verification")
  .action(async (opts) => {
    const client = new HookflareClient();
    const body: Record<string, unknown> = { name: opts.name };
    if (opts.verificationType) {
      body.verification = {
        type: opts.verificationType,
        secret: opts.verificationSecret,
      };
    }
    const res = await client.createSource(body as Parameters<HookflareClient["createSource"]>[0]);
    output(res.data);
    outputSuccess("Source created");
  });

sourcesCommand
  .command("delete")
  .alias("rm")
  .description("Delete a source")
  .argument("<id>", "Source ID")
  .action(async (id: string) => {
    const client = new HookflareClient();
    await client.deleteSource(id);
    outputSuccess(`Source ${id} deleted`);
  });
