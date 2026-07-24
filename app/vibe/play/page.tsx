"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function VibeJoin() {
  return (
    <Suspense>
      <JoinForm game="vibe" title="🌡️ Vibe Check" />
    </Suspense>
  );
}
