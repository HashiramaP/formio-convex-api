import { v } from "convex/values";
import { internalQuery, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

// Submission notification emails, sent via Resend. Rebuilt on Convex to replace
// the legacy Supabase `send-email` Edge Function. Triggered out-of-band from
// `submissions.completeSubmission` via the scheduler, so a Resend outage never
// blocks a client's submission.

interface NotificationParams {
  firmName: string;
  clientName: string;
  immigrationType: string;
  submittedAt: string;
  deepLink: string;
}

// Ported verbatim from the legacy Supabase send-email function (Phase 2 template).
function buildNotificationHtml({
  firmName,
  clientName,
  immigrationType,
  submittedAt,
  deepLink,
}: NotificationParams): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0; color: #1a1a1a; background-color: #f9fafb;">
  <div style="background-color: #0088FF; padding: 20px 32px; text-align: center;">
    <img src="https://formio.ca/FormioTextWhite.png" alt="Formio" style="height: 36px; width: auto;" />
  </div>

  <div style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1a1a1a;">Nouveau formulaire soumis</h2>

    <p style="font-size: 16px; line-height: 1.5;">
      <strong>${clientName}</strong> a soumis le formulaire
      <strong>${immigrationType}</strong>.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background-color: #f9fafb; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; color: #6b7280; font-size: 14px;">Client</td>
        <td style="padding: 12px 16px; font-size: 14px; text-align: right; font-weight: 500;">${clientName}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Type d&#39;immigration</td>
        <td style="padding: 12px 16px; font-size: 14px; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb;">${immigrationType}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Soumis le</td>
        <td style="padding: 12px 16px; font-size: 14px; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb;">${submittedAt}</td>
      </tr>
    </table>

    <a href="${deepLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
      Voir la demande
    </a>
  </div>

  <div style="padding: 16px 32px; text-align: center; font-size: 11px; color: #9ca3af;">
    <p style="margin: 0;">Envoy&#233; automatiquement par <a href="https://formio.ca" style="color: #2563eb; text-decoration: none;">Formio</a></p>
  </div>
</body>
</html>`;
}

// Gather recipient + template data in a single DB round-trip. Actions can't use
// ctx.db, so the action calls this internal query. Recipient resolution:
// case's notification profile email -> firm general notification email -> none.
export const getSubmissionNotificationData = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const submission = await ctx.db.get(submissionId);
    if (!submission) return null;

    const client = submission.clientId
      ? await ctx.db.get(submission.clientId)
      : null;
    const firm = await ctx.db.get(submission.firmId);
    const formDef = submission.formDefinitionId
      ? await ctx.db.get(submission.formDefinitionId)
      : null;

    let recipientEmail: string | null = null;
    if (client?.notificationProfileId) {
      const profile = await ctx.db.get(client.notificationProfileId);
      if (profile?.email) recipientEmail = profile.email;
    }
    const generalEmail = firm?.emailSettings?.generalNotificationEmail ?? null;
    if (!recipientEmail) recipientEmail = generalEmail;

    const clientName =
      `${client?.firstName ?? ""} ${client?.lastName ?? ""}`.trim() || "Client";
    const meta = (submission.metadata as Record<string, unknown> | null) ?? {};
    const submittedAt =
      typeof meta.submitted_at === "string" ? meta.submitted_at : null;

    return {
      recipientEmail,
      generalEmail,
      firmId: submission.firmId,
      clientId: submission.clientId ?? null,
      firmName: firm?.displayName ?? "Formio",
      clientName,
      immigrationType: formDef?.name ?? "Demande",
      submittedAt,
    };
  },
});

export const sendSubmissionNotification = internalAction({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, { submissionId }) => {
    const data = await ctx.runQuery(
      internal.notifications.getSubmissionNotificationData,
      { submissionId },
    );
    if (!data) return { status: "skipped_no_submission" as const };

    if (!data.recipientEmail) {
      await ctx.runMutation(api.errorLogs.logError, {
        source: "notifications",
        context: "sendSubmissionNotification",
        message: "skipped_no_recipient",
        submissionId,
        firmId: data.firmId,
        ...(data.clientId ? { clientId: data.clientId } : {}),
      });
      return { status: "skipped_no_recipient" as const };
    }

    const submittedAt = new Date(
      data.submittedAt ?? new Date().toISOString(),
    ).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });

    // Dashboard case page for firm staff. (Confirm prod dashboard domain.)
    const deepLink = data.clientId
      ? `https://app.formio.ca/dashboard/clients/${data.clientId}`
      : "https://app.formio.ca/dashboard";

    const html = buildNotificationHtml({
      firmName: data.firmName,
      clientName: data.clientName,
      immigrationType: data.immigrationType,
      submittedAt,
      deepLink,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Formio <info@formio.ca>",
        to: [data.recipientEmail],
        ...(data.generalEmail ? { reply_to: data.generalEmail } : {}),
        subject: `Nouveau formulaire soumis par ${data.clientName}`,
        html,
      }),
    });
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (!res.ok || !body?.id) {
      await ctx.runMutation(api.errorLogs.logError, {
        source: "notifications",
        context: "sendSubmissionNotification",
        message: "resend_failed",
        details: body,
        submissionId,
        firmId: data.firmId,
        ...(data.clientId ? { clientId: data.clientId } : {}),
      });
      return { status: "failed" as const };
    }
    return { status: "sent" as const, id: body.id as string };
  },
});
