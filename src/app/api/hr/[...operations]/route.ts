import { jsonResponse, parseJsonBody, requireHrApi, withHrApi } from "@/lib/hr/api";
import { hrOperationSchema } from "@/lib/hr/schemas";
import {
  approvalInbox, assignEmployeeWorkLocation, clock, copyHolidayYear, createAttendanceAdjustment,
  createNotification, createPayrollRun, createSchedulePeriod, createWorkLocation, issuePayslips,
  listAttendanceDays, listCalendars, listNotifications, listPayItems, listWorkLocations,
  markNotificationRead, payrollAction, report, reviewLeave, reviewOvertime, saveCalendar,
  saveHoliday, saveRecurringPayItem, scheduleAction, selfService, submitLeave, submitOvertime,
  toCsv, updateWorkLocation,
} from "@/lib/hr/services/operations";

export const dynamic = "force-dynamic";
type Params = { operations: string[] };

async function dispatch(request: Request, params: Params): Promise<Response> {
  const path = params.operations.join("/");
  const body: any = request.method === "GET" ? {} : await parseJsonBody(request, hrOperationSchema);
  const { service } = await requireHrApi(request);
  if (path === "work-locations") {
    if (request.method === "GET") return jsonResponse(await listWorkLocations(service, new URL(request.url).searchParams.get("branchId")));
    return jsonResponse(await createWorkLocation(service, body), 201);
  }
  if (path.startsWith("work-locations/")) {
    const id = params.operations[1];
    return jsonResponse(await updateWorkLocation(service, id, request.method === "DELETE" ? { isActive: false } : body));
  }
  if (path === "work-locations/assign") return jsonResponse(await assignEmployeeWorkLocation(service, body), 201);
  if (path === "calendars") return jsonResponse(request.method === "GET" ? await listCalendars(service) : await saveCalendar(service, body), request.method === "POST" ? 201 : 200);
  if (path === "calendars/copy-year") return jsonResponse(await copyHolidayYear(service, body));
  if (path === "holidays") return jsonResponse(await saveHoliday(service, body), 201);
  if (path === "schedules") return jsonResponse(request.method === "POST" ? await createSchedulePeriod(service, body) : []);
  if (path.startsWith("schedules/")) return jsonResponse(await scheduleAction(service, params.operations[1], body));
  if (path === "attendance/clock") return jsonResponse(await clock(service, body), 201);
  if (path === "attendance/days") return jsonResponse(await listAttendanceDays(service, Object.fromEntries(new URL(request.url).searchParams)));
  if (path === "attendance/adjustments") return jsonResponse(await createAttendanceAdjustment(service, body), 201);
  if (path === "leave/requests") {
    if (body.action === "approve" || body.action === "reject") return jsonResponse(await reviewLeave(service, body.id, body.action === "approve", body.reason));
    return jsonResponse(await submitLeave(service, body), 201);
  }
  if (path === "leave/balances") return jsonResponse([]);
  if (path === "leave/types") return jsonResponse([]);
  if (path === "overtime/requests") {
    if (body.action === "approve" || body.action === "reject") return jsonResponse(await reviewOvertime(service, body.id, body.action === "approve", body.reason));
    return jsonResponse(await submitOvertime(service, body), 201);
  }
  if (path === "pay-items") return jsonResponse(request.method === "GET" ? await listPayItems(service, new URL(request.url).searchParams.get("employeeId") ?? undefined) : await saveRecurringPayItem(service, body, body.id));
  if (path === "payroll/runs") return jsonResponse(request.method === "POST" ? await createPayrollRun(service, String(body.payrollPeriodId)) : []);
  if (path.startsWith("payroll/runs/")) {
    const id = params.operations[2];
    if (path.endsWith("/actions")) return jsonResponse(await payrollAction(service, id, body.action));
    return jsonResponse(await issuePayslips(service, id));
  }
  if (path === "payslips") return jsonResponse(await selfService(service, "payslips"));
  if (path === "approvals") return jsonResponse(await approvalInbox(service));
  if (path === "notifications") return jsonResponse(request.method === "POST" ? await createNotification(service, body) : await listNotifications(service));
  if (path.startsWith("notifications/")) return jsonResponse(await markNotificationRead(service, params.operations[1]));
  if (path.startsWith("reports/")) {
    const result = await report(service, params.operations[1], Object.fromEntries(new URL(request.url).searchParams));
    return new URL(request.url).searchParams.get("format") === "csv"
      ? new Response(toCsv(result.rows), { headers: { "content-type": "text/csv; charset=utf-8" } })
      : jsonResponse(result);
  }
  if (path.startsWith("me/")) return jsonResponse(await selfService(service, params.operations[1]));
  return jsonResponse({ error: { code: "NOT_FOUND", message: "ไม่พบ API ที่ต้องการ" } }, 404);
}
export async function GET(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
export async function POST(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
export async function PATCH(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
export async function DELETE(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
