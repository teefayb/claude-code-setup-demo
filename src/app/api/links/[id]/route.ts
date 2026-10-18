import { errorResponse } from "@/lib/http";
import { deleteLink } from "@/lib/links/store";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteLink(id);
  if (!deleted) return errorResponse(404, "not_found");
  return new Response(null, { status: 204 });
}
