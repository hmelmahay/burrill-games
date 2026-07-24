"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function TTJoin() {
  return (
    <Suspense>
      <JoinForm game="twotruths" title="🤥 Two Truths & a Lie" />
    </Suspense>
  );
}
