/**
 * Epic Manager - Manages Epic CRUD operations and relationships
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseConnector } from './firebase-connector';
import { Epic, EpicStatus, Priority, Story } from '@/types/bug-analytics';

export class EpicManager {
  constructor(private connector: FirebaseConnector) {}

  /**
   * Create a new epic
   */
  async createEpic(epic: Omit<Epic, 'id' | 'createdAt' | 'updatedAt' | 'completionPercentage' | 'storyIds'>): Promise<Epic> {
    const now = Timestamp.now();
    const newEpic: Omit<Epic, 'id'> = {
      ...epic,
      storyIds: [],
      completionPercentage: 0,
      createdAt: now,
      updatedAt: now,
      searchableText: `${epic.title} ${epic.description} ${epic.tags.join(' ')}`.toLowerCase(),
    };

    const epicId = await this.connector.create<Omit<Epic, 'id'>>('epics', newEpic);
    return { id: epicId, ...newEpic };
  }

  /**
   * Update an existing epic
   */
  async updateEpic(epicId: string, updates: Partial<Epic>): Promise<void> {
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    // Update searchable text if title, description, or tags changed
    if (updates.title || updates.description || updates.tags) {
      const epic = await this.getEpicById(epicId);
      if (epic) {
        const title = updates.title || epic.title;
        const description = updates.description || epic.description;
        const tags = updates.tags || epic.tags;
        updateData.searchableText = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
      }
    }

    await this.connector.update<Epic>('epics', epicId, updateData);
  }

  /**
   * Delete an epic with optional story reassignment
   */
  async deleteEpic(epicId: string, reassignStories: boolean = false): Promise<void> {
    const epic = await this.getEpicById(epicId);
    if (!epic) {
      throw new Error(`Epic ${epicId} not found`);
    }

    if (reassignStories && epic.storyIds.length > 0) {
      // Unlink all stories from this epic
      for (const storyId of epic.storyIds) {
        try {
          await this.connector.update<Story>('stories', storyId, {
            epicId: '',
            updatedAt: Timestamp.now(),
          });
        } catch (error) {
          console.error(`Failed to unlink story ${storyId}:`, error);
        }
      }
    }

    await this.connector.delete('epics', epicId);
  }

  /**
   * Get epic by ID
   */
  async getEpicById(epicId: string): Promise<Epic | null> {
    return await this.connector.read<Epic>('epics', epicId);
  }

  /**
   * Get epics by status
   */
  async getEpicsByStatus(status: EpicStatus): Promise<Epic[]> {
    return await this.connector.query<Epic>('epics', {
      where: [{ field: 'status', operator: '==', value: status }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }

  /**
   * Calculate completion percentage for an epic
   */
  async calculateCompletion(epicId: string): Promise<number> {
    const epic = await this.getEpicById(epicId);
    if (!epic || epic.storyIds.length === 0) {
      return 0;
    }

    const stories = await this.getStoriesForEpic(epicId);
    const doneStories = stories.filter(story => story.status === 'done');
    const completion = (doneStories.length / stories.length) * 100;

    // Update the epic's completion percentage
    await this.updateEpic(epicId, { completionPercentage: Math.round(completion) });

    return Math.round(completion);
  }

  /**
   * Get all stories for an epic
   */
  async getStoriesForEpic(epicId: string): Promise<Story[]> {
    return await this.connector.query<Story>('stories', {
      where: [{ field: 'epicId', operator: '==', value: epicId }],
      orderBy: { field: 'createdAt', direction: 'asc' },
    });
  }
}
