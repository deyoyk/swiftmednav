import { subscribe } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(`data: ${JSON.stringify({ kind: "hello", simulated: true })}\n\n`));
      const unsub = subscribe((msg) => {
        try { c.enqueue(enc.encode(`data: ${JSON.stringify(msg)}\n\n`)); } catch { unsub(); }
      });
      const t = setInterval(() => {
        try { c.enqueue(enc.encode(`data: ${JSON.stringify({ kind: "heartbeat", at: new Date().toISOString() })}\n\n`)); } catch { clearInterval(t); unsub(); }
      }, 15000);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
