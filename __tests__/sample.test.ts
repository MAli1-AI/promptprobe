import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Sample Test Suite", () => {
  it("executes a passing sample test", () => {
    expect(true).toBe(true);
  });

  it("GET /api/health returns { status: 'ok' }", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
