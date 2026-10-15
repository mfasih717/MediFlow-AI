"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Upload,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Phone,
  Globe,
  MessageSquare,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Shield,
  RefreshCw,
  Sparkles,
  Activity,
  Pill,
  HeartPulse,
  Stethoscope,
  Eye,
  HelpCircle,
  User,
  Zap,
  Info,
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  BellRing,
  Pencil,
  History,
  FileCheck,
  Download,
  Home,
} from "lucide-react";

// Types
type Language = "en" | "ur";

interface PatientProfile {
  name: string;
  nameUr: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  genderUr: string;
  mrn: string;
  allergies: string;
  allergiesUr: string;
}

interface DoctorProfile {
  id: string;
  name: string;
  nameUr: string;
  specialty: string;
  specialtyUr: string;
  clinic: string;
  clinicUr: string;
  rxRef: string;
  diagnosis: string;
  diagnosisUr: string;
  followUpGoal: string;
  followUpGoalUr: string;
}

interface ExtractedSalt {
  id: string;
  brandName: string;
  brandNameUr: string;
  activeSalt: string;
  activeSaltUr: string;
  dosage: string;
  dosageUr: string;
  frequency?: string;
  frequencyUr?: string;
  confidence: number;
  laymanExplanation: string;
  laymanExplanationUr: string;
  mealAdvice: string;
  mealAdviceUr: string;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
  ambiguityReasonUr?: string;
}

interface DoseSchedule {
  id: string;
  slot: "morning" | "afternoon" | "evening";
  time: string;
  timeUr: string;
  medicine: string;
  medicineUr: string;
  dosage: string;
  dosageUr: string;
  salt: string;
  instructions: string;
  instructionsUr: string;
  mealPairing: string;
  mealPairingUr: string;
  taken: boolean;
  alarmSet: boolean;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "system";
  text: string;
  timestamp: string;
  isUrdu?: boolean;
  tier?: number;
}

interface SafetyAuditLog {
  id: string;
  timestamp: string;
  event: string;
  eventUr: string;
  tier: 1 | 2 | 3;
  status: "Nominal" | "Ambiguity Hold" | "Emergency Active" | "Resolved";
  statusUr: string;
  details: string;
  detailsUr: string;
}

// Preset Doctor Profiles
const doctorsDatabase: Record<string, DoctorProfile> = {
  "dr-tariq": {
    id: "dr-tariq",
    name: "Dr. Tariq Khan",
    nameUr: "ڈاکٹر طارق خان",
    specialty: "Pulmonology & Critical Care",
    specialtyUr: "ماہر امراضِ سینہ و تنفس",
    clinic: "Pulmonology Suite 4B",
    clinicUr: "کلینک برائے امراضِ تنفس 4B",
    rxRef: "Rx-8842",
    diagnosis: "Acute Bacterial Respiratory Infection & Bronchospasm",
    diagnosisUr: "سانس کی نالی کا شدید بیکٹیریل انفیکشن",
    followUpGoal: "Post-antibiotic auscultation, Peak Expiratory Flow, and CBC re-check",
    followUpGoalUr: "سینے کے ایکس رے کا موازنہ اور اینٹی بائیوٹک کورس کا جائزہ",
  },
  "dr-ayesha": {
    id: "dr-ayesha",
    name: "Dr. Ayesha Malik",
    nameUr: "ڈاکٹر عائشہ ملک",
    specialty: "General Medicine & Internal Care",
    specialtyUr: "ماہر انٹرنل میڈیسن و جنرل فزیشن",
    clinic: "Urgent Care OPD-2",
    clinicUr: "ارجنٹ کیئر او پی ڈی 2",
    rxRef: "Rx-4102",
    diagnosis: "Upper Respiratory Infection (Unclear Handwritten Script)",
    diagnosisUr: "اوپری تنفس کا انفیکشن (مبہم ہینڈ رائٹنگ)",
    followUpGoal: "Reconcile antibiotic dosage tolerance, symptom follow-up, and blood pressure check",
    followUpGoalUr: "دوا کی مقدار کا اعادہ، علامات کی جانچ اور بلڈ پریشر چیک",
  },
  "custom": {
    id: "custom",
    name: "Dr. Zeeshan Ali",
    nameUr: "ڈاکٹر ذیشان علی",
    specialty: "Cardiology & Internal Medicine",
    specialtyUr: "ماہر امراضِ قلب و میٹابولک میڈیسن",
    clinic: "Cardiology Center Room 12",
    clinicUr: "کارڈیالوجی کلینک روم 12",
    rxRef: "Rx-Custom",
    diagnosis: "Cardiovascular & Metabolic Care",
    diagnosisUr: "قلبی و میٹابولک نگہداشت",
    followUpGoal: "Therapeutic response assessment and lipid panel review",
    followUpGoalUr: "علاج کے اثرات کا جائزہ اور لپڈ پینل ٹیسٹ",
  },
};

