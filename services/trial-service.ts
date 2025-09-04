// Service for granting and managing premium trials.
// Note: This implementation assumes availability of a database and Clerk client.

import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/services/db'; // placeholder, actual db module should provide query builder
import { userTrials } from '@/services/schema'; // placeholder schema
import { eq } from 'drizzle-orm';

export class TrialService {
  /**
   * Grant a premium trial to a user identified by email.
   */
  static async grantTrial(email: string, durationDays: number = 14) {
    // 1. Find user by email
    const user = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (!user.data.length) {
      throw new Error('User not found');
    }
    const userId = user.data[0].id;

    // 2. Check for existing active trial
    const existing = await db
      .select()
      .from(userTrials)
      .where(eq(userTrials.userId, userId))
      .where(eq(userTrials.trialStatus, 'active'))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('User already has an active trial');
    }

    // 3. Create trial record
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + durationDays);

    const [trial] = await db
      .insert(userTrials)
      .values({
        userId,
        email,
        trialEnd,
        trialStatus: 'active',
        createdBy: await this.getCurrentUserId(),
      })
      .returning();

    // 4. Update Clerk metadata
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...user.data[0].publicMetadata,
        premium_trial: {
          start: new Date().toISOString(),
          end: trialEnd.toISOString(),
          status: 'active',
        },
      },
    });

    return trial;
  }

  // Placeholder helper to retrieve current admin user id
  private static async getCurrentUserId(): Promise<string> {
    // Implement according to authentication mechanism
    return 'admin-id';
  }
}
