// Placeholder schema definitions for the trial system.
export interface Trial {
  id: string;
  userId: string;
  email: string;
  trialEnd: Date;
  trialStatus: string;
  [key: string]: any;
}

export const userTrials: any = {
  id: 'id',
  userId: 'user_id',
  email: 'email',
  trialEnd: 'trial_end',
  trialStatus: 'trial_status',
};
