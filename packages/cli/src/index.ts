import { Command } from "commander";
import { setJsonMode, outputError } from "./output.js";
import { configCommand } from "./commands/config.js";
import { sourcesCommand } from "./commands/sources.js";
import { destinationsCommand } from "./commands/destinations.js";
import { subscriptionsCommand } from "./commands/subscriptions.js";
import { eventsCommand } from "./commands/events.js";
import { HookflareClient } from "./client.js";

const program = new Command();

program
  .name("hookflare")
  .description("CLI for hookflare — open-source webhook infrastructure")
  .version("0.0.1")
  .option("--json", "Output in JSON format (agent-friendly)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    if (opts.json) setJsonMode(true);
  });

// Health check
program
  .command("health")
  .description("Check connection to hookflare server")
  .action(async () => {
    const client = new HookflareClient();
    const res = await client.health();
    console.log(JSON.stringify(res, null, 2));
  });

// Register subcommands
program.addCommand(configCommand);
program.addCommand(sourcesCommand);
program.addCommand(destinationsCommand);
program.addCommand(subscriptionsCommand);
program.addCommand(eventsCommand);

// Global error handler
program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof Error && err.message !== "(outputHelp)") {
      outputError(err.message);
      process.exit(1);
    }
  }
}

main();
