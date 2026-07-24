"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function DoodleJoin() {
  return (
    <Suspense>
      <JoinForm game="doodle" title="🎨 Doodle Dash" />
    </Suspense>
  );
}
