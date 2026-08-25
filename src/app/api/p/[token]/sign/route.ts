import { loadEstimateByToken, signEstimate } from "@/lib/estimates/actions";
import { jsonError } from "@/lib/estimates/http";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!isAdminClientConfigured()) {
    return jsonError("This link is unavailable.", 503);
  }
  const { token } = await params;
  const admin = createAdminClient();
  const estimate = await loadEstimateByToken(admin, token);
  if (!estimate || estimate.status === "draft") {
    return jsonError("This estimate link is invalid or expired.", 404);
  }

  const body = (await request.json().catch(() => null)) as {
    signedName?: string;
    signatureDataUrl?: string;
  } | null;

  const result = await signEstimate({
    admin,
    estimate,
    signedName: body?.signedName ?? "",
    signatureDataUrl: body?.signatureDataUrl,
    actorLabel: "client via link",
  });
  if (result.error) return jsonError(result.error, result.status);
  return Response.json({ ok: true });
}
