"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function BallparkJoin() {
  return (
    <Suspense>
      <JoinForm game="ballpark" title="🎯 Ballpark" />
    </Suspense>
  );
}
