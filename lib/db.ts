export interface UserTrial {
  id: string;
  userId: string;
  email: string;
  trialStart: Date;
  trialEnd: Date;
  trialStatus: 'active' | 'expired' | 'converted';
  reminderSent7d: boolean;
  reminderSent3d: boolean;
  reminderSent1d: boolean;
  createdBy: string;
  createdAt: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

// Simple in-memory store used as placeholder for a real database
const trials: UserTrial[] = [];

export const db = {
  insertTrial(trial: UserTrial) {
    trials.push(trial);
    return trial;
  },
  findActiveTrialByUser(userId: string) {
    return trials.find(t => t.userId === userId && t.trialStatus === 'active');
  },
  updateTrial(id: string, data: Partial<UserTrial>) {
    const trial = trials.find(t => t.id === id);
    if (trial) Object.assign(trial, data);
    return trial;
  },
  trials,
};
