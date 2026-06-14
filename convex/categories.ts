import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";

const DEFAULTS = [
  ["Compras", "expense", "shopping-bag", "#ef4444"],
  ["Transferencias", "expense", "arrow-up-right", "#f97316"],
  ["Servicios digitales", "expense", "globe", "#8b5cf6"],
  ["Vivienda", "expense", "house", "#ec4899"],
  ["Transporte", "expense", "car", "#0ea5e9"],
  ["Nómina", "income", "briefcase", "#0d9488"],
  ["Otros ingresos", "income", "circle-plus", "#14b8a6"],
] as const;

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
      .take(1);
    if (existing.length > 0) return null;
    for (const [name, kind, icon, color] of DEFAULTS) {
      await ctx.db.insert("categories", {
        userId,
        name,
        kind,
        icon,
        color,
        isDefault: true,
      });
    }
    return null;
  },
});

export const list = query({
  args: { kind: v.optional(v.union(v.literal("expense"), v.literal("income"))) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (args.kind) {
      return ctx.db
        .query("categories")
        .withIndex("by_userId_and_kind_and_name", (q) =>
          q.eq("userId", userId).eq("kind", args.kind!),
        )
        .take(50);
    }
    return ctx.db
      .query("categories")
      .withIndex("by_userId_and_name", (q) => q.eq("userId", userId))
      .take(50);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    kind: v.union(v.literal("expense"), v.literal("income")),
    icon: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const duplicate = await ctx.db
      .query("categories")
      .withIndex("by_userId_and_kind_and_name", (q) =>
        q.eq("userId", userId).eq("kind", args.kind).eq("name", args.name.trim()),
      )
      .unique();
    if (duplicate) throw new Error("La categoría ya existe.");
    return ctx.db.insert("categories", {
      userId,
      name: args.name.trim(),
      kind: args.kind,
      icon: args.icon,
      color: args.color,
      isDefault: false,
    });
  },
});
