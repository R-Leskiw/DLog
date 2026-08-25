import { NextRequest } from "next/server";

import {
  loadEstimateById,
  sendEstimate,
} from "@/lib/estimates/actions";
import { jsonError, originFrom, requireAdminSession } from "@/lib/estimates/http";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAdminSession();
  if (error || !user) return error;
  if (!isAdminClientConfigured()) {
    return jsonError("Server is missing SUPABASE_SERVICE_ROLE_KEY.", 503);
  }

  const { id } = await params;
  const admin = createAdminClient();
  const estimate = await loadEstimateById(admin, id);
  if (!estimate) return jsonError("Estimate not found.", 404);

  const result = await sendEstimate({
    admin,
    estimateId: id,
    actorId: user.id,
    origin: originFrom(request),
  });
  if (result.error) {
    return jsonError(result.error, result.status);
  }
  return Response.json({
    shareUrl: result.shareUrl,
    emailed: result.emailed,
  });
}
