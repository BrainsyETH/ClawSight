"use client";

import { useRouter } from "next/navigation";
import { ModeProvider } from "@/hooks/use-mode";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { DisplayMode } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();

  const handleComplete = (mode: DisplayMode) => {
    // In production: save mode to Supabase, set session cookie
    localStorage.setItem("clawsight_mode", mode);
    localStorage.setItem("clawsight_onboarded", "true");
    router.push("/");
  };

  return (
    <ModeProvider>
      <OnboardingFlow onComplete={handleComplete} />
    </ModeProvider>
  );
}
