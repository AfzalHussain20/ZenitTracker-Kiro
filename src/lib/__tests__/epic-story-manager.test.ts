/**
 * Unit tests for EpicManager and StoryManager
 */

import { Timestamp } from 'firebase/firestore';
import { EpicManager } from '../epic-manager';
import { StoryManager } from '../story-manager';
import { FirebaseConnector } from '../firebase-connector';
import { Epic, Story, EpicStatus, StoryStatus } from '@/types/bug-analytics';

// Mock FirebaseConnector
jest.mock('../firebase-connector');

describe('EpicManager', () => {
  let epicManager: EpicManager;
  let mockConnector: any;

  beforeEach(() => {
    mockConnector = {
      create: jest.fn(),
      read: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),
    };
    epicManager = new EpicManager(mockConnector as FirebaseConnector);
  });

  describe('createEpic', () => {
    it('should create an epic with all required fields', async () => {
      const epicData = {
        title: 'Test Epic',
        description: 'Test Description',
        status: 'backlog' as EpicStatus,
        priority: 'high' as const,
        ownerId: 'user123',
        ownerName: 'John Doe',
        tags: ['test', 'epic'],
      };

      mockConnector.create.mockResolvedValue('epic123');

      const result = await epicManager.createEpic(epicData);

      expect(result.id).toBe('epic123');
      expect(result.title).toBe('Test Epic');
      expect(result.storyIds).toEqual([]);
      expect(result.completionPercentage).toBe(0);
      expect(result.searchableText).toContain('test epic');
      expect(mockConnector.create).toHaveBeenCalledWith('epics', expect.objectContaining({
        title: 'Test Epic',
        storyIds: [],
        completionPercentage: 0,
      }));
    });
  });

  describe('getEpicById', () => {
    it('should retrieve an epic by ID', async () => {
      const mockEpic: Epic = {
        id: 'epic123',
        title: 'Test Epic',
        description: 'Description',
        status: 'in_progress',
        priority: 'high',
        ownerId: 'user123',
        ownerName: 'John Doe',
        storyIds: [],
        completionPercentage: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        tags: [],
      };

      mockConnector.read.mockResolvedValue(mockEpic);

      const result = await epicManager.getEpicById('epic123');

      expect(result).toEqual(mockEpic);
      expect(mockConnector.read).toHaveBeenCalledWith('epics', 'epic123');
    });
  });

  describe('calculateCompletion', () => {
    it('should calculate completion percentage correctly', async () => {
      const mockEpic: Epic = {
        id: 'epic123',
        title: 'Test Epic',
        description: 'Description',
        status: 'in_progress',
        priority: 'high',
        ownerId: 'user123',
        ownerName: 'John Doe',
        storyIds: ['story1', 'story2', 'story3'],
        completionPercentage: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        tags: [],
      };

      const mockStories: Story[] = [
        {
          id: 'story1',
          title: 'Story 1',
          description: 'Desc',
          epicId: 'epic123',
          status: 'done',
          priority: 'high',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          acceptanceCriteria: [],
          bugIds: [],
        },
        {
          id: 'story2',
          title: 'Story 2',
          description: 'Desc',
          epicId: 'epic123',
          status: 'done',
          priority: 'high',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          acceptanceCriteria: [],
          bugIds: [],
        },
        {
          id: 'story3',
          title: 'Story 3',
          description: 'Desc',
          epicId: 'epic123',
          status: 'in_progress',
          priority: 'high',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          acceptanceCriteria: [],
          bugIds: [],
        },
      ];

      mockConnector.read.mockResolvedValue(mockEpic);
      mockConnector.query.mockResolvedValue(mockStories);
      mockConnector.update.mockResolvedValue(undefined);

      const completion = await epicManager.calculateCompletion('epic123');

      expect(completion).toBe(67); // 2 out of 3 stories done
      expect(mockConnector.update).toHaveBeenCalledWith('epics', 'epic123', expect.objectContaining({
        completionPercentage: 67,
      }));
    });

    it('should return 0 for epic with no stories', async () => {
      const mockEpic: Epic = {
        id: 'epic123',
        title: 'Test Epic',
        description: 'Description',
        status: 'backlog',
        priority: 'high',
        ownerId: 'user123',
        ownerName: 'John Doe',
        storyIds: [],
        completionPercentage: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        tags: [],
      };

      mockConnector.read.mockResolvedValue(mockEpic);

      const completion = await epicManager.calculateCompletion('epic123');

      expect(completion).toBe(0);
    });
  });

  describe('deleteEpic', () => {
    it('should delete epic and reassign stories when reassignStories is true', async () => {
      const mockEpic: Epic = {
        id: 'epic123',
        title: 'Test Epic',
        description: 'Description',
        status: 'backlog',
        priority: 'high',
        ownerId: 'user123',
        ownerName: 'John Doe',
        storyIds: ['story1', 'story2'],
        completionPercentage: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        tags: [],
      };

      mockConnector.read.mockResolvedValue(mockEpic);
      mockConnector.update.mockResolvedValue(undefined);
      mockConnector.delete.mockResolvedValue(undefined);

      await epicManager.deleteEpic('epic123', true);

      expect(mockConnector.update).toHaveBeenCalledTimes(2); // Once for each story
      expect(mockConnector.delete).toHaveBeenCalledWith('epics', 'epic123');
    });
  });
});

