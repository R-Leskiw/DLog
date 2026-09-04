import { JobPicker } from "@/components/jobs/job-picker";
import { PageTrail } from "@/components/layout/page-breadcrumbs";
import { loadActiveJobs } from "@/lib/jobs/workspace";

export async function JobsLanding() {
  const { jobs, error } = await loadActiveJobs();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <PageTrail
          items={[{ label: "Jobs" }]}
          fallbackHref="/dashboard"
        />
        <h1 className="font-heading text-3xl md:text-4xl">Jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Select a job site to see today’s work, who’s on the clock, upcoming
          schedule, and daily logs for that site.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {jobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No active jobs yet. An admin can add job sites under Admin → Jobs.
        </p>
      ) : (
        <JobPicker jobs={jobs.map((j) => ({ id: j.id, name: j.name }))} />
      )}
    </main>
  );
}
