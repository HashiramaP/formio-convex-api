import { query } from "./_generated/server";

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("questionTemplates").collect();
    return templates.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});
