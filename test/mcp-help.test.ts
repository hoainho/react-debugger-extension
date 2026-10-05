import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printMcpHelp } from "../path/to/your/file";

describe("printMcpHelp", () => {
  let stderrSpy: any;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it("writes help text to stderr", () => {
    printMcpHelp();

    expect(stderrSpy).toHaveBeenCalled();
  });

  it("prints expected help content", () => {
    printMcpHelp();

    const output = stderrSpy.mock.calls[0][0];

    expect(output).toContain("react-debugger mcp");
    expect(output).toContain("Usage:");
    expect(output).toContain("npx @nhonh/react-debugger mcp");
    expect(output).toContain("chrome-extension://");
    expect(output).toContain("pairing link");
  });

  it("does not write to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    printMcpHelp();

    expect(stdoutSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
  });
});
