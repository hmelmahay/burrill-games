"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function QuizJoin() {
  return (
    <Suspense>
      <JoinForm game="quiz" title="⚡ Quiz Rush" />
    </Suspense>
  );
}
