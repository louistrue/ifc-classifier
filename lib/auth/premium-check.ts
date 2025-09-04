import { clerkClient } from "@/lib/clerk";
import { isTrialActive } from "@/lib/utils/trial-utils";

export async function requirePremiumAccess(userId: string) {
  const user = await clerkClient.users.getUser(userId);
  const trialData = user.publicMetadata?.premium_trial;
  if (!isTrialActive(trialData)) {
    throw new Error("Premium access required");
  }
  return { userId, trialData };
}
