import { describe, expect, it } from "vitest";
import { parseStreamEvent } from "./generateStream";

describe("parseStreamEvent", () => {
  it("parses token event and supports incremental append", () => {
    const first = parseStreamEvent('event: token\ndata: {"delta":"Hello "}\n\n');
    const second = parseStreamEvent('event: token\ndata: {"delta":"World"}\n\n');

    let content = "";
    if (first?.event === "token") content += first.payload.delta || "";
    if (second?.event === "token") content += second.payload.delta || "";

    expect(content).toBe("Hello World");
  });
});
