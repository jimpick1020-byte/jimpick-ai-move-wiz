import { beforeEach, describe, expect, test, vi } from "vitest";
import { PAYAPP_POLICY_VERSION } from "./payapp-live";

const fake = vi.hoisted(() => ({ admin: {rpc:vi.fn(),from:vi.fn()}, context: {userId:"11111111-1111-4111-8111-111111111111",supabase:{from:vi.fn()}}, request:vi.fn() }));
vi.mock("@tanstack/react-start", () => ({createServerFn:() => {
  let validator:(input:unknown)=>unknown = input=>input;
  const chain = {middleware:()=>chain,inputValidator:(fn:typeof validator)=>{validator=fn;return chain;},handler:(fn:(arg:unknown)=>unknown)=>async(args:{data:unknown})=>fn({context:fake.context,data:validator(args.data)})};
  return chain;
}}));
vi.mock("@/integrations/supabase/auth-middleware",()=>({requireSupabaseAuth:{}}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:fake.admin}));
vi.mock("./payapp-live.server",async importOriginal=>({...(await importOriginal<typeof import("./payapp-live.server")>()),payappRequest:fake.request}));
import { startPayappSubscription } from "./payapp-live.functions";
import { PayappRequestError } from "./payapp-live.server";

const consent={consent:true as const,requestDate:"2026-11-16",expire:"2031-11-16",policyVersion:PAYAPP_POLICY_VERSION};
const order={id:"22222222-2222-4222-8222-222222222222",payurl:null,status:"creating",created_at:"2026-11-16T14:00:00Z",requested_at:"2026-11-16T14:00:00Z",request_date:consent.requestDate,rebill_expire:consent.expire,first_paid_at:null,requested_day:16,amount:39000,policy_version:PAYAPP_POLICY_VERSION};
beforeEach(()=>{
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T14:00:00Z")); vi.clearAllMocks();
  for(const key of ["PAYAPP_USER_ID","PAYAPP_LINK_KEY","PAYAPP_LINK_VALUE","PAYAPP_REQUEST_KEY"]) vi.stubEnv(key,"synthetic-only");
  fake.context.supabase.from.mockReturnValue({select:()=>({eq:()=>({single:async()=>({data:{phone:"010-0000-0000"},error:null})})})});
  fake.admin.rpc.mockResolvedValue({data:{created:true,order},error:null});
  const query={eq:vi.fn(),is:vi.fn(),select:vi.fn(),maybeSingle:async()=>({data:{id:order.id},error:null})};
  query.eq.mockReturnValue(query);query.is.mockReturnValue(query);query.select.mockReturnValue(query);
  fake.admin.from.mockReturnValue({update:vi.fn(()=>query)});
  fake.request.mockResolvedValue(new URLSearchParams("rebill_no=123&payurl=https%3A%2F%2Fpayapp.kr%2Fsynthetic"));
});
import { afterEach } from "vitest";
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe("actual checkout server orchestration with fake provider/isolated records",()=>{
  test("unchecked consent never reserves or requests payment",async()=>{
    await expect(startPayappSubscription({data:{...consent,consent:false} as never})).rejects.toThrow(); expect(fake.admin.rpc).not.toHaveBeenCalled(); expect(fake.request).not.toHaveBeenCalled();
  });
  test("consented 39000/card/no-SMS registration returns validated same-tab destination only",async()=>{
    expect(await startPayappSubscription({data:consent})).toEqual({payurl:"https://payapp.kr/synthetic"});
    expect(fake.request).toHaveBeenCalledWith("rebillRegist",expect.objectContaining({goodprice:"39000",smsuse:"n",openpaytype:"card",rebillCycleMonth:"16",rebillExpire:"2031-11-16"}));
    expect(fake.admin.from).toHaveBeenCalledTimes(1); expect(fake.admin.from).toHaveBeenCalledWith("payapp_orders");
  });
  test("cross-midnight resume reuses original quote without provider call or consent rewrite",async()=>{
    vi.setSystemTime(new Date("2026-11-17T01:00:00Z"));
    fake.admin.rpc.mockResolvedValue({data:{created:false,order:{...order,status:"pending",payurl:"https://payapp.kr/synthetic"}},error:null});
    await startPayappSubscription({data:{...consent,resumeOrderId:order.id}});
    expect(fake.request).not.toHaveBeenCalled(); expect(fake.admin.rpc).toHaveBeenCalledWith("reserve_payapp_order_v2",expect.objectContaining({p_request:"2026-11-16",p_resume:order.id}));
  });
  test("midnight before registration rejects stale consent without new request",async()=>{
    vi.setSystemTime(new Date("2026-11-16T15:00:00Z")); await expect(startPayappSubscription({data:consent})).rejects.toThrow("날짜"); expect(fake.request).not.toHaveBeenCalled();
  });
  test.each([true,false])("definite rejection %s only releases proven failure",async definitive=>{
    fake.request.mockRejectedValue(new PayappRequestError(definitive)); await expect(startPayappSubscription({data:consent})).rejects.toThrow();
    expect(fake.admin.rpc.mock.calls.filter(call=>call[0]==="reject_payapp_registration").length).toBe(definitive ? 1 : 0);
  });
  test("unsafe URL keeps request locked and never returns redirect",async()=>{
    fake.request.mockResolvedValue(new URLSearchParams("rebill_no=123&payurl=https%3A%2F%2Fevil.example%2Fsynthetic")); await expect(startPayappSubscription({data:consent})).rejects.toThrow("검토"); expect(fake.admin.rpc).toHaveBeenCalledTimes(1);
    expect(fake.admin.from().update).toHaveBeenCalledWith({rebill_no:"123",payurl:null,status:"review"});
    const query=fake.admin.from().update.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith("id",order.id);expect(query.eq).toHaveBeenCalledWith("user_id",fake.context.userId);expect(query.eq).toHaveBeenCalledWith("status","creating");expect(query.is).toHaveBeenCalledWith("rebill_no",null);
  });
  test("URL-encoded official HTTP response saves and redirects only HTTPS",async()=>{
    fake.request.mockResolvedValue(new URLSearchParams("state=1&rebill_no=123&payurl=http%3A%2F%2Fpayapp.kr%2Fsynthetic"));
    expect(await startPayappSubscription({data:consent})).toEqual({payurl:"https://payapp.kr/synthetic"});
    expect(fake.admin.from().update).toHaveBeenCalledWith({rebill_no:"123",payurl:"https://payapp.kr/synthetic",status:"pending"});
  });
  test("legacy pending URL is normalized in storage before reopening, no provider request",async()=>{
    fake.admin.rpc.mockResolvedValue({data:{created:false,order:{...order,status:"pending",payurl:"http://payapp.kr/synthetic"}},error:null});
    expect(await startPayappSubscription({data:{...consent,resumeOrderId:order.id}})).toEqual({payurl:"https://payapp.kr/synthetic"});
    expect(fake.admin.from().update).toHaveBeenCalledWith({payurl:"https://payapp.kr/synthetic"});expect(fake.request).not.toHaveBeenCalled();
  });
  test("reviewed registration cannot issue another registration or URL",async()=>{
    fake.admin.rpc.mockResolvedValue({data:{created:false,order:{...order,status:"review"}},error:null});
    await expect(startPayappSubscription({data:{...consent,resumeOrderId:order.id}})).rejects.toThrow("중복");expect(fake.request).not.toHaveBeenCalled();
  });
  test("24-hour exact boundary does not reopen or unlock",async()=>{
    vi.setSystemTime(new Date("2026-11-17T14:00:00Z"));fake.admin.rpc.mockResolvedValue({data:{created:false,order:{...order,status:"pending",payurl:"https://payapp.kr/synthetic"}},error:null});
    await expect(startPayappSubscription({data:{...consent,resumeOrderId:order.id}})).rejects.toThrow("기간");expect(fake.request).not.toHaveBeenCalled();expect(fake.admin.rpc).toHaveBeenCalledTimes(1);
  });
});