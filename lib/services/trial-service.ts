import { randomUUID } from "crypto";
import { db, UserTrial } from "@/lib/db";
import { clerkClient } from "@/lib/clerk";

export class TrialService {
  static async grantTrial(email: string, durationDays = 14) {
    const user = await clerkClient.users.getUserList({ emailAddress: [email] });
    if (!user.data.length) {
      throw new Error("User not found");
    }

    const userId = user.data[0].id;
    const existing = db.findActiveTrialByUser(userId);
    if (existing) {
      throw new Error("User already has an active trial");
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + durationDays);

    const trial: UserTrial = {
      id: randomUUID(),
      userId,
      email,
      trialStart: new Date(),
      trialEnd,
      trialStatus: "active",
      reminderSent7d: false,
      reminderSent3d: false,
      reminderSent1d: false,
      createdBy: userId,
      createdAt: new Date(),
    };

    db.insertTrial(trial);

    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        premium_trial: {
          start: trial.trialStart.toISOString(),
          end: trial.trialEnd.toISOString(),
          status: "active",
        },
      },
    });

    return trial;
  }
}
