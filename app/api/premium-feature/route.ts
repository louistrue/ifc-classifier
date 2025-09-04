import { NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/auth/premium-check";
import { getTrialDaysLeft } from "@/lib/utils/trial-utils";

export async function POST() {
  try {
    const { userId, trialData } = await requirePremiumAccess("stub-user");
    const daysLeft = getTrialDaysLeft(trialData);
    return NextResponse.json({ message: "Premium feature executed", userId, daysLeft });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 403 });
  }
}
