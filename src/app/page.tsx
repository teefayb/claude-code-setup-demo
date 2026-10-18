import Link from "next/link";

import { DeleteLinkButton } from "@/components/DeleteLinkButton";
import { LinkForm } from "@/components/LinkForm";
import { listLinks } from "@/lib/links/store";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const links = await listLinks({ tag });

  return (
    <main>
      <h1>Teamlinks</h1>
      <p className="muted">
        The links your team keeps asking for.
        {tag ? (
          <>
            {" "}
            Showing <strong>#{tag}</strong> · <Link href="/">show all</Link>
          </>
        ) : null}
      </p>

      <LinkForm />

      {links.length === 0 ? (
        <p className="muted">No links yet.</p>
      ) : (
        <ul className="links">
          {links.map((link) => (
            <li key={link.id}>
              <div>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.title}
                </a>
                <div>
                  {link.tags.map((t) => (
                    <Link key={t} className="tag" href={`/?tag=${encodeURIComponent(t)}`}>
                      #{t}
                    </Link>
                  ))}
                </div>
              </div>
              <DeleteLinkButton id={link.id} title={link.title} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
