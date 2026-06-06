from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import io

from services.resume_parser import extract_text_from_pdf
from services.ai_generator import generate_email as ai_generate

app = Flask(__name__)
CORS(app)


def extract_resume_text_from_memory(file_storage):
    """
    Reads the uploaded file into a BytesIO buffer (no disk write),
    then extracts text. Supports PDF, DOC, DOCX.
    """
    filename = file_storage.filename.lower()
    file_bytes = file_storage.read()
    buffer = io.BytesIO(file_bytes)

    if filename.endswith(".pdf"):
        # Primary: pdfplumber  →  pip install pdfplumber
        try:
            import pdfplumber  # type: ignore[import]
            with pdfplumber.open(buffer) as pdf:
                text = "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
            return text.strip(), file_bytes
        except ImportError:
            pass

        # Fallback: pypdf  →  pip install pypdf
        # (PyPDF2 is deprecated; pypdf is the maintained successor)
        try:
            from pypdf import PdfReader  # type: ignore[import]
            reader = PdfReader(buffer)
            text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
            return text.strip(), file_bytes
        except ImportError:
            raise ImportError(
                "No PDF library found. Run: pip install pdfplumber"
            )

    elif filename.endswith(".docx"):
        # pip install python-docx
        try:
            from docx import Document  # type: ignore[import]
            doc = Document(buffer)
            text = "\n".join(para.text for para in doc.paragraphs)
            return text.strip(), file_bytes
        except ImportError:
            raise ImportError(
                "python-docx not installed. Run: pip install python-docx"
            )

    elif filename.endswith(".doc"):
        raise ValueError(".doc files are not supported. Please convert to .pdf or .docx")

    else:
        raise ValueError(f"Unsupported file type: {filename}")


# ── /generate  (parse resume + generate email/cover letter) ──────
@app.route("/generate", methods=["POST"])
def generate():
    """
    Stateless endpoint:
      - Receives resume file + job details in one request
      - Parses resume IN MEMORY (no disk write)
      - Generates email/cover letter via AI
      - Returns generated text

    Email sending is handled client-side via Gmail API (see App.jsx).
    No SENDER_EMAIL / SENDER_PASSWORD env vars needed.
    """
    try:
        if "resume" not in request.files:
            return jsonify({"success": False, "error": "Resume file is required"}), 400

        resume_file = request.files["resume"]

        if not resume_file.filename:
            return jsonify({"success": False, "error": "No file selected"}), 400

        resume_text, _ = extract_resume_text_from_memory(resume_file)

        if not resume_text:
            return jsonify({
                "success": False,
                "error": "Could not extract text from resume. Make sure it is not a scanned image."
            }), 400

        job_role        = request.form.get("job_role", "").strip()
        company_name    = request.form.get("company_name", "").strip()
        recruiter_email = request.form.get("recruiter_email", "").strip()
        content_type    = request.form.get("content_type", "email").strip()

        if not job_role:
            return jsonify({"success": False, "error": "Job role is required"}), 400

        result = ai_generate(
            resume_text,
            job_role,
            company_name or None,
            recruiter_email or None,
            content_type
        )

        return jsonify({"success": True, "email": result})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/")
def home():
    return {"status": "Backend is running successfully 🚀"}

if __name__ == "__main__":
    app.run(debug=True)

    