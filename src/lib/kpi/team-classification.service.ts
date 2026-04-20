/**
 * Team Classification Service
 * 
 * Automatically detects team types based on team names and work patterns
 * to enable intelligent metric mapping.
 */

import { TeamType, TeamClassificationResult, JiraTeam } from '@/types/kpi-dashboard';

class TeamClassificationService {
  /**
   * Classify a team based on its name and work patterns
   */
  classifyTeam(team: JiraTeam, workPatterns?: any): TeamClassificationResult {
    const teamName = team.name.toLowerCase();
    
    // Check for explicit team type keywords in name
    const nameBasedType = this.classifyByName(teamName);
    
    if (nameBasedType.confidence >= 0.8) {
      return nameBasedType;
    }

    // If work patterns available, use them for classification
    if (workPatterns) {
      const patternBasedType = this.classifyByWorkPattern(workPatterns);
      
      // Combine name and pattern-based classification
      if (patternBasedType.confidence > nameBasedType.confidence) {
        return patternBasedType;
      }
    }

    return nameBasedType;
  }

  /**
   * Classify team based on name keywords
   */
  private classifyByName(teamName: string): TeamClassificationResult {
    const classifications: Array<{
      type: TeamType;
      keywords: string[];
      weight: number;
    }> = [
      {
        type: 'dev',
        keywords: ['dev', 'development', 'engineer', 'backend', 'frontend', 'fullstack', 'android', 'ios', 'mobile', 'web'],
        weight: 1.0,
      },
      {
        type: 'qa',
        keywords: ['qa', 'quality', 'test', 'testing', 'automation', 'qe'],
        weight: 1.0,
      },
      {
        type: 'ui_ux',
        keywords: ['ui', 'ux', 'design', 'designer', 'creative', 'visual'],
        weight: 1.0,
      },
      {
        type: 'database',
        keywords: ['database', 'db', 'dba', 'data engineer', 'sql'],
        weight: 1.0,
      },
      {
        type: 'api',
        keywords: ['api', 'integration', 'middleware', 'service'],
        weight: 0.8,
      },
      {
        type: 'sms',
        keywords: ['sms', 'messaging', 'notification', 'communication'],
        weight: 1.0,
      },
      {
        type: 'analytics',
        keywords: ['analytics', 'data', 'bi', 'business intelligence', 'reporting'],
        weight: 0.9,
      },
    ];

    let bestMatch: TeamClassificationResult = {
      teamType: 'generic',
      confidence: 0.3,
      reasons: ['No specific team type keywords found'],
    };

    for (const classification of classifications) {
      const matchedKeywords = classification.keywords.filter(keyword =>
        teamName.includes(keyword)
      );

      if (matchedKeywords.length > 0) {
        const confidence = Math.min(
          0.95,
          (matchedKeywords.length / classification.keywords.length) * classification.weight
        );

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            teamType: classification.type,
            confidence,
            reasons: [
              `Team name contains keywords: ${matchedKeywords.join(', ')}`,
            ],
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Classify team based on work patterns (issue types)
   */
  private classifyByWorkPattern(workPatterns: {
    stories: number;
    bugs: number;
    tasks: number;
    epics: number;
    subtasks: number;
  }): TeamClassificationResult {
    const total = Object.values(workPatterns).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return {
        teamType: 'generic',
        confidence: 0.2,
        reasons: ['No work items found'],
      };
    }

    const bugPercentage = (workPatterns.bugs / total) * 100;
    const storyPercentage = (workPatterns.stories / total) * 100;

    // QA teams typically have high bug percentage
    if (bugPercentage > 60) {
      return {
        teamType: 'qa',
        confidence: 0.75,
        reasons: [`${bugPercentage.toFixed(1)}% of work items are bugs`],
      };
    }

    // Dev teams typically have high story percentage
    if (storyPercentage > 50) {
      return {
        teamType: 'dev',
        confidence: 0.7,
        reasons: [`${storyPercentage.toFixed(1)}% of work items are stories`],
      };
    }

    return {
      teamType: 'generic',
      confidence: 0.4,
      reasons: ['Mixed work pattern, no clear specialization'],
    };
  }

  /**
   * Batch classify multiple teams
   */
  classifyTeams(teams: JiraTeam[]): Map<string, TeamClassificationResult> {
    const results = new Map<string, TeamClassificationResult>();

    for (const team of teams) {
      const classification = this.classifyTeam(team);
      results.set(team.id, classification);
    }

    return results;
  }

  /**
   * Get all supported team types
   */
  getSupportedTeamTypes(): TeamType[] {
    return ['dev', 'qa', 'ui_ux', 'database', 'api', 'sms', 'analytics', 'generic'];
  }
}

// Export singleton instance
export const teamClassificationService = new TeamClassificationService();
