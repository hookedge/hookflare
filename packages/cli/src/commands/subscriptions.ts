import { Command } from "commander";
import { HookflareClient } from "../client.js";
import { output, outputTable, outputSuccess } from "../output.js";

export const subscriptionsCommand = new Command("subscriptions")
  .alias("subs")
  .description("Manage webhook subscriptions (source → destination routing)");

subscriptionsCommand
  .command("list")
  .alias("ls")
  .description("List all subscriptions")
  .action(async () => {
    const client = new HookflareClient();
    const res = await client.listSubscriptions();
    const subs = res.data as Record<string, unknown>[];
    outputTable(
      subs.map((s) => ({
        id: s.id,
        source_id: s.source_id,
        destination_id: s.destination_id,
        event_types: s.event_types,
        enabled: s.enabled,
      })),
    );
  });

subscriptionsCommand
  .command("create")
  .description("Create a new subscription")
  .requiredOption("--source <id>", "Source ID")
  .requiredOption("--destination <id>", "Destination ID")
  .option("--events <types...>", "Event type filters (default: *)")
  .action(async (opts) => {
    const client = new HookflareClient();
    const res = await client.createSubscription({
      source_id: opts.source,
      destination_id: opts.destination,
      event_types: opts.events ?? ["*"],
    });
    output(res.data);
    outputSuccess("Subscription created");
  });

subscriptionsCommand
  .command("delete")
  .alias("rm")
  .description("Delete a subscription")
  .argument("<id>", "Subscription ID")
  .action(async (id: string) => {
    const client = new HookflareClient();
    await client.deleteSubscription(id);
    outputSuccess(`Subscription ${id} deleted`);
  });
