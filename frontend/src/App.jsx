import { useState, useRef, useEffect } from "react";
import "./App.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faFileLines,
  faPaperclip,
  faWandMagicSparkles,
  faCopy,
  faPaperPlane,
  faDownload,
  faCheck,
  faXmark,
  faTriangleExclamation,
  faPen,
  faBolt,
  faChevronDown,
  faClockRotateLeft,
} from "@fortawesome/free-solid-svg-icons";


function loadScript(src, globalKey) {
  return new Promise((resolve, reject) => {
    if (window[globalKey]) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function downloadTxt(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".txt";
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(text, filename) {
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "jspdf"
  );
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 60;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lineHeight = 15;
  const lines = doc.splitTextToSize(text, maxWidth);
  let y = margin;
  lines.forEach((line) => {
    if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  });
  doc.save(filename + ".pdf");
}

async function downloadDocx(text, filename) {
  await loadScript("https://unpkg.com/docx@8.5.0/build/index.umd.js", "docx");
  const { Document, Packer, Paragraph, TextRun } = window.docx;
  const paragraphs = text.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, font: "Arial", size: 24 })],
        spacing: { after: line.trim() === "" ? 0 : 160 },
      })
  );
  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: paragraphs,
      },
    ],
  });
  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".docx";
  a.click();
  URL.revokeObjectURL(url);
}

function openMailto({ to, subject, body }) {
  const MAX = 1800;
  const safeBody =
    body.length > MAX
      ? body.slice(0, MAX) +
      "\n\n[Full text truncated — paste from the editor above]"
      : body;
  const uri =
    "mailto:" +
    encodeURIComponent(to) +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(safeBody);
  window.location.href = uri;
}

function stripEmailHeaders(text) {
  const lines = text.split("\n");
  const headerRe = /^(subject|to|from|cc|bcc|date)\s*:/i;
  let i = 0;
  while (
    i < lines.length &&
    (headerRe.test(lines[i]) || (i > 0 && lines[i].trim() === ""))
  ) {
    if (lines[i].trim() === "" && i === 0) break;
    i++;
  }
  return lines
    .slice(i)
    .join("\n")
    .replace(/^\s*\n+/, "");
}


const LS_ROLES_KEY = "job_app_recent_roles";
const LS_RESUME_KEY = "job_app_resume";

