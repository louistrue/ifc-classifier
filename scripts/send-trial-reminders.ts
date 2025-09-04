// Scheduled job to send trial reminder emails.
// This script queries trials ending in 7, 3, or 1 day and sends reminders.

import { db } from '@/services/db'; // placeholder db module
import { userTrials } from '@/services/schema'; // placeholder schema
import { EmailService } from '@/services/email-service';
import { eq, sql, not } from 'drizzle-orm';

export async function sendTrialReminders() {
  const now = new Date();
  const reminderDays = [7, 3, 1];

  for (const days of reminderDays) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + days);

    const trials = await db
      .select()
      .from(userTrials)
      .where(eq(userTrials.trialStatus, 'active'))
      .where(sql`DATE(${userTrials.trialEnd}) = DATE(${targetDate})`)
      .where(not(sql`${userTrials[`reminderSent${days}d` as keyof typeof userTrials]}`));

    for (const trial of trials) {
      try {
        await EmailService.sendTrialReminder(trial.userId, trial, days);
        console.log(`Sent ${days}-day reminder to ${trial.email}`);
      } catch (err) {
        console.error(`Failed to send reminder to ${trial.email}:`, err);
      }
    }
  }
}

// Allow running as standalone script
if (require.main === module) {
  sendTrialReminders().then(() => process.exit(0));
}
