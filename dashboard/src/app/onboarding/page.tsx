"use client";

import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

function OnboardingInner() {
  const router = useRouter();
  const { walletAddress } = useAuth();

  const handleComplete = async () => {
    localStorage.setItem("clawsight_onboarded", "true");
    router.push("/");
  };

  return <OnboardingFlow onComplete={handleComplete} />;
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <OnboardingInner />
    </AuthProvider>
  );
}
