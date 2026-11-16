import { describe, expect, it } from "vitest";
import { ConnectAgentModal } from "./ConnectAgentModal";

describe("ConnectAgentModal Component", () => {
  it("exports ConnectAgentModal correctly", () => {
    expect(ConnectAgentModal).toBeDefined();
    expect(typeof ConnectAgentModal).toBe("function");
  });
});
