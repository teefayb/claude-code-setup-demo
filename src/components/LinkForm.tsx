"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LinkForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const tags = String(fields.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setPending(true);
    setError(null);
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: fields.get("title"), url: fields.get("url"), tags }),
    });
    setPending(false);

    if (!res.ok) {
      setError("Could not save that link. Check the title and URL.");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form className="add" onSubmit={onSubmit}>
      <input name="title" placeholder="Title" required maxLength={120} />
      <input name="url" type="url" placeholder="https://…" required />
      <input name="tags" placeholder="tags, comma, separated" />
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add link"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
