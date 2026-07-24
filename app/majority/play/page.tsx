"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function MajorityJoin() {
  return (
    <Suspense>
      <JoinForm game="majority" title="🐑 Majority Rules" />
    </Suspense>
  );
}
