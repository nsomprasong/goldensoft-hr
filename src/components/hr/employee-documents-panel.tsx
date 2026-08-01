"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import Alert from "@/components/hr/alert";
import Field, { fieldProps } from "@/components/hr/field";
import { EMPLOYEE_DOCUMENT_CATEGORIES } from "@/lib/hr/employee-document-types";
import { formatThaiDate } from "@/lib/hr/thai-date";

export type EmployeeDocumentItem = {
  id: string;
  title: string;
  categoryLabel: string;
  contentType: string;
  url: string;
  createdAt: string;
};

function DocumentPreview({
  url,
  contentType,
  title,
}: {
  url: string;
  contentType: string;
  title: string;
}) {
  if (contentType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="hr-doc-preview-media" src={url} alt={title} />
    );
  }
  if (contentType === "application/pdf") {
    return (
      <object
        className="hr-doc-preview-media hr-doc-preview-media--pdf"
        data={`${url}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        type="application/pdf"
        aria-label={`ตัวอย่าง ${title}`}
      >
        <div className="hr-doc-preview-fallback">PDF</div>
      </object>
    );
  }
  return (
    <div className="hr-doc-preview-fallback" aria-hidden="true">
      เอกสาร
    </div>
  );
}

export default function EmployeeDocumentsPanel({
  employeeId,
  documents,
  canEdit,
  disabled = false,
}: {
  employeeId: string;
  documents: EmployeeDocumentItem[];
  canEdit: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    if (!file) {
      setFeedback({ kind: "error", text: "กรุณาเลือกไฟล์" });
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", title.trim() || file.name);
      body.set("category", category);
      const response = await fetch(`/api/hr/employees/${employeeId}/documents`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        let message = "อัปโหลดไม่สำเร็จ";
        try {
          const json = (await response.json()) as {
            error?: { message?: string };
            message?: string;
          };
          message = json.error?.message ?? json.message ?? message;
        } catch {
          // keep fallback
        }
        setFeedback({ kind: "error", text: message });
        return;
      }
      setFeedback({ kind: "success", text: "แนบเอกสารเรียบร้อยแล้ว" });
      setOpen(false);
      setTitle("");
      setCategory("OTHER");
      setFile(null);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!window.confirm("ลบเอกสารนี้หรือไม่?")) return;
    setBusyId(docId);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/hr/employees/${employeeId}/documents/${docId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setFeedback({ kind: "error", text: "ลบเอกสารไม่สำเร็จ" });
        return;
      }
      setFeedback({ kind: "success", text: "ลบเอกสารแล้ว" });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <div className="hr-entity-card-top">
        <h2 id={titleId}>เอกสารประกอบ</h2>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setOpen(true)}
            disabled={disabled}
          >
            แนบเอกสาร
          </button>
        ) : null}
      </div>

      {feedback ? <Alert kind={feedback.kind}>{feedback.text}</Alert> : null}

      {documents.length === 0 ? (
        <p className="empty">ยังไม่มีเอกสารประกอบ</p>
      ) : (
        <div className="hr-card-grid">
          {documents.map((doc) => (
            <article key={doc.id} className="card hr-entity-card">
              <div className="hr-doc-preview">
                <DocumentPreview
                  url={doc.url}
                  contentType={doc.contentType}
                  title={doc.title}
                />
              </div>
              <div className="hr-entity-card-top">
                <div className="hr-entity-card-title-wrap">
                  <h3 className="hr-entity-card-title">{doc.title}</h3>
                  <p className="hr-entity-card-subtitle">{doc.categoryLabel}</p>
                </div>
              </div>
              <dl className="hr-entity-card-meta">
                <div>
                  <dt>วันที่แนบ</dt>
                  <dd>{formatThaiDate(doc.createdAt.slice(0, 10))}</dd>
                </div>
              </dl>
              <div className="hr-entity-card-actions">
                <a
                  className="btn btn-sm"
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิด
                </a>
                <a className="btn btn-sm" href={`${doc.url}?download=1`}>
                  ดาวน์โหลด
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(doc.id)}
                    disabled={disabled || busyId === doc.id}
                  >
                    {busyId === doc.id ? "กำลังลบ…" : "ลบ"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {open ? (
        <div
          className="hr-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${titleId}-upload`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !uploading) setOpen(false);
          }}
        >
          <div className="hr-overlay-panel card">
            <div className="hr-overlay-head">
              <h3 id={`${titleId}-upload`}>แนบเอกสาร</h3>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setOpen(false)}
                disabled={uploading}
              >
                ปิด
              </button>
            </div>
            <form onSubmit={handleUpload} noValidate>
              <div className="form-grid">
                <Field id="doc-title" label="ชื่อเอกสาร" required>
                  <input
                    {...fieldProps("doc-title")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น สัญญาจ้าง"
                  />
                </Field>
                <Field id="doc-category" label="ประเภทเอกสาร" required>
                  <select
                    {...fieldProps("doc-category")}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {EMPLOYEE_DOCUMENT_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="doc-file" label="ไฟล์" required full>
                  <input
                    {...fieldProps("doc-file")}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
              <p className="field-hint">
                รองรับ PDF, รูปภาพ, Word — ขนาดไม่เกิน 10 MB
              </p>
              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || disabled}
                >
                  {uploading ? "กำลังอัปโหลด…" : "บันทึกเอกสาร"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                  disabled={uploading}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
