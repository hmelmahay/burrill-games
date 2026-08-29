"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function LetterRipJoin() {
  return (
    <Suspense>
      <JoinForm game="letterrip" title="🔤 Letter Rip" />
    </Suspense>
  );
}
