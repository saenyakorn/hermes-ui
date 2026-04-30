import { isConfiguredSecretPlaceholder } from "../../../hooks/useWorkspaceFieldSources";

export function normalizeEnvSetValue(rawValue: string): string | undefined {
  const trimmedValue = rawValue.trim();
  if (trimmedValue.length === 0 || isConfiguredSecretPlaceholder(trimmedValue)) {
    return undefined;
  }
  return trimmedValue;
}

export function createEnvSet(
  envEntries: ReadonlyArray<readonly [envKey: string, rawValue: string]>,
): Record<string, string> {
  const set: Record<string, string> = {};
  for (const [envKey, rawValue] of envEntries) {
    const normalizedValue = normalizeEnvSetValue(rawValue);
    if (normalizedValue !== undefined) {
      set[envKey] = normalizedValue;
    }
  }
  return set;
}

export function createFormKey(
  defaultFieldValues: Record<string, string | undefined>,
  fieldIds: readonly string[],
): string {
  return fieldIds
    .map((fieldId) => `${fieldId}:${String(defaultFieldValues[fieldId] ?? "")}`)
    .join("\u0001");
}
