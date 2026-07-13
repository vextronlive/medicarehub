"""
MediCare Hub — Complete API Integration List (PDF)
Generated via ReportLab Report pipeline.
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = "/home/z/my-project/download/medicarehub-api-list.pdf"

# ───────── Palette (auto-generated cascade) ─────────
PAGE_BG       = colors.HexColor('#f4f4f4')
SECTION_BG    = colors.HexColor('#f0f0ee')
CARD_BG       = colors.HexColor('#ededea')
TABLE_STRIPE  = colors.HexColor('#edece9')
HEADER_FILL   = colors.HexColor('#635c48')
COVER_BLOCK   = colors.HexColor('#877a54')
BORDER        = colors.HexColor('#cdc9bf')
ICON          = colors.HexColor('#9b8649')
ACCENT        = colors.HexColor('#95771d')
ACCENT_2      = colors.HexColor('#6441ce')
TEXT_PRIMARY   = colors.HexColor('#181816')
TEXT_MUTED     = colors.HexColor('#7a7871')
SEM_SUCCESS   = colors.HexColor('#457655')
SEM_WARNING   = colors.HexColor('#a88a4d')
SEM_ERROR     = colors.HexColor('#a3544c')
SEM_INFO      = colors.HexColor('#4c6987')

# ───────── Page setup ─────────
PAGE_W, PAGE_H = A4
LEFT = RIGHT = 18 * mm
TOP = BOTTOM = 18 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT

# ───────── Styles ─────────
styles = getSampleStyleSheet()

def style(name, **kw):
    base = dict(name=name, fontName='Helvetica', fontSize=10,
                leading=14, textColor=TEXT_PRIMARY)
    base.update(kw)
    return ParagraphStyle(**base)

S_TITLE      = style('Title',     fontName='Helvetica-Bold', fontSize=28, leading=34, textColor=TEXT_PRIMARY, spaceAfter=8)
S_SUBTITLE   = style('Subtitle',  fontName='Helvetica',      fontSize=14, leading=18, textColor=TEXT_MUTED,    spaceAfter=24)
S_H1         = style('H1',        fontName='Helvetica-Bold', fontSize=18, leading=24, textColor=HEADER_FILL,   spaceBefore=22, spaceAfter=10)
S_H2         = style('H2',        fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=ACCENT,        spaceBefore=16, spaceAfter=6)
S_BODY       = style('Body',      fontSize=10, leading=15, textColor=TEXT_PRIMARY, spaceAfter=8)
S_BODY_SMALL = style('BodySmall', fontSize=9,  leading=12, textColor=TEXT_MUTED, spaceAfter=4)
S_TABLE_HEAD = style('TH',        fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=colors.white, alignment=TA_LEFT)
S_TABLE_CELL = style('TD',        fontSize=9, leading=11, textColor=TEXT_PRIMARY)
S_TABLE_CELL_CTR = style('TDC',   fontSize=9, leading=11, textColor=TEXT_PRIMARY, alignment=TA_CENTER)
S_FOOTER     = style('Footer',    fontSize=8, leading=10, textColor=TEXT_MUTED, alignment=TA_CENTER)
S_COVER_TAG  = style('Tag',       fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=ACCENT, alignment=TA_CENTER)
S_COVER_TITLE = style('CoverT',   fontName='Helvetica-Bold', fontSize=36, leading=42, textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=6)
S_COVER_SUB   = style('CoverS',   fontName='Helvetica',      fontSize=14, leading=18, textColor=TEXT_MUTED,    alignment=TA_LEFT, spaceAfter=20)

# ───────── Page header / footer ─────────
def on_page(canvas, doc):
    canvas.saveState()
    page_num = doc.page
    if page_num == 1:
        # Cover page — minimal footer
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont('Helvetica', 8)
        canvas.drawCentredString(PAGE_W / 2, 10 * mm, "MediCare Hub  ·  Confidential  ·  2025")
    else:
        # Header bar
        canvas.setFillColor(HEADER_FILL)
        canvas.rect(0, PAGE_H - 12 * mm, PAGE_W, 12 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 9)
        canvas.drawString(LEFT, PAGE_H - 8 * mm, "MediCare Hub  ·  Complete API Integration List")
        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(PAGE_W - RIGHT, PAGE_H - 8 * mm, f"Page {page_num}")
        # Footer
        canvas.setFillColor(TEXT_MUTED)
        canvas.setFont('Helvetica', 8)
        canvas.drawCentredString(PAGE_W / 2, 10 * mm,
            "MediCare Hub  ·  API Integration Reference  ·  2025")
    canvas.restoreState()

# ───────── Helpers ─────────
def P(text, style=S_BODY):
    return Paragraph(text, style)

def make_table(headers, rows, col_widths=None):
    """Build a styled table. headers: list[str], rows: list[list[str]]."""
    data = [[Paragraph(h, S_TABLE_HEAD) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), S_TABLE_CELL) for c in r])
    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
        ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
        ('TOPPADDING',    (0, 0), (-1, 0), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
        ('TOPPADDING',    (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
        ('LINEBELOW', (0, 0), (-1, 0), 1, ACCENT),
        ('LINEBELOW', (0, 1), (-1, -1), 0.3, BORDER),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    return t

def section(title, intro=None):
    flow = [P(title, S_H1)]
    if intro:
        flow.append(P(intro, S_BODY))
    return flow

# ───────── Content ─────────
story = []

# ===== COVER =====
story.append(Spacer(1, 50 * mm))
story.append(P("MEDICARE HUB", S_COVER_TAG))
story.append(Spacer(1, 8 * mm))
story.append(P("Complete API<br/>Integration List", S_COVER_TITLE))
story.append(P("External &amp; Internal APIs · Verification · Communication · AI · Healthcare · Payments · Storage",
               S_COVER_SUB))

# Cover meta block
meta = Table([
    [Paragraph("<b>Document</b>", S_BODY_SMALL), Paragraph("API Integration Reference", S_BODY_SMALL)],
    [Paragraph("<b>Project</b>",  S_BODY_SMALL), Paragraph("MediCare Hub — Healthcare Platform", S_BODY_SMALL)],
    [Paragraph("<b>Audience</b>", S_BODY_SMALL), Paragraph("Engineering · Product · Stakeholders", S_BODY_SMALL)],
    [Paragraph("<b>Version</b>",  S_BODY_SMALL), Paragraph("1.0  ·  2025", S_BODY_SMALL)],
    [Paragraph("<b>Live URL</b>", S_BODY_SMALL), Paragraph("https://medicarehub-sandy.vercel.app", S_BODY_SMALL)],
], colWidths=[40 * mm, CONTENT_W - 40 * mm])
meta.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LINEBELOW', (0, 0), (-1, -2), 0.3, BORDER),
    ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
]))
story.append(meta)
story.append(PageBreak())

# ===== TABLE OF CONTENTS =====
story.append(P("Table of Contents", S_H1))
toc_items = [
    "1.  Executive Summary",
    "2.  Verification APIs (Government + Third-Party)",
    "3.  Communication APIs",
    "4.  Location &amp; Maps APIs",
    "5.  Payment APIs",
    "6.  Telemedicine APIs",
    "7.  AI / ML APIs (z-ai-web-dev-sdk)",
    "8.  Healthcare-Specific APIs",
    "9.  Storage &amp; File APIs",
    "10. Security &amp; Authentication APIs",
    "11. Analytics &amp; Monitoring APIs",
    "12. Lab &amp; Diagnostic APIs",
    "13. Pharmacy &amp; Medicine APIs",
    "14. Insurance APIs",
    "15. Internal APIs — Already Implemented",
    "16. Internal APIs — New (MoM Features)",
    "17. Monthly Cost Estimate",
    "18. Implementation Roadmap",
]
for item in toc_items:
    story.append(P(item, S_BODY))
story.append(PageBreak())

# ===== 1. EXECUTIVE SUMMARY =====
story.extend(section("1. Executive Summary",
    "This document provides the complete list of external and internal APIs required to build "
    "MediCare Hub — a healthcare platform serving Patients, Doctors, and Healthcare Organizations. "
    "It covers verification, communication, AI, payments, telemedicine, storage, healthcare-specific "
    "integrations (including ABDM), and the full set of internal API endpoints (existing and new)."))
story.append(P(
    "The platform already has 33 internal API endpoints implemented and deployed on Vercel with "
    "a Supabase PostgreSQL backend. The MoM (meeting) features require an additional 30 internal "
    "endpoints and integration with ~90 external APIs. Cost at MVP scale is estimated at "
    "₹2,500–7,500 per month, scaling to ₹15,000–30,000 per month at 10k users.", S_BODY))
story.append(PageBreak())

# ===== 2. VERIFICATION APIs =====
story.extend(section("2. Verification APIs (Government + Third-Party)",
    "Identity and credential verification for patients, doctors, and hospitals — PAN, Aadhaar, "
    "GST, MCI/NMC, NABH and optional ID checks."))
rows = [
    ["1", "PAN Verification", "Doctor/Hospital PAN validation against Income Tax database", "NSDL / Surepass / Signzy / Zoop.one", "₹5-15/call"],
    ["2", "Aadhaar e-KYC (OTP)", "Patient identity verification before appointment booking", "UIDAI / Surepass / Signzy / Hyperverge", "₹5-10/call"],
    ["3", "GST Verification", "Hospital GST registration check", "GSTN API / Surepass", "₹5-10/call"],
    ["4", "MCI/NMC Doctor Registry", "Verify doctor's medical registration number", "Indian Medical Registry API", "Free/Manual"],
    ["5", "NABH Verification", "Hospital NABH accreditation check", "NABH website", "Manual"],
    ["6", "Driving License", "Optional alternate ID verification", "Parivahan API / Surepass", "₹5-10/call"],
    ["7", "Voter ID", "Optional ID verification", "Surepass / Signzy", "₹5-10/call"],
    ["8", "Passport Verification", "Optional ID verification", "Surepass / Signzy", "₹10-15/call"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 38*mm, 60*mm, 42*mm, 24*mm]))
story.append(PageBreak())

# ===== 3. COMMUNICATION APIs =====
story.extend(section("3. Communication APIs",
    "SMS, email, WhatsApp, push, and voice channels for OTP, reminders, alerts, and SOS."))
rows = [
    ["9",  "SMS OTP",           "Patient/Doctor mobile verification during signup", "Twilio / MSG91 / Amazon SNS",         "₹0.5-2/SMS"],
    ["10", "Email OTP",         "Patient/Doctor email verification during signup", "Resend / SendGrid / Amazon SES",     "Free tier"],
    ["11", "WhatsApp Business", "Appointment reminders, SOS alerts, prescription sharing", "WhatsApp Cloud API / Twilio",   "₹0.5-1/msg"],
    ["12", "Push Notifications","Appointment reminders, refill alerts, new records", "Firebase Cloud Messaging (FCM)",   "Free"],
    ["13", "Voice OTP",         "OTP via automated call (fallback)", "Twilio Verify / MSG91",                            "₹2-5/call"],
    ["14", "IVR Calling",       "Emergency SOS voice call to doctors/hospitals", "Twilio / Exotel",                       "₹2-5/call"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 38*mm, 60*mm, 42*mm, 24*mm]))
story.append(PageBreak())

# ===== 4. LOCATION & MAPS APIs =====
story.extend(section("4. Location &amp; Maps APIs",
    "Geocoding, distance calculation, nearby places, navigation — for Emergency SOS and "
    "doctor/hospital discovery by pincode."))
rows = [
    ["15", "Google Maps Geocoding",      "Convert address ↔ coordinates (patient/doctor addresses)", "Google Maps Platform", "$2/1000 calls (free $200/mo)"],
    ["16", "Google Maps Distance Matrix","Calculate ETA between patient and doctor/hospital (Emergency SOS)", "Google Maps Platform", "$5/1000 calls"],
    ["17", "Google Maps Places",         "Find nearby hospitals, pharmacies, labs", "Google Maps Platform", "$17/1000 calls"],
    ["18", "Google Maps Directions",     "Turn-by-turn navigation to hospital", "Google Maps Platform", "$5/1000 calls"],
    ["19", "Mapbox (alternative)",       "Cost-effective mapping, geocoding, routing", "Mapbox", "Free 50k/mo"],
    ["20", "OpenStreetMap Nominatim",    "Free geocoding (limited usage)", "OSM", "Free"],
    ["21", "IP Geolocation",             "Auto-detect patient location", "ipapi / ipstack", "Free tier"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 60*mm, 38*mm, 24*mm]))
story.append(PageBreak())

# ===== 5. PAYMENT APIs =====
story.extend(section("5. Payment APIs",
    "Payment gateway integration for lab orders, consultation fees, subscriptions, and "
    "international patient payments."))
rows = [
    ["22", "Razorpay",                "Lab orders, consultation fees, subscription", "Razorpay",                "2% per txn"],
    ["23", "Cashfree (alternative)",  "Payment gateway with UPI, cards, netbanking", "Cashfree",                "1.75% per txn"],
    ["24", "UPI Deep Link",           "Generate UPI payment links (PhonePe, GPay, Paytm)", "Razorpay / Cashfree", "Same as gateway"],
    ["25", "Stripe (international)",  "International patient payments", "Stripe",                                    "2.9% + $0.30"],
    ["26", "Paytm Business",          "Alternate payment gateway", "Paytm",                                          "1.99% per txn"],
    ["27", "Razorpay Smart Collect",  "Hospital/clinic subscription billing", "Razorpay",                          "2% per txn"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 58*mm, 40*mm, 24*mm]))
story.append(PageBreak())

# ===== 6. TELEMEDICINE APIs =====
story.extend(section("6. Telemedicine APIs",
    "Real-time video consultation between doctors and patients."))
rows = [
    ["28", "Agora Video",            "HD video consultations (doctor-patient)", "Agora",                  "Free 10k min/mo"],
    ["29", "Twilio Video (alt)",     "WebRTC video calls", "Twilio",                                       "$0.0015/min"],
    ["30", "Dyte (alternative)",     "Modern video SDK with chat", "Dyte",                                   "Free tier"],
    ["31", "Jitsi Meet (self-host)", "Open-source video calls", "Jitsi",                                     "Free (hosting cost)"],
    ["32", "Whereby (alternative)",  "Embedded video calls", "Whereby",                                      "$9.99/mo"],
    ["33", "Socket.io (already impl)","Real-time chat, notifications, presence", "Mini-service (port 3003)", "Free"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 60*mm, 38*mm, 24*mm]))
story.append(PageBreak())

# ===== 7. AI/ML APIs =====
story.extend(section("7. AI / ML APIs (Available via z-ai-web-dev-sdk)",
    "All AI capabilities are available in-house through the z-ai-web-dev-sdk. These power the "
    "NLP record creation, prescription OCR, chatbot, voice recording → structured records, "
    "and health insights."))
rows = [
    ["34", "LLM (Chat Completions)",   "NLP for record creation, health insights, chatbot", "z-ai-web-dev-sdk",       "Sandbox free"],
    ["35", "ASR (Speech-to-Text)",     "Doctor voice recording → text for record creation", "z-ai-web-dev-sdk / Whisper", "Sandbox free"],
    ["36", "VLM (Vision Language)",    "Scan prescription images, OCR lab reports, document understanding", "z-ai-web-dev-sdk", "Sandbox free"],
    ["37", "TTS (Text-to-Speech)",     "Voice-over for medication instructions, accessibility", "z-ai-web-dev-sdk",  "Sandbox free"],
    ["38", "Image Generation",         "Generate health education visuals, illustrations", "z-ai-web-dev-sdk",     "Sandbox free"],
    ["39", "Web Search",               "Real-time medical info, drug interactions lookup", "z-ai-web-dev-sdk",      "Sandbox free"],
    ["40", "Web Reader",               "Extract content from medical articles, drug references", "z-ai-web-dev-sdk", "Sandbox free"],
    ["41", "Video Understanding",      "Analyze patient-recorded videos (e.g. physiotherapy exercises)", "z-ai-web-dev-sdk", "Sandbox free"],
    ["42", "OpenAI GPT-4 (alt)",       "Advanced medical reasoning", "OpenAI",                                        "$0.03/1k tokens"],
    ["43", "Anthropic Claude (alt)",   "Medical text analysis", "Anthropic",                                       "$0.003/1k tokens"],
    ["44", "Google Med-PaLM (medical)","Medical-specialized AI", "Google Cloud",                                  "Contact sales"],
    ["45", "Hugging Face (self-host)", "Open-source medical NLP models", "Hugging Face",                            "Free (compute cost)"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 60*mm, 38*mm, 24*mm]))
story.append(PageBreak())

# ===== 8. HEALTHCARE-SPECIFIC APIs =====
story.extend(section("8. Healthcare-Specific APIs",
    "Government health-record exchange (ABDM), national Health ID, doctor/hospital databases, "
    "drug references, and clinical terminology standards."))
rows = [
    ["46", "ABDM (Ayushman Bharat)",      "National Health ID, health record exchange, ₹5 Cr incentive for clinics", "ABDM Govt API", "Free (registration)"],
    ["47", "NDHM Health ID",              "Generate patient's unique 14-digit Health ID", "ABDM",                   "Free"],
    ["48", "ABDM Health Information Exchange","Share patient records across hospitals", "ABDM",                     "Free"],
    ["49", "Practo API",                  "Doctor database, appointment booking integration", "Practo (partnership)","Partnership"],
    ["50", "1mg API",                     "Medicine info, drug interactions, pharmacy orders", "1mg (partnership)", "Partnership"],
    ["51", "Practo Ray",                  "Clinic management integration", "Practo",                                 "Subscription"],
    ["52", "OpenMRS (open-source)",       "EMR system integration", "OpenMRS",                                       "Free (self-host)"],
    ["53", "DrugBank API",                "Drug database, interactions, side effects", "DrugBank",                 "$1k+/yr"],
    ["54", "RxNorm API (NLM)",            "Clinical drug nomenclature", "NLM (US Govt)",                            "Free"],
    ["55", "OpenFDA API",                 "Drug adverse events, recalls", "US FDA",                                 "Free"],
    ["56", "ICD-10 / ICD-11 Codes",       "Standardized diagnosis codes", "WHO",                                    "Free"],
    ["57", "SNOMED CT",                   "Clinical terminology", "SNOMED International",                            "Free (in India)"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 48*mm, 60*mm, 32*mm, 24*mm]))
story.append(PageBreak())

# ===== 9. STORAGE & FILE APIs =====
story.extend(section("9. Storage &amp; File APIs",
    "Store medical records, prescription images, lab reports, and generate PDFs."))
rows = [
    ["58", "AWS S3",                "Store records, prescription images, lab reports, documents", "AWS S3",          "$0.023/GB"],
    ["59", "Cloudinary (alt)",      "Image-optimized storage with transforms", "Cloudinary",                          "Free 25 GB"],
    ["60", "Vercel Blob",           "Native Vercel integration", "Vercel",                                       "$0.15/GB"],
    ["61", "Supabase Storage",      "Already using Supabase — use its storage too", "Supabase",                    "Free 1 GB"],
    ["62", "PDF Generation",        "Generate health report PDFs, prescriptions", "ReportLab / PDFKit / Puppeteer", "Free"],
    ["63", "PDF.co (alternative)",  "Cloud PDF generation, conversion", "PDF.co",                                 "$0.001/PDF"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 38*mm, 62*mm, 42*mm, 24*mm]))
story.append(PageBreak())

# ===== 10. SECURITY & AUTH APIs =====
story.extend(section("10. Security &amp; Authentication APIs",
    "QR code generation, encryption, JWT tokens, biometric auth, and bot protection."))
rows = [
    ["64", "QR Code Generation",  "Generate patient QR codes (encrypted)", "qrcode npm",                "Free"],
    ["65", "AES-256 Encryption",  "Encrypt patient records, QR tokens", "Node.js crypto",               "Free"],
    ["66", "JWT",                 "Doctor authentication, secure QR token signing", "jsonwebtoken npm", "Free"],
    ["67", "NextAuth.js (impl)", "User session management", "NextAuth v4",                                "Free"],
    ["68", "bcrypt / scrypt",    "Password hashing (already implemented)", "Node.js crypto",            "Free"],
    ["69", "WebAuthn / FIDO2",   "Biometric authentication (fingerprint, Face ID)", "Browser native",   "Free"],
    ["70", "Google reCAPTCHA",   "Prevent bot signups, brute-force attacks", "Google",                  "Free"],
    ["71", "Cloudflare Turnstile","Modern captcha alternative", "Cloudflare",                            "Free"],
    ["72", "HashiCorp Vault",    "Secrets management (API keys)", "HashiCorp",                            "Free (self-host)"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 38*mm, 62*mm, 42*mm, 24*mm]))
story.append(PageBreak())

# ===== 11. ANALYTICS & MONITORING =====
story.extend(section("11. Analytics &amp; Monitoring APIs",
    "Error tracking, user analytics, session replay, and full-stack monitoring."))
rows = [
    ["73", "Sentry",             "Error tracking, performance monitoring", "Sentry",                    "Free 5k errors/mo"],
    ["74", "PostHog",            "User analytics, funnels, feature flags", "PostHog",                  "Free 1M events/mo"],
    ["75", "Google Analytics 4", "Web traffic analytics", "Google",                                       "Free"],
    ["76", "Mixpanel (alt)",     "Product analytics", "Mixpanel",                                         "Free 20M events/mo"],
    ["77", "LogRocket",          "Session replay, frontend debugging", "LogRocket",                     "Free 1k sessions/mo"],
    ["78", "Vercel Analytics",   "Native Vercel traffic insights", "Vercel",                             "Free tier"],
    ["79", "Datadog (enterprise)","Full-stack monitoring", "Datadog",                                     "$15-50/host/mo"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 38*mm, 58*mm, 42*mm, 28*mm]))
story.append(PageBreak())

# ===== 12. LAB & DIAGNOSTIC APIs =====
story.extend(section("12. Lab &amp; Diagnostic APIs",
    "Book lab tests, fetch results, and integrate with diagnostic chains (partnerships)."))
rows = [
    ["80", "Dr. Lal PathLabs API", "Lab test booking, results", "Dr. Lal (partnership)",  "Partnership"],
    ["81", "Thyrocare API",        "Lab tests, health packages", "Thyrocare (partnership)","Partnership"],
    ["82", "Metropolis API",       "Diagnostic tests", "Metropolis (partnership)",        "Partnership"],
    ["83", "1mg Labs API",         "Online lab bookings", "1mg (partnership)",             "Partnership"],
    ["84", "Healthians API",       "At-home sample collection", "Healthians (partnership)","Partnership"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 60*mm, 40*mm, 24*mm]))
story.append(PageBreak())

# ===== 13. PHARMACY APIs =====
story.extend(section("13. Pharmacy &amp; Medicine APIs",
    "Order medicines online, check availability, and verify drug interactions."))
rows = [
    ["85", "1mg Pharmacy API",       "Medicine ordering, availability", "1mg (partnership)",       "Partnership"],
    ["86", "Pharmeasy API",           "Medicine delivery", "Pharmeasy (partnership)",               "Partnership"],
    ["87", "Netmeds API",             "Online pharmacy", "Netmeds (partnership)",                   "Partnership"],
    ["88", "Apollo Pharmacy API",     "Medicine orders", "Apollo (partnership)",                    "Partnership"],
    ["89", "Drug Interaction Check",  "Verify prescription safety", "DrugBank / RxNorm",            "Free/Paid"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 60*mm, 40*mm, 24*mm]))
story.append(PageBreak())

# ===== 14. INSURANCE APIs =====
story.extend(section("14. Insurance APIs",
    "IRDAI-approved insurer list, plus partnership APIs for claims integration."))
rows = [
    ["90", "Insurance Company List",  "IRDAI-approved insurers database (~25 companies)", "IRDAI website (scrape/manual)", "Free"],
    ["91", "PolicyBazaar API",        "Insurance comparison, quotes", "PolicyBazaar (partnership)", "Partnership"],
    ["92", "Star Health API",         "Health insurance claims", "Star Health (partnership)",      "Partnership"],
    ["93", "HDFC Ergo API",           "Insurance integration", "HDFC Ergo (partnership)",          "Partnership"],
    ["94", "ICICI Lombard API",       "Insurance integration", "ICICI Lombard (partnership)",     "Partnership"],
]
story.append(make_table(["#", "API", "Purpose", "Provider", "Cost"],
    rows, col_widths=[10*mm, 42*mm, 60*mm, 40*mm, 24*mm]))
story.append(PageBreak())

# ===== 15. INTERNAL APIs - EXISTING =====
story.extend(section("15. Internal APIs — Already Implemented",
    "These 31 endpoints are already built, deployed on Vercel, and connected to Supabase "
    "PostgreSQL."))
rows = [
    ["1",  "/api/auth/signup",            "POST",  "Account creation"],
    ["2",  "/api/auth/login",             "POST",  "Login"],
    ["3",  "/api/auth/otp",               "POST",  "Send/verify OTP (demo mode)"],
    ["4",  "/api/auth/me",                "GET",   "Current user profile"],
    ["5",  "/api/auth/forgot",            "POST",  "Password reset"],
    ["6",  "/api/account",                "GET",   "Profile"],
    ["7",  "/api/doctors",                "GET",   "Doctors list"],
    ["8",  "/api/appointments",           "GET/POST","Appointments"],
    ["9",  "/api/vitals",                 "GET/POST","Vitals tracker"],
    ["10", "/api/medications",            "GET/POST","Medications"],
    ["11", "/api/medications/log",        "POST",  "Medication adherence log"],
    ["12", "/api/records",                "GET/POST","Health records"],
    ["13", "/api/emergency",              "POST",  "Emergency SOS"],
    ["14", "/api/notifications",          "GET",   "Notifications"],
    ["15", "/api/notifications/read",     "POST",  "Mark read"],
    ["16", "/api/ai/insights",            "GET",   "AI health insights"],
    ["17", "/api/ai/health-summary",      "GET",   "AI health summary"],
    ["18", "/api/ai/recommendations",     "GET",   "AI recommendations"],
    ["19", "/api/ai/scan-prescription",   "POST",  "OCR prescription scan"],
    ["20", "/api/chat",                   "POST",  "AI chatbot"],
    ["21", "/api/family-members",         "GET/POST","Family members"],
    ["22", "/api/goals",                  "GET/POST","Health goals"],
    ["23", "/api/goals/log",              "POST",  "Goal progress log"],
    ["24", "/api/lab-catalog",            "GET",   "Lab tests catalog"],
    ["25", "/api/lab-orders",             "GET/POST","Lab test orders"],
    ["26", "/api/partnerships",           "GET/POST","Doctor-hospital partnerships"],
    ["27", "/api/ratings",                "GET/POST","Doctor/hospital ratings"],
    ["28", "/api/referrals",              "GET/POST","Patient referrals"],
    ["29", "/api/refills",                "GET/POST","Prescription refills"],
    ["30", "/api/telemedicine",           "GET/POST","Telemedicine sessions"],
    ["31", "/api/token",                  "POST",   "Session token"],
]
story.append(make_table(["#", "Endpoint", "Method", "Purpose"],
    rows, col_widths=[10*mm, 60*mm, 24*mm, 80*mm]))
story.append(PageBreak())

# ===== 16. INTERNAL APIs - NEW =====
story.extend(section("16. Internal APIs — New (MoM Features)",
    "These 30 new endpoints are required to implement the meeting (MoM) features: "
    "PAN/Aadhaar/MCI verification, blood group edit, doctor categories, voice records, "
    "QR codes, BMI, menstruation tracker, ABDM integration, and payments."))
rows = [
    ["32", "/api/verify/pan",                 "POST", "PAN verification (Income Tax DB)",            "#1"],
    ["33", "/api/verify/aadhaar/send-otp",    "POST", "Send Aadhaar OTP",                             "#3"],
    ["34", "/api/verify/aadhaar/verify-otp",  "POST", "Verify Aadhaar OTP",                           "#3"],
    ["35", "/api/verify/mci",                 "POST", "Doctor MCI registration check",                "#2"],
    ["36", "/api/verify/nabh",                "POST", "Hospital NABH check",                          "#2"],
    ["37", "/api/verify/gst",                 "POST", "Hospital GST verification",                    "#2"],
    ["38", "/api/account/blood-group",        "PATCH","Update blood group (post-signup)",             "#5"],
    ["39", "/api/doctors/categories",         "GET",  "List all specializations",                     "#10"],
    ["40", "/api/doctors/nearby",             "GET",  "Find doctors by pincode + category",           "#10"],
    ["41", "/api/doctors/:id/slots",          "GET",  "Available slots (capacity/hr logic)",          "#4"],
    ["42", "/api/doctors/:id/capacity",       "GET",  "Check capacity for date",                      "#4"],
    ["43", "/api/records/voice",              "POST", "Voice recording → AI structured record",       "#7, #12"],
    ["44", "/api/records/nlp",                "POST", "Natural language → structured record",         "#7"],
    ["45", "/api/patient/qr/generate",        "POST", "Generate encrypted QR token",                  "#8, #9"],
    ["46", "/api/patient/qr/scan",            "POST", "Scan QR → fetch records (doctor only)",        "#8, #9"],
    ["47", "/api/bmi/calculate",              "POST", "Calculate BMI from height/weight",             "BMI"],
    ["48", "/api/bmi/history",                "GET",  "BMI trend over time",                          "BMI"],
    ["49", "/api/menstrual-cycle",            "GET/POST","Menstruation tracking",                      "Menstruation"],
    ["50", "/api/menstrual-cycle/predict",    "GET",  "Predict next cycle",                           "Menstruation"],
    ["51", "/api/insurance-companies",        "GET",  "IRDAI insurers list",                          "Insurance"],
    ["52", "/api/abdm/health-id/create",      "POST", "Create ABDM Health ID",                        "#11"],
    ["53", "/api/abdm/health-id/verify",      "POST", "Verify existing Health ID",                    "#11"],
    ["54", "/api/abdm/records/share",         "POST", "Share records via ABDM HIE",                   "#11"],
    ["55", "/api/abdm/records/fetch",         "GET",  "Fetch records from ABDM",                      "#11"],
    ["56", "/api/notifications/realtime",     "WS",   "Real-time notifications (socket.io)",          "Existing"],
    ["57", "/api/payments/create-order",      "POST", "Create Razorpay order",                        "Payments"],
    ["58", "/api/payments/verify",            "POST", "Verify Razorpay signature",                    "Payments"],
    ["59", "/api/telemedicine/token",         "POST", "Generate Agora video token",                   "Telemedicine"],
    ["60", "/api/uploads/prescription",       "POST", "Upload prescription image (S3)",               "Storage"],
    ["61", "/api/uploads/report",             "POST", "Upload lab report (S3)",                       "Storage"],
]
story.append(make_table(["#", "Endpoint", "Method", "Purpose", "MoM"],
    rows, col_widths=[10*mm, 56*mm, 22*mm, 62*mm, 22*mm]))
story.append(PageBreak())

# ===== 17. COST ESTIMATE =====
story.extend(section("17. Monthly Cost Estimate",
    "Estimated monthly cost at MVP scale and at production scale (10k users)."))
rows = [
    ["Verification APIs (PAN/Aadhaar/MCI) — sandbox", "₹2,000 - 5,000"],
    ["SMS / Email (Twilio + Resend)",                  "₹500 - 2,000"],
    ["Google Maps (free $200/mo credit)",              "₹0"],
    ["Razorpay (2% per transaction)",                  "Variable"],
    ["AWS S3 (storage)",                               "₹100 - 500"],
    ["AI (z-ai sandbox)",                              "₹0"],
    ["Agora Video (free tier)",                        "₹0"],
    ["ABDM (Govt, free)",                              "₹0"],
    ["Vercel (Hobby plan)",                            "₹0"],
    ["Supabase (Free tier)",                           "₹0"],
    ["<b>Total (MVP)</b>",                              "<b>₹2,500 - 7,500/month</b>"],
    ["<b>Total (Production — 10k users)</b>",          "<b>₹15,000 - 30,000/month</b>"],
]
story.append(make_table(["Category", "Estimated Cost"],
    rows, col_widths=[120*mm, 54*mm]))
story.append(PageBreak())

# ===== 18. ROADMAP =====
story.extend(section("18. Implementation Roadmap",
    "Recommended priority order across 4 weeks. Phase 1 (verification) is highest priority — "
    "it makes signup trustworthy. Phase 4 (ABDM) requires government registration and can take "
    "weeks."))

story.append(P("Phase 1 (Week 1) — Core Verification", S_H2))
story.append(P(
    "Real OTP (Twilio + Resend) for signup email/mobile verification. PAN verification via "
    "Surepass for doctor/hospital. Aadhaar OTP for patient appointment booking. Remove blood "
    "group from signup, add to profile edit.", S_BODY))

story.append(P("Phase 2 (Week 2) — Patient UX", S_H2))
story.append(P(
    "BMI calculator module. Menstrual cycle tracker (with cycle prediction). Doctor "
    "recommendations by category + pincode on home page. Insurance companies database.", S_BODY))

story.append(P("Phase 3 (Week 3) — Doctor Productivity", S_H2))
story.append(P(
    "Voice recording → AI structured records (ASR + LLM). Capacity per hour → appointment slots "
    "logic. Patient QR code generation + AES encryption. Doctor QR scanner → view/create records.",
    S_BODY))

story.append(P("Phase 4 (Week 4) — Government Integration", S_H2))
story.append(P(
    "ABDM registration + Health ID integration. MCI/NABH verification. Note: ABDM registration "
    "can take 2-4 weeks; start the application in Week 1 in parallel.", S_BODY))

# Final note
story.append(Spacer(1, 16 * mm))
note = Table([[Paragraph(
    "<b>Next step:</b> Pick a phase to start. The fastest visible win is Phase 1 — "
    "real OTP (1 day), then removing blood group from signup (5 minutes), then BMI + "
    "menstrual cycle module (2 days).",
    S_BODY)]], colWidths=[CONTENT_W])
note.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ('TOPPADDING', (0, 0), (-1, -1), 10),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ('BOX', (0, 0), (-1, -1), 0.5, ACCENT),
    ('LINEBEFORE', (0, 0), (0, -1), 3, ACCENT),
]))
story.append(note)

# ───────── Build ─────────
doc = SimpleDocTemplate(
    OUT,
    pagesize=A4,
    leftMargin=LEFT, rightMargin=RIGHT,
    topMargin=TOP + 8 * mm,  # extra for header
    bottomMargin=BOTTOM,
    title="MediCare Hub — Complete API Integration List",
    author="MediCare Hub",
    subject="API Integration Reference",
    creator="Z.ai",
)
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
size = os.path.getsize(OUT) / 1024
print(f"\n✅ PDF generated: {OUT}")
print(f"   Size: {size:.1f} KB")
