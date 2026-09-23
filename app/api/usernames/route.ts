import { getAllUsernames, insertUsername } from "@/server/usernames";

export async function GET() {
  const usernames = await getAllUsernames();
  return Response.json(usernames);
}

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    await insertUsername(username);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
