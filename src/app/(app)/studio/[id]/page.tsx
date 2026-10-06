"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function StudioVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { getVideo } = useStore();
  const v = getVideo(id);
  useEffect(() => {
    router.replace(`/studio/${id}/${v?.stage ?? "idea"}`);
  }, [id, v?.stage, router]);
  return null;
}
