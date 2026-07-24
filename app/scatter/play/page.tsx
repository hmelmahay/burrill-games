"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function ScatterJoin() {
  return (
    <Suspense>
      <JoinForm game="scatter" title="📝 Scatter Sprint" />
    </Suspense>
  );
}
