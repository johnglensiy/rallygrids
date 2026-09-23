// app/api/users/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  console.log("Received:", body); // shows in the bun dev terminal
  return Response.json({ created: body }, { status: 201 });
}
