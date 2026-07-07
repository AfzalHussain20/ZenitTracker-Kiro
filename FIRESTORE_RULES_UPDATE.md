# Firestore Security Rules — Update Required for Public Reports

## Current Issue
The `/report/[sessionId]` public page reads from Firestore without authentication.
For this to work, the Firestore rules need to allow public read access to session documents.

## Required Rule Changes

Go to **Firebase Console** → **Firestore Database** → **Rules** tab, and update:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Sessions — authenticated users can read/write their own
    // Public can READ any session (for shareable reports)
    match /sessions/{sessionId} {
      allow read: if true;  // Public reports need this
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    
    // Test Sessions — same rules
    match /testSessions/{sessionId} {
      allow read: if true;  // Public reports need this
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    
    // Users — only authenticated users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Everything else — require auth
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Security Notes
- Session READ is public so `/report/[id]` can work without login
- Session WRITE still requires the authenticated owner
- If you want more restrictive public access (e.g., only completed sessions), use:
  ```
  allow read: if resource.data.status == 'Completed' || (request.auth != null && request.auth.uid == resource.data.userId);
  ```
- This means only completed session reports are publicly viewable

## How to Apply
1. Firebase Console → Firestore → Rules
2. Replace the existing rules with the above
3. Click "Publish"
4. Test by opening a `/report/[sessionId]` URL in an incognito window
