import fs from "fs";
import path from "path";
import { clerkClient } from "@/lib/clerk";
import { db, UserTrial } from "@/lib/db";

const templatesDir = path.join(process.cwd(), "emails");
const sevenDayTemplate = fs.readFileSync(
  path.join(templatesDir, "trial-reminder-7d.html"),
  "utf8"
);
const threeDayTemplate = fs.readFileSync(
  path.join(templatesDir, "trial-reminder-3d.html"),
  "utf8"
);
const oneDayTemplate = fs.readFileSync(
  path.join(templatesDir, "trial-reminder-1d.html"),
  "utf8"
);

export class EmailService {
  static async sendTrialReminder(userId: string, trial: UserTrial, daysLeft: number) {
    const user = await clerkClient.users.getUser(userId);
    const template = this.getEmailTemplate(daysLeft);

    const html = template.html
      .replace(/{{user.name}}/g, user.firstName || "there")
      .replace(/{{trial.end_date}}/g, trial.trialEnd.toLocaleDateString())
      .replace(/{{upgrade_url}}/g, `${process.env.NEXT_PUBLIC_APP_URL || ''}/pricing`);

    console.log(`Sending email to ${user.emailAddresses[0].emailAddress}: ${template.subject}`);
    console.log(html.substring(0, 60));

    db.updateTrial(trial.id, {
      [`reminderSent${daysLeft}d`]: true as any,
    });
  }

  private static getEmailTemplate(daysLeft: number) {
    switch (daysLeft) {
      case 7:
        return { subject: "Your QTOpro Premium Trial Ends in 7 Days", html: sevenDayTemplate };
      case 3:
        return { subject: "⚠️ Your QTOpro Premium Trial Ends in 3 Days", html: threeDayTemplate };
      case 1:
        return { subject: "🚨 FINAL REMINDER: Trial Ends Tomorrow", html: oneDayTemplate };
      default:
        return { subject: "", html: "" };
    }
  }
}
