import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

// POST /uploadFilledPdf
//
// Called by the IRCC XFA fill worker (Windows VM running Acrobat + AHK) after
// it produces a filled PDF. Body is the raw PDF bytes; metadata travels in
// headers so we can stream the body straight to storage without parsing.
//
// Auth: shared webhook secret in env (PDF_FILLER_WEBHOOK_SECRET). Rotate by
// updating the Pulumi secret + Convex env var; admin key is intentionally not
// used here so the VM never gets DB-write privileges.
http.route({
  path: "/uploadFilledPdf",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.PDF_FILLER_WEBHOOK_SECRET;
    if (!expected) {
      return new Response("Server missing PDF_FILLER_WEBHOOK_SECRET", { status: 500 });
    }
    if (request.headers.get("authorization") !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const jobId = request.headers.get("x-job-id");
    const template = request.headers.get("x-template");
    if (!jobId || !template) {
      return new Response("Missing x-job-id or x-template header", { status: 400 });
    }

    const blob = await request.blob();
    if (blob.size === 0) {
      return new Response("Empty body", { status: 400 });
    }

    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);

    // Slice 1 spike — when the worker forwards client/document context, mark
    // generatedLegalDocs as ready in the same request. Both headers optional
    // so legacy callers (no Convex linkage) keep working.
    const clientId = request.headers.get("x-client-id");
    const legalDocumentId = request.headers.get("x-legal-document-id");
    if (clientId && legalDocumentId) {
      await ctx.runMutation(api.legalDocuments.upsertGeneratedLegalDoc, {
        clientId: clientId as Id<"clients">,
        legalDocumentId: legalDocumentId as Id<"legalDocuments">,
        storageId,
        status: "ready",
      });
    }

    return new Response(JSON.stringify({ jobId, template, storageId, url }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

export default http;
