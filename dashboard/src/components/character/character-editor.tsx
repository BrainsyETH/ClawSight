"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CharacterEditorProps {
  initialName?: string;
  onSave?: (agentName: string) => void;
  saving?: boolean;
}

export function CharacterEditor({ initialName = "ClawSight", onSave, saving }: CharacterEditorProps) {
  const [agentName, setAgentName] = useState(initialName);

  return (
    <div className="space-y-6">
      {/* Preview */}
      <Card>
        <CardContent className="py-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-4xl">
            {agentName.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-4">{agentName}</h2>
          <p className="text-sm text-gray-500 mt-1">Agent identity</p>
        </CardContent>
      </Card>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Name</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="ClawSight"
            maxLength={30}
          />
          <p className="text-xs text-gray-400 mt-2">
            Displayed throughout the dashboard.
          </p>
        </CardContent>
      </Card>

      {onSave && (
        <Button onClick={() => onSave(agentName)} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      )}
    </div>
  );
}
