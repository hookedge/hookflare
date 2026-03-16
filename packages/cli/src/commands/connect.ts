import { Command } from "commander";
import { builtinProviders } from "@hookflare/providers";
import { HookflareClient } from "../client.js";
import { output, outputSuccess, outputError, isJsonMode } from "../output.js";
import { loadConfig } from "../config.js";

export const connectCommand = new Command("connect")
  .description("One-shot setup: create source + destination + subscription")
  .argument("<provider>", "Provider ID (stripe, github, slack, shopify, vercel, or generic)")
  .requiredOption("--secret <secret>", "Webhook signing secret from the provider")
  .requiredOption("--to <url>", "Destination URL (your API endpoint)")
  .option("--events <filter>", "Event type filter (default: *)", "*")
  .option("--name <name>", "Source name (default: provider ID)")
  .option("--retry <strategy>", "Retry strategy: exponential, linear, fixed", "exponential")
  .option("--max-retries <n>", "Maximum retry attempts", "10")
  .option("--json", "Output as JSON")
  .option("--dry-run", "Show what would be created without executing")
  .addHelpText("after", `
Examples:
  # Stripe → your API (payment events only)
  $ hookflare connect stripe --secret whsec_xxx --to https://api.example.com/hooks --events "payment_intent.*"

  # GitHub → your API (all events)
  $ hookflare connect github --secret ghsec_xxx --to https://api.example.com/hooks

  # Multiple environments
  $ hookflare connect stripe --secret whsec_prod --to https://api.myapp.com/hooks --name stripe-prod
  $ hookflare connect stripe --secret whsec_stg --to https://staging.myapp.com/hooks --name stripe-staging

  # Dry run (validate without creating)
  $ hookflare connect stripe --secret whsec_xxx --to https://api.example.com/hooks --dry-run

  # Generic provider (no built-in knowledge)
  $ hookflare connect my-service --secret my_secret --to https://api.example.com/hooks`)
  .action(async (providerArg: string, opts) => {
    const provider = builtinProviders[providerArg] ?? null;
    const sourceName = opts.name ?? providerArg;
    const events = opts.events.split(",").map((e: string) => e.trim());
    const config = loadConfig();

    // Build the plan
    const plan = {
      source: {
        name: sourceName,
        provider: provider ? providerArg : undefined,
        verification: {
          type: provider
            ? resolveVerificationType(provider)
            : "hmac-sha256",
          secret: opts.secret,
        },
      },
      destination: {
        name: slugify(opts.to),
        url: opts.to,
        retry_policy: {
          strategy: opts.retry,
          max_retries: parseInt(opts.maxRetries, 10),
        },
      },
      subscription: {
        event_types: events,
      },
    };

    if (opts.dryRun) {
      output({ dry_run: true, ...plan });
      return;
    }

    const client = new HookflareClient();

    try {
      // 1. Create source
      const srcRes = await client.createSource(plan.source);
      const src = srcRes.data as { id: string; name: string };

      // 2. Create destination
      const dstRes = await client.createDestination(plan.destination);
      const dst = dstRes.data as { id: string; name: string; url: string };

      // 3. Create subscription
      const subRes = await client.createSubscription({
        source_id: src.id,
        destination_id: dst.id,
        event_types: events,
      });
      const sub = subRes.data as { id: string };

      // Build webhook URL
      const baseUrl = config.api_url.replace(/\/$/, "");
      const webhookUrl = `${baseUrl}/webhooks/${src.id}`;

      if (isJsonMode()) {
        output({
          source: { id: src.id, name: src.name, webhook_url: webhookUrl },
          destination: { id: dst.id, name: dst.name, url: dst.url },
          subscription: { id: sub.id, events },
          next_steps: provider?.nextSteps ?? null,
        });
      } else {
        outputSuccess(`Connected ${providerArg} → ${opts.to}`);
        console.log();
        console.log(`  Source:       ${src.id} (${src.name})`);
        console.log(`  Destination:  ${dst.id} (${dst.name})`);
        console.log(`  Events:       ${events.join(", ")}`);
        console.log(`  Webhook URL:  ${webhookUrl}`);
        console.log();
        if (provider?.nextSteps) {
          console.log("  Next steps:");
          if (provider.nextSteps.instruction) console.log(`    ${provider.nextSteps.instruction}`);
          if (provider.nextSteps.dashboard) console.log(`    Dashboard: ${provider.nextSteps.dashboard}`);
        } else {
          console.log(`  Next steps: configure your service to send webhooks to the URL above.`);
        }
      }
    } catch (err) {
      // Rollback is best-effort — log what was created
      outputError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

function resolveVerificationType(provider: { verification: { type?: string; algorithm?: string } }): string {
  const v = provider.verification;
  if ("type" in v && v.type && v.type !== "custom") return v.type === "stripe-signature" ? "stripe" : v.type === "slack-signature" ? "slack" : v.type;
  if ("algorithm" in v && v.algorithm) return v.algorithm;
  return "hmac-sha256";
}

function slugify(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/\./g, "-").slice(0, 50);
  } catch {
    return "destination";
  }
}
