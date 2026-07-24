"use client";

import { Suspense } from "react";
import { JoinForm } from "@/app/components/JoinForm";

export default function EmojiJoin() {
  return (
    <Suspense>
      <JoinForm game="emoji" title="🎬 Emoji Cinema" />
    </Suspense>
  );
}
