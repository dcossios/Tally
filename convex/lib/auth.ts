import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("No autenticado");
  }
  return userId;
}

export async function requireSpaceMembership(
  ctx: QueryCtx | MutationCtx,
): Promise<{
  userId: Id<"users">;
  spaceId: Id<"sharedSpaces">;
  membership: Doc<"sharedMemberships">;
}> {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("sharedMemberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!membership) {
    throw new Error("No perteneces a un espacio compartido.");
  }
  return { userId, spaceId: membership.spaceId, membership };
}
