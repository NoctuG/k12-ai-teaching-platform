export type GenerationStreamEvent =
  | { event: "start"; payload: { historyId?: number } }
  | { event: "token"; payload: { delta?: string } }
  | { event: "done"; payload: { historyId?: number; content?: string } }
  | { event: "error"; payload: { message?: string } }
  | { event: "heartbeat"; payload: Record<string, unknown> };

export function parseStreamEvent(rawEvent: string): GenerationStreamEvent | null {
  const lines = rawEvent.split("\n");
  let eventType = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return null;
  const payload = JSON.parse(dataLines.join("\n"));

  if (
    eventType === "start" ||
    eventType === "token" ||
    eventType === "done" ||
    eventType === "error" ||
    eventType === "heartbeat"
  ) {
    return { event: eventType, payload } as GenerationStreamEvent;
  }

  return null;
}
