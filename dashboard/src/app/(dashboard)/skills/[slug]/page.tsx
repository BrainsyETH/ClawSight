"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/hooks/use-mode";
import { getSkillForm, getDefaultConfig } from "@/lib/skill-forms";
import { SkillConfigForm } from "@/components/skills/skill-config-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncBadge } from "@/components/shared/sync-badge";
import { ArrowLeft, Code } from "lucide-react";
import { SyncStatus } from "@/types";

export default function SkillConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { label } = useMode();
  const slug = params.slug as string;
  const form = getSkillForm(slug);

  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("applied");
  const [jsonMode, setJsonMode] = useState(!form);
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(form ? getDefaultConfig(slug) : {}, null, 2)
  );

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true);
    setSyncStatus("syncing");
    // In production: POST to /v1/api/config
    await new Promise((r) => setTimeout(r, 1500));
    setSaving(false);
    setSyncStatus("applied");
  };

  const handleJsonSave = async () => {
    try {
      const parsed = JSON.parse(jsonValue);
      await handleSave(parsed);
    } catch {
      alert("Invalid JSON");
    }
  };

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
              {label(
                `Configure ${form?.name || slug}`,
                `${form?.name || slug} Configuration`
              )}
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

      {/* Form or JSON editor */}
      {form && !jsonMode ? (
        <SkillConfigForm
          definition={form}
          initialValues={getDefaultConfig(slug)}
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
