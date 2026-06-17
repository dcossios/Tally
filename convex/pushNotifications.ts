"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import * as webpush from "web-push";

export const sendTransactionRegistered = internalAction({
  args: {
    userId: v.id("users"),
    transactionId: v.id("transactions"),
    status: v.union(v.literal("confirmed"), v.literal("pending")),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
    const siteUrl = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL;
    const subject = process.env.WEB_PUSH_SUBJECT ?? siteUrl;

    if (!publicKey || !privateKey || !subject) {
      return null;
    }

    const subscriptions = await ctx.runQuery(
      internal.pushSubscriptions.listByUserId,
      { userId: args.userId },
    );
    if (subscriptions.length === 0) {
      return null;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const baseUrl = new URL(siteUrl ?? "http://localhost");
    baseUrl.searchParams.set("transactionId", args.transactionId);
    baseUrl.searchParams.set("openNote", "1");

    const payload = JSON.stringify({
      title: "Nueva transacción registrada",
      body:
        args.status === "pending"
          ? "Toca para revisar el movimiento y agregar una nota."
          : "Toca para abrirla y anotar en qué gastaste el dinero.",
      url: baseUrl.toString(),
      transactionId: args.transactionId,
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            payload,
          );
        } catch (error) {
          const statusCode =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
              ? error.statusCode
              : undefined;

          if (statusCode === 404 || statusCode === 410) {
            await ctx.runMutation(internal.pushSubscriptions.removeByEndpoint, {
              endpoint: subscription.endpoint,
            });
          } else {
            console.error("Failed to send push notification", error);
          }
        }
      }),
    );

    return null;
  },
});

export const sendGoalAlert = internalAction({
  args: {
    userId: v.id("users"),
    goalId: v.id("goals"),
    goalName: v.string(),
    threshold: v.union(v.literal(80), v.literal(100)),
    currentMinor: v.number(),
    targetMinor: v.number(),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
    const siteUrl = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL;
    const subject = process.env.WEB_PUSH_SUBJECT ?? siteUrl;

    if (!publicKey || !privateKey || !subject) {
      return null;
    }

    const subscriptions = await ctx.runQuery(
      internal.pushSubscriptions.listByUserId,
      { userId: args.userId },
    );
    if (subscriptions.length === 0) {
      return null;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const baseUrl = new URL(siteUrl ?? "http://localhost");
    baseUrl.searchParams.set("screen", "goals");
    baseUrl.searchParams.set("goalId", args.goalId);

    const payload = JSON.stringify({
      title: args.threshold === 100 ? "Límite de gasto alcanzado" : "Te acercas a tu límite",
      body:
        args.threshold === 100
          ? `Llegaste al máximo de gasto en ${args.goalName}.`
          : `Ya consumiste el 80% de ${args.goalName}.`,
      url: baseUrl.toString(),
      goalId: args.goalId,
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            payload,
          );
        } catch (error) {
          const statusCode =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
              ? error.statusCode
              : undefined;

          if (statusCode === 404 || statusCode === 410) {
            await ctx.runMutation(internal.pushSubscriptions.removeByEndpoint, {
              endpoint: subscription.endpoint,
            });
          } else {
            console.error("Failed to send goal push notification", error);
          }
        }
      }),
    );

    return null;
  },
});
