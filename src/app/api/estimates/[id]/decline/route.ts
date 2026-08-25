import { declineEstimate, loadEstimateById } from "@/lib/estimates/actions";
import { jsonError, requireApprovedSession } from "@/lib/estimates/http";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { estimateIsLinkedToUser } from "@/types/estimates";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user, profile } = await requireApprovedSession();
  if (error || !user || !profile) return error;
  if (profile.role !== "client") {
    return jsonError("Only the client can decline this estimate.", 403);
  }
  if (!isAdminClientConfigured()) {
    return jsonError("Server is missing SUPABASE_SERVICE_ROLE_KEY.", 503);
  }
  const { id } = await params;
  const admin = createAdminClient();
  const estimate = await loadEstimateById(admin, id);
  if (!estimate) return jsonError("Estimate not found.", 404);
  if (!estimateIsLinkedToUser(estimate, user.id) || estimate.status === "draft") {
    return jsonError("You cannot update this estimate.", 403);
  }

  const result = await declineEstimate({
    admin,
    estimate,
    actorId: user.id,
    actorLabel: "client portal",
  });
  if (result.error) return jsonError(result.error, result.status);
  return Response.json({ ok: true });
}
