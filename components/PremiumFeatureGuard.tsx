"use client";

import type React from "react";
import { useUser } from "@/lib/useUser";
import { isTrialActive, getTrialDaysLeft } from "@/lib/utils/trial-utils";

interface PremiumFeatureGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PremiumFeatureGuard({ children, fallback }: PremiumFeatureGuardProps) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <div>Loading...</div>;

  const trialData = user?.publicMetadata?.premium_trial;
  const hasActiveTrial = isTrialActive(trialData);
  const daysLeft = getTrialDaysLeft(trialData);

  if (!hasActiveTrial) {
    return (
      fallback || (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800">Premium Feature</h3>
          <p className="text-yellow-700 mt-2">
            This feature requires a premium subscription.
            <a href="/pricing" className="ml-2 text-yellow-800 underline hover:text-yellow-900">
              Upgrade now
            </a>
          </p>
        </div>
      )
    );
  }

  return (
    <div>
      {daysLeft <= 3 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-orange-800">
            ⚠️ Your premium trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.
            <a href="/pricing" className="ml-2 text-orange-800 underline hover:text-orange-900">
              Upgrade now
            </a>
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
