import { notFound } from "next/navigation";
import { StudioView } from "@/components/studio/studio-view";
import { getStage, isStageId } from "@/lib/stages";

export async function generateMetadata({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return { title: isStageId(step) ? `${getStage(step).label} · Studio` : "Studio" };
}

export default async function StudioStepPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { id, step } = await params;
  if (!isStageId(step)) notFound();
  return <StudioView id={id} step={step} />;
}
