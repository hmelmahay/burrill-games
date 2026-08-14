"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function ChameleonJoin() {
  return (
    <Suspense>
      <JoinForm game="chameleon" title="🦎 Chameleon" />
    </Suspense>
  );
}