describe('StoryManager', () => {
  let storyManager: StoryManager;
  let mockConnector: any;

  beforeEach(() => {
    mockConnector = {
      create: jest.fn(),
      read: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),
    };
    storyManager = new StoryManager(mockConnector as FirebaseConnector);
  });

  describe('createStory', () => {
    it('should create a story and link to epic', async () => {
      const storyData = {
        title: 'Test Story',
        description: 'Test Description',
        epicId: 'epic123',
        status: 'backlog' as StoryStatus,
        priority: 'high' as const,
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        bugIds: [],
      };

      const mockEpic = {
        id: 'epic123',
        storyIds: [],
      };

      mockConnector.create.mockResolvedValue('story123');
      mockConnector.read.mockResolvedValue(mockEpic);
      mockConnector.update.mockResolvedValue(undefined);

      const result = await storyManager.createStory(storyData);

      expect(result.id).toBe('story123');
      expect(result.title).toBe('Test Story');
      expect(result.searchableText).toContain('test story');
      expect(mockConnector.create).toHaveBeenCalledWith('stories', expect.objectContaining({
        title: 'Test Story',
        epicId: 'epic123',
      }));
    });
  });

  describe('transitionStatus', () => {
    it('should transition story status to valid state', async () => {
      const mockStory: Story = {
        id: 'story123',
        title: 'Test Story',
        description: 'Description',
        epicId: 'epic123',
        status: 'backlog',
        priority: 'high',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        acceptanceCriteria: [],
        bugIds: [],
      };

      mockConnector.read.mockResolvedValue(mockStory);
      mockConnector.update.mockResolvedValue(undefined);

      await storyManager.transitionStatus('story123', 'in_progress');

      expect(mockConnector.update).toHaveBeenCalledWith('stories', 'story123', expect.objectContaining({
        status: 'in_progress',
      }));
    });

    it('should throw error for invalid status', async () => {
      const mockStory: Story = {
        id: 'story123',
        title: 'Test Story',
        description: 'Description',
        epicId: 'epic123',
        status: 'backlog',
        priority: 'high',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        acceptanceCriteria: [],
        bugIds: [],
      };

      mockConnector.read.mockResolvedValue(mockStory);

      await expect(storyManager.transitionStatus('story123', 'invalid' as any)).rejects.toThrow('Invalid status');
    });
  });

  describe('linkToEpic', () => {
    it('should link story to epic and update epic storyIds', async () => {
      const mockStory: Story = {
        id: 'story123',
        title: 'Test Story',
        description: 'Description',
        epicId: '',
        status: 'backlog',
        priority: 'high',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        acceptanceCriteria: [],
        bugIds: [],
      };

      const mockEpic = {
        id: 'epic123',
        storyIds: [],
      };

      mockConnector.read.mockImplementation((collection: string, id: string) => {
        if (collection === 'stories') return Promise.resolve(mockStory);
        if (collection === 'epics') return Promise.resolve(mockEpic);
        return Promise.resolve(null);
      });
      mockConnector.update.mockResolvedValue(undefined);

      await storyManager.linkToEpic('story123', 'epic123');

      expect(mockConnector.update).toHaveBeenCalledWith('stories', 'story123', expect.objectContaining({
        epicId: 'epic123',
      }));
      expect(mockConnector.update).toHaveBeenCalledWith('epics', 'epic123', expect.objectContaining({
        storyIds: ['story123'],
      }));
    });
  });
});
