import { NextResponse } from 'next/server';
import { TrialService } from '@/services/trial-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, durationDays = 14, notes } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const trial = await TrialService.grantTrial(email, durationDays);

    return NextResponse.json({
      success: true,
      trial_id: trial.id,
      user_id: trial.userId,
      trial_end: trial.trialEnd,
      notes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
