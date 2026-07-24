"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function HotTakeJoin() {
  return (
    <Suspense>
      <JoinForm game="hottake" title="🔥 Hot Take" />
    </Suspense>
  );
}
