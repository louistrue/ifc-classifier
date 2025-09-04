import { NextRequest, NextResponse } from "next/server";
import { TrialService } from "@/lib/services/trial-service";

export async function POST(req: NextRequest) {
  const { email, durationDays } = await req.json();
  try {
    const trial = await TrialService.grantTrial(email, durationDays);
    return NextResponse.json({
      success: true,
      trial_id: trial.id,
      user_id: trial.userId,
      trial_end: trial.trialEnd.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
