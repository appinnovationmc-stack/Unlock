"use client";

export function RetryState({
  reset,
  title = "Something went wrong",
  description = "We couldn't load this view. Try again."
}: {
  reset: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <main className="min-h-screen bg-void px-6 py-16 flex items-center justify-center">
      <div className="max-w-md text-center">
        <p className="font-display text-xl text-fog">{title}</p>
        <p className="text-mute text-sm mt-2">{description}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 bg-volt text-void px-4 py-2 text-sm hover:bg-volt/90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
