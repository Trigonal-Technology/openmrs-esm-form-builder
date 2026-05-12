import Ajv from 'ajv';
import type { Schema } from '@types';

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Allowed top-level keys for context / visibility rules (list-only for tags, visits,
 * privileges, and roles — aligned with {@code FormVisibilityRule} in esm-patient-forms-app).
 */
export const FORM_VISIBILITY_RULE_KEYS = [
  'gender',
  'minAge',
  'maxAge',
  'requiredDiagnosisCodes',
  'diagnosisMatchMode',
  'locationTags',
  'excludeLocationTags',
  'allowedLocationUuids',
  'excludedLocationUuids',
  'visitTypeUuids',
  'requiredPrivileges',
  'requiredRoles',
  'sensitive',
  'forensicPrivilege',
  'displayTags',
] as const;

const stringArray = { type: 'array' as const, items: { type: 'string' as const } };

/** Strict object: only known keys; each property type-checked. */
const formVisibilityRuleJsonSchema = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    gender: { enum: ['M', 'F', 'O', 'U'] },
    minAge: { type: 'number' as const },
    maxAge: { type: 'number' as const },
    requiredDiagnosisCodes: stringArray,
    diagnosisMatchMode: { enum: ['any', 'all'] },
    locationTags: stringArray,
    excludeLocationTags: stringArray,
    allowedLocationUuids: stringArray,
    excludedLocationUuids: stringArray,
    visitTypeUuids: stringArray,
    requiredPrivileges: stringArray,
    requiredRoles: stringArray,
    sensitive: { type: 'boolean' as const },
    forensicPrivilege: { type: 'string' as const },
    displayTags: stringArray,
  },
};

const validateFormRulesShape = ajv.compile(formVisibilityRuleJsonSchema);

export type FormRulesValidationResult = { ok: true; value: null | unknown } | { ok: false; error: string };

export function isFormRulesValidationFailure(r: FormRulesValidationResult): r is { ok: false; error: string } {
  return r.ok === false;
}

/**
 * Reads `formRules` from the raw schema editor JSON first (so unsaved editor content is used),
 * then falls back to the parsed in-memory schema.
 */
export function getFormRulesDisplayText(stringifiedSchema: string | undefined, schema: Schema | undefined): string {
  if (stringifiedSchema?.trim()) {
    try {
      const doc = JSON.parse(stringifiedSchema) as Record<string, unknown>;
      if (doc && typeof doc === 'object' && !Array.isArray(doc) && 'formRules' in doc && doc.formRules != null) {
        return JSON.stringify(doc.formRules, null, 2);
      }
    } catch {
      // Invalid JSON in editor — fall through to parsed schema
    }
  }
  const fr = schema?.formRules;
  if (fr != null) {
    try {
      return JSON.stringify(fr, null, 2);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Validates context/visibility rules: empty clears; otherwise must be valid JSON
 * and a single object using only {@link FORM_VISIBILITY_RULE_KEYS} with correct value types.
 */
export function validateFormRulesText(text: string): FormRulesValidationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true as const, value: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : String(e);
    return { ok: false as const, error: `Invalid JSON: ${msg}` };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false as const,
      error:
        'Form rules must be a JSON object (not an array). Only these keys are allowed: ' +
        FORM_VISIBILITY_RULE_KEYS.join(', '),
    };
  }

  if (!validateFormRulesShape(parsed)) {
    const errs = validateFormRulesShape.errors;
    const detail = errs && errs.length ? ajv.errorsText(errs, { separator: '; ' }) : '';
    return {
      ok: false as const,
      error: detail || 'Form rules failed validation against the visibility rule schema',
    };
  }

  return { ok: true as const, value: parsed };
}
