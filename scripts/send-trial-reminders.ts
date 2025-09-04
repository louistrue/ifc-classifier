import { db } from "@/lib/db";
import { EmailService } from "@/lib/services/email-service";

export async function sendTrialReminders() {
  const now = new Date();
  const reminderDays = [7, 3, 1];

  for (const days of reminderDays) {
    const target = new Date();
    target.setDate(now.getDate() + days);

    for (const trial of db.trials.filter(t => t.trialStatus === "active")) {
      const sameDate = trial.trialEnd.toDateString() === target.toDateString();
      const flag = (trial as any)[`reminderSent${days}d`];
      if (sameDate && !flag) {
        try {
          await EmailService.sendTrialReminder(trial.userId, trial, days);
          console.log(`Sent ${days}-day reminder to ${trial.email}`);
        } catch (err) {
          console.error(`Failed to send reminder to ${trial.email}:`, err);
        }
      }
    }
  }
}
