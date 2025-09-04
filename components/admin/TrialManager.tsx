"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function TrialManager() {
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState("14");

  const handleGrantTrial = async () => {
    try {
      const response = await fetch("/api/admin/trials/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, durationDays: Number(duration) }),
      });

      if (response.ok) {
        alert("Trial granted successfully");
        setEmail("");
      } else {
        alert("Failed to grant trial");
      }
    } catch (error) {
      alert("Failed to grant trial");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grant Premium Trial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="14">14 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleGrantTrial}>Grant Trial Access</Button>
      </CardContent>
    </Card>
  );
}
