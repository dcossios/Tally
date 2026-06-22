import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { normalizeMessage, sha256 } from "./lib/hash";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/api/import/sms",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ status: "error", message: "Token requerido." }, 401);
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ status: "error", message: "JSON inválido." }, 400);
    }
    if (!isSmsPayload(payload)) {
      return json({ status: "error", message: "Payload inválido." }, 400);
    }
    const receivedAt = Date.parse(payload.receivedAt);
    if (!Number.isFinite(receivedAt)) {
      return json({ status: "error", message: "Fecha inválida." }, 400);
    }
    const tokenHash = await sha256(authorization.slice("Bearer ".length));
    const normalizedHash = await sha256(
      `${payload.sender}|${normalizeMessage(payload.message)}`,
    );
    const result = await ctx.runMutation(internal.imports.processSms, {
      tokenHash,
      normalizedHash,
      sender: payload.sender,
      message: payload.message,
      receivedAt,
    });
    if (result.kind === "unauthorized") {
      return json({ status: "error", message: "Token inválido o revocado." }, 401);
    }
    if (result.kind === "sender_not_allowed") {
      return json({ status: "error", message: "Remitente no autorizado." }, 403);
    }
    if (result.kind === "duplicate") {
      return json({ status: "duplicate", message: "El mensaje ya fue importado." }, 200);
    }
    if (result.kind === "ignored") {
      return json({ status: "ignored", message: "El mensaje no representa un movimiento." }, 200);
    }
    if (result.kind === "pending") {
      await ctx.scheduler.runAfter(0, internal.pushNotifications.sendTransactionRegistered, {
        userId: result.userId,
        transactionId: result.transactionId,
        status: result.status,
      });
      return json({ status: "pending", message: "Guardado para revisión." }, 202);
    }
    await ctx.scheduler.runAfter(0, internal.pushNotifications.sendTransactionRegistered, {
      userId: result.userId,
      transactionId: result.transactionId,
      status: result.status,
    });
    return json({ status: "created", message: "Movimiento registrado." }, 201);
  }),
});

function isSmsPayload(
  value: unknown,
): value is { sender: string; message: string; receivedAt: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sender === "string" &&
    typeof candidate.message === "string" &&
    candidate.message.length > 0 &&
    candidate.message.length < 5000 &&
    typeof candidate.receivedAt === "string"
  );
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default http;
