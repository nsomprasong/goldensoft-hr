/**
 * Persistence contract for HR domain services.
 *
 * Services never touch Prisma directly. Two implementations satisfy this
 * interface: `prisma-repository` for runtime and `memory-repository` for tests,
 * which is what keeps the domain suite free of a live database.
 */

export const HR_MASTER_KINDS = [
  "employmentType",
  "employeeStatus",
  "shiftType",
  "payFrequency",
  "wageType",
  "overtimeRateType",
  "payrollPeriodStatus",
  "auditActionType",
] as const;

export type HrMasterKind = (typeof HR_MASTER_KINDS)[number];

export type MasterRecord = {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
};

export type MasterUpsertInput = {
  code: string;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
};

export type ListResult<T> = { rows: T[]; total: number };

export type Pagination = { skip: number; take: number };

// ─── Structure ────────────────────────────────────────────────────────────

export type DepartmentRecord = {
  id: string;
  organizationId: string;
  code: string;
  nameTh: string;
  nameEn: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type DepartmentCreateInput = Omit<
  DepartmentRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type DepartmentPatch = Partial<
  Pick<DepartmentRecord, "nameTh" | "nameEn" | "description" | "isActive">
>;

export type PositionRecord = DepartmentRecord & {
  departmentId: string | null;
};

export type PositionCreateInput = Omit<
  PositionRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type PositionPatch = DepartmentPatch & {
  departmentId?: string | null;
};

// ─── Employee ─────────────────────────────────────────────────────────────

export type EmployeeRecord = {
  id: string;
  organizationId: string;
  employeeCode: string;
  platformUserId: string | null;
  authUserId: string | null;
  branchId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentTypeId: string;
  employeeStatusId: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string | null;
  lastNameEn: string | null;
  displayName: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  hireDate: Date;
  probationEndDate: Date | null;
  resignationDate: Date | null;
  terminatedAt: Date | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type EmployeeCreateInput = Omit<
  EmployeeRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type EmployeePatch = Partial<
  Omit<EmployeeRecord, "id" | "organizationId" | "createdAt" | "createdBy">
>;

export type EmployeeListFilter = Pagination & {
  organizationId: string;
  /** Null means no branch restriction beyond the organization. */
  branchIds?: readonly string[] | null;
  branchId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  employmentTypeId?: string | null;
  employeeStatusId?: string | null;
  isActive?: boolean | null;
  search?: string | null;
};

export type EmployeeActiveCounts = {
  total: number;
  byBranchId: Record<string, number>;
  byEmploymentTypeId: Record<string, number>;
};

// ─── Compensation ─────────────────────────────────────────────────────────

export type CompensationRecord = {
  id: string;
  employeeId: string;
  wageTypeId: string;
  amount: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  standardHoursPerDay: number | null;
  standardDaysPerMonth: number | null;
  overtimeEligible: boolean;
  isCurrent: boolean;
  createdBy: string;
  createdAt: Date;
};

export type CompensationCreateInput = Omit<
  CompensationRecord,
  "id" | "createdAt"
>;

export type CompensationPatch = Partial<
  Pick<
    CompensationRecord,
    | "wageTypeId"
    | "amount"
    | "currency"
    | "effectiveFrom"
    | "effectiveTo"
    | "standardHoursPerDay"
    | "standardDaysPerMonth"
    | "overtimeEligible"
    | "isCurrent"
  >
>;

// ─── Overtime ─────────────────────────────────────────────────────────────

export type OvertimeRuleRecord = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  rateTypeId: string;
  multiplier: number;
  fixedAmount: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type OvertimeRuleCreateInput = Omit<
  OvertimeRuleRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type OvertimeRulePatch = Partial<
  Omit<
    OvertimeRuleRecord,
    "id" | "organizationId" | "code" | "createdAt" | "updatedAt"
  >
>;

// ─── Shift ────────────────────────────────────────────────────────────────

export type ShiftRecord = {
  id: string;
  organizationId: string;
  branchId: string | null;
  code: string;
  name: string;
  shiftTypeId: string;
  /** Minutes from midnight; the repository maps this to PostgreSQL `time`. */
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
  graceLateMinutes: number;
  graceEarlyLeaveMinutes: number;
  crossesMidnight: boolean;
  standardWorkMinutes: number;
  overtimeAfterMinutes: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ShiftCreateInput = Omit<ShiftRecord, "id" | "createdAt" | "updatedAt">;

export type ShiftPatch = Partial<
  Omit<ShiftRecord, "id" | "organizationId" | "code" | "createdAt" | "updatedAt">
>;

// ─── Payroll ──────────────────────────────────────────────────────────────

export type PayrollScheduleRecord = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  payFrequencyId: string;
  periodStartRule: string;
  periodEndRule: string;
  paymentDayRule: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollScheduleCreateInput = Omit<
  PayrollScheduleRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type PayrollSchedulePatch = Partial<
  Omit<
    PayrollScheduleRecord,
    "id" | "organizationId" | "code" | "createdAt" | "updatedAt"
  >
>;

export type PayrollPeriodRecord = {
  id: string;
  organizationId: string;
  payrollScheduleId: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  statusId: string;
  lockedAt: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollPeriodCreateInput = Omit<
  PayrollPeriodRecord,
  "id" | "createdAt" | "updatedAt"
>;

export type PayrollPeriodPatch = Partial<
  Pick<
    PayrollPeriodRecord,
    "statusId" | "paymentDate" | "lockedAt" | "lockedBy"
  >
>;

export type PayrollPeriodListFilter = Pagination & {
  organizationId: string;
  payrollScheduleId?: string | null;
  statusIds?: readonly string[] | null;
};

// ─── Audit ────────────────────────────────────────────────────────────────

export type AuditLogRecord = {
  id: string;
  organizationId: string | null;
  branchId: string | null;
  actorAuthUserId: string | null;
  actionTypeId: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type AuditLogCreateInput = Omit<AuditLogRecord, "id" | "createdAt">;

// ─── Repository ───────────────────────────────────────────────────────────

export type MasterRepository = {
  list(
    kind: HrMasterKind,
    options?: { activeOnly?: boolean },
  ): Promise<MasterRecord[]>;
  findById(kind: HrMasterKind, id: string): Promise<MasterRecord | null>;
  findByCode(kind: HrMasterKind, code: string): Promise<MasterRecord | null>;
  /** Idempotent by `code`; never rewrites an existing code. */
  upsert(
    kind: HrMasterKind,
    row: MasterUpsertInput,
  ): Promise<{ record: MasterRecord; created: boolean }>;
};

export type DepartmentRepository = {
  list(input: {
    organizationId: string;
    isActive?: boolean | null;
    search?: string | null;
  } & Pagination): Promise<ListResult<DepartmentRecord>>;
  findById(organizationId: string, id: string): Promise<DepartmentRecord | null>;
  findByCode(
    organizationId: string,
    code: string,
  ): Promise<DepartmentRecord | null>;
  create(input: DepartmentCreateInput): Promise<DepartmentRecord>;
  update(id: string, patch: DepartmentPatch): Promise<DepartmentRecord>;
};

export type PositionRepository = {
  list(input: {
    organizationId: string;
    departmentId?: string | null;
    isActive?: boolean | null;
    search?: string | null;
  } & Pagination): Promise<ListResult<PositionRecord>>;
  findById(organizationId: string, id: string): Promise<PositionRecord | null>;
  findByCode(
    organizationId: string,
    code: string,
  ): Promise<PositionRecord | null>;
  create(input: PositionCreateInput): Promise<PositionRecord>;
  update(id: string, patch: PositionPatch): Promise<PositionRecord>;
};

export type EmployeeRepository = {
  list(filter: EmployeeListFilter): Promise<ListResult<EmployeeRecord>>;
  findById(organizationId: string, id: string): Promise<EmployeeRecord | null>;
  /** Cross-tenant lookup used only to detect and refuse cross-org links. */
  findByIdAnyOrganization(id: string): Promise<EmployeeRecord | null>;
  findByCode(
    organizationId: string,
    employeeCode: string,
  ): Promise<EmployeeRecord | null>;
  findByPlatformUserId(
    organizationId: string,
    platformUserId: string,
  ): Promise<EmployeeRecord | null>;
  create(input: EmployeeCreateInput): Promise<EmployeeRecord>;
  update(id: string, patch: EmployeePatch): Promise<EmployeeRecord>;
  countActive(organizationId: string): Promise<EmployeeActiveCounts>;
};

export type CompensationRepository = {
  listByEmployee(employeeId: string): Promise<CompensationRecord[]>;
  findCurrent(employeeId: string): Promise<CompensationRecord | null>;
  create(input: CompensationCreateInput): Promise<CompensationRecord>;
  update(id: string, patch: CompensationPatch): Promise<CompensationRecord>;
};

export type OvertimeRuleRepository = {
  list(input: {
    organizationId: string;
    rateTypeId?: string | null;
    isActive?: boolean | null;
    search?: string | null;
  } & Pagination): Promise<ListResult<OvertimeRuleRecord>>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<OvertimeRuleRecord | null>;
  findByCode(
    organizationId: string,
    code: string,
  ): Promise<OvertimeRuleRecord | null>;
  create(input: OvertimeRuleCreateInput): Promise<OvertimeRuleRecord>;
  update(id: string, patch: OvertimeRulePatch): Promise<OvertimeRuleRecord>;
};

export type ShiftRepository = {
  list(input: {
    organizationId: string;
    branchIds?: readonly string[] | null;
    isActive?: boolean | null;
    search?: string | null;
  } & Pagination): Promise<ListResult<ShiftRecord>>;
  findById(organizationId: string, id: string): Promise<ShiftRecord | null>;
  findByCode(organizationId: string, code: string): Promise<ShiftRecord | null>;
  create(input: ShiftCreateInput): Promise<ShiftRecord>;
  update(id: string, patch: ShiftPatch): Promise<ShiftRecord>;
  countActive(organizationId: string): Promise<number>;
};

export type PayrollScheduleRepository = {
  list(input: {
    organizationId: string;
    isActive?: boolean | null;
  } & Pagination): Promise<ListResult<PayrollScheduleRecord>>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<PayrollScheduleRecord | null>;
  findByCode(
    organizationId: string,
    code: string,
  ): Promise<PayrollScheduleRecord | null>;
  create(input: PayrollScheduleCreateInput): Promise<PayrollScheduleRecord>;
  update(
    id: string,
    patch: PayrollSchedulePatch,
  ): Promise<PayrollScheduleRecord>;
};

export type PayrollPeriodRepository = {
  list(
    filter: PayrollPeriodListFilter,
  ): Promise<ListResult<PayrollPeriodRecord>>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<PayrollPeriodRecord | null>;
  findByRange(input: {
    organizationId: string;
    payrollScheduleId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<PayrollPeriodRecord | null>;
  create(input: PayrollPeriodCreateInput): Promise<PayrollPeriodRecord>;
  update(id: string, patch: PayrollPeriodPatch): Promise<PayrollPeriodRecord>;
};

export type AuditRepository = {
  create(input: AuditLogCreateInput): Promise<AuditLogRecord>;
  listByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLogRecord[]>;
};

export type HrRepository = {
  masters: MasterRepository;
  departments: DepartmentRepository;
  positions: PositionRepository;
  employees: EmployeeRepository;
  compensations: CompensationRepository;
  overtimeRules: OvertimeRuleRepository;
  shifts: ShiftRepository;
  payrollSchedules: PayrollScheduleRepository;
  payrollPeriods: PayrollPeriodRepository;
  audit: AuditRepository;
};
