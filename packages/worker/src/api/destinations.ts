import { Hono } from "hono";
import type { Env } from "../lib/types";
import { generateId } from "../lib/id";
import { badRequest, notFound } from "../lib/errors";
import { createDb } from "../db/queries";
import * as db from "../db/queries";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const destinations = await db.listDestinations(createDb(c.env.DB));
  return c.json({ data: destinations });
});

app.get("/:id", async (c) => {
  const dest = await db.getDestination(createDb(c.env.DB), c.req.param("id"));
  if (!dest) throw notFound("Destination not found");
  return c.json({ data: dest });
});

app.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    url: string;
    retry_policy?: {
      max_retries?: number;
      timeout_ms?: number;
      backoff_base_ms?: number;
      backoff_max_ms?: number;
    };
  }>();

  if (!body.name) throw badRequest("name is required");
  if (!body.url) throw badRequest("url is required");

  const id = generateId("dst");
  await db.createDestination(createDb(c.env.DB), {
    id,
    name: body.name,
    url: body.url,
    timeout_ms: body.retry_policy?.timeout_ms ?? 30000,
    max_retries: body.retry_policy?.max_retries ?? 5,
    backoff_base_ms: body.retry_policy?.backoff_base_ms ?? 30000,
    backoff_max_ms: body.retry_policy?.backoff_max_ms ?? 86400000,
  });

  const dest = await db.getDestination(createDb(c.env.DB), id);
  return c.json({ data: dest }, 201);
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.getDestination(createDb(c.env.DB), id);
  if (!existing) throw notFound("Destination not found");

  const body = await c.req.json<{
    name?: string;
    url?: string;
    retry_policy?: {
      max_retries?: number;
      timeout_ms?: number;
      backoff_base_ms?: number;
      backoff_max_ms?: number;
    };
  }>();

  await db.updateDestination(createDb(c.env.DB), id, {
    name: body.name,
    url: body.url,
    timeout_ms: body.retry_policy?.timeout_ms,
    max_retries: body.retry_policy?.max_retries,
    backoff_base_ms: body.retry_policy?.backoff_base_ms,
    backoff_max_ms: body.retry_policy?.backoff_max_ms,
  });

  const dest = await db.getDestination(createDb(c.env.DB), id);
  return c.json({ data: dest });
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.getDestination(createDb(c.env.DB), id);
  if (!existing) throw notFound("Destination not found");

  await db.deleteDestination(createDb(c.env.DB), id);
  return c.json({ message: "Deleted" });
});

export { app as destinationsApi };
