import { loadEstimateById, signEstimate } from "@/lib/estimates/actions";
import { jsonError, requireApprovedSession } from "@/lib/estimates/http";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { estimateIsLinkedToUser } from "@/types/estimates";

async function loadClientEstimate(id: string, userId: string) {
  if (!isAdminClientConfigured()) {
    return { estimate: null, admin: null, error: jsonError("Server is missing SUPABASE_SERVICE_ROLE_KEY.", 503) };
  }
  const admin = createAdminClient();
  const estimate = await loadEstimateById(admin, id);
  if (!estimate) {
    return { estimate: null, admin, error: jsonError("Estimate not found.", 404) };
  }
  if (!estimateIsLinkedToUser(estimate, userId) || estimate.status === "draft") {
    return { estimate: null, admin, error: jsonError("You cannot update this estimate.", 403) };
  }
  return { estimate, admin, error: null };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user, profile } = await requireApprovedSession();
  if (error || !user || !profile) return error;
  if (profile.role !== "client") {
    return jsonError("Only the client can sign this estimate.", 403);
  }
  const { id } = await params;
  const loaded = await loadClientEstimate(id, user.id);
  if (loaded.error || !loaded.estimate || !loaded.admin) return loaded.error;

  const body = (await request.json().catch(() => null)) as {
    signedName?: string;
    signatureDataUrl?: string;
  } | null;

  const result = await signEstimate({
    admin: loaded.admin,
    estimate: loaded.estimate,
    signedName: body?.signedName ?? "",
    signatureDataUrl: body?.signatureDataUrl,
    actorId: user.id,
    actorLabel: "client portal",
  });
  if (result.error) return jsonError(result.error, result.status);
  return Response.json({ ok: true });
}
