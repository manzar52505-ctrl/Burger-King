# Security Specification - King Burgers

## 1. Data Invariants
- A **User** document can only be created by the authenticated owner and must start with 0 points (or a small welcome bonus). Uid in data must match auth.uid.
- An **Order** must belong to the authenticated user. Total must be positive. Status must be 'pending' on creation.
- **Rewards** are read-only for users.

## 2. The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Creating a user profile for a different UID.
2. **Privilege Escalation**: Attempting to set `isAdmin` (though not defined yet) or manually adding 1,000,000 points.
3. **Ghost Field Injection**: Adding `isVerified: true` to a user document.
4. **Orphaned Order**: Creating an order for a non-existent user.
5. **State Shortcutting**: Creating an order with status 'delivered'.
6. **Value Poisoning**: Setting order `total` to -50.99.
7. **Identity Hijacking**: Updating someone else's order.
8. **Resource Poisoning**: Document ID with 2KB junk characters.
9. **Immortality Breach**: Modifying `createdAt` on an order.
10. **Unauthorized PII Read**: Authenticated user trying to read someone else's PII in `/users/ID`.
11. **Blanket List Query**: Trying to list all orders from all users.
12. **System Field Modification**: Modifying `points` manually via client (points should be earned via transactions).

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would verify these rejections.
