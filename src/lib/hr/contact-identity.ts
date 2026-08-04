/**
 * Compare identity contacts (email / phone) without throwing on empty values.
 */

export function normalizeEmailForCompare(
  raw: string | null | undefined,
): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

/** Digits-only form so +6681… and 081… can still match when suffixes align. */
export function normalizePhoneForCompare(
  raw: string | null | undefined,
): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  // Thai mobiles often stored as 0xxxxxxxxx vs 66xxxxxxxxx
  if (digits.startsWith("66") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export type IdentityContacts = {
  email?: string | null;
  phone?: string | null;
};

/**
 * True when email matches OR phone matches.
 * Empty / missing fields never count as a match.
 */
export function contactsMatchByEmailOrPhone(
  left: IdentityContacts,
  right: IdentityContacts,
): boolean {
  const leftEmail = normalizeEmailForCompare(left.email);
  const rightEmail = normalizeEmailForCompare(right.email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;

  const leftPhone = normalizePhoneForCompare(left.phone);
  const rightPhone = normalizePhoneForCompare(right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) return true;

  return false;
}