function loadRecentRoles() {
  try {
    const raw = localStorage.getItem(LS_ROLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentRole(role) {
  if (!role.trim()) return;
  const existing = loadRecentRoles().filter(
    (r) => r.toLowerCase() !== role.trim().toLowerCase()
  );
  existing.unshift(role.trim());
  localStorage.setItem(LS_ROLES_KEY, JSON.stringify(existing.slice(0, 5)));
}

function saveResumeToStorage(name, base64, type) {
  try {
    localStorage.setItem(LS_RESUME_KEY, JSON.stringify({ name, base64, type }));
  } catch (e) {
    console.warn("Could not save resume to localStorage:", e);
  }
}

function loadResumeFromStorage() {
  try {
    const raw = localStorage.getItem(LS_RESUME_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearResumeFromStorage() {
  localStorage.removeItem(LS_RESUME_KEY);
}

function base64ToFile(base64, name, type) {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new File([ab], name, { type });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const API_BASE = "http://127.0.0.1:5000";


function RoleCombobox({ value, onChange, recentRoles }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  const options =
    value.trim() === ""
      ? recentRoles
      : recentRoles.filter(
        (r) =>
          r.toLowerCase().includes(value.toLowerCase()) &&
          r.toLowerCase() !== value.trim().toLowerCase()
      );

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        setActiveIdx(-1);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pick(options[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const toggleOpen = (e) => {
    e.preventDefault();
    setOpen((prev) => !prev);
    setActiveIdx(-1);
  };

  return (
    <div className="combo-wrap" ref={wrapRef}>
      <div className={`combo-row${open ? " combo-focused" : ""}`}>
        <input
          className="combo-input"
          type="text"
          placeholder="e.g. Frontend Engineer"
          value={value}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            setActiveIdx(-1);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          className={`combo-chevron${open ? " combo-chevron-open" : ""}`}
          onMouseDown={toggleOpen}
          type="button"
          aria-label="Toggle role suggestions"
          tabIndex={-1}
        >
          <FontAwesomeIcon icon={faChevronDown} />
        </button>
      </div>

      {open && (
        <div className="combo-dropdown" role="listbox">
          {options.length === 0 ? (
            <div className="combo-empty">
              No recent matches — just type your role
            </div>
          ) : (
            <>
              <div className="combo-group-label">
                {value.trim() === "" ? "Recent roles" : "Suggestions"}
              </div>
              {options.map((r, i) => (
                <div
                  key={r}
                  className={`combo-option${i === activeIdx ? " combo-option-active" : ""}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <FontAwesomeIcon
                    icon={faClockRotateLeft}
                    className="combo-option-icon"
                  />
                  <span>{r}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [file, setFile] = useState(() => {
    const stored = loadResumeFromStorage();
    if (!stored) return null;
    try {
      return base64ToFile(stored.base64, stored.name, stored.type);
    } catch {
      clearResumeFromStorage();
      return null;
    }
  });

  const [savedMeta, setSavedMeta] = useState(() => {
    const stored = loadResumeFromStorage();
    return stored ? { name: stored.name } : null;
  });

  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [contentType, setContentType] = useState("email");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dlLoading, setDlLoading] = useState("");
  const [drag, setDrag] = useState(false);
  const [sendState, setSendState] = useState("idle");
  const [recentRoles, setRecentRoles] = useState(() => loadRecentRoles());

  const fileRef = useRef();

  const hasResume = !!file;
  const steps = [hasResume, !!role.trim(), !!email.trim()];
  const ready = steps.every(Boolean);
  const isCover = contentType === "cover_letter";

  const handleNewFile = async (f) => {
    if (!f) return;
    setFile(f);
    setSavedMeta({ name: f.name });
    try {
      const base64 = await fileToBase64(f);
      saveResumeToStorage(f.name, base64, f.type);
    } catch (e) {
      console.warn("Could not persist resume:", e);
    }
  };

  const handleRemoveFile = (evt) => {
    evt?.stopPropagation();
    setFile(null);
    setSavedMeta(null);
    clearResumeFromStorage();
  };

  const generate = async () => {
    if (!ready) return;
    setLoading(true);
    setError("");
    setOutput("");
    setSendState("idle");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      fd.append("job_role", role);
      fd.append("company_name", company);
      fd.append("recruiter_email", email);
      fd.append("content_type", contentType);

      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);

      setOutput(stripEmailHeaders(d.email));
      saveRecentRole(role);
      setRecentRoles(loadRecentRoles());
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!output) return;
    const subject = `${isCover ? "Cover Letter" : "Application"} for ${role}${company ? ` at ${company}` : ""}`;
    openMailto({ to: email, subject, body: output });
    setSendState("opened");
    setTimeout(() => setSendState("idle"), 6000);
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const filename = `${isCover ? "cover-letter" : "email"}-${role.replace(/\s+/g, "-").toLowerCase() || "job"
    }`;

  const handleDownload = async (fmt) => {
    if (!output || dlLoading) return;
    setDlLoading(fmt);
    try {
      if (fmt === "txt") downloadTxt(output, filename);
      else if (fmt === "pdf") await downloadPdf(output, filename);
      else if (fmt === "docx") await downloadDocx(output, filename);
    } catch (e) {
      alert("Download failed: " + (e.message || e));
    } finally {
      setDlLoading("");
    }
  };

  return (
    <>
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="page">
        {/* ── Header ── */}
        <header className="header">
          <div className="pill">
            <FontAwesomeIcon icon={faBolt} />
            AI-Powered
          </div>
          <h1>
            Job Application
            <br />
            <span className="grad">Email Generator</span>
          </h1>
          <p className="sub">
            Upload your résumé, describe the role, and get a perfectly crafted
            cold email or cover letter — in seconds.
          </p>
        </header>

        {/* ── Content Type Toggle ── */}
        <div className="type-toggle">
          <button
            className={`toggle-btn${!isCover ? " active-email" : ""}`}
            onClick={() => setContentType("email")}
          >
            <FontAwesomeIcon icon={faEnvelope} />
            Cold Email
          </button>
          <button
            className={`toggle-btn${isCover ? " active-cover" : ""}`}
            onClick={() => setContentType("cover_letter")}
          >
            <FontAwesomeIcon icon={faFileLines} />
            Cover Letter
          </button>
        </div>

        {/* ── Main grid ── */}
        <div className="main">

          {/* ── Resume Upload ── */}
          <div className="card tall" style={{ gridRow: "span 2" }}>
            <div className="card-label">
              <span className="num">1</span> Resume
            </div>

            {savedMeta && (
              <div className="saved-banner">
                <div className="saved-banner-left">
                  <span className="saved-dot" />
                  <span className="saved-name" title={savedMeta.name}>
                    {savedMeta.name}
                  </span>
                </div>
                <span className="saved-label">Saved ✓</span>
              </div>
            )}

            <div
              className={`drop${drag ? " over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                handleNewFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleNewFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <div className="drop-icon">
                    <FontAwesomeIcon icon={faFileLines} />
                  </div>
                  <div className="file-chip">
                    <span>{file.name}</span>
                    <button className="chip-x" onClick={handleRemoveFile}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                  <span className="replace-hint">Click to replace</span>
                </>
              ) : (
                <>
                  <div className="drop-icon">
                    <FontAwesomeIcon icon={faPaperclip} />
                  </div>
                  <div className="drop-title">Drop your résumé</div>
                  <div className="drop-hint">PDF · DOC · DOCX</div>
                  <div className="drop-hint" style={{ fontSize: 11 }}>
                    or click to browse
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Job Details ── */}
          <div className="card">
            <div className="card-label">
              <span className="num">2</span> Job Details
            </div>

            {/* Role — combobox */}
            <div className="field">
              <label>
                Job Role <span className="req">*</span>
              </label>
              <RoleCombobox
                value={role}
                onChange={setRole}
                recentRoles={recentRoles}
              />
            </div>

            <div className="field">
              <label>
                Company <span className="opt">(optional)</span>
              </label>
              <input
                className="inp"
                type="text"
                placeholder="e.g. Stripe, Figma…"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="field">
              <label>
                Recruiter Email <span className="req">*</span>
              </label>
              <div className="inp-wrap">
                <span className="inp-ico">
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  className="inp"
                  type="email"
                  placeholder="hiring@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="cta-card">
            <div className="progress-steps">
              {["Resume", "Role", "Email"].map((l, i) => (
                <div
                  key={l}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flex: i < 2 ? "1" : "initial",
                  }}
                >
                  <span className={`step-dot${steps[i] ? " done" : ""}`} />
                  <span
                    style={{
                      fontSize: 11,
                      color: steps[i] ? "var(--teal)" : "var(--sub)",
                      fontWeight: 500,
                    }}
                  >
                    {l}
                  </span>
                  {i < 2 && <div className="step-sep" />}
                </div>
              ))}
            </div>

            <button
              className="btn-gen"
              onClick={generate}
              disabled={!ready || loading}
            >
              {loading ? (
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div className="spin" />
                  Generating…
                </div>
              ) : (
                <span style={{ position: "relative", zIndex: 1 }}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  Generate {isCover ? "Cover Letter" : "Email"}
                </span>
              )}
            </button>

            <p className="hint-text">
              {ready ? (
                <>
                  <strong>Ready!</strong> Hit the button to craft your{" "}
                  {isCover ? "cover letter" : "email"}.
                </>
              ) : (
                <>
                  Complete the{" "}
                  <strong>
                    {3 - steps.filter(Boolean).length} remaining
                  </strong>{" "}
                  step
                  {3 - steps.filter(Boolean).length !== 1 ? "s" : ""} above.
                </>
              )}
            </p>
          </div>

          {error && (
            <div className="err full">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              {error}
            </div>
          )}
        </div>

        {/* ── Output ── */}
        {output && (
          <div className="out-wrap">
            <div className="out-card">
              <div className="out-head">
                <span className="out-label">
                  {isCover ? "Generated Cover Letter" : "Generated Email"}
                </span>
                <div className="out-btns">
                  <button
                    className={`btn-s${copied ? " ok" : ""}`}
                    onClick={copy}
                  >
                    <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                    {copied ? " Copied!" : " Copy"}
                  </button>

                  <button
                    className={`btn-s send-resume${sendState === "opened" ? " ok" : ""}`}
                    onClick={handleSend}
                    title="Opens your mail client with subject and body pre-filled"
                  >
                    <FontAwesomeIcon
                      icon={sendState === "opened" ? faCheck : faPaperPlane}
                    />
                    {" "}
                    {sendState === "opened"
                      ? "Mail client opened!"
                      : "Open in Mail App"}
                  </button>

                  <div className="btn-divider" />
                  <span className="dl-label">
                    <FontAwesomeIcon icon={faDownload} />
                    Save as
                  </span>
                  {["txt", "pdf", "docx"].map((fmt) => (
                    <button
                      key={fmt}
                      className="btn-dl"
                      onClick={() => handleDownload(fmt)}
                      disabled={!!dlLoading}
                      title={`Download as .${fmt}`}
                    >
                      {dlLoading === fmt ? "…" : `.${fmt}`}
                    </button>
                  ))}
                </div>
              </div>

              {sendState === "opened" && (
                <div className="send-banner success">
                  <FontAwesomeIcon icon={faPaperclip} />
                  <div>
                    <strong>Your mail app should be open.</strong> Don't forget
                    to attach your resume (<em>{file?.name}</em>) before hitting
                    send!
                  </div>
                </div>
              )}

              <div className="out-body">
                <textarea
                  value={output}
                  onChange={(e) => setOutput(e.target.value)}
                  rows={14}
                />
                <div className="edit-hint">
                  <FontAwesomeIcon icon={faPen} />
                  Edit directly above before sending or downloading.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}