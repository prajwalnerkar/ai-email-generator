from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

def extract_company_from_email(email):

    if not email:
        return None

    domain = email.split("@")[-1]

    company = domain.split(".")[0]

    return company.capitalize()


def generate_email(
    resume_text,
    job_role,
    company_name=None,
    recruiter_email=None,
    content_type="email"
):

    # Auto extract company name
    if not company_name:
        company_name = extract_company_from_email(
            recruiter_email
        )

    if not company_name:
        company_name = "your company"

    # Cover Letter Prompt
    if content_type == "cover_letter":

        prompt = f"""
        Write a professional cover letter.

        Company Name:
        {company_name}

        Job Role:
        {job_role}

        Resume:
        {resume_text}

        Instructions:
        - Professional tone
        - ATS friendly
        - Strong introduction
        - Highlight relevant skills
        - Keep concise
        """

    # Email Prompt
    else:

        prompt = f"""
        Write a professional job application email.

        Company Name:
        {company_name}

        Job Role:
        {job_role}

        Resume:
        {resume_text}

        Instructions:
        - Keep email concise
        - Professional tone
        - Mention company name naturally
        - Add proper subject
        """

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response.choices[0].message.content