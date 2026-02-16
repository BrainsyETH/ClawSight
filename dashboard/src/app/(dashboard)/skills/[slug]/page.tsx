"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSkillConfigs } from "@/hooks/use-supabase-data";
import { useEncryption } from "@/hooks/use-encryption";
import { getSkillForm, getDefaultConfig } from "@/lib/skill-forms";
import { SkillConfigForm } from "@/components/skills/skill-config-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncBadge } from "@/components/shared/sync-badge";
import { ArrowLeft, Code, Loader2 } from "lucide-react";
import { SyncStatus } from "@/types";

export default function SkillConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { walletAddress, signMessage } = useAuth();
  const { configs, loading, saveConfig } = useSkillConfigs(walletAddress ?? undefined);
  const { ready: encryptionReady, initEncryption, encryptConfig, decryptConfig } = useEncryption();
  const slug = params.slug as string;
  const form = getSkillForm(slug);

  // Find existing config for this skill
  const existingConfig = configs.find((c) => c.skill_slug === slug);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    existingConfig?.sync_status || "applied"
  );
  const [jsonMode, setJsonMode] = useState(!form);
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(existingConfig?.config || (form ? getDefaultConfig(slug) : {}), null, 2)
  );
  const [initialValues, setInitialValues] = useState<Record<string, unknown>>(
    existingConfig?.config || (form ? getDefaultConfig(slug) || {} : {})
  );

  // Init encryption for secret fields when form has them
  useEffect(() => {
    const hasSecrets = form?.fields.some((f) => f.type === "secret");
    if (hasSecrets && !encryptionReady && walletAddress) {
      initEncryption(signMessage);
    }
  }, [form, encryptionReady, walletAddress, initEncryption, signMessage]);

  // Decrypt existing config if it has encrypted values
  useEffect(() => {
    if (!existingConfig || !form || !encryptionReady) return;

    async function decrypt() {
      try {
        const decrypted = await decryptConfig(form!.fields, existingConfig!.config);
        setInitialValues(decrypted);
        setJsonValue(JSON.stringify(decrypted, null, 2));
      } catch {
        // Decryption failed — use raw values
        setInitialValues(existingConfig!.config);
      }
    }
    decrypt();
  }, [existingConfig, form, encryptionReady, decryptConfig]);

  // Update sync status from realtime updates
  useEffect(() => {
    if (existingConfig) {
      setSyncStatus(existingConfig.sync_status);
    }
  }, [existingConfig?.sync_status, existingConfig]);

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    setSaveError(null);
    setSyncStatus("syncing");
    try {
      // Encrypt secret fields before sending
      let configToSave = values;
      if (form && encryptionReady) {
        configToSave = await encryptConfig(form.fields, values);
      }

      await saveConfig(slug, configToSave, existingConfig?.updated_at);
      setSyncStatus("pending");
    } catch (err) {
      setSyncStatus("failed");
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleJsonSave = async () => {
    try {
      const parsed = JSON.parse(jsonValue);
      await handleSave(parsed);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setSaveError("Invalid JSON");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {form?.name || slug} Configuration
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <SyncBadge status={syncStatus} />
              {form && (
                <Badge variant="outline" className="text-xs">
                  {form.fields.length} settings
                </Badge>
              )}
            </div>
          </div>
        </div>
        {form && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJsonMode(!jsonMode)}
            className="gap-2"
          >
            <Code className="w-4 h-4" />
            {jsonMode ? "Visual Editor" : "JSON Editor"}
          </Button>
        )}
      </div>

      {saveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Form or JSON editor */}
      {form && !jsonMode ? (
        <SkillConfigForm
          definition={form}
          initialValues={initialValues}
          onSave={handleSave}
          saving={saving}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              JSON Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={jsonValue}
              onChange={(e) => setJsonValue(e.target.value)}
              className="w-full h-80 font-mono text-sm bg-gray-900 text-green-400 p-4 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-red-500"
              spellCheck={false}
            />
            <div className="flex justify-end mt-4">
              <Button onClick={handleJsonSave} disabled={saving}>
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
