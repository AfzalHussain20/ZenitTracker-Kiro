/**
 * Unit Tests for Firebase Connector
 * Feature: bug-analytics-categorization-system
 */

import { FirebaseConnector } from '../firebase-connector';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore');

describe('FirebaseConnector - Unit Tests', () => {
  let connector: FirebaseConnector;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {};
    connector = new FirebaseConnector(mockDb);
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    /**
     * Test: Create operation
     * Requirements: 10.1, 10.2
     */
    test('should create a document with auto-generated ID', async () => {
      const mockCollectionRef = {};
      const mockDocRef = { id: 'auto-id-123' };
      
      (collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const data = { name: 'Test Bug', severity: 'high' };
      const docId = await connector.create('bugs', data);

      expect(docId).toBe('auto-id-123');
      expect(setDoc).toHaveBeenCalled();
    });

    test('should create a document with custom ID', async () => {
      const mockCollectionRef = {};
      const mockDocRef = { id: 'custom-id' };
      
      (collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const data = { name: 'Test Bug' };
      const docId = await connector.create('bugs', data, 'custom-id');

      expect(docId).toBe('custom-id');
    });

    /**
     * Test: Read operation
     * Requirements: 10.1, 10.2
     */
    test('should read an existing document', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => true,
        id: 'doc-123',
        data: () => ({ name: 'Test Bug', severity: 'high' }),
      };
      
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      const result = await connector.read('bugs', 'doc-123');

      expect(result).toEqual({
        id: 'doc-123',
        name: 'Test Bug',
        severity: 'high',
      });
    });

    test('should return null for non-existent document', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };
      
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      const result = await connector.read('bugs', 'non-existent');

      expect(result).toBeNull();
    });

    /**
     * Test: Update operation
     * Requirements: 10.1, 10.2
     */
    test('should update a document', async () => {
      const mockDocRef = {};
      
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await connector.update('bugs', 'doc-123', { severity: 'critical' });

      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, { severity: 'critical' });
    });

    /**
     * Test: Delete operation
     * Requirements: 10.1, 10.2
     */
    test('should delete a document', async () => {
      const mockDocRef = {};
      
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      await connector.delete('bugs', 'doc-123');

      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });
  });

  describe('Query Operations', () => {
    /**
     * Test: Query with filters
     * Requirements: 10.3, 10.4
     */
    test('should query documents with filters', async () => {
      const mockCollectionRef = {};
      const mockQuery = {};
      const mockDocs = [
        { id: 'doc-1', data: () => ({ severity: 'high' }) },
        { id: 'doc-2', data: () => ({ severity: 'high' }) },
      ];
      const mockQuerySnapshot = { docs: mockDocs };
      
      (collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (query as jest.Mock).mockReturnValue(mockQuery);
      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      const results = await connector.query('bugs', {
        where: [{ field: 'severity', operator: '==', value: 'high' }],
        limit: 10,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: 'doc-1', severity: 'high' });
    });
  });

  describe('Transaction Operations', () => {
    /**
     * Test: Transaction rollback on error
     * Requirements: 10.6
     */
    test('should rollback transaction on error', async () => {
      const mockError = new Error('Transaction failed');
      (runTransaction as jest.Mock).mockRejectedValue(mockError);

      await expect(
        connector.runTransaction(async () => {
          throw mockError;
        })
      ).rejects.toThrow('Transaction failed');
    });

    test('should complete transaction successfully', async () => {
      const mockResult = { success: true };
      (runTransaction as jest.Mock).mockResolvedValue(mockResult);

      const result = await connector.runTransaction(async () => mockResult);

      expect(result).toEqual(mockResult);
    });
  });

  describe('Batch Operations', () => {
    /**
     * Test: Batch write operations
     * Requirements: 10.6
     */
    test('should execute batch operations', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      
      (writeBatch as jest.Mock).mockReturnValue(mockBatch);
      (collection as jest.Mock).mockReturnValue({});
      (doc as jest.Mock).mockReturnValue({});

      const operations = [
        { type: 'create' as const, collection: 'bugs', docId: 'doc-1', data: { name: 'Bug 1' } },
        { type: 'update' as const, collection: 'bugs', docId: 'doc-2', data: { severity: 'high' } },
        { type: 'delete' as const, collection: 'bugs', docId: 'doc-3' },
      ];

      await connector.batchWrite(operations);

      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});
