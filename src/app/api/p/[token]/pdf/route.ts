import { loadEstimateByToken } from "@/lib/estimates/actions";
import { generateEstimatePdfBytes } from "@/lib/estimates/pdf";
import { jsonError, pdfHeaders } from "@/lib/estimates/http";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
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
  try {
    const bytes = await generateEstimatePdfBytes(admin, estimate.id);
    return new Response(Buffer.from(bytes), {
      headers: pdfHeaders(`${estimate.title || "estimate"}.pdf`),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build PDF.";
    return jsonError(message, 500);
  }
}
