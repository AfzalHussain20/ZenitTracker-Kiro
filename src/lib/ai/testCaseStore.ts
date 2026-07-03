// src/lib/ai/testCaseStore.ts
// Firestore persistence layer for AI-generated test cases

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import type {
  GeneratedTestCase,
  StoredTestCase,
  GenerationMetadata,
  TestCaseReviewUpdate,
} from '@/types/test-cases';

const COLLECTION_NAME = 'testCaseGenerations';

/**
 * Delays execution for the specified duration in milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with a single retry after a 1-second delay on failure.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Wait 1 second then retry once
    await delay(1000);
    return await operation();
  }
}

/**
 * Determines if a test case module value matches one of the extracted PRD headings.
 * Returns true if the module matches any heading (case-insensitive trimmed comparison).
 */
export function validateSourceVerified(
  module: string,
  prdHeadings: string[]
): boolean {
  const normalizedModule = module.trim().toLowerCase();
  return prdHeadings.some(
    (heading) => heading.trim().toLowerCase() === normalizedModule
  );
}

/**
 * Persists all generated test cases and metadata to Firestore.
 *
 * Structure:
 *   testCaseGenerations/{pageId} — metadata document
 *   testCaseGenerations/{pageId}/testCases/{testcaseId} — individual test case documents
 *
 * The `sourceVerified` field is computed by checking if each test case's module
 * matches one of the provided PRD headings.
 *
 * @param pageId - The Confluence page ID
 * @param testCases - Array of generated test cases to persist
 * @param metadata - Generation metadata (timestamps, model info, counts)
 * @param prdHeadings - Extracted PRD section headings for source verification
 * @returns The page ID used as the generation document ID
 */
export async function saveGenerationResult(
  pageId: string,
  testCases: GeneratedTestCase[],
  metadata: GenerationMetadata,
  prdHeadings: string[] = []
): Promise<string> {
  return withRetry(async () => {
    const metadataRef = doc(db, COLLECTION_NAME, pageId);
    const testCasesCollectionRef = collection(metadataRef, 'testCases');

    // Save metadata document
    await setDoc(metadataRef, {
      pageId: metadata.pageId,
      pageTitle: metadata.pageTitle,
      generatedAt: Timestamp.fromDate(metadata.generatedAt),
      totalCount: metadata.totalCount,
      modelVersion: metadata.modelVersion,
      categories: metadata.categories,
    });

    // Save each test case as a subcollection document
    const batch = writeBatch(db);
    const now = Timestamp.now();

    for (const testCase of testCases) {
      const sourceVerified = validateSourceVerified(testCase.module, prdHeadings);
      const testCaseRef = doc(testCasesCollectionRef, testCase.testcaseId);

      batch.set(testCaseRef, {
        testcaseId: testCase.testcaseId,
        module: testCase.module,
        priority: testCase.priority,
        testScenario: testCase.testScenario,
        testSteps: testCase.testSteps,
        expectedResult: testCase.expectedResult,
        category: testCase.category,
        reviewStatus: 'pending',
        sourceVerified,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    return pageId;
  });
}

/**
 * Loads all existing test cases for a given page from Firestore.
 *
 * @param pageId - The Confluence page ID
 * @returns Array of stored test cases, or null if no generation exists
 */
export async function loadTestCases(
  pageId: string
): Promise<StoredTestCase[] | null> {
  const metadataRef = doc(db, COLLECTION_NAME, pageId);
  const metadataSnap = await getDoc(metadataRef);

  if (!metadataSnap.exists()) {
    return null;
  }

  const testCasesCollectionRef = collection(metadataRef, 'testCases');
  const testCasesSnap = await getDocs(testCasesCollectionRef);

  const testCases: StoredTestCase[] = testCasesSnap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      testcaseId: data.testcaseId,
      module: data.module,
      priority: data.priority,
      testScenario: data.testScenario,
      testSteps: data.testSteps,
      expectedResult: data.expectedResult,
      category: data.category,
      reviewStatus: data.reviewStatus,
      editedFields: data.editedFields || undefined,
      sourceVerified: data.sourceVerified,
      createdAt: data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : new Date(data.createdAt),
      updatedAt: data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : new Date(data.updatedAt),
    } as StoredTestCase;
  });

  return testCases;
}

/**
 * Updates the review status for an individual test case.
 *
 * @param pageId - The Confluence page ID
 * @param testcaseId - The test case ID to update
 * @param update - The review update (status and optional edited fields)
 */
export async function updateTestCaseReview(
  pageId: string,
  testcaseId: string,
  update: TestCaseReviewUpdate
): Promise<void> {
  return withRetry(async () => {
    const testCaseRef = doc(
      db,
      COLLECTION_NAME,
      pageId,
      'testCases',
      testcaseId
    );

    if (update.editedFields) {
      await updateDoc(testCaseRef, {
        reviewStatus: update.reviewStatus,
        updatedAt: Timestamp.now(),
        editedFields: update.editedFields,
      });
    } else {
      await updateDoc(testCaseRef, {
        reviewStatus: update.reviewStatus,
        updatedAt: Timestamp.now(),
      });
    }
  });
}

/**
 * Checks if a generation already exists for a given page.
 *
 * @param pageId - The Confluence page ID
 * @returns True if a generation metadata document exists
 */
export async function hasExistingGeneration(pageId: string): Promise<boolean> {
  const metadataRef = doc(db, COLLECTION_NAME, pageId);
  const metadataSnap = await getDoc(metadataRef);
  return metadataSnap.exists();
}

/**
 * Deletes an existing generation and all its test cases for regeneration.
 *
 * @param pageId - The Confluence page ID
 */
export async function deleteGeneration(pageId: string): Promise<void> {
  return withRetry(async () => {
    const metadataRef = doc(db, COLLECTION_NAME, pageId);
    const testCasesCollectionRef = collection(metadataRef, 'testCases');

    // Delete all test case documents in the subcollection
    const testCasesSnap = await getDocs(testCasesCollectionRef);
    const batch = writeBatch(db);

    testCasesSnap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();

    // Delete the metadata document
    await deleteDoc(metadataRef);
  });
}
