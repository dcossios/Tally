import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { normalizeMessage, sha256 } from "./lib/hash";
import { normalizeSender } from "./lib/allowedSenders";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/api/import/sms",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json(
        { status: "error", code: "token_required", message: "Token requerido." },
        401,
      );
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json(
        { status: "error", code: "json_invalid", message: "JSON inválido." },
        400,
      );
    }
    if (!isSmsPayload(payload)) {
      return json(
        { status: "error", code: "payload_invalid", message: "Payload inválido." },
        400,
      );
    }
    const receivedAt = Date.parse(payload.receivedAt);
    if (!Number.isFinite(receivedAt)) {
      return json(
        {
          status: "error",
          code: "received_at_invalid",
          message: "Fecha inválida.",
          receivedAt: payload.receivedAt,
        },
        400,
      );
    }
    const tokenHash = await sha256(authorization.slice("Bearer ".length));
    const normalizedMessage = normalizeMessage(payload.message);
    const normalizedHash = await sha256(
      `${payload.sender}|${normalizedMessage}`,
    );
    const result = await ctx.runMutation(internal.imports.processSms, {
      tokenHash,
      normalizedHash,
      sender: payload.sender,
      message: payload.message,
      receivedAt,
    });
    if (result.kind === "unauthorized") {
      return json(
        {
          status: "error",
          code: "token_invalid",
          message: "Token inválido o revocado.",
        },
        401,
      );
    }
    if (result.kind === "sender_not_allowed") {
      return json(
        {
          status: "error",
          code: "sender_not_allowed",
          message: "Remitente no autorizado.",
          sender: payload.sender,
          normalizedSender: normalizeSender(payload.sender),
        },
        403,
      );
    }
    if (result.kind === "duplicate") {
      return json(
        {
          status: "duplicate",
          code: "duplicate",
          message: "El mensaje ya fue importado.",
          importId: result.importId,
          transactionId: result.transactionId,
          parserRule: result.parserRule,
          parserError: result.parserError,
          importStatus: result.status,
        },
        200,
      );
    }
    if (result.kind === "pending") {
      return json(
        {
          status: "pending",
          code: "parser_pending",
          message: "Guardado para revisión.",
          importId: result.importId,
          transactionId: result.transactionId,
          parserRule: result.parserRule,
          parserError: result.parserError,
        },
        202,
      );
    }
    return json(
      {
        status: "created",
        code: "import_created",
        message: "Movimiento registrado.",
        importId: result.importId,
        transactionId: result.transactionId,
        parserRule: result.parserRule,
        parserError: result.parserError,
        receivedAt,
        normalizedHash,
      },
      201,
    );
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
