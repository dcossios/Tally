import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const subscriptionFields = {
  endpoint: v.string(),
  expirationTime: v.optional(v.number()),
  auth: v.string(),
  p256dh: v.string(),
};

export const publicKey = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return process.env.WEB_PUSH_PUBLIC_KEY ?? null;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) => q.eq("userId", userId))
      .take(10);
  },
});

export const upsert = mutation({
  args: subscriptionFields,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) =>
        q.eq("userId", userId).eq("endpoint", args.endpoint),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        expirationTime: args.expirationTime,
        auth: args.auth,
        p256dh: args.p256dh,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      expirationTime: args.expirationTime,
      auth: args.auth,
      p256dh: args.p256dh,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) =>
        q.eq("userId", userId).eq("endpoint", args.endpoint),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const listByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) => q.eq("userId", args.userId))
      .take(10);
  },
});

export const removeByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
