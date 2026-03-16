import { defineProvider } from "../define";

export const vercel = defineProvider({
  id: "vercel",
  name: "Vercel",
  website: "https://vercel.com",
  dashboardUrl: "https://vercel.com/account/webhooks",

  verification: {
    header: "x-vercel-signature",
    algorithm: "hmac-sha1",
  },

  parseEventType: (body) => (body as Record<string, unknown>).type as string ?? "unknown",
  parseEventId: (body) => (body as Record<string, unknown>).id as string ?? null,

  events: {
    "deployment.created": { description: "Deployment started", category: "deployments" },
    "deployment.succeeded": { description: "Deployment succeeded", category: "deployments" },
    "deployment.ready": { description: "Deployment ready to serve traffic", category: "deployments" },
    "deployment.error": { description: "Deployment failed", category: "deployments" },
    "deployment.canceled": { description: "Deployment canceled", category: "deployments" },
    "project.created": { description: "New project created", category: "projects" },
    "project.removed": { description: "Project removed", category: "projects" },
    "domain.created": { description: "Domain added", category: "domains" },
    "integration-configuration.removed": { description: "Integration removed", category: "integrations" },
  },

  presets: {
    deployments: ["deployment.*"],
    all: ["*"],
  },

  nextSteps: {
    dashboard: "https://vercel.com/account/webhooks",
    instruction: "Go to Vercel Account Settings → Webhooks → Create Webhook, paste the URL",
  },
});
