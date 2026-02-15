"use client";

import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useUser, useSkillConfigs } from "@/hooks/use-supabase-data";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getDefaultConfig } from "@/lib/skill-forms";

function OnboardingInner() {
  const router = useRouter();
  const { walletAddress } = useAuth();
  const { updateUser } = useUser(walletAddress ?? undefined);
  const { saveConfig } = useSkillConfigs(walletAddress ?? undefined);

  const handleComplete = async () => {
    localStorage.setItem("clawsight_onboarded", "true");
    router.push("/");
  };

  const handleSaveAgentName = async (name: string) => {
    await updateUser({ agent_name: name });
  };

  const handleInstallSkill = async (slug: string) => {
    const defaults = getDefaultConfig(slug) || {};
    await saveConfig(slug, defaults);
  };

  return (
    <OnboardingFlow
      onComplete={handleComplete}
      onSaveAgentName={handleSaveAgentName}
      onInstallSkill={handleInstallSkill}
    />
  );
}

export default function OnboardingPage() {
  return (
    <AuthProvider>
      <OnboardingInner />
    </AuthProvider>
  );
}
