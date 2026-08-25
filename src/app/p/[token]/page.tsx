import { PublicEstimateView } from "@/components/estimates/public-estimate-view";

export default async function PublicEstimatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicEstimateView token={token} />;
}
