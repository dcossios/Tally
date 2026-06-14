import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";
import { sha256 } from "./lib/hash";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("shortcutTokens")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const create = mutation({
  args: { name: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.token.length < 32) throw new Error("Token inválido.");
    const tokenHash = await sha256(args.token);
    const duplicate = await ctx.db
      .query("shortcutTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (duplicate) throw new Error("El token ya existe.");
    return ctx.db.insert("shortcutTokens", {
      userId,
      name: args.name.trim() || "iPhone",
      tokenHash,
      prefix: args.token.slice(0, 8),
      createdAt: Date.now(),
    });
  },
});

export const revoke = mutation({
  args: { id: v.id("shortcutTokens") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const token = await ctx.db.get("shortcutTokens", args.id);
    if (!token || token.userId !== userId) throw new Error("No encontrado.");
    await ctx.db.patch("shortcutTokens", args.id, { revokedAt: Date.now() });
    return null;
  },
});
