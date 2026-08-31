import { TrackingPage } from "@/app/(tracking)/track/tracking-page";

export const dynamic = "force-dynamic";

export default async function TrackNoncePage({
  params,
}: {
  params: Promise<{ nonce: string }>;
}) {
  const { nonce } = await params;
  return <TrackingPage initialNonce={nonce} />;
}
