"use client";

import { useRouter } from "next/navigation";

export function DeleteLinkButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();

  async function onClick() {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/links/${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button type="button" onClick={onClick} aria-label={`Delete ${title}`}>
      Delete
    </button>
  );
}
