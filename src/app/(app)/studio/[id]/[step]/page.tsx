import { notFound } from "next/navigation";
import { StudioView } from "@/components/studio/studio-view";
import { isStageId } from "@/lib/stages";

export default async function StudioStepPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  if (!isStageId(step)) notFound();
  return <StudioView id={id} step={step} />;
}
