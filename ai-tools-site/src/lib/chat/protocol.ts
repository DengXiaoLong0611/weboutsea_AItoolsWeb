export type ChatEvent = { type: "delta"; text: string } | { type: "done"; truncated: boolean } | { type: "error"; code: string };

async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (pending.length > 262144) throw new Error("Frame too large");
      let index: number;
      while ((index = pending.indexOf("\n")) >= 0) {
        yield pending.slice(0, index).replace(/\r$/, "");
        pending = pending.slice(index + 1);
      }
      if (done) break;
    }
    if (pending) yield pending.replace(/\r$/, "");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let data: string[] = [];
  for await (const line of lines(body)) {
    if (line === "") {
      if (data.length) yield data.join("\n");
      data = [];
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).replace(/^ /, ""));
    }
  }
  // An event is only complete when followed by a blank line.
  if (data.length) throw new Error("Incomplete SSE event");
}

export async function* readNDJSON(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  for await (const line of lines(body)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "delta" && typeof event.text === "string") yield event;
    else if (event.type === "done" && typeof event.truncated === "boolean") yield event;
    else if (event.type === "error" && typeof event.code === "string") yield event;
    else throw new Error("Invalid chat event");
  }
}
