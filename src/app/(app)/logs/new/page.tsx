import { DailyLogForm } from "@/components/logs/daily-log-form";

export default function NewDailyLogPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <DailyLogForm />
    </main>
  );
}
