import { errorResponse, type Ctx } from "@/lib/api";
import { streamTutor } from "@/lib/ai";
import { chatHistory, lessonContextForTutor, markActive, saveMessage } from "@/lib/learning";
import { TUTOR_CHAT_SYSTEM } from "@/lib/prompts";

// Streams the tutor's reply as plain text.
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { message } = (await req.json()) as { message: string };
  let context: string;
  try {
    context = lessonContextForTutor(id);
  } catch (e) {
    return errorResponse(e);
  }
  const history = [...chatHistory(id), { role: "user" as const, content: message.slice(0, 4000) }];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reply = await streamTutor({
          system: TUTOR_CHAT_SYSTEM,
          lessonContext: context,
          history,
          onText: (t) => controller.enqueue(encoder.encode(t)),
        });
        saveMessage(id, "user", message);
        saveMessage(id, "assistant", reply);
        markActive();
      } catch (e) {
        const res = errorResponse(e);
        const { error } = (await res.json()) as { error: string };
        controller.enqueue(encoder.encode(`\n\n⚠️ ${error}`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
