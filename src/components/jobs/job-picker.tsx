"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type JobOption = { id: string; name: string };

export function JobPicker({ jobs }: { jobs: JobOption[] }) {
  const router = useRouter();
  const [jobId, setJobId] = useState("");

  function openJob(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) return;
    router.push(`/jobs/${jobId}`);
  }

  return (
    <form
      onSubmit={openJob}
      className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="jobs-pick">Job site</Label>
        <select
          id="jobs-pick"
          className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          required
        >
          <option value="">Select a job…</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" className="min-h-11 shrink-0" disabled={!jobId}>
        Open job
      </Button>
    </form>
  );
}
