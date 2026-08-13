"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FeedFilterValues = {
  jobId: string;
  date: string;
  authorId: string;
  search: string;
};

export const EMPTY_FEED_FILTERS: FeedFilterValues = {
  jobId: "all",
  date: "",
  authorId: "all",
  search: "",
};

type Option = { id: string; name: string };

export function FeedFilters({
  value,
  onChange,
  jobs,
  authors,
}: {
  value: FeedFilterValues;
  onChange: (next: FeedFilterValues) => void;
  jobs: Option[];
  authors: Option[];
}) {
  const hasFilters =
    value.jobId !== "all" ||
    Boolean(value.date) ||
    value.authorId !== "all" ||
    Boolean(value.search.trim());

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-search">Search</Label>
        <Input
          id="filter-search"
          className="min-h-11"
          placeholder="Title or work notes"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-job">Job</Label>
        <Select
          value={value.jobId}
          onValueChange={(v) =>
            onChange({ ...value, jobId: (v as string) || "all" })
          }
        >
          <SelectTrigger
            id="filter-job"
            className={cn("w-full min-h-11 py-2.5", "data-[size=default]:h-11")}
          >
            <SelectValue placeholder="All jobs">
              {value.jobId === "all"
                ? "All jobs"
                : jobs.find((j) => j.id === value.jobId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-date">Date</Label>
        <Input
          id="filter-date"
          type="date"
          className="min-h-11"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-author">Author</Label>
        <Select
          value={value.authorId}
          onValueChange={(v) =>
            onChange({ ...value, authorId: (v as string) || "all" })
          }
        >
          <SelectTrigger
            id="filter-author"
            className={cn("w-full min-h-11 py-2.5", "data-[size=default]:h-11")}
          >
            <SelectValue placeholder="All authors">
              {value.authorId === "all"
                ? "All authors"
                : authors.find((a) => a.id === value.authorId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All authors</SelectItem>
            {authors.map((author) => (
              <SelectItem key={author.id} value={author.id}>
                {author.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onChange(EMPTY_FEED_FILTERS)}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
