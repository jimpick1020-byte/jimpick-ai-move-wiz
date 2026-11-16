import { afterEach, describe, expect, test, vi } from "vitest";
vi.mock("@tanstack/react-router",()=>({createFileRoute:()=> (options:unknown)=>options}));
import { Route } from "@/routes/api/public/payapp/readiness";
const handlers=(Route as unknown as {server:{handlers:Record<"GET"|"HEAD",()=>Response>}}).server.handlers;
const keys=["PAYAPP_USER_ID","PAYAPP_LINK_KEY","PAYAPP_LINK_VALUE","PAYAPP_REQUEST_KEY"];
afterEach(()=>vi.unstubAllEnvs());
describe("public aggregate readiness: synthetic env only, no customer or provider",()=>{
  test.each(["GET","HEAD"] as const)("%s gives empty uncached 204 only when all four are set",async method=>{
    for(const key of keys) vi.stubEnv(key,"synthetic-only");
    const response=handlers[method]();expect(response.status).toBe(204);expect(response.body).toBeNull();expect(await response.text()).toBe("");expect(response.headers.get("Cache-Control")).toContain("no-store");expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
  });
  test.each(keys)("missing synthetic setting returns empty 503 without reason: %s",async missing=>{
    for(const key of keys) vi.stubEnv(key,key===missing ? "" : "synthetic-only");
    for(const method of ["GET","HEAD"] as const){const response=handlers[method]();expect(response.status).toBe(503);expect(response.body).toBeNull();expect(await response.text()).toBe("");expect([...response.headers.keys()].sort()).toEqual(["cache-control","cdn-cache-control"]);}
  });
});