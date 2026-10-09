import { getPlayerHeadshot } from "@/server/players";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const playerId = Number((await params).id);
  if (!Number.isInteger(playerId)) {
    return Response.json({ error: "invalid player id" }, { status: 400 });
  }

  const headshot = await getPlayerHeadshot(playerId);
  if (!headshot)
    return Response.json({ error: "no headshot" }, { status: 404 });

  // headshots can be re-picked at any time, so browsers revalidate on each
  // load and only re-download when the pick has changed
  const etag = `"${headshot.updatedAt.getTime()}"`;
  const headers = { ETag: etag, "Cache-Control": "no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(headshot.image), {
    headers: { ...headers, "Content-Type": headshot.mimeType },
  });
}
