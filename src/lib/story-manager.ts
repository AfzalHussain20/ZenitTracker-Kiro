/**
 * Story Manager - Manages Story CRUD operations and status transitions
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseConnector } from './firebase-connector';
import { Story, StoryStatus } from '@/types/bug-analytics';

export class StoryManager {
  constructor(private connector: FirebaseConnector) {}

  /**
   * Create a new story
   */
  async createStory(story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>): Promise<Story> {
    const now = Timestamp.now();
    const newStory: Omit<Story, 'id'> = {
      ...story,
      bugIds: story.bugIds || [],
      createdAt: now,
      updatedAt: now,
      searchableText: `${story.title} ${story.description} ${story.acceptanceCriteria.join(' ')}`.toLowerCase(),
    };

    const storyId = await this.connector.create<Omit<Story, 'id'>>('stories', newStory);

    // Update epic's storyIds array if epicId is provided
    if (story.epicId) {
      await this.linkToEpic(storyId, story.epicId);
    }

    return { id: storyId, ...newStory };
  }

  /**
   * Update an existing story
   */
  async updateStory(storyId: string, updates: Partial<Story>): Promise<void> {
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    // Update searchable text if title, description, or acceptance criteria changed
    if (updates.title || updates.description || updates.acceptanceCriteria) {
      const story = await this.getStoryById(storyId);
      if (story) {
        const title = updates.title || story.title;
        const description = updates.description || story.description;
        const criteria = updates.acceptanceCriteria || story.acceptanceCriteria;
        updateData.searchableText = `${title} ${description} ${criteria.join(' ')}`.toLowerCase();
      }
    }

    await this.connector.update<Story>('stories', storyId, updateData);
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string): Promise<void> {
    const story = await this.getStoryById(storyId);
    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Unlink from epic if linked
    if (story.epicId) {
      await this.unlinkFromEpic(storyId);
    }

    await this.connector.delete('stories', storyId);
  }

  /**
   * Get story by ID
   */
  async getStoryById(storyId: string): Promise<Story | null> {
    return await this.connector.read<Story>('stories', storyId);
  }

  /**
   * Transition story status with validation
   */
  async transitionStatus(storyId: string, newStatus: StoryStatus): Promise<void> {
    const story = await this.getStoryById(storyId);
    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Validate status transition
    const validStatuses: StoryStatus[] = ['backlog', 'in_progress', 'in_review', 'done', 'blocked'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    await this.updateStory(storyId, { status: newStatus });
  }

  /**
   * Link story to an epic
   */
  async linkToEpic(storyId: string, epicId: string): Promise<void> {
    const story = await this.getStoryById(storyId);
    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Unlink from previous epic if exists
    if (story.epicId && story.epicId !== epicId) {
      await this.unlinkFromEpic(storyId);
    }

    // Update story's epicId
    await this.updateStory(storyId, { epicId });

    // Update epic's storyIds array
    const epic = await this.connector.read('epics', epicId);
    if (epic) {
      const storyIds = epic.storyIds || [];
      if (!storyIds.includes(storyId)) {
        storyIds.push(storyId);
        await this.connector.update('epics', epicId, {
          storyIds,
          updatedAt: Timestamp.now(),
        });
      }
    }
  }

  /**
   * Unlink story from its epic
   */
  async unlinkFromEpic(storyId: string): Promise<void> {
    const story = await this.getStoryById(storyId);
    if (!story || !story.epicId) {
      return;
    }

    const epicId = story.epicId;

    // Update story to remove epicId
    await this.updateStory(storyId, { epicId: '' });

    // Update epic's storyIds array
    const epic = await this.connector.read('epics', epicId);
    if (epic) {
      const storyIds = (epic.storyIds || []).filter((id: string) => id !== storyId);
      await this.connector.update('epics', epicId, {
        storyIds,
        updatedAt: Timestamp.now(),
      });
    }
  }
}
