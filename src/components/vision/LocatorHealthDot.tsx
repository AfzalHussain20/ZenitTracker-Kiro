"use client";

/**
 * LocatorHealthDot — green/amber/red dot showing locator health
 */
interface Props {
  found: boolean;
  healingOccurred?: boolean;
  noHierarchy?: boolean;
}

export default function LocatorHealthDot({ found, healingOccurred, noHierarchy }: Props) {
  if (noHierarchy) return (
    <span className="w-2 h-2 rounded-full bg-[#D0D0D0] inline-block" title="No device connected" />
  );
  if (!found) return (
    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Locator not found in current hierarchy" />
  );
  if (healingOccurred) return (
    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Primary locator failed — using fallback" />
  );
  return (
    <span className="w-2 h-2 rounded-full bg-[#107C10] inline-block" title="Locator found" />
  );
}
