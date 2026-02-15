"use client";

import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ModeProvider } from "@/hooks/use-mode";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { createClient } from "@/lib/supabase";
import { DisplayMode } from "@/types";

function OnboardingInner() {
  const router = useRouter();
  const { walletAddress } = useAuth();

  const handleComplete = async (mode: DisplayMode) => {
    // Save mode preference to Supabase
    if (walletAddress) {
      const supabase = createClient();
      await supabase
        .from("users")
        .update({ display_mode: mode })
        .eq("wallet_address", walletAddress);
    }

    localStorage.setItem("clawsight_mode", mode);
    localStorage.setItem("clawsight_onboarded", "true");
    router.push("/");
  };

  return <OnboardingFlow onComplete={handleComplete} />;
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <ModeProvider>
        <OnboardingInner />
      </ModeProvider>
    </AuthProvider>
  );
}
