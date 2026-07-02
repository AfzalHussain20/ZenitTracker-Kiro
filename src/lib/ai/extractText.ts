/**
 * Converts Confluence storage-format HTML into plain text suitable for
 * sending to an LLM as context. Strips all markup and keeps readable text,
 * headings, and table content in a flat, model-friendly shape.
 */
export function extractPlainText(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/gi, '')
    .replace(/<ac:[^>]*>/gi, '')
    .replace(/<\/ac:[^>]*>/gi, '')
    .replace(/<ri:[^>]*\/>/gi, '')
    .replace(/<ri:[^>]*>[\s\S]*?<\/ri:[^>]*>/gi, '')
    // Headings → markdown-style
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n')
    // Tables → pipe-separated
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<t[dh][^>]*>/gi, '')
    .replace(/<\/table>/gi, '\n')
    // Lists → "- item"
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    // Paragraphs/br → newlines
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

/**
 * Truncates PRD text to a safe token budget for context.
 * Keeps beginning (70%) + end (30%) — PRDs front-load scope/summary
 * and back-load edge cases/appendices.
 */
export function truncateForContext(text: string, maxTokens = 12000): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = maxChars - headChars;
  return (
    text.slice(0, headChars) +
    '\n\n[... content truncated for length ...]\n\n' +
    text.slice(text.length - tailChars)
  );
}
