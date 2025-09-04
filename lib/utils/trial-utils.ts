export interface TrialMetadata {
  start?: string;
  end?: string;
  status?: 'active' | 'expired' | 'converted';
}

/**
 * Determine if the trial data represents an active trial.
 */
export function isTrialActive(trialData: TrialMetadata | null | undefined): boolean {
  if (!trialData || trialData.status !== 'active') return false;

  const now = new Date();
  const trialEnd = trialData.end ? new Date(trialData.end) : new Date(0);
  return now <= trialEnd;
}

/**
 * Calculate the number of days left in an active trial.
 */
export function getTrialDaysLeft(trialData: TrialMetadata | null | undefined): number {
  if (!trialData || trialData.status !== 'active' || !trialData.end) return 0;

  const now = new Date();
  const trialEnd = new Date(trialData.end);
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
