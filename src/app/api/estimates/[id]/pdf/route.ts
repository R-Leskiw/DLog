import { estimateIsLinkedToUser } from "@/types/estimates";
import { generateEstimatePdfBytes } from "@/lib/estimates/pdf";
import { loadEstimateById } from "@/lib/estimates/actions";
import { jsonError, pdfHeaders, requireApprovedSession } from "@/lib/estimates/http";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { isStaffRole } from "@/types/roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user, profile } = await requireApprovedSession();
  if (error || !user || !profile) return error;
  if (!isAdminClientConfigured()) {
    return jsonError("Server is missing SUPABASE_SERVICE_ROLE_KEY.", 503);
  }

  const { id } = await params;
  const admin = createAdminClient();
  const estimate = await loadEstimateById(admin, id);
  if (!estimate) return jsonError("Estimate not found.", 404);

  const staff = isStaffRole(profile.role);
  const clientOk =
    profile.role === "client" &&
    estimateIsLinkedToUser(estimate, user.id) &&
    estimate.status !== "draft";
  if (!staff && !clientOk) {
    return jsonError("You cannot view this estimate.", 403);
  }

  try {
    const bytes = await generateEstimatePdfBytes(admin, id);
    return new Response(Buffer.from(bytes), {
      headers: pdfHeaders(`${estimate.title || "estimate"}.pdf`),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build PDF.";
    return jsonError(message, 500);
  }
}
