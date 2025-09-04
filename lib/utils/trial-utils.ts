export function isTrialActive(trialData: any): boolean {
  if (!trialData || trialData.status !== "active") return false;

  const now = new Date();
  const trialEnd = new Date(trialData.end);

  return now <= trialEnd;
}

export function getTrialDaysLeft(trialData: any): number {
  if (!trialData || trialData.status !== "active") return 0;

  const now = new Date();
  const trialEnd = new Date(trialData.end);
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}
