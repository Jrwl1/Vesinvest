const mojibakePattern = /[ÃƒÃ‚Ã¢]/;
const nordicPattern = /[ÅÄÖåäö]/;

function recoverLatin1Mojibake(value: string): string {
  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function normalizeImportedFileName(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  if (!mojibakePattern.test(trimmed)) {
    return trimmed;
  }
  try {
    const recovered = recoverLatin1Mojibake(trimmed);
    if (nordicPattern.test(recovered) && !mojibakePattern.test(recovered)) {
      return recovered;
    }
  } catch {
    // Keep the original value if decoding fails.
  }
  return trimmed;
}
