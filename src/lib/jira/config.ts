/**
 * Client-safe Jira configuration.
 * Server-only credentials live in the API routes; the site URL is public
 * (it is rendered into "open in Jira" links) so it is exposed via NEXT_PUBLIC_.
 */
export const JIRA_BASE_URL =
    process.env.NEXT_PUBLIC_JIRA_BASE_URL || 'https://sunnetwork-techteam-hanqzy91.atlassian.net';
