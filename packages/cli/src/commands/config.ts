import { Command } from "commander";
import { saveConfig, loadConfig, getConfigPath } from "../config.js";
import { output, outputSuccess } from "../output.js";

export const configCommand = new Command("config")
  .description("Manage CLI configuration");

configCommand
  .command("set")
  .description("Set a configuration value")
  .argument("<key>", "Config key (api_url, token)")
  .argument("<value>", "Config value")
  .action((key: string, value: string) => {
    if (!["api_url", "token"].includes(key)) {
      throw new Error(`Unknown config key: ${key}. Valid keys: api_url, token`);
    }
    saveConfig({ [key]: value });
    outputSuccess(`${key} = ${key === "token" ? "****" : value}`);
  });

configCommand
  .command("get")
  .description("Show current configuration")
  .action(() => {
    const config = loadConfig();
    const display = {
      ...config,
      token: config.token ? "****" : undefined,
      config_path: getConfigPath(),
    };
    output(display);
  });
