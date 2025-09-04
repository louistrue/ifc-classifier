'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

export function TrialManager() {
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState(14);

  const handleGrantTrial = async () => {
    try {
      const response = await fetch('/api/admin/trials/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, durationDays: duration }),
      });

      if (response.ok) {
        toast.success('Trial granted successfully');
        setEmail('');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to grant trial');
      }
    } catch (err) {
      toast.error('Failed to grant trial');
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v))}>
        <SelectTrigger>
          <SelectValue placeholder="Duration" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">7 days</SelectItem>
          <SelectItem value="14">14 days</SelectItem>
          <SelectItem value="30">30 days</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleGrantTrial}>Grant Trial Access</Button>
    </div>
  );
}
