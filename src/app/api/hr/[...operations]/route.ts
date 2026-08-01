import { jsonResponse, parseJsonBody, requireHrApi, withHrApi } from "@/lib/hr/api";
import { hrOperationSchema } from "@/lib/hr/schemas";
import {
  approvalInbox, assignEmployeeWorkLocation, clock, copyHolidayYear, createAttendanceAdjustment,
  createNotification, createPayrollRun, createSchedulePeriod, createWorkLocation, deleteCalendar, deleteHoliday, deleteSchedulePeriod, getSchedulePeriod, issuePayslips,
  assignLeaveCover, listAttendanceAdjustments, listAttendanceDays, listCalendars, listHolidayTypes, listLeaveBalances, listLeaveCoverCandidates, listLeaveRequests, listLeaveTypes, listNotifications, listOvertimeRequests, listPayItems, listSchedulePeriods, listSelfAttendanceToday, listShiftMismatchRequests, listWorkLocations,
  markAllNotificationsRead, markNotificationRead, payrollAction, report, resolveSelfEmployee, reviewAttendanceAdjustment, reviewLeave, reviewOvertime, reviewShiftMismatchRequest, saveCalendar, saveHoliday, saveRecurringPayItem, scheduleAction, seedThaiPublicHolidays, selfService, submitLeave, submitOvertime,
  toCsv, updateSchedulePeriod, updateWorkLocation,
} from "@/lib/hr/services/operations";
import {
  getPayrollRun,
  getPayslip,
  listOrgPayslips,
  listPayrollRuns,
  listSelfPayslips,
} from "@/lib/hr/services/payroll-runs";
import {
  getPayrollDeductionSettings,
  upsertAttendancePaySettings,
  upsertPayrollDeductionSettings,
} from "@/lib/hr/services/payroll-deduction-settings";
import {
  clearMyFaceEnrollment,
  enrollMyFace,
  getAttendanceFaceSettings,
  getSelfFaceMatchStatus,
  upsertAttendanceFaceSettings,
} from "@/lib/hr/services/face-matching";
import {
  attachAdvanceTransferSlip,
  cancelSalaryAdvance,
  listAdvancePeriodOptions,
  listMySalaryAdvances,
  listPendingSalaryAdvances,
  listSalaryAdvances,
  reviewSalaryAdvance,
  submitSalaryAdvance,
} from "@/lib/hr/services/salary-advances";
export const dynamic = "force-dynamic";
type Params = { operations: string[] };

async function slipFromForm(
  form: FormData,
): Promise<{ buffer: Buffer; originalName: string; contentType: string | null } | null> {
  const file = form.get("transferSlip") ?? form.get("file");
  if (!(file instanceof File) || file.size <= 0) return null;
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    originalName: file.name || "transfer-slip.jpg",
    contentType: file.type || null,
  };
}

