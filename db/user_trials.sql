CREATE TABLE user_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_status VARCHAR(20) DEFAULT 'active',
  reminder_sent_7d BOOLEAN DEFAULT false,
  reminder_sent_3d BOOLEAN DEFAULT false,
  reminder_sent_1d BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  metadata JSONB
);

CREATE INDEX idx_user_trials_user_id ON user_trials(user_id);
CREATE INDEX idx_user_trials_email ON user_trials(email);
CREATE INDEX idx_user_trials_status ON user_trials(trial_status);
CREATE INDEX idx_user_trials_end ON user_trials(trial_end);
