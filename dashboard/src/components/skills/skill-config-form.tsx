"use client";

import { useState, useCallback } from "react";
import { SkillFormDefinition, FormField } from "@/types";
import { useMode } from "@/hooks/use-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Save, RotateCcw } from "lucide-react";

// ============================================================
// Generic skill config form renderer.
// Renders any SkillFormDefinition into a working form.
// ============================================================

interface SkillConfigFormProps {
  definition: SkillFormDefinition;
  initialValues?: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => void;
  saving?: boolean;
}

export function SkillConfigForm({
  definition,
  initialValues,
  onSave,
  saving = false,
}: SkillConfigFormProps) {
  const { isFun } = useMode();
  const [values, setValues] = useState<Record<string, unknown>>(
    initialValues || definition.defaultConfig
  );
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = () => {
    setValues(definition.defaultConfig);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {definition.name}
                <Badge variant="secondary">
                  {definition.fields.length} settings
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {isFun ? definition.funDescription : definition.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {definition.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(v) => setValue(field.key, v)}
              isFun={isFun}
              showSecret={showSecrets[field.key] || false}
              onToggleSecret={() =>
                setShowSecrets((prev) => ({
                  ...prev,
                  [field.key]: !prev[field.key],
                }))
              }
            />
          ))}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={resetToDefaults}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

// ============================================================
// Individual field renderer — handles all field types
// ============================================================

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  isFun: boolean;
  showSecret: boolean;
  onToggleSecret: () => void;
}

function FieldRenderer({
  field,
  value,
  onChange,
  isFun,
  showSecret,
  onToggleSecret,
}: FieldRendererProps) {
  const label = isFun && field.funLabel ? field.funLabel : field.label;

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </span>
        {field.description && (
          <span className="block text-xs text-gray-400 mt-0.5">
            {field.description}
          </span>
        )}
      </label>

      {field.type === "text" && (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          pattern={field.pattern}
        />
      )}

      {field.type === "secret" && (
        <div className="relative">
          <Input
            type={showSecret ? "text" : "password"}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="pr-10"
          />
          <button
            type="button"
            onClick={onToggleSecret}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showSecret ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {field.type === "number" && (
        <Input
          type="number"
          value={(value as number) ?? field.default ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      )}

      {field.type === "select" && (
        <select
          value={(value as string) || field.default || ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === "toggle" && (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          onClick={() => onChange(!value)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value ? "bg-red-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      )}

      {field.type === "slider" && (
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step || 1}
            value={(value as number) ?? field.default ?? field.min}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-red-500"
          />
          <span className="text-sm font-medium text-gray-700 min-w-[60px] text-right">
            {value as number}
            {field.suffix ? ` ${field.suffix}` : ""}
          </span>
        </div>
      )}

      {field.type === "currency" && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            $
          </span>
          <Input
            type="number"
            value={(value as number) ?? field.default ?? ""}
            onChange={(e) => onChange(Number(e.target.value))}
            min={field.min}
            max={field.max}
            className="pl-7"
          />
          {field.currency && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {field.currency}
            </span>
          )}
        </div>
      )}

      {field.type === "multiselect" && (
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = (value as string[]) || [];
                  onChange(
                    selected
                      ? current.filter((v) => v !== opt.value)
                      : [...current, opt.value]
                  );
                }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selected
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {field.type === "textarea" && (
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows || 3}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      )}
    </div>
  );
}