async function dispatch(request: Request, params: Params): Promise<Response> {
  const path = params.operations.join("/");
  const contentType = request.headers.get("content-type") ?? "";
  const isAdvanceMultipart =
    contentType.includes("multipart/form-data") &&
    (path === "advances" || path.startsWith("advances/"));

  let body: any = {};
  let transferSlip: Awaited<ReturnType<typeof slipFromForm>> = null;
  if (request.method !== "GET" && request.method !== "DELETE") {
    if (isAdvanceMultipart) {
      const form = await request.formData();
      const autoRaw = String(form.get("autoApprove") ?? "");
      body = {
        action: String(form.get("action") ?? "") || undefined,
        employeeId: String(form.get("employeeId") ?? "") || undefined,
        amount: form.get("amount") != null && String(form.get("amount")) !== ""
          ? Number(form.get("amount"))
          : undefined,
        advanceDate: String(form.get("advanceDate") ?? "") || undefined,
        reason: String(form.get("reason") ?? "") || undefined,
        installmentCount:
          form.get("installmentCount") != null &&
          String(form.get("installmentCount")) !== ""
            ? Number(form.get("installmentCount"))
            : undefined,
        startPayrollPeriodId:
          String(form.get("startPayrollPeriodId") ?? "") || undefined,
        disbursementMode: String(form.get("disbursementMode") ?? "") || undefined,
        autoApprove: autoRaw === "true" || autoRaw === "1",
        reviewNote: String(form.get("reviewNote") ?? "") || undefined,
      };
      transferSlip = await slipFromForm(form);
    } else {
      body = await parseJsonBody(request, hrOperationSchema);
    }
  }
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
  if (path === "calendars") {
    if (request.method === "GET") return jsonResponse(await listCalendars(service));
    return jsonResponse(await saveCalendar(service, body), 201);
  }
  if (path === "calendars/copy-year") {
    return jsonResponse(await copyHolidayYear(service, body));
  }
  if (path === "holiday-types") {
    return jsonResponse(await listHolidayTypes(service));
  }
  if (path.startsWith("calendars/")) {
    const id = params.operations[1];
    if (params.operations[2] === "seed-thai-holidays" && request.method === "POST") {
      return jsonResponse(await seedThaiPublicHolidays(service, id, body));
    }
    if (request.method === "PATCH") {
      return jsonResponse(await saveCalendar(service, body, id));
    }
    if (request.method === "DELETE") {
      return jsonResponse(await deleteCalendar(service, id));
    }
  }
  if (path === "holidays") {
    return jsonResponse(await saveHoliday(service, body), 201);
  }
  if (path.startsWith("holidays/")) {
    const id = params.operations[1];
    if (request.method === "DELETE") {
      return jsonResponse(await deleteHoliday(service, id));
    }
  }
  if (path === "schedules") {
    if (request.method === "GET") {
      return jsonResponse(
        await listSchedulePeriods(service, {
          branchId: new URL(request.url).searchParams.get("branchId"),
        }),
      );
    }
    return jsonResponse(await createSchedulePeriod(service, body), 201);
  }
  if (path.startsWith("schedules/")) {
    const id = params.operations[1];
    if (request.method === "GET") {
      return jsonResponse(await getSchedulePeriod(service, id));
    }
    if (request.method === "PATCH") {
      return jsonResponse(await updateSchedulePeriod(service, id, body));
    }
    if (request.method === "DELETE") {
      return jsonResponse(await deleteSchedulePeriod(service, id));
    }
    return jsonResponse(await scheduleAction(service, id, body));
  }
  if (path === "attendance/clock") {
    if (request.method === "GET") {
      const [data, faceMatching] = await Promise.all([
        listSelfAttendanceToday(service),
        getSelfFaceMatchStatus(service),
      ]);
      return jsonResponse({ ...data, faceMatching });
    }
    return jsonResponse(await clock(service, body), 201);
  }
  if (path === "attendance/face-settings") {
    if (request.method === "GET") {
      return jsonResponse(await getAttendanceFaceSettings(service));
    }
    return jsonResponse(await upsertAttendanceFaceSettings(service, body));
  }
  if (path === "me/face") {
    if (request.method === "GET") {
      return jsonResponse(await getSelfFaceMatchStatus(service));
    }
    if (request.method === "DELETE") {
      return jsonResponse(await clearMyFaceEnrollment(service));
    }
    return jsonResponse(await enrollMyFace(service, body), 201);
  }
  if (path === "attendance/days") return jsonResponse(await listAttendanceDays(service, Object.fromEntries(new URL(request.url).searchParams)));
  if (path === "attendance/adjustments") {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const scopeRaw = params.get("scope");
      return jsonResponse(
        await listAttendanceAdjustments(service, {
          status: params.get("status"),
          scope: scopeRaw === "self" || scopeRaw === "org" ? scopeRaw : null,
        }),
      );
    }
    if (body.action === "approve" || body.action === "reject") {
      return jsonResponse(
        await reviewAttendanceAdjustment(
          service,
          body.id,
          body.action === "approve",
          body.reason,
        ),
      );
    }
    return jsonResponse(await createAttendanceAdjustment(service, body), 201);
  }
  if (path === "attendance/shift-mismatches") {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      return jsonResponse(
        await listShiftMismatchRequests(service, {
          status: params.get("status"),
        }),
      );
    }
    if (body.action === "approve" || body.action === "reject") {
      return jsonResponse(
        await reviewShiftMismatchRequest(
          service,
          body.id,
          body.action === "approve",
          body.reason,
        ),
      );
    }
    return jsonResponse(
      { error: { message: "รองรับเฉพาะ approve / reject" } },
      400,
    );
  }
  if (path === "leave/requests") {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const scopeRaw = params.get("scope");
      const viewRaw = params.get("view");
      return jsonResponse(
        await listLeaveRequests(service, {
          status: params.get("status"),
          scope: scopeRaw === "self" || scopeRaw === "org" ? scopeRaw : null,
          view:
            viewRaw === "inbox" || viewRaw === "all" ? viewRaw : null,
        }),
      );
    }
    if (body.action === "assignCover") {
      return jsonResponse(await assignLeaveCover(service, body));
    }
    if (body.action === "approve" || body.action === "reject") {
      return jsonResponse(
        await reviewLeave(
          service,
          body.id,
          body.action === "approve",
          body.reason,
          body.coverEmployeeId,
        ),
      );
    }
    return jsonResponse(await submitLeave(service, body), 201);
  }
  if (path === "leave/balances") {
    return jsonResponse(
      await listLeaveBalances(
        service,
        new URL(request.url).searchParams.get("employeeId") ?? undefined,
      ),
    );
  }
  if (path === "leave/cover-candidates") {
    const leaveRequestId =
      new URL(request.url).searchParams.get("leaveRequestId") ?? "";
    return jsonResponse(
      await listLeaveCoverCandidates(service, { leaveRequestId }),
    );
  }
  if (path === "leave/types") return jsonResponse(await listLeaveTypes(service));
  if (path === "leave/entitlements") {
    const {
      listLeaveEntitlementSettings,
      upsertLeaveEntitlement,
    } = await import("@/lib/hr/services/leave-entitlements");
    if (request.method === "GET") {
      return jsonResponse(await listLeaveEntitlementSettings(service));
    }
    return jsonResponse(await upsertLeaveEntitlement(service, body));
  }
  if (path === "leave/balances/self") {
    const { listSelfLeaveBalances } = await import(
      "@/lib/hr/services/leave-entitlements"
    );
    return jsonResponse(await listSelfLeaveBalances(service));
  }
  if (path === "overtime/requests") {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const scopeRaw = params.get("scope");
      const viewRaw = params.get("view");
      return jsonResponse(
        await listOvertimeRequests(service, {
          status: params.get("status"),
          scope: scopeRaw === "self" || scopeRaw === "org" ? scopeRaw : null,
          view:
            viewRaw === "inbox" || viewRaw === "all" ? viewRaw : null,
        }),
      );
    }
    if (body.action === "approve" || body.action === "reject") {
      return jsonResponse(
        await reviewOvertime(
          service,
          body.id,
          body.action === "approve",
          body.reason,
        ),
      );
    }
    return jsonResponse(await submitOvertime(service, body), 201);
  }
  if (path === "pay-items") return jsonResponse(request.method === "GET" ? await listPayItems(service, new URL(request.url).searchParams.get("employeeId") ?? undefined) : await saveRecurringPayItem(service, body, body.id));
  if (path === "advances/period-options") {
    return jsonResponse(await listAdvancePeriodOptions(service));
  }
  if (path === "advances/me") {
    if (request.method === "GET") {
      const self = await resolveSelfEmployee(service);
      if (!self) {
        return jsonResponse(
          { error: { code: "NOT_FOUND", message: "ไม่พบบัญชีพนักงาน" } },
          404,
        );
      }
      return jsonResponse(await listMySalaryAdvances(service, self.id));
    }
    return jsonResponse(
      await submitSalaryAdvance(service, body, { selfOnly: true }),
      201,
    );
  }
  if (path === "advances/pending") {
    return jsonResponse(await listPendingSalaryAdvances(service));
  }
  if (path === "advances") {
    if (request.method === "GET") return jsonResponse(await listSalaryAdvances(service));
    return jsonResponse(
      await submitSalaryAdvance(service, {
        ...body,
        autoApprove: body.autoApprove ?? false,
        transferSlip: transferSlip ?? undefined,
      }),
      201,
    );
  }
  if (path.startsWith("advances/") && request.method === "POST") {
    const advanceId = params.operations[1];
    if (path.endsWith("/cancel")) {
      return jsonResponse(await cancelSalaryAdvance(service, advanceId));
    }
    if (path.endsWith("/slip")) {
      if (!transferSlip) {
        return jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "กรุณาแนบสลิปโอนเงิน",
            },
          },
          400,
        );
      }
      return jsonResponse(
        await attachAdvanceTransferSlip(service, advanceId, transferSlip),
      );
    }
    if (path.endsWith("/review") || body.action === "approve" || body.action === "reject") {
      return jsonResponse(
        await reviewSalaryAdvance(
          service,
          advanceId,
          body.action === "approve" || path.endsWith("/approve"),
          {
            ...body,
            transferSlip: transferSlip ?? undefined,
          },
        ),
      );
    }
  }
  if (path === "payroll/deduction-settings") {
    if (request.method === "GET") return jsonResponse(await getPayrollDeductionSettings(service));
    return jsonResponse(await upsertPayrollDeductionSettings(service, body));
  }
  if (path === "payroll/attendance-pay-settings") {
    if (request.method === "GET") return jsonResponse(await getPayrollDeductionSettings(service));
    return jsonResponse(await upsertAttendancePaySettings(service, body));
  }
  if (path === "payroll/runs") {
    if (request.method === "GET") return jsonResponse(await listPayrollRuns(service));
    return jsonResponse(await createPayrollRun(service, String(body.payrollPeriodId)), 201);
  }
  if (path.startsWith("payroll/runs/")) {
    const id = params.operations[2];
    if (path.endsWith("/actions")) return jsonResponse(await payrollAction(service, id, String(body.action)));
    if (path.endsWith("/issue") || (request.method === "POST" && !path.endsWith("/actions"))) {
      return jsonResponse(await issuePayslips(service, id));
    }
    if (request.method === "GET") return jsonResponse(await getPayrollRun(service, id));
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "ไม่รองรับคำขอนี้" } }, 405);
  }
  if (path === "payslips") {
    if (request.method === "GET") return jsonResponse(await listOrgPayslips(service));
  }
  if (path === "payslips/self") return jsonResponse(await listSelfPayslips(service));
  if (path.startsWith("payslips/") && params.operations[1] !== "self") {
    return jsonResponse(await getPayslip(service, params.operations[1]));
  }
  if (path === "approvals") return jsonResponse(await approvalInbox(service));
  if (path === "notifications") {
    if (request.method === "POST") {
      return jsonResponse(await createNotification(service, body));
    }
    const search = new URL(request.url).searchParams;
    return jsonResponse(
      await listNotifications(service, {
        unreadOnly: search.get("unreadOnly") === "1" || search.get("unreadOnly") === "true",
        limit: Number(search.get("limit") || 40) || 40,
      }),
    );
  }
  if (path === "notifications/mark-all-read") {
    if (request.method !== "POST") {
      return jsonResponse(
        { error: { code: "METHOD_NOT_ALLOWED", message: "ใช้ POST" } },
        405,
      );
    }
    return jsonResponse(await markAllNotificationsRead(service));
  }
  if (path.startsWith("notifications/")) {
    const id = params.operations[1];
    if (!id || id === "mark-all-read") {
      return jsonResponse(
        { error: { code: "NOT_FOUND", message: "ไม่พบการแจ้งเตือน" } },
        404,
      );
    }
    return jsonResponse(await markNotificationRead(service, id));
  }
  if (path.startsWith("reports/")) {
    const result = await report(
      service,
      params.operations[1],
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const wantCsv = new URL(request.url).searchParams.get("format") === "csv";
    if (wantCsv && result && typeof result === "object" && "rows" in result) {
      return new Response(toCsv((result as { rows: Record<string, unknown>[] }).rows), {
        headers: { "content-type": "text/csv; charset=utf-8" },
      });
    }
    return jsonResponse(result);
  }
  if (path.startsWith("me/")) return jsonResponse(await selfService(service, params.operations[1]));
  return jsonResponse({ error: { code: "NOT_FOUND", message: "ไม่พบ API ที่ต้องการ" } }, 404);
}
export async function GET(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
export async function POST(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
export async function PATCH(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
export async function DELETE(request: Request, context: { params: Promise<Params> }) { return withHrApi(async () => dispatch(request, await context.params)); }
