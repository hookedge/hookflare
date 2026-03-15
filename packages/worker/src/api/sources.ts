import { Hono } from "hono";
import type { Env } from "../lib/types";
import { generateId } from "../lib/id";
import { badRequest, notFound } from "../lib/errors";
import { createDb } from "../db/queries";
import * as db from "../db/queries";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const sources = await db.listSources(createDb(c.env.DB));
  return c.json({ data: sources });
});

app.get("/:id", async (c) => {
  const source = await db.getSource(createDb(c.env.DB), c.req.param("id"));
  if (!source) throw notFound("Source not found");
  return c.json({ data: source });
});

app.post("/", async (c) => {
  const d = createDb(c.env.DB);
  const body = await c.req.json<{
    name: string;
    verification?: { type: string; secret: string };
  }>();

  if (!body.name) throw badRequest("name is required");

  const id = generateId("src");
  await db.createSource(d, {
    id,
    name: body.name,
    verification_type: body.verification?.type ?? null,
    verification_secret: body.verification?.secret ?? null,
  });

  const source = await db.getSource(d, id);
  return c.json({ data: source }, 201);
});

app.put("/:id", async (c) => {
  const d = createDb(c.env.DB);
  const id = c.req.param("id");
  const existing = await db.getSource(d, id);
  if (!existing) throw notFound("Source not found");

  const body = await c.req.json<{
    name?: string;
    verification?: { type: string; secret: string } | null;
  }>();

  await db.updateSource(d, id, {
    name: body.name,
    verification_type: body.verification?.type,
    verification_secret: body.verification?.secret,
  });

  const source = await db.getSource(d, id);
  return c.json({ data: source });
});

app.delete("/:id", async (c) => {
  const d = createDb(c.env.DB);
  const id = c.req.param("id");
  const existing = await db.getSource(d, id);
  if (!existing) throw notFound("Source not found");

  await db.deleteSource(d, id);
  return c.json({ message: "Deleted" });
});

export { app as sourcesApi };