// Helper: Escape string for PDF syntax and ensure ASCII compatibility
function escapePdf(str: string): string {
  if (!str) return "";
  const normalized = str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");
  return normalized
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// Helper: Generate hospital-grade, standard-compliant PDF 1.4 document string for clinical handover
function buildClinicalPdfString(
  patient: PatientProfile,
  doctor: DoctorProfile,
  salts: ExtractedSalt[],
  schedule: DoseSchedule[],
  isEmergencyActive: boolean,
  adherencePercent: number
): string {
  const now = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const cleanMrn = patient.mrn.replace(/[^a-zA-Z0-9]/g, "") || "94021PK";

  let s = ""; // Graphic and text stream content

  // 1. TOP HEADER BANNER (Navy #0f172a with Teal Accent #0f766e)
  s += "0.059 0.090 0.165 rg\n"; // #0f172a
  s += "40 755 515 52 re f\n";
  s += "0.059 0.463 0.431 rg\n"; // #0f766e
  s += "40 752 515 3 re f\n";

  s += "1 1 1 rg\n";
  s += "BT\n/F2 13 Tf\n52 787 Td\n(" + escapePdf("MEDIFLOW AI - EMERGENCY CLINICAL HANDOVER SUMMARY") + ") Tj\nET\n";
  s += "0.80 0.88 0.95 rg\n";
  s += "BT\n/F1 7.5 Tf\n52 767 Td\n(" + escapePdf("CONFIDENTIAL EHR RECORD | Generated: " + now + " | ISO-13485 & HIPAA Compliant Architecture") + ") Tj\nET\n";

  // 2. PATIENT CONTEXT BOX (Dedicated Slate Card)
  s += "0.965 0.975 0.990 rg\n"; // Slate-50 #f8fafc
  s += "40 675 515 68 re f\n";
  s += "0.82 0.86 0.92 RG 0.75 w\n"; // Slate-200 border
  s += "40 675 515 68 re s\n";

  s += "0.88 0.94 1.00 rg\n"; // Sky-100 badge
  s += "50 726 135 12 re f\n";
  s += "0.01 0.40 0.65 rg\n";
  s += "BT\n/F2 7 Tf\n55 729 Td\n(" + escapePdf("ACTIVE PATIENT RECORD: #" + cleanMrn) + ") Tj\nET\n";

  s += "0.12 0.16 0.22 rg\n";
  s += "BT\n/F2 10 Tf\n50 711 Td\n(" + escapePdf(`Patient: ${patient.name}`) + ") Tj\nET\n";
  s += "BT\n/F1 8.5 Tf\n215 711 Td\n(" + escapePdf(`Age: ${patient.age} Yrs   |   Gender: ${patient.gender}`) + ") Tj\nET\n";
  s += "BT\n/F1 8.5 Tf\n370 711 Td\n(" + escapePdf(`MRN: ${patient.mrn}`) + ") Tj\nET\n";

  s += "0.25 0.30 0.38 rg\n";
  s += "BT\n/F1 8 Tf\n50 696 Td\n(" + escapePdf(`Attending Clinician: ${doctor.name} (${doctor.specialty})   |   Rx Ref: ${doctor.rxRef}`) + ") Tj\nET\n";

  // High-visibility allergy alert badge
  const isPenicillin = patient.allergies.toLowerCase().includes("penicillin");
  const allergyText = isPenicillin
    ? `ALLERGY ALERT: [!] ${patient.allergies} (Cross-Reactivity Vigilance)`
    : `DRUG ALLERGIES: ${patient.allergies}`;

  if (isPenicillin) {
    s += "0.99 0.92 0.92 rg\n"; // Rose-100
    s += "50 680 340 13 re f\n";
    s += "0.88 0.25 0.25 RG 0.5 w\n";
    s += "50 680 340 13 re s\n";
    s += "0.75 0.10 0.10 rg\n"; // Red-800
    s += "BT\n/F2 7.5 Tf\n55 683 Td\n(" + escapePdf(allergyText) + ") Tj\nET\n";
  } else {
    s += "0.92 0.97 0.93 rg\n"; // Emerald-50
    s += "50 680 260 13 re f\n";
    s += "0.20 0.65 0.35 RG 0.5 w\n";
    s += "50 680 260 13 re s\n";
    s += "0.10 0.45 0.20 rg\n";
    s += "BT\n/F2 7.5 Tf\n55 683 Td\n(" + escapePdf(allergyText) + ") Tj\nET\n";
  }

  // 3. EXTRACTED MEDICATIONS AS A STRUCTURED TABLE (Vision OCR)
  s += "0.10 0.15 0.25 rg\n";
  s += "BT\n/F2 9.5 Tf\n40 658 Td\n(" + escapePdf("1. EXTRACTED PRESCRIPTION MEDICATIONS & SALTS (MULTIMODAL VISION OCR)") + ") Tj\nET\n";

  // Column Headers: x=40, y=637, w=515, h=16
  s += "0.059 0.463 0.431 rg\n"; // Teal-700
  s += "40 637 515 16 re f\n";
  s += "1 1 1 rg\n";
  s += "BT\n/F2 7.5 Tf\n46 642 Td\n(" + escapePdf("MEDICATION & FORM") + ") Tj\nET\n";
  s += "BT\n/F2 7.5 Tf\n170 642 Td\n(" + escapePdf("ACTIVE SALT / STRENGTH") + ") Tj\nET\n";
  s += "BT\n/F2 7.5 Tf\n320 642 Td\n(" + escapePdf("DOSAGE & FREQUENCY") + ") Tj\nET\n";
  s += "BT\n/F2 7.5 Tf\n445 642 Td\n(" + escapePdf("SAFETY / OCR FLAG") + ") Tj\nET\n";

  let tableY = 618;
  const medsToRender = salts.slice(0, 3);
  for (let i = 0; i < medsToRender.length; i++) {
    const med = medsToRender[i];
    const rowH = 26;
    const isAlt = i % 2 === 1;

    if (isAlt) {
      s += "0.96 0.98 0.99 rg\n";
      s += `40 ${tableY} 515 ${rowH} re f\n`;
    }
    s += "0.85 0.88 0.92 RG 0.5 w\n";
    s += `40 ${tableY} 515 ${rowH} re s\n`;

    s += "0.12 0.16 0.22 rg\n";
    s += `BT\n/F2 8 Tf\n46 ${tableY + 14} Td\n(` + escapePdf(med.brandName) + ") Tj\nET\n";
    s += "0.40 0.45 0.55 rg\n";
    s += `BT\n/F1 6.5 Tf\n46 ${tableY + 5} Td\n(` + escapePdf((med.mealAdvice || "").slice(0, 35)) + ") Tj\nET\n";

    s += "0.15 0.20 0.30 rg\n";
    s += `BT\n/F1 7.5 Tf\n170 ${tableY + 11} Td\n(` + escapePdf((med.activeSalt || "").slice(0, 32)) + ") Tj\nET\n";
    s += `BT\n/F1 7.5 Tf\n320 ${tableY + 11} Td\n(` + escapePdf((med.dosage || "").slice(0, 28)) + ") Tj\nET\n";

    if (med.isAmbiguous) {
      s += "0.99 0.95 0.85 rg\n"; // Amber-100
      s += `445 ${tableY + 5} 102 15 re f\n`;
      s += "0.85 0.55 0.10 RG 0.5 w\n";
      s += `445 ${tableY + 5} 102 15 re s\n`;
      s += "0.70 0.35 0.05 rg\n";
      s += `BT\n/F2 6.5 Tf\n448 ${tableY + 10} Td\n(` + escapePdf("[!] AMBIGUITY HOLD") + ") Tj\nET\n";
    } else {
      s += "0.90 0.97 0.92 rg\n"; // Emerald-50
      s += `445 ${tableY + 5} 102 15 re f\n`;
      s += "0.25 0.65 0.35 RG 0.5 w\n";
      s += `445 ${tableY + 5} 102 15 re s\n`;
      s += "0.10 0.45 0.20 rg\n";
      s += `BT\n/F2 6.5 Tf\n448 ${tableY + 10} Td\n(` + escapePdf(`VERIFIED (Conf. ${med.confidence || 95}%)`) + ") Tj\nET\n";
    }

    tableY -= rowH;
  }

  // 4. DOSING SCHEDULE & ADHERENCE GRID (3 Clean Column Cards)
  const schedY = tableY - 14;
  s += "0.10 0.15 0.25 rg\n";
  s += `BT\n/F2 9.5 Tf\n40 ${schedY} Td\n(` + escapePdf(`2. TODAY'S DOSING SCHEDULE & ADHERENCE LOG (${adherencePercent}% COMPLETED)`) + ") Tj\nET\n";

  const colW = 163;
  const colH = 50;
  const cardY = schedY - 56;

  const slots = [
    { title: "MORNING (08:30 AM)", defaultMed: "Augmentin 625mg", slotKey: "morning" as const, x: 40 },
    { title: "AFTERNOON (02:00 PM)", defaultMed: "Panadol CF 500mg", slotKey: "afternoon" as const, x: 216 },
    { title: "EVENING (09:00 PM)", defaultMed: "Montiget 10mg", slotKey: "evening" as const, x: 392 },
  ];

  for (const slot of slots) {
    const item = schedule.find((sc) => sc.slot === slot.slotKey);
    const medText = item ? `${item.medicine} (${item.dosage})` : slot.defaultMed;
    const isTaken = item ? item.taken : slot.slotKey === "morning";

    s += "0.98 0.99 1.00 rg\n";
    s += `${slot.x} ${cardY} ${colW} ${colH} re f\n`;
    s += "0.82 0.86 0.92 RG 0.5 w\n";
    s += `${slot.x} ${cardY} ${colW} ${colH} re s\n`;

    s += "0.20 0.25 0.35 rg\n";
    s += `BT\n/F2 7.5 Tf\n${slot.x + 8} ${cardY + 36} Td\n(` + escapePdf(slot.title) + ") Tj\nET\n";

    s += "0.10 0.15 0.25 rg\n";
    s += `BT\n/F1 7.5 Tf\n${slot.x + 8} ${cardY + 22} Td\n(` + escapePdf(medText.slice(0, 25)) + ") Tj\nET\n";

    if (isTaken) {
      s += "0.88 0.97 0.92 rg\n";
      s += `${slot.x + 8} ${cardY + 7} 75 11 re f\n`;
      s += "0.08 0.45 0.20 rg\n";
      s += `BT\n/F2 6.5 Tf\n${slot.x + 12} ${cardY + 9} Td\n(` + escapePdf("[COMPLETED]") + ") Tj\nET\n";
    } else {
      s += "0.94 0.95 0.97 rg\n";
      s += `${slot.x + 8} ${cardY + 7} 65 11 re f\n`;
      s += "0.35 0.40 0.50 rg\n";
      s += `BT\n/F2 6.5 Tf\n${slot.x + 12} ${cardY + 9} Td\n(` + escapePdf("[PENDING]") + ") Tj\nET\n";
    }
  }

  // 5. TRIAGE & EMERGENCY DISPATCH ACTION CENTER
  const triageY = cardY - 14;
  s += "0.10 0.15 0.25 rg\n";
  s += `BT\n/F2 9.5 Tf\n40 ${triageY} Td\n(` + escapePdf("3. CLINICAL SAFETY ENGINE & EMERGENCY TRIAGE DISPATCH") + ") Tj\nET\n";

  const emerBoxY = triageY - 50;
  if (isEmergencyActive) {
    s += "0.99 0.93 0.93 rg\n";
    s += `40 ${emerBoxY} 515 44 re f\n`;
    s += "0.88 0.20 0.20 RG 1 w\n";
    s += `40 ${emerBoxY} 515 44 re s\n`;
    s += "0.75 0.08 0.08 rg\n";
    s += `BT\n/F2 8 Tf\n50 ${emerBoxY + 30} Td\n(` + escapePdf("STATUS: TIER 3 - ACUTE EMERGENCY ACTIVE (CLINICAL LOCKOUT DISPATCHED)") + ") Tj\nET\n";
  } else {
    s += "0.94 0.98 0.95 rg\n";
    s += `40 ${emerBoxY} 515 44 re f\n`;
    s += "0.25 0.65 0.40 RG 0.75 w\n";
    s += `40 ${emerBoxY} 515 44 re s\n`;
    s += "0.08 0.45 0.22 rg\n";
    s += `BT\n/F2 8 Tf\n50 ${emerBoxY + 30} Td\n(` + escapePdf("STATUS: TIER 1 - NOMINAL ACTIVE MONITORING (24/7 Continuous Guardrails Armed)") + ") Tj\nET\n";
  }

  s += "0.15 0.20 0.30 rg\n";
  s += `BT\n/F1 7.5 Tf\n50 ${emerBoxY + 16} Td\n(` + escapePdf("Emergency Dispatch Hotline: Rescue 1122 (Direct Ambulance)   |   Global Emergency: 911") + ") Tj\nET\n";
  s += `BT\n/F1 7.5 Tf\n50 ${emerBoxY + 5} Td\n(` + escapePdf("Cardiopulmonary Alert: Chest tightness, dyspnea, or anaphylaxis triggers instant paramedic interconnect.") + ") Tj\nET\n";

  // 6. CLINICAL HANDOVER VERIFICATION & SIGN-OFF (Single-Page Fit)
  const signY = emerBoxY - 14;
  s += "0.10 0.15 0.25 rg\n";
  s += `BT\n/F2 9.5 Tf\n40 ${signY} Td\n(` + escapePdf("4. CLINICAL HANDOVER VERIFICATION & SIGN-OFF") + ") Tj\nET\n";

  s += "0.35 0.40 0.50 rg\n";
  s += `BT\n/F1 7 Tf\n40 ${signY - 12} Td\n(` + escapePdf("This handover document was synthesized by MediFlow AI Clinical Safety Engine in coordination with attending clinician.") + ") Tj\nET\n";
  s += `BT\n/F1 7 Tf\n40 ${signY - 22} Td\n(` + escapePdf("For continuity of care, present this record upon admission to hospital emergency triage or referral center.") + ") Tj\nET\n";

  // Doctor Signature line on left
  s += "0.70 0.75 0.82 RG 0.75 w\n";
  s += `40 ${signY - 48} m 210 ${signY - 48} l S\n`;
  s += "0.20 0.25 0.35 rg\n";
  s += `BT\n/F2 7.5 Tf\n40 ${signY - 58} Td\n(` + escapePdf(`Attending Clinician Signature & Date: ${doctor.name}`) + ") Tj\nET\n";

  // Pharmacist Signature line on right
  s += "0.70 0.75 0.82 RG 0.75 w\n";
  s += `345 ${signY - 48} m 515 ${signY - 48} l S\n`;
  s += "0.20 0.25 0.35 rg\n";
  s += `BT\n/F2 7.5 Tf\n345 ${signY - 58} Td\n(` + escapePdf("Clinical Pharmacist Triage Stamp & Verification") + ") Tj\nET\n";

  // Bottom Security Watermark
  s += "0.50 0.55 0.65 rg\n";
  s += `BT\n/F1 6.5 Tf\n180 20 Td\n(` + escapePdf("MediFlow AI Healthcare Engine - Confidential EHR Handover - Page 1 of 1") + ") Tj\nET\n";

  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(s);
  const streamLen = streamBytes.length;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  function put(id: number, objStr: string) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += id + " 0 obj\n" + objStr + "\nendobj\n";
  }

  put(1, "<< /Type /Catalog /Pages 2 0 R >>");
  put(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  put(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>");
  put(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  put(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  put(6, "<< /Length " + streamLen + " >>\nstream\n" + s + "\nendstream");

  const startxref = encoder.encode(pdf).length;
  pdf += "xref\n0 7\n";
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + startxref + "\n%%EOF\n";
  return pdf;
}

export default function MediFlowPatientPortal() {
  // Navigation Tab State (1: Intake & Vision OCR, 2: Bilingual Clinical Assistant, 3: Safety Guardrails)
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);

  // Standalone Bilingual State
  const [lang, setLang] = useState<Language>("en");

  // Dynamic Patient Profile State
  const [patient, setPatient] = useState<PatientProfile>({
    name: "Farhan Ahmed",
    nameUr: "فرحان احمد",
    age: 42,
    gender: "Male",
    genderUr: "مرد",
    mrn: "#94021-PK",
    allergies: "Penicillin",
    allergiesUr: "پینسلن",
  });

  // Patient Profile Edit / Register Modal State
  const [editPatientModalOpen, setEditPatientModalOpen] = useState<boolean>(false);
  const [patientFormName, setPatientFormName] = useState<string>("Farhan Ahmed");
  const [patientFormAge, setPatientFormAge] = useState<number>(42);
  const [patientFormGender, setPatientFormGender] = useState<"Male" | "Female" | "Other">("Male");
  const [patientFormAllergies, setPatientFormAllergies] = useState<string>("Penicillin");
  const [patientFormDoctorKey, setPatientFormDoctorKey] = useState<string>("dr-tariq");
  const [patientFormMrn, setPatientFormMrn] = useState<string>("#94021-PK");

  // Quick Preset Selector for Demo
  const applyPatientPreset = (presetKey: "farhan" | "zainab" | "custom") => {
    if (presetKey === "farhan") {
      setPatientFormName("Farhan Ahmed");
      setPatientFormAge(42);
      setPatientFormGender("Male");
      setPatientFormAllergies("Penicillin (Cross-Reactivity Risk)");
      setPatientFormDoctorKey("dr-tariq");
      setPatientFormMrn("#94021-PK");
    } else if (presetKey === "zainab") {
      setPatientFormName("Zainab Bibi");
      setPatientFormAge(29);
      setPatientFormGender("Female");
      setPatientFormAllergies("No Known Drug Allergies (NKDA)");
      setPatientFormDoctorKey("dr-ayesha");
      setPatientFormMrn("#78204-PK");
    } else {
      setPatientFormName("");
      setPatientFormAge(32);
      setPatientFormGender("Male");
      setPatientFormAllergies("Sulfa Drugs");
      setPatientFormDoctorKey("custom");
      setPatientFormMrn(`#${Math.floor(10000 + Math.random() * 90000)}-PK`);
    }
  };

  // Dynamic Doctor & Prescription Selection State
  const [selectedPreset, setSelectedPreset] = useState<"standard" | "ambiguous" | "custom">("standard");
  const [selectedDoctorKey, setSelectedDoctorKey] = useState<string>("dr-tariq");
  const [customDoctorName, setCustomDoctorName] = useState<string>("Dr. Zeeshan Ali");
  const [customDoctorSpecialty, setCustomDoctorSpecialty] = useState<string>("Cardiology & Internal Medicine");

  // Memoized Active Doctor
  const currentDoctor: DoctorProfile = useMemo(() => {
    if (selectedDoctorKey === "custom") {
      return {
        ...doctorsDatabase["custom"],
        name: customDoctorName.trim() || "Dr. Zeeshan Ali",
        nameUr: customDoctorName.trim() || "ڈاکٹر ذیشان علی",
        specialty: customDoctorSpecialty.trim() || "Cardiology & Internal Medicine",
        specialtyUr: customDoctorSpecialty.trim() || "ماہر امراضِ قلب",
      };
    }
    return doctorsDatabase[selectedDoctorKey] || doctorsDatabase["dr-tariq"];
  }, [selectedDoctorKey, customDoctorName, customDoctorSpecialty]);

  // Derived initials for avatar
  const patientInitials = useMemo(() => {
    const parts = patient.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "FA";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [patient.name]);

  // Clinical Safety & Emergency State (Tier 3)
  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState<boolean>(false);

  // Tier 2 Ambiguity Verification Modal
  const [pharmacistModalOpen, setPharmacistModalOpen] = useState<boolean>(false);
  const [ambiguityVerified, setAmbiguityVerified] = useState<boolean>(false);

  // Document Intake & OCR State
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<number>(100);
  const [uploadedFileName, setUploadedFileName] = useState<string>("Rx-8842-Chest-Infection-DrTariqKhan.pdf");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // PDF Handover Download Simulation State
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<SafetyAuditLog[]>([
    {
      id: "log-1",
      timestamp: "10:00:15 AM",
      event: "System Initialization & Guardrail Verification",
      eventUr: "سسٹم کا آغاز اور حفاظتی گارڈ ریلز کی تصدیق",
      tier: 1,
      status: "Nominal",
      statusUr: "معمول کے مطابق",
      details: "24/7 Red-flag interceptor armed. Local inference PHI guardrails verified.",
      detailsUr: "24/7 ریڈ فلیگ پروٹوکول فعال۔ مریض کے ڈیٹا کی رازداری محفوظ ہے۔",
    },
    {
      id: "log-2",
      timestamp: "10:05:40 AM",
      event: "Multimodal Vision OCR Extraction Complete",
      eventUr: "وژن او سی آر تجزیہ مکمل",
      tier: 1,
      status: "Nominal",
      statusUr: "معمول کے مطابق",
      details: "Prescription Rx-8842 ingested (Confidence 98%). Active salts mapped to timeline.",
      detailsUr: "نسخہ 8842 کامیابی سے اسکین ہو گیا۔ ایکٹو سالٹس شیڈول میں شامل۔",
    },
  ]);

  // Doses Schedule State
  const [schedule, setSchedule] = useState<DoseSchedule[]>([
    {
      id: "dose-1",
      slot: "morning",
      time: "08:00 AM",
      timeUr: "صبح 08:00 بجے",
      medicine: "Augmentin 625mg",
      medicineUr: "آگمنٹن 625 ملی گرام",
      dosage: "1 Tablet (Amoxicillin 500mg + Clavulanate 125mg)",
      dosageUr: "1 گولی (اموکسیسیلین + کلیوولانک ایسڈ)",
      salt: "Amoxicillin + Clavulanic Acid",
      instructions: "Take 30 mins after breakfast to protect stomach lining.",
      instructionsUr: "معدے کی حفاظت کے لیے ناشتے کے 30 منٹ بعد پانی سے لیں۔",
      mealPairing: "Post-Breakfast",
      mealPairingUr: "ناشتے کے بعد",
      taken: true,
      alarmSet: true,
    },
    {
      id: "dose-2",
      slot: "afternoon",
      time: "02:00 PM",
      timeUr: "دوپہر 02:00 بجے",
      medicine: "Panadol CF",
      medicineUr: "پیناڈول سی ایف",
      dosage: "1 Caplet (Paracetamol 500mg + Pseudoephedrine 30mg)",
      dosageUr: "1 گولی (پیراسیٹامول + سیوڈو فیڈرین)",
      salt: "Paracetamol + Pseudoephedrine",
      instructions: "Take with warm water if experiencing sinus congestion or fever.",
      instructionsUr: "بخار یا بند ناک کی صورت میں نیم گرم پانی کے ساتھ لیں۔",
      mealPairing: "Post-Lunch",
      mealPairingUr: "دوپہر کے کھانے کے بعد",
      taken: false,
      alarmSet: true,
    },
    {
      id: "dose-3",
      slot: "evening",
      time: "09:00 PM",
      timeUr: "رات 09:00 بجے",
      medicine: "Montiget 10mg",
      medicineUr: "مونٹی گیٹ 10 ملی گرام",
      dosage: "1 Tablet (Montelukast Sodium 10mg)",
      dosageUr: "1 گولی (مونٹی لوکاسٹ سوڈیم)",
      salt: "Montelukast Sodium",
      instructions: "Take at bedtime. Helps open airways and prevent nocturnal wheeze.",
      instructionsUr: "رات سونے سے قبل لیں۔ یہ سانس کی نالیوں کو کشادہ رکھتی ہے۔",
      mealPairing: "Bedtime",
      mealPairingUr: "سوتے وقت",
      taken: false,
      alarmSet: true,
    },
  ]);

  // Extracted Salts & Vision OCR Data
  const extractedMeds: ExtractedSalt[] = useMemo(() => {
    if (selectedPreset === "standard") {
      return [
        {
          id: "med-1",
          brandName: "Augmentin",
          brandNameUr: "آگمنٹن",
          activeSalt: "Amoxicillin + Clavulanic Acid 625mg",
          activeSaltUr: "اموکسیسیلین + کلیوولانک ایسڈ 625 ملی گرام",
          dosage: "1 Tab - Twice daily (BID) for 7 days",
          dosageUr: "1 گولی - دن میں 2 بار (7 دن کے لیے)",
          confidence: 98,
          laymanExplanation: "Antibiotic combating bacterial respiratory infection. Clavulanate stops bacterial resistance.",
          laymanExplanationUr: "طاقتور اینٹی بائیوٹک جو سینے اور گلے کے جراثیم کو ختم کرتی ہے۔ کورس مکمل کرنا ضروری ہے۔",
          mealAdvice: "Take with or right after food to minimize nausea.",
          mealAdviceUr: "معدے کی جلن سے بچنے کے لیے کھانے کے فوراً بعد لیں۔",
        },
        {
          id: "med-2",
          brandName: "Panadol CF",
          brandNameUr: "پیناڈول سی ایف",
          activeSalt: "Paracetamol 500mg + Pseudoephedrine 30mg",
          activeSaltUr: "پیراسیٹامول 500 م گ + سیوڈوفیڈرین 30 م گ",
          dosage: "1 Tab - Every 8 hours as needed (PRN)",
          dosageUr: "1 گولی - ہر 8 گھنٹے بعد ضرورت پڑنے پر",
          confidence: 94,
          laymanExplanation: "Reduces fever, headache, and relieves nasal blockage by constricting swollen vessels.",
          laymanExplanationUr: "بخار اور جسمانی درد کم کرتی ہے اور بند ناک اور سائنس کو کھولتی ہے۔",
          mealAdvice: "Can be taken with or without meals with a full glass of water.",
          mealAdviceUr: "کھانے کے ساتھ یا بغیر پورے گلاس پانی سے لی جا سکتی ہے۔",
        },
        {
          id: "med-3",
          brandName: "Montiget",
          brandNameUr: "مونٹی گیٹ",
          activeSalt: "Montelukast Sodium 10mg",
          activeSaltUr: "مونٹی لوکاسٹ سوڈیم 10 م گ",
          dosage: "1 Tab - Once daily at night",
          dosageUr: "1 گولی - روزانہ رات کو",
          confidence: 96,
          laymanExplanation: "Leukotriene receptor blocker that prevents asthma triggers, chest tightness, and nighttime coughing.",
          laymanExplanationUr: "سانس کی نالیوں کی سوزش کم کرتی ہے تاکہ رات کو سانس نہ پھولے اور کھانسی نہ ہو۔",
          mealAdvice: "Take at bedtime with water.",
          mealAdviceUr: "رات سونے سے قبل پانی کے ساتھ لیں۔",
        },
      ];
    } else if (selectedPreset === "ambiguous") {
      return [
        {
          id: "med-1",
          brandName: "Azithromycin (Illegible script)",
          brandNameUr: "ایزیتھرومائسن (غیر واضح تحریر)",
          activeSalt: "Azithromycin 250mg or 500mg (?)",
          activeSaltUr: "ایزیتھرومائسن 250 یا 500 ملی گرام (؟)",
          dosage: "Handwriting illegible - daily duration unclear",
          dosageUr: "ڈاکٹر کی تحریر واضح نہیں - خوراک کی تصدیق درکار ہے",
          confidence: ambiguityVerified ? 99 : 68,
          laymanExplanation: ambiguityVerified
            ? "Pharmacist reconciled: Take 500mg once daily for 3 days."
            : "Vision OCR detected ambiguous doctor handwriting. Do not consume until confirmed with a licensed pharmacist.",
          laymanExplanationUr: ambiguityVerified
            ? "فارماسسٹ نے تصدیق کر دی: روزانہ 500 ملی گرام 1 گولی 3 دن تک لیں۔"
            : "ہینڈ رائٹنگ غیر واضح ہے۔ غلط خوراک کے خطرے سے بچنے کے لیے فارماسسٹ سے تصدیق لازمی ہے۔",
          mealAdvice: "Take 1 hour before or 2 hours after meals.",
          mealAdviceUr: "کھانے سے 1 گھنٹہ پہلے یا 2 گھنٹے بعد لیں۔",
          isAmbiguous: !ambiguityVerified,
          ambiguityReason: "Doctor's pen stroke overlaps dose units. Confidence 68% falls below Tier 2 clinical threshold (85%).",
          ambiguityReasonUr: "نسخے پر لکھائی مدہم ہے اور ملی گرام کی مقدار مبہم ہے۔ کلینیکل فارماسسٹ سے تصدیق لازمی ہے۔",
        },
        {
          id: "med-2",
          brandName: "Panadol CF",
          brandNameUr: "پیناڈول سی ایف",
          activeSalt: "Paracetamol 500mg + Pseudoephedrine 30mg",
          activeSaltUr: "پیراسیٹامول 500 م گ + سیوڈوفیڈرین 30 م گ",
          dosage: "1 Tab - Every 8 hours as needed",
          dosageUr: "1 گولی - ہر 8 گھنٹے بعد ضرورت پڑنے پر",
          confidence: 95,
          laymanExplanation: "Reduces fever and relieves nasal congestion.",
          laymanExplanationUr: "بخار اور بند ناک کھولنے کے لیے۔",
          mealAdvice: "Take with water.",
          mealAdviceUr: "پانی کے ساتھ لیں۔",
        },
        {
          id: "med-3",
          brandName: "Solvin Syrup",
          brandNameUr: "سولون سیرپ",
          activeSalt: "Dextromethorphan + Chlorpheniramine",
          activeSaltUr: "ڈیکسٹرومیتھورفن + کلورفینیرامین",
          dosage: "2 Teaspoons - Twice daily for 5 days",
          dosageUr: "2 چمچ - دن میں 2 بار (5 دن کے لیے)",
          confidence: 91,
          laymanExplanation: "Cough suppressant syrup to calm dry bronchial throat tickles.",
          laymanExplanationUr: "خشک کھانسی اور گلے کی خراش کو دور کرنے کے لیے شربت۔",
          mealAdvice: "Take after meals.",
          mealAdviceUr: "کھانے کے بعد لیں۔",
        },
      ];
    } else {
      return [
        {
          id: "med-1",
          brandName: "Glucophage 500mg",
          brandNameUr: "گلوکوفیج 500 ملی گرام",
          activeSalt: "Metformin Hydrochloride 500mg",
          activeSaltUr: "میٹفارمین ہائیڈروکلورائیڈ 500 م گ",
          dosage: "1 Tab - Twice daily with breakfast and dinner",
          dosageUr: "1 گولی - صبح اور شام کھانے کے ساتھ",
          confidence: 97,
          laymanExplanation: "Improves cellular insulin sensitivity and balances blood glucose levels.",
          laymanExplanationUr: "خون میں شوگر کی سطح کو متوازن رکھنے اور کنٹرول کرنے والی دوا۔",
          mealAdvice: "Always take during or immediately after meals.",
          mealAdviceUr: "ہمیشہ کھانے کے دوران یا فوراً بعد لیں۔",
        },
        {
          id: "med-2",
          brandName: "Lipitor 10mg",
          brandNameUr: "لیپیٹور 10 ملی گرام",
          activeSalt: "Atorvastatin Calcium 10mg",
          activeSaltUr: "ایٹورواسٹیٹن کیلشیم 10 م گ",
          dosage: "1 Tab - Once daily at bedtime",
          dosageUr: "1 گولی - روزانہ رات کو سوتے وقت",
          confidence: 96,
          laymanExplanation: "HMG-CoA reductase inhibitor reducing bad LDL cholesterol and protecting vascular walls.",
          laymanExplanationUr: "خون میں کولیسٹرول کو کم کرتی ہے اور شریانوں کی حفاظت کرتی ہے۔",
          mealAdvice: "Take at bedtime with water.",
          mealAdviceUr: "رات سوتے وقت پانی کے ساتھ لیں۔",
        },
        {
          id: "med-3",
          brandName: "Concor 2.5mg",
          brandNameUr: "کونکور 2.5 ملی گرام",
          activeSalt: "Bisoprolol Fumarate 2.5mg",
          activeSaltUr: "بائیسوپرولول فیوماریٹ 2.5 م گ",
          dosage: "1 Tab - Once daily in the morning",
          dosageUr: "1 گولی - روزانہ صبح نہار منہ یا ناشتے کے بعد",
          confidence: 94,
          laymanExplanation: "Beta-blocker regulating cardiac workload and maintaining smooth arterial blood pressure.",
          laymanExplanationUr: "بلڈ پریشر اور دل کی دھڑکن کو متوازن رکھنے والی دوا۔",
          mealAdvice: "Take with breakfast.",
          mealAdviceUr: "ناشتے کے ساتھ لیں۔",
        },
      ];
    }
  }, [selectedPreset, ambiguityVerified]);

  // Chat Assistant State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "ai",
      text:
        lang === "ur"
          ? `السلام علیکم ${patient.name} صاحب! میں میڈی فلو کلینیکل اسسٹنٹ ہوں۔ ${currentDoctor.nameUr} کا نسخہ آپ کے پورٹل میں کامیابی سے لوڈ ہو چکا ہے۔ کیا آپ ادویات، خوراک کے اوقات یا سائیڈ ایفیکٹس کے بارے میں کچھ پوچھنا چاہتے ہیں؟`
          : `Hello ${patient.name}! I am your MediFlow Clinical Navigator. Your prescription from ${currentDoctor.name} has been loaded. How can I guide you regarding your medications, meal timings, or side effects today?`,
      timestamp: "10:14 AM",
      isUrdu: lang === "ur",
      tier: 1,
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  // Update initial greeting when language, patient name, or doctor changes if only 1 message
  useEffect(() => {
    if (chatMessages.length === 1 && chatMessages[0].id === "msg-1") {
      setChatMessages([
        {
          id: "msg-1",
          sender: "ai",
          text:
            lang === "ur"
              ? `السلام علیکم ${patient.name} صاحب/صاحبہ! میں میڈی فلو کلینیکل اسسٹنٹ ہوں۔ ${currentDoctor.nameUr} کا نسخہ آپ کے پورٹل میں کامیابی سے لوڈ ہو چکا ہے۔ کیا آپ ادویات، خوراک کے اوقات یا سائیڈ ایفیکٹس کے بارے میں کچھ پوچھنا چاہتے ہیں؟`
              : `Hello ${patient.name}! I am your MediFlow Clinical Navigator. Your prescription from ${currentDoctor.name} has been loaded. How can I guide you regarding your medications, meal timings, or side effects today?`,
          timestamp: "10:14 AM",
          isUrdu: lang === "ur",
          tier: 1,
        },
      ]);
    }
  }, [lang, patient.name, currentDoctor.name]);

  // Red-flag keyword detector
  const detectRedFlags = (query: string): boolean => {
    const redFlagKeywords = [
      "chest pain",
      "heart attack",
      "cannot breathe",
      "shortness of breath",
      "suffocating",
      "severe allergic",
      "anaphylaxis",
      "fainting",
      "coughing blood",
      "سینے میں درد",
      "سانس رک رہی",
      "بے ہوش",
      "خون کی الٹی",
      "دل کا دورہ",
    ];
    const lower = query.toLowerCase();
    return redFlagKeywords.some((kw) => lower.includes(kw));
  };

  // Trigger Acute Emergency (Tier 3)
  const triggerEmergency = () => {
    setIsEmergencyActive(true);
    setEmergencyModalOpen(true);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const urgentMsg: ChatMessage = {
      id: `emergency-${Date.now()}`,
      sender: "system",
      text:
        lang === "ur"
          ? "🚨 انتباہ درجہ 3: فوری طبی خطرہ کی علامت موصول ہوئی ہے! انٹرایکٹو چیٹ عارضی طور پر لاک کر دی گئی ہے۔ فوری طور پر 1122 یا 911 پر کال کریں۔"
          : "🚨 TIER 3 RED-FLAG TRIGGERED: Acute distress detected. Interactive chat has been locked to prevent hazardous delays. Call Emergency Dispatch 1122 / 911 immediately.",
      timestamp: now,
      tier: 3,
      isUrdu: lang === "ur",
    };
    setChatMessages((prev) => [...prev, urgentMsg]);

    const newLog: SafetyAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: now,
      event: "Tier 3 Red-Flag Interceptor Tripped",
      eventUr: "درجہ 3 ریڈ فلیگ ہنگامی پروٹوکول نافذ",
      tier: 3,
      status: "Emergency Active",
      statusUr: "ایمرجنسی فعال",
      details: "Severe cardiopulmonary red-flag identified. Interactive chat locked. Paramedic dispatch recommended.",
      detailsUr: "شدید طبی خطرہ شناخت ہوا۔ چیٹ کو فوری طور پر لاک کر دیا گیا تاکہ بروقت مدد مل سکے۔",
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // De-escalate emergency
  const resetEmergency = () => {
    setIsEmergencyActive(false);
    setEmergencyModalOpen(false);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const resetMsg: ChatMessage = {
      id: `reset-${Date.now()}`,
      sender: "system",
      text:
        lang === "ur"
          ? "✅ ہنگامی پروٹوکول بحال کر دیا گیا۔ معمول کی نگرانی فعال ہے۔"
          : "✅ Acute emergency simulation cleared. Patient portal returned to nominal Tier 1 monitoring.",
      timestamp: now,
      tier: 1,
      isUrdu: lang === "ur",
    };
    setChatMessages((prev) => [...prev, resetMsg]);

    const newLog: SafetyAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: now,
      event: "Emergency Override & Nominal Triage Cleared",
      eventUr: "ہنگامی کیفیت ختم اور معمول کی نگرانی بحال",
      tier: 1,
      status: "Resolved",
      statusUr: "حل شدہ",
      details: "Clinician / patient cleared emergency simulation. Returned to standard Tier 1 monitoring.",
      detailsUr: "ہنگامی الرٹ منسوخ کر دیا گیا اور درجہ 1 معمول کی مانیٹرنگ دوبارہ شروع ہو گئی۔",
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Send message in chat
  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isEmergencyActive) return;

    if (detectRedFlags(text)) {
      triggerEmergency();
      setInputMessage("");
      return;
    }

    const hasUrdu = /[\u0600-\u06FF]/.test(text);
    const respondInUrdu = hasUrdu || lang === "ur";

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isUrdu: respondInUrdu,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    setTimeout(() => {
      let aiResponse = "";
      const lower = text.toLowerCase();

      if (respondInUrdu) {
        if (
          text.includes("پہلے") ||
          text.includes("بعد") ||
          text.includes("کھانے") ||
          text.includes("خالی پیٹ") ||
          lower.includes("empty stomach") ||
          lower.includes("before") ||
          lower.includes("after")
        ) {
          aiResponse =
            "یہ دوا ہمیشہ کھانے کے 20 سے 30 منٹ بعد پانی کے ساتھ لیں۔ خالی پیٹ لینے سے معدے میں جلن یا متلی ہو سکتی ہے۔";
        } else if (
          text.includes("بھول") ||
          text.includes("چھوٹ") ||
          text.includes("مس") ||
          lower.includes("miss") ||
          lower.includes("forget")
        ) {
          aiResponse =
            "اگر آپ کی کوئی خوراک چھوٹ جائے تو یاد آتے ہی فوراً لے لیں۔ لیکن اگر اگلی خوراک کا وقت قریب ہو تو چھوٹی ہوئی خوراک چھوڑ دیں اور کبھی بھی ڈبل خوراک (دو گولیاں ایک ساتھ) نہ لیں۔";
        } else if (
          text.includes("اثرات") ||
          text.includes("نقصان") ||
          text.includes("سائیڈ") ||
          text.includes("الرجی") ||
          lower.includes("side effect")
        ) {
          aiResponse =
            "آگمنٹن کے عام ہلکے اثرات میں معدے کی خرابی یا نرم پاخانہ ہو سکتا ہے (دہی یا پروبائیوٹکس کا استعمال فائدہ مند ہے)۔ مونٹی گیٹ سے رات کو سانس کی روانی بہتر ہوتی ہے مگر ہلکا سر درد ہو سکتا ہے۔ اگر جلد پر خارش ہو تو فوراً معالج سے رجوع کریں۔";
        } else if (
          text.includes("چائے") ||
          text.includes("کافی") ||
          lower.includes("tea") ||
          lower.includes("coffee")
        ) {
          aiResponse =
            "پیناڈول سی ایف کے ساتھ چائے یا کافی کا زیادہ استعمال نہ کریں کیونکہ اس دوا میں موجود Pseudoephedrine کیفین کے ساتھ مل کر دل کی دھڑکن تیز یا بے چینی پیدا کر سکتی ہے۔";
        } else if (
          text.includes("کورس") ||
          text.includes("کتنے دن") ||
          lower.includes("days") ||
          lower.includes("course")
        ) {
          aiResponse =
            `ڈاکٹر ${currentDoctor.nameUr} کی ہدایت کے مطابق اینٹی بائیوٹک کا مکمل کورس پورا کرنا لازمی ہے، چاہے آپ کی طبیعت 2 سے 3 دن میں بہتر ہو جائے۔ کورس ادھورا چھوڑنے سے جراثیم میں اینٹی بائیوٹک مزاحمت پیدا ہو سکتی ہے۔`;
        } else {
          aiResponse =
            `محترم ${patient.name} صاحب/صاحبہ! آپ کے استفسار کا جائزہ لیا گیا ہے۔ آپ کا معالجاتی پلان ڈاکٹر ${currentDoctor.nameUr} کی ہدایات کے مطابق مستحکم ہے۔ دن میں مناسب مقدار میں پانی پئیں اور اپنی خوراک وقت پر لیں۔`;
        }
      } else {
        if (
          lower.includes("before") ||
          lower.includes("after") ||
          lower.includes("meal") ||
          lower.includes("food") ||
          lower.includes("empty stomach")
        ) {
          aiResponse =
            "Always take Augmentin 20 to 30 minutes after meals with plenty of water. Taking it on an empty stomach frequently causes gastric irritation, nausea, or stomach upset.";
        } else if (lower.includes("miss") || lower.includes("forget") || lower.includes("skip")) {
          aiResponse =
            "If you miss a dose, take it as soon as you remember. However, if it is almost time for your next scheduled dose, skip the missed one. Never take a double dose to compensate.";
        } else if (lower.includes("side effect") || lower.includes("reaction") || lower.includes("risk")) {
          aiResponse =
            "Common mild effects of Augmentin include mild stomach upset or loose stools (taking it with yogurt/probiotics helps). Montiget may occasionally cause mild drowsiness or headache. If you notice hives or a rash, stop and contact your clinic immediately.";
        } else if (lower.includes("tea") || lower.includes("coffee") || lower.includes("caffeine")) {
          aiResponse =
            "Avoid excessive tea or coffee when taking Panadol CF. It contains Pseudoephedrine, a decongestant stimulant; combining it with high caffeine can cause palpitations or restlessness.";
        } else if (lower.includes("days") || lower.includes("duration") || lower.includes("course")) {
          aiResponse =
            `Complete the full antibiotic course as prescribed by ${currentDoctor.name}, even if symptoms subside after 2 to 3 days, to prevent bacterial recurrence.`;
        } else {
          aiResponse =
            `Hello ${patient.name}, regarding your query: Your prescribed regimen under ${currentDoctor.name} is verified for drug-drug interactions. Ensure adequate hydration and follow the post-meal schedule. Let me know if you need specific guidance!`;
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: aiResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isUrdu: respondInUrdu,
          tier: 1,
        },
      ]);
      setIsTyping(false);
    }, 900);
  };

  // Toggle dose taken state
  const toggleDose = (id: string) => {
    setSchedule((prev) =>
      prev.map((item) => (item.id === id ? { ...item, taken: !item.taken } : item))
    );
  };

  // Switch prescription preset and synchronize attending doctor
  const handleSelectPreset = (preset: "standard" | "ambiguous" | "custom") => {
    setSelectedPreset(preset);
    setIsOcrProcessing(true);
    setOcrProgress(20);
    setAmbiguityVerified(false);

    let newDocKey = "dr-tariq";
    if (preset === "standard") {
      newDocKey = "dr-tariq";
      setUploadedFileName("Rx-8842-Chest-Infection-DrTariqKhan.pdf");
      setSchedule([
        {
          id: "dose-1",
          slot: "morning",
          time: "08:00 AM",
          timeUr: "صبح 08:00 بجے",
          medicine: "Augmentin 625mg",
          medicineUr: "آگمنٹن 625 ملی گرام",
          dosage: "1 Tablet (Amoxicillin 500mg + Clavulanate 125mg)",
          dosageUr: "1 گولی (اموکسیسیلین + کلیوولانک ایسڈ)",
          salt: "Amoxicillin + Clavulanic Acid",
          instructions: "Take 30 mins after breakfast to protect stomach lining.",
          instructionsUr: "معدے کی حفاظت کے لیے ناشتے کے 30 منٹ بعد پانی سے لیں۔",
          mealPairing: "Post-Breakfast",
          mealPairingUr: "ناشتے کے بعد",
          taken: true,
          alarmSet: true,
        },
        {
          id: "dose-2",
          slot: "afternoon",
          time: "02:00 PM",
          timeUr: "دوپہر 02:00 بجے",
          medicine: "Panadol CF",
          medicineUr: "پیناڈول سی ایف",
          dosage: "1 Caplet (Paracetamol 500mg + Pseudoephedrine 30mg)",
          dosageUr: "1 گولی (پیراسیٹامول + سیوڈو فیڈرین)",
          salt: "Paracetamol + Pseudoephedrine",
          instructions: "Take with warm water if experiencing sinus congestion or fever.",
          instructionsUr: "بخار یا بند ناک کی صورت میں نیم گرم پانی کے ساتھ لیں۔",
          mealPairing: "Post-Lunch",
          mealPairingUr: "دوپہر کے کھانے کے بعد",
          taken: false,
          alarmSet: true,
        },
        {
          id: "dose-3",
          slot: "evening",
          time: "09:00 PM",
          timeUr: "رات 09:00 بجے",
          medicine: "Montiget 10mg",
          medicineUr: "مونٹی گیٹ 10 ملی گرام",
          dosage: "1 Tablet (Montelukast Sodium 10mg)",
          dosageUr: "1 گولی (مونٹی لوکاسٹ سوڈیم)",
          salt: "Montelukast Sodium",
          instructions: "Take at bedtime. Helps open airways and prevent nocturnal wheeze.",
          instructionsUr: "رات سونے سے قبل لیں۔ یہ سانس کی نالیوں کو کشادہ رکھتی ہے۔",
          mealPairing: "Bedtime",
          mealPairingUr: "سوتے وقت",
          taken: false,
          alarmSet: true,
        },
      ]);
    } else if (preset === "ambiguous") {
      newDocKey = "dr-ayesha";
      setUploadedFileName("Rx-4102-UnclearDosage-DrAyeshaMalik.jpeg");
      setSchedule([
        {
          id: "dose-1",
          slot: "morning",
          time: "08:30 AM",
          timeUr: "صبح 08:30 بجے",
          medicine: "Azithromycin 500mg",
          medicineUr: "ایزیتھرومائسن 500 ملی گرام",
          dosage: "1 Tablet (Once daily x 3 days)",
          dosageUr: "1 گولی (روزانہ 1 بار، 3 دن)",
          salt: "Azithromycin (Pending Pharmacist Verification)",
          instructions: "Hold ingestion until pharmacist reconciles handwriting.",
          instructionsUr: "فارماسسٹ کی تصدیق تک خوراک روکی گئی ہے۔",
          mealPairing: "1h Pre-Breakfast",
          mealPairingUr: "ناشتے سے 1 گھنٹہ پہلے",
          taken: false,
          alarmSet: true,
        },
        {
          id: "dose-2",
          slot: "afternoon",
          time: "02:00 PM",
          timeUr: "دوپہر 02:00 بجے",
          medicine: "Solvin Syrup",
          medicineUr: "سولون کھانسی کا شربت",
          dosage: "2 Teaspoons (Dextromethorphan + Chlorpheniramine)",
          dosageUr: "2 چائے کے چمچ",
          salt: "Dextromethorphan HBr",
          instructions: "Take after lunch for chest soothing.",
          instructionsUr: "کھانے کے بعد لیں۔",
          mealPairing: "Post-Lunch",
          mealPairingUr: "کھانے کے بعد",
          taken: true,
          alarmSet: true,
        },
        {
          id: "dose-3",
          slot: "evening",
          time: "09:00 PM",
          timeUr: "رات 09:00 بجے",
          medicine: "Panadol CF",
          medicineUr: "پیناڈول سی ایف",
          dosage: "1 Caplet as needed",
          dosageUr: "1 گولی ضرورت پڑنے پر",
          salt: "Paracetamol 500mg",
          instructions: "Take before sleep with plenty of water.",
          instructionsUr: "سوتے وقت پانی کے ساتھ لیں۔",
          mealPairing: "Bedtime",
          mealPairingUr: "سوتے وقت",
          taken: false,
          alarmSet: true,
        },
      ]);
    } else {
      newDocKey = "custom";
      setUploadedFileName(`Rx-Custom-${(customDoctorName || "Doctor").replace(/[^a-zA-Z0-9]/g, "")}.pdf`);
      setSchedule([
        {
          id: "dose-1",
          slot: "morning",
          time: "08:00 AM",
          timeUr: "صبح 08:00 بجے",
          medicine: "Concor 2.5mg",
          medicineUr: "کونکور 2.5 ملی گرام",
          dosage: "1 Tablet (Bisoprolol 2.5mg)",
          dosageUr: "1 گولی (بائیسوپرولول)",
          salt: "Bisoprolol Fumarate",
          instructions: "Take with water to regulate arterial pulse.",
          instructionsUr: "دل کی دھڑکن اور بلڈ پریشر کے توازن کے لیے لیں۔",
          mealPairing: "With Breakfast",
          mealPairingUr: "ناشتے کے ساتھ",
          taken: true,
          alarmSet: true,
        },
        {
          id: "dose-2",
          slot: "afternoon",
          time: "01:30 PM",
          timeUr: "دوپہر 01:30 بجے",
          medicine: "Glucophage 500mg",
          medicineUr: "گلوکوفیج 500 ملی گرام",
          dosage: "1 Tablet (Metformin HCl 500mg)",
          dosageUr: "1 گولی (میٹفارمین)",
          salt: "Metformin Hydrochloride",
          instructions: "Take with meal to stabilize glucose levels.",
          instructionsUr: "کھانے کے دوران لیں۔",
          mealPairing: "During Lunch",
          mealPairingUr: "کھانے کے دوران",
          taken: false,
          alarmSet: true,
        },
        {
          id: "dose-3",
          slot: "evening",
          time: "10:00 PM",
          timeUr: "رات 10:00 بجے",
          medicine: "Lipitor 10mg",
          medicineUr: "لیپیٹور 10 ملی گرام",
          dosage: "1 Tablet (Atorvastatin 10mg)",
          dosageUr: "1 گولی (ایٹورواسٹیٹن)",
          salt: "Atorvastatin Calcium",
          instructions: "Take at bedtime with water for vascular health.",
          instructionsUr: "رات سوتے وقت لیں۔",
          mealPairing: "Bedtime",
          mealPairingUr: "سوتے وقت",
          taken: false,
          alarmSet: true,
        },
      ]);
    }

    setSelectedDoctorKey(newDocKey);

    const interval = setInterval(() => {
      setOcrProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsOcrProcessing(false);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  // Handle Save Patient Profile / Switch Patient
  const handleSavePatientProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = patientFormName.trim() || "Farhan Ahmed";
    const cleanAge = Number(patientFormAge) || 42;
    const cleanGender = patientFormGender;
    const cleanGenderUr = cleanGender === "Male" ? "مرد" : cleanGender === "Female" ? "عورت" : "دیگر";
    const cleanAllergies = patientFormAllergies.trim() || "No Known Drug Allergies (NKDA)";
    const cleanMrn = patientFormMrn.trim() || `#${Math.floor(10000 + Math.random() * 90000)}-PK`;

    setPatient({
      name: cleanName,
      nameUr: cleanName,
      age: cleanAge,
      gender: cleanGender,
      genderUr: cleanGenderUr,
      mrn: cleanMrn,
      allergies: cleanAllergies,
      allergiesUr: cleanAllergies,
    });

    if (patientFormDoctorKey) {
      setSelectedDoctorKey(patientFormDoctorKey);
      if (patientFormDoctorKey === "dr-tariq") {
        setSelectedPreset("standard");
      } else if (patientFormDoctorKey === "dr-ayesha") {
        setSelectedPreset("ambiguous");
      } else {
        setSelectedPreset("custom");
      }
    }

    setEditPatientModalOpen(false);

    const docName = doctorsDatabase[patientFormDoctorKey]?.name || "Dr. Tariq Khan";
    const docNameUr = doctorsDatabase[patientFormDoctorKey]?.nameUr || "ڈاکٹر طارق خان";

    setChatMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "msg-1") {
        return [
          {
            id: "msg-1",
            sender: "ai",
            text:
              lang === "ur"
                ? `السلام علیکم ${cleanName} صاحب/صاحبہ! میں میڈی فلو کلینیکل اسسٹنٹ ہوں۔ ${docNameUr} کا نسخہ آپ کے پورٹل میں کامیابی سے لوڈ ہو چکا ہے۔ کیا آپ ادویات، خوراک کے اوقات یا سائیڈ ایفیکٹس کے بارے میں کچھ پوچھنا چاہتے ہیں؟`
                : `Hello ${cleanName}! I am your MediFlow Clinical Navigator. Your prescription from ${docName} has been loaded. How can I guide you regarding your medications, meal timings, or side effects today?`,
            timestamp: prev[0].timestamp,
            isUrdu: lang === "ur",
            tier: 1,
          },
        ];
      } else {
        return [
          ...prev,
          {
            id: `profile-update-${Date.now()}`,
            sender: "system",
            text:
              lang === "ur"
                ? `مریض کا ریکارڈ کامیابی سے تبدیل ہو گیا: ${cleanName} (MRN: ${cleanMrn} | عمر: ${cleanAge} سال | معالج: ${docNameUr})۔`
                : `Active patient record switched: ${cleanName} (MRN: ${cleanMrn} | Age: ${cleanAge} | Attending: ${docName}).`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isUrdu: lang === "ur",
            tier: 1,
          },
        ];
      }
    });

    setDownloadToast(
      lang === "ur"
        ? `✅ مریض کا نیا ریکارڈ فعال ہو گیا: ${cleanName} (${cleanMrn})`
        : `✅ Switched Active Patient: ${cleanName} (${cleanMrn})`
    );
    setTimeout(() => setDownloadToast(null), 4500);
  };

  // File Drop Simulation
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFileName(file.name);
      handleSelectPreset("custom");
    }
  };

  // Download Handover Summary as a real PDF Blob
  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    setTimeout(() => {
      try {
        const cleanMrn = patient.mrn.replace(/[^a-zA-Z0-9]/g, "") || "94021PK";
        const fileName = `MediFlow-Handover-${cleanMrn}.pdf`;

        // Generate standard-compliant PDF 1.4 document string
        const pdfData = buildClinicalPdfString(
          patient,
          currentDoctor,
          extractedMeds,
          schedule,
          isEmergencyActive,
          adherencePercent
        );

        // Create browser Blob with application/pdf MIME type
        const blob = new Blob([pdfData], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);

        // Invisible <a> tag download trigger
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Revoke object URL after download has triggered
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);

        setDownloadToast(
          lang === "ur"
            ? `✅ کلینیکل ہینڈ اوور سمری (${fileName}) کامیابی سے ڈاؤن لوڈ ہو گئی۔`
            : `✅ Clinical Handover Summary (${fileName}) generated and saved to your Downloads folder.`
        );
        setTimeout(() => setDownloadToast(null), 5000);
      } catch (err) {
        console.error("PDF generation failed:", err);
      } finally {
        setIsDownloadingPdf(false);
      }
    }, 600);
  };

  // Adherence calculation
  const takenCount = schedule.filter((s) => s.taken).length;
  const totalCount = schedule.length;
  const adherencePercent = Math.round((takenCount / totalCount) * 100);

  // Active Safety Tier calculation
  const currentSafetyTier = useMemo(() => {
    if (isEmergencyActive) return 3;
    if (selectedPreset === "ambiguous" && !ambiguityVerified) return 2;
    return 1;
  }, [isEmergencyActive, selectedPreset, ambiguityVerified]);

  // Bilingual UI dictionary
  const t = {
    appName: lang === "ur" ? "میڈی فلو اے آئی" : "MediFlow AI",
    appSub: lang === "ur" ? "کلینیکل انٹیلیجنس اور مریض پورٹل" : "Clinical Intelligence & Patient Navigation Portal",
    activePatientRecordBadge: lang === "ur" ? "📋 فعال مریض کا ریکارڈ" : "📋 ACTIVE PATIENT RECORD",
    mrnBadge: lang === "ur" ? `شناخت: ${patient.mrn}` : `MRN: ${patient.mrn}`,
    patientIdentitySummary:
      lang === "ur"
        ? `مریض: ${patient.name} | عمر: ${patient.age} سال • جنس: ${patient.genderUr} | شناختی نمبر: ${patient.mrn}`
        : `Patient: ${patient.name} | Age: ${patient.age} • Gender: ${patient.gender} | MRN: ${patient.mrn}`,
    allergies: lang === "ur" ? `الرجی: ${patient.allergiesUr}` : `Allergies: ${patient.allergies}`,
    clinician:
      lang === "ur"
        ? `نگران ڈاکٹر: ${currentDoctor.nameUr}`
        : `Attending: ${currentDoctor.name}`,
    tier1Status: lang === "ur" ? "درجہ 1: معمول (نارمل مانیٹرنگ)" : "Tier 1: Nominal Monitoring",
    tier2Status: lang === "ur" ? "درجہ 2: ہینڈ رائٹنگ تصدیق درکار" : "Tier 2: Ambiguity Flag",
    tier3Status: lang === "ur" ? "درجہ 3: ریڈ فلیگ ایمرجنسی" : "Tier 3: Red-Flag Emergency",
    emergencyBarTitle:
      lang === "ur"
        ? "24/7 کلینیکل گارڈ ریلز فعال ہیں۔ سینے میں شدید درد، سانس کی بندش یا اینافیلیکسس کی صورت میں فوری ایمرجنسی کال کریں۔"
        : "24/7 Clinical Red-Flag Guardrails Armed. Cardiopulmonary distress triggers acute emergency dispatch.",
    simulateEmergencyBtn:
      lang === "ur"
        ? "🚨 شدید ایمرجنسی ٹیسٹ کریں"
        : "🚨 Simulate Emergency",
    deescalateBtn:
      lang === "ur"
        ? "ہنگامی حالت ختم کریں اور معمول پر آئیں"
        : "De-escalate & Resume Nominal Monitoring",

    // Step Navigation Tabs (Explicit Step Titles)
    tab1Title: lang === "ur" ? "مرحلہ 1: دستاویزات اور او سی آر" : "Step 1: Document Intake & OCR",
    tab1Subtitle:
      lang === "ur"
        ? "نسخہ، ایکسرے یا لیب رپورٹ اپ لوڈ کریں"
        : "Upload prescription, radiological scan, or lab results",
    tab2Title: lang === "ur" ? "مرحلہ 2: بائی لنگوئل کلینیکل اسسٹنٹ" : "Step 2: Bilingual Clinical Assistant",
    tab2Subtitle:
      lang === "ur"
        ? "ادویات کے اوقات، ایکٹو سالٹس اور سائیڈ ایفیکٹس کے متعلق رہنمائی"
        : "Consult AI regarding medication schedules, active salts & side effects",
    tab3Title: lang === "ur" ? "مرحلہ 3: کلینیکل سیفٹی اور ٹرائی ایج" : "Step 3: Clinical Safety & Triage",
    tab3Subtitle:
      lang === "ur"
        ? "فعال کلینیکل سیفٹی انجن، ریڈ فلیگ انتباہات اور ایمرجنسی ڈسپیچ"
        : "Active clinical safety engine, red-flag triggers & emergency dispatch",

    // Step 1 Content
    step1Guidance:
      lang === "ur"
        ? "مرحلہ 1: نگران معالج منتخب کریں اور کلینیکل ریکارڈز اپ لوڈ کریں"
        : "Step 1: Select Attending Clinician & Upload Clinical Records",
    presetsLabel: lang === "ur" ? "ڈاکٹر اور نسخہ منتخب کریں:" : "Select Attending Doctor & Prescription:",
    presetStandard: lang === "ur" ? "نسخہ 8842: ڈاکٹر طارق خان (ماہر امراضِ تنفس)" : "Rx-8842: Dr. Tariq Khan (Pulmonology)",
    presetAmbiguous: lang === "ur" ? "نسخہ 4102: ڈاکٹر عائشہ ملک (جنرل میڈیسن)" : "Rx-4102: Dr. Ayesha Malik (General Medicine)",
    presetCustom: lang === "ur" ? "کسٹم نسخہ / نیا ڈاکٹر" : "Custom Upload / New Doctor",
    dragDropText:
      lang === "ur"
        ? "نسخہ، ریڈیولوجی اسکین یا لیب رپورٹ یہاں ڈریگ کریں یا فائل منتخب کریں"
        : "Drag & drop prescription, radiological scan, or lab results here",
    browseFiles: lang === "ur" ? "فائل چنیں" : "Browse Files",
    supportsFormats: lang === "ur" ? "سپورٹ شدہ فارمیٹس: PDF, JPG, PNG, DICOM (زیادہ سے زیادہ 25MB)" : "Supports: PDF, JPG, PNG, DICOM (Up to 25MB)",
    extractedSaltsTitle: lang === "ur" ? "دریافت شدہ ادویات اور ایکٹو سالٹس" : "Extracted Active Salts & Layman Schedules",
    proceedToStep2: lang === "ur" ? "کلینیکل اسسٹنٹ کی طرف آگے بڑھیں (مرحلہ 2) ➔" : "Proceed to Clinical Assistant (Step 2) ➔",
    proceedToStep3: lang === "ur" ? "سیفٹی ٹرائی ایج کا جائزہ لیں (مرحلہ 3) ➔" : "Review Safety Triage (Step 3) ➔",
    backToStep1: lang === "ur" ? "← واپس دستاویزات کے مرحلے پر" : "← Back to Documents",
    backToStep2: lang === "ur" ? "← واپس کلینیکل اسسٹنٹ پر" : "← Back to Assistant",
    downloadPdfBtn: lang === "ur" ? "کلینیکل ہینڈ اوور سمری ڈاؤن لوڈ کریں (PDF)" : "Download Clinical Handover Summary (PDF)",
    downloadingPdfText: lang === "ur" ? "پی ڈی ایف تیار ہو رہی ہے..." : "Generating Clinical PDF...",
    pharmacistVerificationReq:
      lang === "ur"
        ? "درجہ 2 انتباہ: ہینڈ رائٹنگ واضح نہیں ہے۔ فارماسسٹ سے تصدیق ضروری ہے!"
        : "Tier 2 Ambiguity Alert: Handwriting confidence low (<70%). Requires Pharmacist Verification before ingestion.",
    confirmWithPharmacistBtn: lang === "ur" ? "فارماسسٹ سے تصدیق کریں" : "Confirm with Pharmacist",
    verifiedBadge: lang === "ur" ? "فارماسسٹ سے تصدیق شدہ" : "Verified by Licensed Pharmacist",

    // Timeline in Step 1
    dailyScheduleTitle: lang === "ur" ? "روزانہ خوراک کا ٹائم لائن اور پرہیز" : "Daily Care Journey & Medication Schedule",
    adherenceScoreLabel: lang === "ur" ? "آج کی پابندی:" : "Today's Adherence:",
    dosesLoggedText:
      lang === "ur"
        ? `${takenCount} از ${totalCount} خوراکیں مکمل ہوئیں (${adherencePercent}%)`
        : `${takenCount} of ${totalCount} doses logged (${adherencePercent}%)`,
    markTaken: lang === "ur" ? "لی گئی" : "Mark Taken",
    completed: lang === "ur" ? "مکمل شدہ" : "Completed",

    // Step 2 Content
    contextBannerText:
      lang === "ur"
        ? `فعال سیاق و سباق: نسخہ ${currentDoctor.rxRef} (${currentDoctor.nameUr}) لوڈ شدہ ہے`
        : `Active Context: Prescription ${currentDoctor.rxRef} (${currentDoctor.name}) loaded`,
    quickQuestionsLabel: lang === "ur" ? "فوری طبی استفسارات:" : "Quick-Prompt Pills:",
    chatDisclaimer:
      lang === "ur"
        ? "میڈی فلو اے آئی مریض کی رہنمائی کے لیے ہے اور ڈاکٹر کے متبادل نہیں۔ شدید علامات کی صورت میں فوری ایمرجنسی خدمات حاصل کریں۔"
        : "MediFlow AI provides clinical educational navigation and does not replace your physician. Never alter medication doses without clinical authorization.",
    typePlaceholder:
      lang === "ur"
        ? "ادویات، سائیڈ ایفیکٹس یا علامات کے متعلق سوال لکھیں..."
        : "Ask about your dosage, food interactions, or side effects...",
    sendBtn: lang === "ur" ? "ارسال کریں" : "Send",
    chatLockedNotice:
      lang === "ur"
        ? "🚨 شدید ایمرجنسی الرٹ: انٹرایکٹو چیٹ عارضی طور پر لاک کر دی گئی ہے۔ فوری طور پر 1122 یا 911 پر کال کریں۔"
        : "🚨 Acute distress detected. Interactive chat locked. Call Emergency Dispatch 1122 / 911 immediately.",

    // Step 3 Content
    safetyDashboardTitle: lang === "ur" ? "میڈی فلو 3-ٹائر کلینیکل سیفٹی گارڈ ریلز" : "MediFlow 3-Tier Clinical Safety Architecture",
    safetyDashboardSub:
      lang === "ur"
        ? "ریئل ٹائم مانیٹرنگ، ایمرجنسی ڈسپیچ اور سسٹم آڈٹ ٹریل"
        : "Real-time safety engine thresholds, red-flag triggers, and verified emergency dispatch",
    call1122Btn: lang === "ur" ? "ریسکیو 1122 پر کال کریں (پاکستان)" : "Call Rescue 1122 (Pakistan Dispatch)",
    call1122Subtitle: lang === "ur" ? "براہ راست ڈائل کریں: 1122 (ایمبولینس / طبی عملہ)" : "Direct Dial: 1122 (Ambulance / Paramedics)",
    call911Btn: lang === "ur" ? "911 ایمرجنسی پر کال کریں" : "Call 911 (International Emergency)",
    call911Subtitle: lang === "ur" ? "براہ راست ڈائل کریں: 911 (ہنگامی سروس)" : "Direct Dial: 911 (Emergency Response)",
    auditTrailTitle: lang === "ur" ? "ریئل ٹائم سیفٹی آڈٹ ٹریل لاگز" : "Real-Time Clinical Safety Audit Trail",
    firstAidTitle: lang === "ur" ? "فوری مریض ٹرائی ایج اور فرسٹ ایڈ گائیڈ:" : "Immediate Patient Triage Protocol:",
    firstAid1:
      lang === "ur"
        ? "1. سیدھے بیٹھ جائیں اور گردن یا سینے کے تنگ کپڑے ڈھیلے کر لیں۔ لیٹنے سے گریز کریں۔"
        : "1. Sit upright in a comfortable position. Loosen restrictive clothing around chest and neck. Do NOT lie flat.",
    firstAid2:
      lang === "ur"
        ? "2. خود گاڑی چلا کر ہسپتال جانے کی کوشش نہ کریں۔ ریسکیو ایمبولینس کا انتظار کریں۔"
        : "2. Do NOT attempt to drive yourself to the hospital. Await paramedic dispatch.",
    firstAid3:
      lang === "ur"
        ? "3. اگر ایمرجنسی کال آپریٹر ہدایت کرے اور الرجی نہ ہو تو 300 ملی گرام اسپرین چبا لیں۔"
        : "3. If instructed by emergency call handler and not allergic, chew 300mg un-coated Aspirin.",
    firstAid4:
      lang === "ur"
        ? "4. گھر کا بیرونی دروازہ کھول دیں تاکہ ایمبولینس عملہ بغیر رکاوٹ اندر آ سکے۔"
        : "4. Unlock your front door so emergency responders can enter without obstruction.",

    // Modals
    emergencyModalTitle: lang === "ur" ? "انتہائی ہنگامی انتباہ (درجہ 3 ریڈ فلیگ)" : "CRITICAL TIER 3 RED-FLAG ALERT",
    emergencyModalSub:
      lang === "ur"
        ? "شدید طبی خطرہ (سینے میں درد یا سانس کی تنگی) کی علامات محسوس کی گئی ہیں!"
        : "Acute cardiopulmonary distress or high-priority clinical red-flag detected!",
    pharmacistModalTitle: lang === "ur" ? "فارماسسٹ سے نسخے کی تصدیق" : "Pharmacist Handwritten Prescription Verification",
    pharmacistModalSub:
      lang === "ur"
        ? "کلینیکل فارماسسٹ ڈاکٹر ثناء بشیر (PharmD) آن لائن دستیاب ہیں"
        : "Clinical Pharmacist Dr. Sana Bashir (PharmD, RPh) - On Duty",
    pharmacistResolveExplanation:
      lang === "ur"
        ? "فارماسسٹ نے نسخہ دیکھ کر تصدیق کی ہے: دوا 'ایزیتھرومائسن 500 ملی گرام' ہے، روزانہ 1 گولی 3 دن کے لیے۔ اب یہ محفوظ ہے۔"
        : "Pharmacist visual verification: The physician's script has been manually reconciled as 'Azithromycin 500mg' tablet once daily for 3 days. Dosage ambiguity is resolved.",
    approveRxBtn: lang === "ur" ? "تصدیق قبول کریں اور شیڈول اپ ڈیٹ کریں" : "Approve Reconciled Dose & Unlock Safety Gate",
    dismiss: lang === "ur" ? "بند کریں" : "Close",
    editProfileBtn: lang === "ur" ? "پروفائل تبدیل کریں" : "Edit Profile",
    resetHomeBtn: lang === "ur" ? "🏠 ہوم پر واپس" : "🏠 Reset to Home",
  };

  // Quick Questions
  const sampleQuestions =
    lang === "ur"
      ? [
          "مجھے دوا کھانے کے بعد لینی ہے یا پہلے؟",
          "اگر دوپہر کی دوا چھوٹ جائے تو کیا کروں؟",
          "پیناڈول سی ایف کے ساتھ چائے یا کافی پی سکتے ہیں؟",
          "اینٹی بائیوٹک کا کورس کتنے دن میں پورا کرنا ہے؟",
          "مجھے سینے میں شدید درد اور سانس لینے میں دشواری ہو رہی ہے!",
        ]
      : [
          "Should I take my medicine before or after meals?",
          "What should I do if I forget the afternoon dose?",
          "Can I drink tea while on Panadol CF?",
          "How many days should I continue this antibiotic?",
          "I have sudden severe chest pain and breathlessness!",
        ];

  return (
    <div
      dir={lang === "ur" ? "rtl" : "ltr"}
      className={`min-h-screen bg-slate-50 text-slate-900 transition-all duration-300 font-sans flex flex-col ${
        lang === "ur" ? "font-serif leading-relaxed" : ""
      }`}
    >
      {/* Toast Notification for Download */}
      {downloadToast && (
        <div className="fixed top-20 right-4 z-50 rounded-xl bg-emerald-900/95 text-white px-4 py-3 shadow-2xl border border-emerald-500/80 flex items-center gap-3 text-xs sm:text-sm font-medium animate-in slide-in-from-top-4 duration-200 backdrop-blur-md">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{downloadToast}</span>
        </div>
      )}

      {/* =========================================================================
          PATIENT RECORD MANAGEMENT & INTAKE MODAL
          ========================================================================= */}
      {editPatientModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl my-auto flex flex-col max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between bg-teal-700 px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-800 text-white shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    {lang === "ur" ? "مریض کے ریکارڈ کا انتظام اور داخلہ" : "Patient Record Management & Intake"}
                  </h3>
                  <p className="text-[11px] text-teal-100 font-medium mt-0.5">
                    {lang === "ur"
                      ? "نیا مریض رجسٹر کریں یا ٹیسٹنگ کے لیے پہلے سے طے شدہ ڈیمو پروفائلز منتخب کریں"
                      : "Register a new clinical patient or select from predefined demonstration profiles"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditPatientModalOpen(false)}
                className="rounded-lg bg-teal-800/80 p-1.5 text-white hover:bg-teal-800 transition cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePatientProfile} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-slate-800">
              {/* Quick Presets for Demo */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-teal-700" />
                    <span>{lang === "ur" ? "ڈیمو پروفائلز (ایک کلک پر منتخب کریں):" : "Quick Demo Presets:"}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Click to populate</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPatientPreset("farhan")}
                    className="flex flex-col items-start p-2 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-300 text-left transition cursor-pointer text-xs"
                  >
                    <span className="font-bold text-slate-900">Farhan Ahmed</span>
                    <span className="text-[11px] text-slate-500">42y • Pulmonology</span>
                    <span className="text-[10px] text-rose-700 font-semibold mt-0.5">Penicillin Allergy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPatientPreset("zainab")}
                    className="flex flex-col items-start p-2 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-300 text-left transition cursor-pointer text-xs"
                  >
                    <span className="font-bold text-slate-900">Zainab Bibi</span>
                    <span className="text-[11px] text-slate-500">29y • Internal Med</span>
                    <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">NKDA (No Allergies)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPatientPreset("custom")}
                    className="flex flex-col items-start p-2 rounded-lg border border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-100/60 text-left transition cursor-pointer text-xs"
                  >
                    <span className="font-bold text-teal-900">+ Custom Patient</span>
                    <span className="text-[11px] text-teal-700">Blank form input</span>
                    <span className="text-[10px] text-teal-800 font-medium mt-0.5">Auto-generate MRN</span>
                  </button>
                </div>
              </div>

              {/* Patient Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {lang === "ur" ? "مریض کا پورا نام:" : "Patient Full Name:"}
                </label>
                <input
                  type="text"
                  required
                  value={patientFormName}
                  onChange={(e) => setPatientFormName(e.target.value)}
                  placeholder="e.g. Zainab Bibi or Hamza Malik"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                />
              </div>

              {/* Age, Gender & MRN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {lang === "ur" ? "عمر (سال):" : "Age (Years):"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={patientFormAge}
                    onChange={(e) => setPatientFormAge(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {lang === "ur" ? "جنس:" : "Gender:"}
                  </label>
                  <select
                    value={patientFormGender}
                    onChange={(e) => setPatientFormGender(e.target.value as "Male" | "Female" | "Other")}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                  >
                    <option value="Male">{lang === "ur" ? "مرد (Male)" : "Male"}</option>
                    <option value="Female">{lang === "ur" ? "عورت (Female)" : "Female"}</option>
                    <option value="Other">{lang === "ur" ? "دیگر (Other)" : "Other"}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {lang === "ur" ? "میڈیکل ریکارڈ نمبر:" : "Record MRN:"}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      required
                      value={patientFormMrn}
                      onChange={(e) => setPatientFormMrn(e.target.value)}
                      placeholder="#94021-PK"
                      className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setPatientFormMrn(`#${Math.floor(10000 + Math.random() * 90000)}-PK`)}
                      className="shrink-0 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer text-xs"
                      title="Generate Random MRN"
                    >
                      🎲
                    </button>
                  </div>
                </div>
              </div>

              {/* Attending Physician selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {lang === "ur" ? "نگران معالج (ڈاکٹر):" : "Attending Physician / Clinician:"}
                </label>
                <select
                  value={patientFormDoctorKey}
                  onChange={(e) => setPatientFormDoctorKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                >
                  <option value="dr-tariq">
                    Dr. Tariq Khan, MD (Pulmonology & Critical Care) — Rx-8842
                  </option>
                  <option value="dr-ayesha">
                    Dr. Ayesha Malik, MD (Internal Medicine & Pulmonology) — Rx-4102
                  </option>
                  <option value="custom">
                    Dr. Zeeshan Ali, MD (Cardiology & Internal Medicine) — Rx-Custom
                  </option>
                </select>
              </div>

              {/* Known Drug Allergies */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {lang === "ur" ? "معلوم طبی الرجیز:" : "Known Drug Allergies:"}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPatientFormAllergies("Penicillin (Cross-Reactivity Risk)")}
                      className="text-[10px] font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                    >
                      Penicillin
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientFormAllergies("Sulfa Drugs")}
                      className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition cursor-pointer"
                    >
                      Sulfa
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientFormAllergies("No Known Drug Allergies (NKDA)")}
                      className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition cursor-pointer"
                    >
                      NKDA
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={patientFormAllergies}
                  onChange={(e) => setPatientFormAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa drugs, or No Known Drug Allergies (NKDA)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 font-medium"
                />
              </div>

              {/* Dynamic Real-time notice */}
              <div className="rounded-xl bg-teal-50 p-3.5 border border-teal-200 text-xs text-teal-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  {lang === "ur"
                    ? "مریض کی تفصیلات محفوظ کرنے سے پورٹل کا ہیڈر، اوتار کے ابتدائی حروف، کلینیکل چیٹ اسسٹنٹ اور ایچ آر پی ڈی ایف ہینڈ اوور خود بخود ہم آہنگ ہو جائیں گے۔"
                    : "Saving updates the active patient record strip, circular avatar initials, bilingual clinical chat greetings, and the hospital-grade PDF handover export in real time."}
                </span>
              </div>

              {/* Modal Actions */}
              <div className="shrink-0 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditPatientModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t.dismiss}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-700 hover:bg-teal-800 px-5 py-2.5 text-xs font-bold text-white shadow-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>{lang === "ur" ? "ریکارڈ محفوظ کریں اور تبدیل کریں" : "Save & Switch Active Patient"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 3 ACUTE EMERGENCY MODAL (Desktop direct number fallback)
          ========================================================================= */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl my-auto flex flex-col max-h-[92vh] rounded-2xl border-2 border-red-600 bg-white shadow-2xl overflow-hidden">
            <div className="shrink-0 flex items-center justify-between bg-red-600 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-white text-red-600 font-black text-[10px] items-center justify-center">
                    !
                  </span>
                </span>
                <div className="text-base sm:text-lg font-black tracking-wide uppercase">
                  {t.emergencyModalTitle}
                </div>
              </div>
              <button
                onClick={() => setEmergencyModalOpen(false)}
                className="rounded-lg bg-red-700 p-1.5 text-white hover:bg-red-800 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-900">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-base text-red-900">{t.emergencyModalSub}</h3>
                    <p className="mt-1 text-xs sm:text-sm text-red-800">
                      {lang === "ur"
                        ? "میڈی فلو اے آئی نے فوری طور پر مریض کی سرگرمی معطل کر دی ہے تاکہ وقت ضائع کیے بغیر فوری ایمرجنسی خدمات حاصل کی جا سکیں۔"
                        : "MediFlow AI has intercepted acute cardiopulmonary red flags. Digital medical chat is locked to prevent catastrophic delay."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons with clear desktop dialer fallback */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href="tel:1122"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-red-600 px-4 py-3.5 text-white shadow-sm hover:bg-red-700 transition transform active:scale-95 text-center"
                >
                  <div className="flex items-center gap-2 text-base font-bold">
                    <Phone className="h-5 w-5 animate-bounce" />
                    <span>{t.call1122Btn}</span>
                  </div>
                  <div className="text-xs text-red-100 font-medium">
                    {t.call1122Subtitle}
                  </div>
                </a>

                <a
                  href="tel:911"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 py-3.5 text-white shadow-sm hover:bg-slate-800 transition transform active:scale-95 text-center"
                >
                  <div className="flex items-center gap-2 text-base font-bold">
                    <Phone className="h-5 w-5" />
                    <span>{t.call911Btn}</span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    {t.call911Subtitle}
                  </div>
                </a>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-2.5 flex items-center gap-2 text-sm">
                  <HeartPulse className="h-4 w-4 text-red-600" />
                  {t.firstAidTitle}
                </h4>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <span>{t.firstAid1}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <span>{t.firstAid2}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <span>{t.firstAid3}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <span>{t.firstAid4}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-3 sm:px-6 bg-slate-50 border-t border-slate-200">
              <span className="text-[11px] text-slate-500 font-mono">
                Emergency ID: RED-FLG-9024 • Timestamp: {new Date().toLocaleTimeString()}
              </span>
              <button
                onClick={resetEmergency}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.deescalateBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 2 AMBIGUITY VERIFICATION MODAL
          ========================================================================= */}
      {pharmacistModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl my-auto flex flex-col max-h-[90vh] rounded-2xl bg-white shadow-xl border border-amber-300 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between bg-amber-500 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-base sm:text-lg">{t.pharmacistModalTitle}</h3>
              </div>
              <button
                onClick={() => setPharmacistModalOpen(false)}
                className="rounded-lg bg-amber-600 p-1 text-white hover:bg-amber-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-bold text-sm">
                  SB
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{t.pharmacistModalSub}</div>
                  <div className="text-xs text-slate-500">License: PK-PHR-88192 • Shifa International Health Alliance</div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs sm:text-sm text-amber-900 space-y-2">
                <div className="font-semibold text-amber-950 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Clinical Pharmacist Notes:
                </div>
                <p>{t.pharmacistResolveExplanation}</p>
                <div className="mt-2 text-xs font-mono bg-white/90 p-2 rounded border border-amber-200 text-slate-800">
                  Rx ID: 4102 • Resolved Active Salt: Azithromycin 500mg • Frequency: 1 Tab PO OD x 3 Days
                </div>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setPharmacistModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                {t.dismiss}
              </button>
              <button
                onClick={() => {
                  setAmbiguityVerified(true);
                  setPharmacistModalOpen(false);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Check className="h-4 w-4" />
                {t.approveRxBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REFINED CLINICAL ALERT BAR (Top Triage Strip - Healthcare Aesthetic)
          ========================================================================= */}
      <div
        className={`w-full transition-colors duration-300 border-b ${
          isEmergencyActive
            ? "bg-red-700 text-white border-red-800 animate-pulse"
            : "bg-rose-50/90 text-rose-900 border-rose-200"
        } px-4 py-2 sm:py-2.5`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 font-medium text-center md:text-left">
            {isEmergencyActive ? (
              <ShieldAlert className="h-4 sm:h-5 w-4 sm:w-5 shrink-0 text-white" />
            ) : (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
            )}
            <span className={isEmergencyActive ? "font-bold text-white" : "font-semibold text-rose-900"}>
              {t.emergencyBarTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEmergencyActive ? (
              <button
                onClick={resetEmergency}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1 text-xs font-bold text-red-800 shadow-xs hover:bg-red-50 transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t.deescalateBtn}</span>
              </button>
            ) : (
              <button
                onClick={triggerEmergency}
                className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-100/60 transition cursor-pointer"
              >
                <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                <span>{t.simulateEmergencyBtn}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN PORTAL TOP BAR: Clickable Brand Logo + Reset to Home + Language Switcher
          ========================================================================= */}
      <header className="border-b border-slate-200/80 bg-white shadow-2xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Clickable Brand Logo (Navigates directly back to Step 1 Home) */}
            <button
              onClick={() => setActiveTab(1)}
              className="flex items-center gap-3 text-left transition hover:opacity-90 cursor-pointer group"
              title="Return to Home (Step 1: Document Intake)"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm shadow-teal-700/20 group-hover:bg-teal-800 transition">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-teal-900 transition">
                    {t.appName}
                  </span>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200/80">
                    Clinical SaaS
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">{t.appSub}</p>
              </div>
            </button>

            {/* Right Controls: Reset to Home Button + Standalone Language Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Reset to Home Button */}
              <button
                onClick={() => setActiveTab(1)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-800 px-3 py-1.5 text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Restart Workflow at Step 1"
              >
                <Home className="h-3.5 w-3.5 text-teal-700" />
                <span>{t.resetHomeBtn}</span>
              </button>

              {/* Standalone Premium Bilingual Language Switcher */}
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200/90 shadow-2xs">
                <div className="flex items-center gap-1 px-1.5 text-xs font-semibold text-slate-600">
                  <Globe className="h-3.5 w-3.5 text-teal-700" />
                  <span className="hidden md:inline">Language / زبان</span>
                </div>
                <button
                  onClick={() => setLang("en")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    lang === "en"
                      ? "bg-white text-teal-800 shadow-xs border border-slate-200/70"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLang("ur")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    lang === "ur"
                      ? "bg-white text-teal-800 shadow-xs border border-slate-200/70 font-serif"
                      : "text-slate-600 hover:text-slate-900 font-serif"
                  }`}
                >
                  <span>اردو</span>
                  <span className="text-[10px] bg-teal-100 text-teal-800 px-1 py-0.2 rounded font-mono font-semibold">RTL</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        {/* =======================================================================
            SECTION 2: CLARIFIED PATIENT IDENTITY (Active Patient Card)
            Styled with subtle light-blue clinical card background (bg-sky-50/40 border border-sky-100)
            ======================================================================= */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Left: Prominent Identification Badge & Identity */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white font-extrabold text-base shadow-sm shadow-teal-700/20">
                {patientInitials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md inline-block">
                    {t.activePatientRecordBadge}
                  </div>
                  <button
                    onClick={() => {
                      setPatientFormName(patient.name);
                      setPatientFormAge(patient.age);
                      setPatientFormGender(patient.gender);
                      setPatientFormAllergies(patient.allergies);
                      setPatientFormDoctorKey(selectedDoctorKey);
                      setPatientFormMrn(patient.mrn);
                      setEditPatientModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100/80 border border-teal-200/90 px-2.5 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Register New Patient or Switch Profile"
                  >
                    <span>+ Register / Switch Patient</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    {patient.name}
                  </h2>
                  <button
                    onClick={() => {
                      setPatientFormName(patient.name);
                      setPatientFormAge(patient.age);
                      setPatientFormGender(patient.gender);
                      setPatientFormAllergies(patient.allergies);
                      setPatientFormDoctorKey(selectedDoctorKey);
                      setPatientFormMrn(patient.mrn);
                      setEditPatientModalOpen(true);
                    }}
                    className="text-slate-400 hover:text-teal-700 transition p-1 rounded-md hover:bg-sky-100/60 cursor-pointer"
                    title="Edit Patient Profile"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  {t.patientIdentitySummary}
                </p>
              </div>
            </div>

            {/* Right: Clean Muted Metadata Badges as Pill Tags */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Attending Doctor Pill */}
              <div className="flex items-center gap-1.5 rounded-full bg-white border border-teal-200/90 px-3 py-1 text-xs text-teal-900 shadow-2xs">
                <Stethoscope className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                <span className="font-medium text-teal-700">Attending:</span>
                <span className="font-bold">{currentDoctor.name}</span>
                <span className="text-teal-600/90 text-[11px] hidden sm:inline">({currentDoctor.specialty})</span>
              </div>

              {/* Allergies Pill */}
              <div className="flex items-center gap-1.5 rounded-full bg-white border border-amber-200/90 px-3 py-1 text-xs text-amber-900 shadow-2xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="font-medium text-amber-800">Allergies:</span>
                <span className="font-bold">{patient.allergies}</span>
              </div>

              {/* Safety Status Pill */}
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors shadow-2xs ${
                  currentSafetyTier === 3
                    ? "bg-rose-50 text-rose-800 border-rose-300 animate-pulse"
                    : currentSafetyTier === 2
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-white text-emerald-800 border-emerald-300"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {currentSafetyTier === 3
                    ? t.tier3Status
                    : currentSafetyTier === 2
                    ? t.tier2Status
                    : t.tier1Status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            SECTION 3: TOP 3-STEP NAVIGATION CARDS WITH CONNECTING PROGRESS INDICATOR
            Pills with soft slate inactive states and deep medical teal active states
            ======================================================================= */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-3">
          {/* Progress Bar Indicator Line */}
          <div className="relative mb-2">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-700 transition-all duration-300 rounded-full"
                style={{
                  width: activeTab === 1 ? "33.33%" : activeTab === 2 ? "66.66%" : "100%",
                }}
              />
            </div>
          </div>

          {/* Stepper Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Step 1 Card: Document Intake & OCR */}
            <button
              onClick={() => setActiveTab(1)}
              className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeTab === 1
                  ? "border-teal-700 bg-teal-50/70 text-teal-950 shadow-xs ring-1 ring-teal-600/30"
                  : activeTab > 1
                  ? "border-emerald-200 bg-emerald-50/30 text-slate-800 hover:bg-emerald-50/60"
                  : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 text-slate-700"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                  activeTab === 1
                    ? "bg-teal-700 text-white shadow-xs"
                    : activeTab > 1
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {activeTab > 1 ? <Check className="h-5 w-5 stroke-[2.5]" /> : "1"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    {t.tab1Title}
                  </div>
                  <span
                    className={`rounded text-[10px] font-extrabold px-1.5 py-0.2 shrink-0 ${
                      activeTab === 1
                        ? "bg-teal-200 text-teal-900"
                        : activeTab > 1
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {activeTab === 1 ? "Active" : activeTab > 1 ? "Completed" : "Step 1"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {t.tab1Subtitle}
                </div>
              </div>
            </button>

            {/* Step 2 Card: Bilingual Clinical Assistant */}
            <button
              onClick={() => setActiveTab(2)}
              className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeTab === 2
                  ? "border-teal-700 bg-teal-50/70 text-teal-950 shadow-xs ring-1 ring-teal-600/30"
                  : activeTab > 2
                  ? "border-emerald-200 bg-emerald-50/30 text-slate-800 hover:bg-emerald-50/60"
                  : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 text-slate-700"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                  activeTab === 2
                    ? "bg-teal-700 text-white shadow-xs"
                    : activeTab > 2
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {activeTab > 2 ? <Check className="h-5 w-5 stroke-[2.5]" /> : "2"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    {t.tab2Title}
                  </div>
                  <span
                    className={`rounded text-[10px] font-extrabold px-1.5 py-0.2 shrink-0 ${
                      activeTab === 2
                        ? "bg-teal-200 text-teal-900"
                        : activeTab > 2
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {activeTab === 2 ? "Active" : activeTab > 2 ? "Completed" : "Step 2"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {t.tab2Subtitle}
                </div>
              </div>
            </button>

            {/* Step 3 Card: Clinical Safety & Triage */}
            <button
              onClick={() => setActiveTab(3)}
              className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeTab === 3
                  ? "border-teal-700 bg-teal-50/70 text-teal-950 shadow-xs ring-1 ring-teal-600/30"
                  : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 text-slate-700"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                  activeTab === 3
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                3
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    {t.tab3Title}
                  </div>
                  <span
                    className={`rounded text-[10px] font-extrabold px-1.5 py-0.2 shrink-0 ${
                      activeTab === 3
                        ? "bg-teal-200 text-teal-900"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {activeTab === 3 ? "Active" : "Step 3"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {t.tab3Subtitle}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* =======================================================================
            VIEW 1: DOCUMENT INTAKE & VISION OCR (Intake Stage)
            ======================================================================= */}
        {activeTab === 1 && (
          <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200 pb-12">
            {/* Step 1 Guidance Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 text-white p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-teal-500/25 border border-teal-400/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-200 mb-2">
                  Workflow Stage 1 of 3
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{t.step1Guidance}</h2>
                <p className="text-xs sm:text-sm text-teal-100/90 mt-1">
                  Select a clinical reference preset or drop your prescription scan below. Our vision engine extracts active salts, schedules, and clinical safety thresholds.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 px-3.5 py-2 text-xs font-medium shrink-0">
                <Sparkles className="h-4 w-4 text-teal-300" />
                <span>Multimodal Vision OCR v2.5</span>
              </div>
            </div>

            {/* Doctor Selection: Row of Cards */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-teal-700" />
                    <span>{t.presetsLabel}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any prescription case study to test nominal extraction, handwriting ambiguity, or custom clinician upload.
                  </p>
                </div>
                <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-md font-semibold hidden sm:inline-block">
                  Attending: {currentDoctor.name}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Rx-8842: Dr. Tariq Khan */}
                <button
                  onClick={() => handleSelectPreset("standard")}
                  className={`flex flex-col p-4 rounded-xl border text-left transition cursor-pointer ${
                    selectedPreset === "standard"
                      ? "border-teal-700 bg-teal-50/60 text-teal-950 font-semibold shadow-xs ring-2 ring-teal-600/30"
                      : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <span className="text-sm font-extrabold text-teal-900">Rx-8842</span>
                    {selectedPreset === "standard" ? (
                      <CheckCircle className="h-4 w-4 text-teal-700" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900">Dr. Tariq Khan</span>
                  <span className="text-xs text-slate-600 mt-0.5">Pulmonology & Critical Care</span>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                    <span className="text-emerald-700 font-bold">98% OCR Confidence</span>
                    <span className="text-slate-500">Tier 1 Nominal</span>
                  </div>
                </button>

                {/* Rx-4102: Dr. Ayesha Malik */}
                <button
                  onClick={() => handleSelectPreset("ambiguous")}
                  className={`flex flex-col p-4 rounded-xl border text-left transition cursor-pointer ${
                    selectedPreset === "ambiguous"
                      ? "border-amber-500 bg-amber-50/80 text-amber-950 font-semibold shadow-xs ring-2 ring-amber-500/30"
                      : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <span className="text-sm font-extrabold text-amber-900">Rx-4102</span>
                    {selectedPreset === "ambiguous" ? (
                      <CheckCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900">Dr. Ayesha Malik</span>
                  <span className="text-xs text-slate-600 mt-0.5">General Medicine & OPD</span>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                    <span className="text-amber-700 font-bold">Tier 2 Ambiguity (68%)</span>
                    <span className="text-amber-800">Requires Sign-off</span>
                  </div>
                </button>

                {/* Custom Upload: Dr. Zeeshan Ali */}
                <button
                  onClick={() => handleSelectPreset("custom")}
                  className={`flex flex-col p-4 rounded-xl border text-left transition cursor-pointer ${
                    selectedPreset === "custom"
                      ? "border-teal-700 bg-teal-50/60 text-teal-950 font-semibold shadow-xs ring-2 ring-teal-600/30"
                      : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <span className="text-sm font-extrabold text-teal-900">Rx-Custom</span>
                    {selectedPreset === "custom" ? (
                      <CheckCircle className="h-4 w-4 text-teal-700" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-slate-300" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900 truncate">{customDoctorName}</span>
                  <span className="text-xs text-slate-600 mt-0.5 truncate">{customDoctorSpecialty}</span>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                    <span className="text-teal-700 font-bold">Custom Ingestion</span>
                    <span className="text-slate-500">Live Config</span>
                  </div>
                </button>
              </div>

              {/* Custom Doctor Editor */}
              {selectedPreset === "custom" && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                      <Pencil className="h-3.5 w-3.5 text-teal-700" />
                      <span>{lang === "ur" ? "نئے معالج کی تفصیلات درج کریں:" : "Specify Custom Attending Clinician Details:"}</span>
                    </div>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded">
                      Live Synchronized
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Doctor Full Name:
                      </label>
                      <input
                        type="text"
                        value={customDoctorName}
                        onChange={(e) => setCustomDoctorName(e.target.value)}
                        placeholder="e.g. Dr. Zeeshan Ali"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Specialty & Department:
                      </label>
                      <input
                        type="text"
                        value={customDoctorSpecialty}
                        onChange={(e) => setCustomDoctorSpecialty(e.target.value)}
                        placeholder="e.g. Cardiology & Internal Medicine"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Prominent Upload Dropzone */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragOver
                    ? "border-teal-600 bg-teal-50/70 scale-[1.01]"
                    : "border-slate-300 bg-slate-50/60 hover:bg-slate-50"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 mb-3 shadow-2xs">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="text-base font-bold text-slate-800">{t.dragDropText}</div>
                <p className="mt-1 text-xs text-slate-500">{t.supportsFormats}</p>

                <div className="mt-5 flex items-center gap-3">
                  <label className="cursor-pointer rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition">
                    {t.browseFiles}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadedFileName(e.target.files[0].name);
                          handleSelectPreset("custom");
                        }
                      }}
                    />
                  </label>
                  <span className="text-xs text-slate-400">or drop prescription directly</span>
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs text-slate-700 shadow-2xs">
                  <FileText className="h-4 w-4 text-teal-700" />
                  <span className="font-mono font-medium truncate max-w-sm">{uploadedFileName}</span>
                  <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 font-bold">
                    Ingested & Scanned
                  </span>
                </div>
              </div>

              {/* OCR Progress Meter */}
              {isOcrProcessing && (
                <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 space-y-2 animate-in fade-in">
                  <div className="flex justify-between text-xs text-teal-900 font-semibold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-700" />
                      Multimodal Vision Parsing & Chemical Salt Disambiguation...
                    </span>
                    <span>{ocrProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-teal-200 overflow-hidden">
                    <div
                      className="h-full bg-teal-700 transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tier 2 Ambiguity Alert */}
              {selectedPreset === "ambiguous" && !ambiguityVerified && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-amber-900 flex items-center gap-2">
                        <span>{t.pharmacistVerificationReq}</span>
                        <span className="bg-amber-200 text-amber-900 text-[10px] uppercase font-black px-2 py-0.5 rounded">
                          Tier 2 Safety Gate
                        </span>
                      </div>
                      <p className="text-xs text-amber-800">
                        {lang === "ur"
                          ? "ڈاکٹر عائشہ ملک کے نسخے پر لکھائی مدہم ہے جس کی وجہ سے OCR کی درستگی 68 فیصد رہ گئی ہے۔ ممکنہ اوور ڈوز کے خطرے سے بچنے کے لیے خوراک کو لاک کیا گیا ہے۔"
                          : "Dr. Ayesha Malik's handwritten prescription ink is blurred. System confidence (68%) triggered a Tier 2 hold. Ingestion schedule is pending licensed pharmacist verification."}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setPharmacistModalOpen(true)}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition cursor-pointer"
                    >
                      <Stethoscope className="h-4 w-4" />
                      <span>{t.confirmWithPharmacistBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tier 2 Verified Badge */}
              {selectedPreset === "ambiguous" && ambiguityVerified && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-emerald-900">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>{t.verifiedBadge}</span>
                    <span className="text-slate-500 font-normal">
                      (Pharmacist: Dr. Sana Bashir, PharmD)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                    Confidence: 100% Verified
                  </span>
                </div>
              )}
            </div>

            {/* OCR Active Salts Cards */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Pill className="h-4 w-4 text-teal-700" />
                  <span>{t.extractedSaltsTitle}</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {extractedMeds.length} Active Salts Verified for {currentDoctor.name}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {extractedMeds.map((med) => (
                  <div
                    key={med.id}
                    className={`rounded-xl border p-4 transition-all ${
                      med.isAmbiguous
                        ? "border-amber-300 bg-amber-50/40"
                        : "border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-teal-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {lang === "ur" ? med.brandNameUr : med.brandName}
                        </h4>
                        <span className="inline-block mt-0.5 rounded bg-teal-100 text-teal-800 text-[11px] px-2 py-0.5 font-mono font-semibold">
                          {lang === "ur" ? med.activeSaltUr : med.activeSalt}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          med.confidence > 90
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {med.confidence}%
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 mt-2">
                      <strong>{lang === "ur" ? "ہدایت: " : "Schedule: "}</strong>
                      {lang === "ur" ? med.dosageUr : med.dosage}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-700 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <Info className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                        <span>
                          <strong>{lang === "ur" ? "آسان گائیڈ: " : "Layman: "}</strong>
                          {lang === "ur" ? med.laymanExplanationUr : med.laymanExplanation}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-teal-800">
                        <Clock className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                        <span>
                          <strong>{lang === "ur" ? "کھانے کے اوقات: " : "Meals: "}</strong>
                          {lang === "ur" ? med.mealAdviceUr : med.mealAdvice}
                        </span>
                      </div>
                    </div>

                    {med.isAmbiguous && (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-100/70 p-2 text-xs text-amber-900">
                        <span className="text-[11px]">{lang === "ur" ? "تصدیق باقی ہے" : "Pending Sign-off"}</span>
                        <button
                          onClick={() => setPharmacistModalOpen(true)}
                          className="font-bold underline text-amber-950 hover:text-amber-800 text-[11px] cursor-pointer"
                        >
                          {t.confirmWithPharmacistBtn}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Care Journey Timeline */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-teal-700" />
                    <span>{t.dailyScheduleTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chronological dosage slots, meal pairing instructions, and daily adherence tracking.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900">{t.dosesLoggedText}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {schedule.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-all ${
                      item.taken
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-200/80 bg-white hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        onClick={() => toggleDose(item.id)}
                        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg border transition cursor-pointer ${
                          item.taken
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-white text-transparent hover:border-teal-600"
                        }`}
                        title={item.taken ? "Mark as uncompleted" : "Mark as taken"}
                      >
                        <Check className="h-4 w-4 stroke-[3]" />
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {lang === "ur" ? item.medicineUr : item.medicine}
                          </span>
                          <span className="rounded bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 font-medium">
                            {lang === "ur" ? item.timeUr : item.time}
                          </span>
                          <span className="rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] px-2 py-0.2 font-semibold">
                            {lang === "ur" ? item.mealPairingUr : item.mealPairing}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {lang === "ur" ? item.dosageUr : item.dosage}
                        </div>
                        <p className="text-xs text-slate-600">
                          {lang === "ur" ? item.instructionsUr : item.instructions}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        <BellRing className="h-3 w-3 text-teal-700" />
                        <span>Alarm Set</span>
                      </div>
                      <button
                        onClick={() => toggleDose(item.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                          item.taken
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-teal-700 text-white hover:bg-teal-800 shadow-xs"
                        }`}
                      >
                        {item.taken ? t.completed : t.markTaken}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 2: BILINGUAL CLINICAL ASSISTANT (Consultation Stage)
            ======================================================================= */}
        {activeTab === 2 && (
          <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200 pb-12">
            {/* Context Indicator Banner */}
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-950 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-teal-700 shrink-0" />
                <span className="font-semibold">{t.contextBannerText}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-teal-800">
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200">
                  Diagnosis: {currentDoctor.diagnosis}
                </span>
              </div>
            </div>

            {/* Chat Conversation Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-[600px]">
              {/* Chat Header */}
              <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white font-bold">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">
                      {lang === "ur" ? "بائی لنگوئل کلینیکل اسسٹنٹ (اردو / English)" : "Bilingual Clinical Assistant (English / اردو)"}
                    </h3>
                    <p className="text-[11px] text-teal-300">
                      {lang === "ur" ? "ریئل ٹائم فارماکولوجی گارڈ ریلز مع 1122 ایمرجنسی لاک آؤٹ" : "Strict Red-Flag Interceptor • 24/7 Paramedic Dispatch"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setChatMessages([
                        {
                          id: `msg-welcome-${Date.now()}`,
                          sender: "ai",
                          text:
                            lang === "ur"
                              ? `گفتگو دوبارہ شروع کر دی گئی ہے۔ محترم ${patient.name}، میں ڈاکٹر ${currentDoctor.nameUr} کے نسخے اور آپ کی علامات کے حوالے سے رہنمائی کے لیے حاضر ہوں۔`
                              : `Chat session refreshed. Hello ${patient.name}, I am synchronized with your active prescription under ${currentDoctor.name}. How can I assist?`,
                          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                          isUrdu: lang === "ur",
                          tier: 1,
                        },
                      ]);
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="Refresh conversation"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === "user"
                        ? "items-end"
                        : msg.sender === "system"
                        ? "items-center"
                        : "items-start"
                    }`}
                  >
                    {msg.sender === "system" ? (
                      <div
                        dir={msg.isUrdu ? "rtl" : "ltr"}
                        className={`w-full my-2 rounded-xl border border-red-300 bg-red-50 p-3 text-red-900 text-xs font-semibold shadow-2xs flex items-start gap-2.5 ${
                          msg.isUrdu ? "text-right font-serif" : "text-left font-sans"
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div>{msg.text}</div>
                          <div className="mt-1 text-[10px] text-red-700">{msg.timestamp}</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        dir={msg.isUrdu ? "rtl" : "ltr"}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-2xs ${
                          msg.isUrdu ? "text-right font-serif" : "text-left font-sans"
                        }`}
                        style={{
                          backgroundColor: msg.sender === "user" ? "#0f766e" : "#ffffff",
                          color: msg.sender === "user" ? "#ffffff" : "#1e293b",
                          border: msg.sender === "user" ? "none" : "1px solid #e2e8f0",
                        }}
                      >
                        <p className={msg.isUrdu ? "text-[13px] leading-loose text-right" : "text-left"}>
                          {msg.text}
                        </p>
                        <div
                          className={`mt-1.5 flex items-center ${
                            msg.isUrdu ? "justify-start flex-row-reverse" : "justify-end"
                          } gap-1.5 text-[10px] ${
                            msg.sender === "user" ? "text-teal-100" : "text-slate-400"
                          }`}
                        >
                          <span>{msg.timestamp}</span>
                          {msg.sender === "ai" && (
                            <span className="text-teal-700 font-bold">
                              {msg.isUrdu ? "• میڈی فلو تصدیق شدہ" : "• MediFlow Verified"}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div
                    dir={lang === "ur" ? "rtl" : "ltr"}
                    className={`flex items-center gap-2 text-xs text-slate-500 bg-white rounded-full px-3 py-1.5 w-fit border border-slate-200 ${
                      lang === "ur" ? "text-right font-serif" : "text-left font-sans"
                    }`}
                  >
                    <span className="flex h-2 w-2 rounded-full bg-teal-600 animate-pulse" />
                    <span>
                      {lang === "ur"
                        ? "کلینیکل فارماکولوجی ڈیٹابیس سے تصدیق کی جا رہی ہے..."
                        : "Analyzing clinical pharmacology database..."}
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick-Prompt Suggestions */}
              {!isEmergencyActive && (
                <div className="border-t border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] font-bold text-slate-500 mb-1.5 px-1">
                    {t.quickQuestionsLabel}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition cursor-pointer ${
                          idx === 4
                            ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 font-bold"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Input / Interceptor State */}
              <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
                {isEmergencyActive ? (
                  <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-red-700 font-bold text-sm">
                      <Lock className="h-5 w-5 text-red-600 animate-pulse" />
                      <span>{t.chatLockedNotice}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-3">
                      <a
                        href="tel:1122"
                        className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 flex flex-col items-center gap-0.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-4 w-4" />
                          <span>Call Rescue 1122</span>
                        </div>
                        <span className="text-[10px] text-red-100">Direct Dial: 1122</span>
                      </a>
                      <button
                        onClick={resetEmergency}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {t.deescalateBtn}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={t.typePlaceholder}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isEmergencyActive}
                      className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{t.sendBtn}</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </form>
                )}

                <p className="mt-2 text-[10px] text-slate-500 text-center leading-tight">
                  {t.chatDisclaimer}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            VIEW 3: SAFETY GUARDRAILS & EMERGENCY PROTOCOLS (Clinical Safety Stage)
            ======================================================================= */}
        {activeTab === 3 && (
          <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200 pb-12">
            {/* Header Guidance Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-red-900 via-slate-900 to-slate-950 text-white p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-red-500/25 border border-red-400/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-200 mb-2">
                  Workflow Stage 3 of 3
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{t.safetyDashboardTitle}</h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">{t.safetyDashboardSub}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2 text-xs font-bold shrink-0">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>ISO-13485 &amp; HIPAA Verified</span>
              </div>
            </div>

            {/* Safety Tier Breakdown: 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tier 1 Card */}
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden">
                <div className="h-1.5 absolute top-0 left-0 right-0 bg-emerald-500" />
                <div className="flex items-center justify-between">
                  <span className="rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5">
                    Tier 1 Nominal
                  </span>
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Nominal Monitoring</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Autonomous conversational guidance, standard drug-drug interaction validation, and daily scheduled meal pairing alerts.
                </p>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>State: Active & Verified</span>
                </div>
              </div>

              {/* Tier 2 Card */}
              <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden">
                <div className="h-1.5 absolute top-0 left-0 right-0 bg-amber-500" />
                <div className="flex items-center justify-between">
                  <span className="rounded bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-0.5">
                    Tier 2 Ambiguity
                  </span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Ambiguity Hold Gate</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Triggered by blurred handwriting or OCR confidence &lt;85%. Automatically locks medication ingestion schedule until licensed pharmacist sign-off.
                </p>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold flex items-center justify-between">
                  <span className={ambiguityVerified ? "text-emerald-700" : "text-amber-800"}>
                    {selectedPreset === "ambiguous"
                      ? ambiguityVerified
                        ? "Pharmacist Reconciled"
                        : "Active Hold Triggered"
                      : "Nominal Baseline"}
                  </span>
                  {selectedPreset === "ambiguous" && !ambiguityVerified && (
                    <button
                      onClick={() => setPharmacistModalOpen(true)}
                      className="text-xs underline text-amber-900 font-bold cursor-pointer"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {/* Tier 3 Card */}
              <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden">
                <div className="h-1.5 absolute top-0 left-0 right-0 bg-red-600" />
                <div className="flex items-center justify-between">
                  <span className="rounded bg-red-100 text-red-900 text-[11px] font-bold px-2 py-0.5">
                    Tier 3 Red-Flag
                  </span>
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Acute Emergency Lockout</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Triggered by cardiopulmonary symptoms (chest pain, suffocating, anaphylaxis). Freezes chat to prevent clinical delays and dispatches 1122.
                </p>
                <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${isEmergencyActive ? "bg-red-600 animate-ping" : "bg-emerald-500"}`} />
                  <span className={isEmergencyActive ? "text-red-700" : "text-slate-600"}>
                    {isEmergencyActive ? "Emergency Active" : "Armed & Intercepting"}
                  </span>
                </div>
              </div>
            </div>

            {/* Emergency Dispatch Action Center with desktop number fallback */}
            <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50/70 via-white to-red-50/40 p-6 shadow-sm hover:shadow-md transition-all space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-200/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-red-950 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    <span>Emergency Dispatch Action Center</span>
                  </h3>
                  <p className="text-xs text-red-800 mt-0.5">
                    Direct interconnect with Rescue 1122 and regional medical dispatch authorities.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isEmergencyActive ? (
                    <button
                      onClick={resetEmergency}
                      className="rounded-xl bg-white border border-red-300 px-4 py-2 text-xs font-bold text-red-700 shadow-2xs hover:bg-red-50 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{t.deescalateBtn}</span>
                    </button>
                  ) : (
                    <button
                      onClick={triggerEmergency}
                      className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>{t.simulateEmergencyBtn}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Direct Hotlines with desktop numbers prominently visible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href="tel:1122"
                  className="flex items-center justify-between rounded-xl bg-red-600 p-4 text-white shadow-xs hover:bg-red-700 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-700 shrink-0">
                      <Phone className="h-5 w-5 group-hover:animate-bounce" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold">{t.call1122Btn}</div>
                      <div className="text-xs text-red-100 font-medium">
                        {t.call1122Subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-red-200 group-hover:translate-x-1 transition" />
                </a>

                <a
                  href="tel:911"
                  className="flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white shadow-xs hover:bg-slate-800 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 shrink-0">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold">{t.call911Btn}</div>
                      <div className="text-xs text-slate-300 font-medium">
                        {t.call911Subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition" />
                </a>
              </div>

              {/* Immediate Patient Triage Guidance */}
              <div className="rounded-xl bg-white p-4 border border-red-200 shadow-2xs">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm mb-2 flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-red-600" />
                  <span>{t.firstAidTitle}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <CheckCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{t.firstAid1}</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <CheckCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{t.firstAid2}</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <CheckCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{t.firstAid3}</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <CheckCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{t.firstAid4}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Handover Document Card (EHR Export) */}
            <div className="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50/60 via-white to-slate-50 p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-teal-100 text-teal-800 text-[11px] font-bold px-2 py-0.5">
                    Official EHR Handover Export
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    MediFlow-Handover-{patient.mrn.replace(/[^a-zA-Z0-9]/g, "") || "94021PK"}.pdf
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-700" />
                  <span>
                    {lang === "ur" ? "کلینیکل ہینڈ اوور سمری دستاویز (PDF)" : "Clinical Handover Summary Document (PDF)"}
                  </span>
                </h3>
                <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                  {lang === "ur"
                    ? "مریض کی مکمل کلینیکل سمری ڈاؤن لوڈ کریں، جس میں ڈاکٹر طارق خان کا نسخہ، فعال نمکیات، تجویز کردہ خوراک، الرجیز اور ہنگامی ٹرائی ایج پروٹوکول شامل ہیں۔"
                    : "Generate and download a comprehensive clinical PDF summary containing patient record, attending physician details, extracted medications, dosage schedule, and emergency triage protocols."}
                </p>
              </div>

              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-75 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
              >
                {isDownloadingPdf ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  {isDownloadingPdf ? t.downloadingPdfText : t.downloadPdfBtn}
                </span>
              </button>
            </div>

            {/* Real-Time Safety Audit Trail */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-4 w-4 text-teal-700" />
                  <span>{t.auditTrailTitle}</span>
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Active Patient: {patient.mrn}
                </span>
              </div>

              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.2 font-mono font-bold text-[10px] ${
                            log.tier === 3
                              ? "bg-red-100 text-red-800"
                              : log.tier === 2
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          Tier {log.tier}
                        </span>
                        <span className="font-bold text-slate-900">
                          {lang === "ur" ? log.eventUr : log.event}
                        </span>
                      </div>
                      <p className="text-slate-600">
                        {lang === "ur" ? log.detailsUr : log.details}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span
                        className={`font-semibold ${
                          log.status === "Emergency Active"
                            ? "text-red-700"
                            : log.status === "Ambiguity Hold"
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {lang === "ur" ? log.statusUr : log.status}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {log.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          PERSISTENT DOCKED BOTTOM NAVIGATION ACTION BAR (On Every Step)
          ========================================================================= */}
      <aside aria-label="Workflow Navigation" className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Step Breadcrumb or Back Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            {activeTab === 1 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full bg-teal-700" />
                <span>
                  {lang === "ur" ? "مرحلہ 1 از 3: دستاویزات اور او سی آر" : "Step 1 of 3: Document Intake & OCR"}
                </span>
              </div>
            )}
            {activeTab === 2 && (
              <button
                onClick={() => setActiveTab(1)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t.backToStep1}</span>
              </button>
            )}
            {activeTab === 3 && (
              <button
                onClick={() => setActiveTab(2)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{t.backToStep2}</span>
              </button>
            )}
          </div>

          {/* Right: Primary Step Actions */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {activeTab === 1 && (
              <button
                onClick={() => setActiveTab(2)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition transform active:scale-95 cursor-pointer"
              >
                <span>{t.proceedToStep2}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {activeTab === 2 && (
              <button
                onClick={() => setActiveTab(3)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-6 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition transform active:scale-95 cursor-pointer"
              >
                <span>{t.proceedToStep3}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {activeTab === 3 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-75 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  {isDownloadingPdf ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>
                    {isDownloadingPdf ? t.downloadingPdfText : t.downloadPdfBtn}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Global Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-teal-700" />
            <span className="font-semibold text-slate-700">MediFlow AI Clinical Systems</span>
            <span>• ISO-13485 &amp; HIPAA Compliant Patient Portal</span>
          </div>
          <div className="flex items-center gap-4 text-slate-600">
            <span>Rescue 1122 Interconnected</span>
            <span>•</span>
            <span>FHIR/HL7 Compatible</span>
            <span>•</span>
            <span>English / اردو Real-Time Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
