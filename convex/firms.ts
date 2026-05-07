import { v } from "convex/values";
import { query } from "./_generated/server";

export const getFirmDisplayName = query({
  args: { firmId: v.id("firms") },
  handler: async (ctx, { firmId }) => {
    const firm = await ctx.db.get(firmId);
    return firm?.displayName ?? null;
  },
});
