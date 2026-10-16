import { NextRequest } from "next/server";
import { getSimulator } from "@/lib/simulator/engine";
import type { SimEvent } from "@/lib/simulator/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const sim = getSimulator();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const initialPayload = `data: ${JSON.stringify({
        type: "connected",
        data: sim.getStatus(),
      })}\n\n`;
      controller.enqueue(encoder.encode(initialPayload));

      const unsubscribe = sim.subscribe((event: SimEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream closed
        }
      });

      // Keepalive heartbeat every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
