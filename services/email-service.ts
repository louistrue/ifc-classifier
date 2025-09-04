// Email service for sending trial reminder notifications.
// Assumes existence of an email sending utility and database access.

import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/services/db'; // placeholder db module
import { userTrials, Trial } from '@/services/schema'; // placeholder schema
import { sevenDayTemplate, threeDayTemplate, oneDayTemplate } from '@/emails/templates';

interface TemplateInfo {
  subject: string;
  html: string;
}

export class EmailService {
  static async sendTrialReminder(userId: string, trial: Trial, daysLeft: number) {
    const user = await clerkClient.users.getUser(userId);
    const template = this.getEmailTemplate(daysLeft);
    if (!template) return;

    await sendEmail({
      to: user.emailAddresses[0].emailAddress,
      subject: template.subject,
      html: this.renderTemplate(template.html, {
        user: {
          name: user.firstName || 'there',
          email: user.emailAddresses[0].emailAddress,
        },
        trial: {
          end_date: trial.trialEnd.toLocaleDateString(),
          days_left: daysLeft,
        },
        upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      }),
    });

    await db
      .update(userTrials)
      .set({ [`reminderSent${daysLeft}d`]: true, updatedAt: new Date() })
      .where((ut) => ut.id === trial.id);
  }

  private static getEmailTemplate(daysLeft: number): TemplateInfo | null {
    switch (daysLeft) {
      case 7:
        return { subject: 'Your QTOpro Premium Trial Ends in 7 Days', html: sevenDayTemplate };
      case 3:
        return { subject: '⚠️ Your QTOpro Premium Trial Ends in 3 Days', html: threeDayTemplate };
      case 1:
        return { subject: '🚨 FINAL REMINDER: Trial Ends Tomorrow', html: oneDayTemplate };
      default:
        return null;
    }
  }

  // Placeholder template rendering
  private static renderTemplate(html: string, data: Record<string, any>): string {
    return html.replace(/{{\s*(.*?)\s*}}/g, (_, key) => {
      const keys = key.split('.');
      let value: any = data;
      for (const k of keys) {
        value = value?.[k];
      }
      return value ?? '';
    });
  }
}

// Placeholder email sending function
async function sendEmail(_payload: { to: string; subject: string; html: string }) {
  // Implementation depends on chosen provider
}
