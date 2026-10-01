import { checkAnswer } from "@/server/checkAnswer";

export async function POST(request: Request) {
    const { puzzleId, row, col, playerId } = await request.json();

    const guessIsCorrect = await checkAnswer(puzzleId, row, col, playerId);
    return Response.json({ guessIsCorrect });
}