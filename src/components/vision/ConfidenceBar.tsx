"use client";

/**
 * ConfidenceBar — renders ●●●●○ style confidence indicator
 */
interface Props {
  confidence: number; // 0–1
  size?: number;      // total dots, default 5
}

export default function ConfidenceBar({ confidence, size = 5 }: Props) {
  const filled = Math.round(confidence * size);
  return (
    <span className="flex items-center gap-0.5" title={`${Math.round(confidence * 100)}% confidence`}>
      {Array.from({ length: size }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-[#0078D4]' : 'bg-[#D0D0D0]'}`}
        />
      ))}
    </span>
  );
}
