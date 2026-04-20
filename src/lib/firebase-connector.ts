/**
 * Firebase Connector - Abstraction layer for Firestore operations
 * Provides CRUD, query, pagination, transaction, and batch operations
 */

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  runTransaction,
  enableIndexedDbPersistence,
  QueryConstraint,
  DocumentSnapshot,
  WhereFilterOp,
  OrderByDirection,
} from 'firebase/firestore';
import { QueryOptions, WhereClause, PaginatedResult, BatchOperation } from '@/types/bug-analytics';

export class FirebaseConnector {
  private db: Firestore;
  private offlineEnabled: boolean = false;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Create a new document in a collection
   */
  async create<T>(collectionName: string, data: T, docId?: string): Promise<string> {
    try {
      const collectionRef = collection(this.db, collectionName);
      const documentId = docId || doc(collectionRef).id;
      const docRef = doc(collectionRef, documentId);
      
      await setDoc(docRef, data);
      return documentId;
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Read a document by ID
   */
  async read<T>(collectionName: string, docId: string): Promise<T | null> {
    try {
      const docRef = doc(this.db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error reading document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async update<T>(collectionName: string, docId: string, updates: Partial<T>): Promise<void> {
    try {
      const docRef = doc(this.db, collectionName, docId);
      await updateDoc(docRef, updates as any);
    } catch (error) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async delete(collectionName: string, docId: string): Promise<void> {
    try {
      const docRef = doc(this.db, collectionName, docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Query documents with filters, ordering, and limits
   */
  async query<T>(collectionName: string, options: QueryOptions = {}): Promise<T[]> {
    try {
      const collectionRef = collection(this.db, collectionName);
      const constraints = this.buildQueryConstraints(options);
      const q = query(collectionRef, ...constraints);
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Query documents with pagination support
   */
  async queryPaginated<T>(
    collectionName: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<T>> {
    try {
      const collectionRef = collection(this.db, collectionName);
      const constraints = this.buildQueryConstraints(options);
      const q = query(collectionRef, ...constraints);
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
      
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      const hasMore = options.limit ? data.length === options.limit : false;
      
      return {
        data,
        lastDoc,
        hasMore
      };
    } catch (error) {
      console.error(`Error querying paginated ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Run a transaction
   */
  async runTransaction<T>(
    callback: (transaction: any) => Promise<T>
  ): Promise<T> {
    try {
      return await runTransaction(this.db, callback);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Execute batch operations
   */
  async batchWrite(operations: BatchOperation[]): Promise<void> {
    try {
      const batch = writeBatch(this.db);
      
      for (const operation of operations) {
        const docRef = operation.docId
          ? doc(this.db, operation.collection, operation.docId)
          : doc(collection(this.db, operation.collection));
        
        switch (operation.type) {
          case 'create':
            batch.set(docRef, operation.data);
            break;
          case 'update':
            batch.update(docRef, operation.data);
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Batch write failed:', error);
      throw error;
    }
  }

  /**
   * Enable offline persistence
   */
  async enableOfflinePersistence(): Promise<void> {
    if (this.offlineEnabled) {
      return;
    }
    
    try {
      await enableIndexedDbPersistence(this.db);
      this.offlineEnabled = true;
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (error.code === 'unimplemented') {
        console.warn('The current browser does not support offline persistence.');
      } else {
        console.error('Error enabling offline persistence:', error);
      }
    }
  }

  /**
   * Get offline queue size (placeholder - Firestore doesn't expose this directly)
   */
  getOfflineQueueSize(): number {
    // Firestore doesn't expose queue size directly
    // This is a placeholder for future implementation
    return 0;
  }

  /**
   * Build query constraints from options
   */
  private buildQueryConstraints(options: QueryOptions): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];
    
    // Add where clauses
    if (options.where) {
      for (const clause of options.where) {
        constraints.push(
          where(clause.field, clause.operator as WhereFilterOp, clause.value)
        );
      }
    }
    
    // Add orderBy
    if (options.orderBy) {
      constraints.push(
        orderBy(options.orderBy.field, options.orderBy.direction as OrderByDirection)
      );
    }
    
    // Add startAfter for pagination
    if (options.startAfter) {
      constraints.push(startAfter(options.startAfter));
    }
    
    // Add limit
    if (options.limit) {
      constraints.push(limit(options.limit));
    }
    
    return constraints;
  }
}
