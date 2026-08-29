"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function ChainJoin() {
  return (
    <Suspense>
      <JoinForm game="chain" title="⛓️ Chain Gang" />
    </Suspense>
  );
}
