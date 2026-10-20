/**
 * Skip (N/A) reasons for the SUN NXT test tracker.
 *
 * Shared by the session runner and the editable report so both offer the same
 * valid, understandable reasons. "Other" must be followed by a written reason.
 */
export const OTHER_REASON = 'Other';

export const naReasonOptions = [
  'Content not available in this region/language',
  'Subscription plan not applicable to this device',
  'Feature not yet released on this platform',
  'Device/OS version incompatibility',
  'Content geo-restricted or DRM-blocked',
  'Backend/API dependency unavailable',
  'Test environment not configured for this scenario',
  'Blocked by another critical bug',
  'Third-party integration unavailable (payment gateway, CDN, etc.)',
  OTHER_REASON,
];

/** Resolve the stored reason, requiring free text when "Other" is selected. */
export function resolveSkipReason(reason: string, other: string): string | null {
  if (!reason) return null;
  if (reason === OTHER_REASON) {
    const text = other.trim();
    return text ? text : null;
  }
  return reason;
}

/** Bit set of reason options for "does this need free text?" checks. */
export function isOtherReason(reason: string): boolean {
  return reason === OTHER_REASON;
}
