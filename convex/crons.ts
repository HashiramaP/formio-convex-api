import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.monthly(
  "reset monthly client quotas",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.firms.resetMonthlyClientQuotas,
);

export default crons;
