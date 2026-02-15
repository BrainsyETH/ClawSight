/**
 * Tests for @/lib/skill-forms
 *
 * NOTE: vitest is not yet installed in this project.
 * See utils.test.ts header for setup instructions.
 */

import { describe, it, expect } from "vitest";
import {
  SKILL_FORMS,
  CURATED_SKILL_SLUGS,
  hasCustomForm,
  getSkillForm,
  getDefaultConfig,
} from "@/lib/skill-forms";

// ---------------------------------------------------------------------------
// SKILL_FORMS registry — expected skills present
// ---------------------------------------------------------------------------
describe("SKILL_FORMS registry", () => {
  const expectedSlugs = [
    "web_search",
    "memory",
    "slack",
    "github",
    "google_calendar",
    "discord",
    "crypto_trading",
    "pdf",
  ];

  it.each(expectedSlugs)("contains the '%s' skill", (slug) => {
    expect(SKILL_FORMS).toHaveProperty(slug);
  });

  it("CURATED_SKILL_SLUGS matches the keys of SKILL_FORMS", () => {
    expect(CURATED_SKILL_SLUGS.sort()).toEqual(
      Object.keys(SKILL_FORMS).sort()
    );
  });
});

// ---------------------------------------------------------------------------
// Structural validation — every skill form has required properties
// ---------------------------------------------------------------------------
describe("skill form structure", () => {
  const slugs = Object.keys(SKILL_FORMS);

  it.each(slugs)("'%s' has slug, name, icon, fields, and defaultConfig", (slug) => {
    const form = SKILL_FORMS[slug];
    expect(form.slug).toBe(slug);
    expect(typeof form.name).toBe("string");
    expect(form.name.length).toBeGreaterThan(0);
    expect(typeof form.icon).toBe("string");
    expect(form.icon.length).toBeGreaterThan(0);
    expect(typeof form.description).toBe("string");
    expect(typeof form.funDescription).toBe("string");
    expect(typeof form.category).toBe("string");
    expect(Array.isArray(form.fields)).toBe(true);
    expect(form.fields.length).toBeGreaterThan(0);
    expect(typeof form.defaultConfig).toBe("object");
  });

  it.each(slugs)("'%s' — every field has key, label, and type", (slug) => {
    const form = SKILL_FORMS[slug];
    for (const field of form.fields) {
      expect(typeof field.key).toBe("string");
      expect(field.key.length).toBeGreaterThan(0);
      expect(typeof field.label).toBe("string");
      expect(field.label.length).toBeGreaterThan(0);
      expect(typeof field.type).toBe("string");
      expect(field.type.length).toBeGreaterThan(0);
    }
  });

  it.each(slugs)(
    "'%s' — defaultConfig has an entry for every field.key",
    (slug) => {
      const form = SKILL_FORMS[slug];
      for (const field of form.fields) {
        expect(form.defaultConfig).toHaveProperty(field.key);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// getSkillForm
// ---------------------------------------------------------------------------
describe("getSkillForm", () => {
  it("returns the correct form definition for web_search", () => {
    const form = getSkillForm("web_search");
    expect(form).not.toBeNull();
    expect(form!.slug).toBe("web_search");
    expect(form!.name).toBe("Web Search");
  });

  it("returns the correct form definition for github", () => {
    const form = getSkillForm("github");
    expect(form).not.toBeNull();
    expect(form!.slug).toBe("github");
    expect(form!.name).toBe("GitHub");
  });

  it("returns null for an unknown skill slug", () => {
    expect(getSkillForm("nonexistent_skill")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getSkillForm("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDefaultConfig
// ---------------------------------------------------------------------------
describe("getDefaultConfig", () => {
  it("returns default config with all field defaults for web_search", () => {
    const config = getDefaultConfig("web_search");
    expect(config).toEqual({
      provider: "google",
      api_key: "",
      max_results: 10,
      safe_search: true,
    });
  });

  it("returns default config for memory skill", () => {
    const config = getDefaultConfig("memory");
    expect(config.embedding_model).toBe("text-embedding-3-small");
    expect(config.max_results).toBe(5);
    expect(config.auto_save).toBe(true);
    expect(config.similarity_threshold).toBe(0.7);
  });

  it("returns default config for crypto_trading skill", () => {
    const config = getDefaultConfig("crypto_trading");
    expect(config.exchange).toBe("hyperliquid");
    expect(config.max_trade_size).toBe(25);
    expect(config.daily_budget).toBe(50);
    expect(config.categories).toEqual(["crypto"]);
  });

  it("returns empty object for unknown skill", () => {
    expect(getDefaultConfig("nonexistent")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// hasCustomForm
// ---------------------------------------------------------------------------
describe("hasCustomForm", () => {
  it("returns true for all known skill slugs", () => {
    for (const slug of CURATED_SKILL_SLUGS) {
      expect(hasCustomForm(slug)).toBe(true);
    }
  });

  it("returns false for unknown slugs", () => {
    expect(hasCustomForm("nonexistent")).toBe(false);
    expect(hasCustomForm("")).toBe(false);
    expect(hasCustomForm("random_string")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Specific skill field validations
// ---------------------------------------------------------------------------
describe("specific skill details", () => {
  it("web_search has a secret field for api_key", () => {
    const form = SKILL_FORMS["web_search"];
    const apiKeyField = form.fields.find((f) => f.key === "api_key");
    expect(apiKeyField).toBeDefined();
    expect(apiKeyField!.type).toBe("secret");
  });

  it("slack has two secret fields (bot_token and app_token)", () => {
    const form = SKILL_FORMS["slack"];
    const secretFields = form.fields.filter((f) => f.type === "secret");
    expect(secretFields.length).toBe(2);
    const keys = secretFields.map((f) => f.key);
    expect(keys).toContain("bot_token");
    expect(keys).toContain("app_token");
  });

  it("crypto_trading has select, secret, currency, slider, and multiselect fields", () => {
    const form = SKILL_FORMS["crypto_trading"];
    const types = new Set(form.fields.map((f) => f.type));
    expect(types.has("select")).toBe(true);
    expect(types.has("secret")).toBe(true);
    expect(types.has("currency")).toBe(true);
    expect(types.has("slider")).toBe(true);
    expect(types.has("multiselect")).toBe(true);
  });

  it("github token field is required", () => {
    const form = SKILL_FORMS["github"];
    const tokenField = form.fields.find((f) => f.key === "token");
    expect(tokenField).toBeDefined();
    expect(tokenField!.required).toBe(true);
  });
});
