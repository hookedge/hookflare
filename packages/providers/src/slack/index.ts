import { defineProvider } from "../define";

export const slack = defineProvider({
  id: "slack",
  name: "Slack",
  website: "https://slack.com",
  dashboardUrl: "https://api.slack.com/apps",

  verification: {
    type: "slack-signature",
    header: "x-slack-signature",
  },

  parseEventType: (body) => {
    const b = body as Record<string, unknown>;
    if (b.type === "event_callback") {
      const event = b.event as Record<string, unknown>;
      return event?.type as string ?? "event_callback";
    }
    return b.type as string ?? "unknown";
  },

  challenge: {
    detect: (body) => body.type === "url_verification",
    respond: (body) => ({ challenge: body.challenge }),
  },

  events: {
    message: { description: "Message posted in a channel", category: "messages" },
    app_mention: { description: "Your app was mentioned", category: "messages" },
    reaction_added: { description: "Reaction added to a message", category: "reactions" },
    reaction_removed: { description: "Reaction removed from a message", category: "reactions" },
    member_joined_channel: { description: "User joined a channel", category: "channels" },
    member_left_channel: { description: "User left a channel", category: "channels" },
    channel_created: { description: "New channel created", category: "channels" },
    channel_archive: { description: "Channel archived", category: "channels" },
    team_join: { description: "New user joined the workspace", category: "workspace" },
    url_verification: { description: "Slack URL verification challenge", category: "system" },
  },

  presets: {
    messages: ["message", "app_mention"],
    channels: ["member_joined_channel", "member_left_channel", "channel_created", "channel_archive"],
    all: ["*"],
  },

  nextSteps: {
    dashboard: "https://api.slack.com/apps",
    instruction: "Go to your Slack App → Event Subscriptions → paste the webhook URL as Request URL",
  },
});
