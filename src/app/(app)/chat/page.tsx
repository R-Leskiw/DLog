export default function ChatPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Team chat</h1>
        <p className="mt-1 text-muted-foreground">
          Employees only — clients must not see this route when wired to auth.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Supabase Realtime messaging UI will go here.
      </div>
    </main>
  );
}
