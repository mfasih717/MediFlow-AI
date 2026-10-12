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
  Volume2,
  ShieldCheck,
  Lock,
  ArrowRight,
  BellRing,
  Download,
  Share2,
  Pencil,
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
    rxRef: "RX-8842",
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
    rxRef: "RX-4102",
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
    rxRef: "RX-CUSTOM",
    diagnosis: "Cardiovascular & Metabolic Care",
    diagnosisUr: "قلبی و میٹابولک نگہداشت",
    followUpGoal: "Therapeutic response assessment and lipid panel review",
    followUpGoalUr: "علاج کے اثرات کا جائزہ اور لپڈ پینل ٹیسٹ",
  },
};

export default function MediFlowPatientPortal() {
  // Bilingual State
  const [lang, setLang] = useState<Language>("en");

  // Dynamic Patient Profile State
  const [patient, setPatient] = useState<PatientProfile>({
    name: "Farhan Ahmed",
    nameUr: "فرحان احمد",
    age: 42,
    gender: "Male",
    genderUr: "مرد",
    mrn: "94021-PK",
    allergies: "Penicillin (Mild Skin Rash)",
    allergiesUr: "پینسلن ریش (ہلکی)",
  });

  // Patient Profile Edit Modal State
  const [editPatientModalOpen, setEditPatientModalOpen] = useState<boolean>(false);
  const [patientFormName, setPatientFormName] = useState<string>("Farhan Ahmed");
  const [patientFormAge, setPatientFormAge] = useState<number>(42);
  const [patientFormGender, setPatientFormGender] = useState<"Male" | "Female" | "Other">("Male");
  const [patientFormAllergies, setPatientFormAllergies] = useState<string>("Penicillin (Mild Skin Rash)");

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
    if (parts.length === 0) return "PT";
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

  // Doses Schedule State (Pillar 2)
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

  // Extracted Salts & Vision OCR Data (Pillar 1) - Dynamically keyed to active preset/doctor
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
      // Custom Preset
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

  // Chat Assistant State (Pillar 5)
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

    const urgentMsg: ChatMessage = {
      id: `emergency-${Date.now()}`,
      sender: "system",
      text:
        lang === "ur"
          ? "🚨 انتباہ درجہ 3: فوری طبی خطرہ کی علامت موصول ہوئی ہے! انٹرایکٹو چیٹ عارضی طور پر لاک کر دی گئی ہے۔ فوری طور پر 1122 یا 911 پر کال کریں۔"
          : "🚨 TIER 3 RED-FLAG TRIGGERED: Acute distress detected. Interactive chat has been locked to prevent hazardous delays. Call Emergency Dispatch 1122 / 911 immediately.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tier: 3,
      isUrdu: lang === "ur",
    };
    setChatMessages((prev) => [...prev, urgentMsg]);
  };

  // De-escalate emergency
  const resetEmergency = () => {
    setIsEmergencyActive(false);
    setEmergencyModalOpen(false);

    const resetMsg: ChatMessage = {
      id: `reset-${Date.now()}`,
      sender: "system",
      text:
        lang === "ur"
          ? "✅ ہنگامی پروٹوکول بحال کر دیا گیا۔ معمول کی نگرانی فعال ہے۔"
          : "✅ Acute emergency simulation cleared. Patient portal returned to nominal Tier 1 monitoring.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tier: 1,
      isUrdu: lang === "ur",
    };
    setChatMessages((prev) => [...prev, resetMsg]);
  };

  // Send message in chat
  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isEmergencyActive) return;

    // Check for acute emergency trigger in text
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

    // Realistic clinical response generation
    setTimeout(() => {
      let aiResponse = "";
      const lower = text.toLowerCase();

      if (respondInUrdu) {
        // Clinically accurate, natural Urdu responses
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
            "یہ دوا (Augmentin) ہمیشہ کھانے کے 20 سے 30 منٹ بعد پانی کے ساتھ لیں۔ خالی پیٹ لینے سے معدے میں جلن یا متلی ہو سکتی ہے۔";
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
        // Clinically accurate English responses
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
            `Hello ${patient.name}, regarding your query "${text}": Your prescribed regimen under ${currentDoctor.name} is verified for drug-drug interactions. Ensure adequate hydration and follow the post-meal schedule. Let me know if you need specific guidance!`;
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
    }, 1000);
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
      // Update schedule for Standard
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
      // Update schedule for Ambiguous
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
      // Update schedule for Custom
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

  // Handle Save Patient Profile
  const handleSavePatientProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = patientFormName.trim() || "Farhan Ahmed";
    const cleanAge = Number(patientFormAge) || 42;
    const cleanGender = patientFormGender;
    const cleanGenderUr = cleanGender === "Male" ? "مرد" : cleanGender === "Female" ? "عورت" : "دیگر";
    const cleanAllergies = patientFormAllergies.trim() || "None reported";

    setPatient({
      ...patient,
      name: cleanName,
      nameUr: cleanName,
      age: cleanAge,
      gender: cleanGender,
      genderUr: cleanGenderUr,
      allergies: cleanAllergies,
      allergiesUr: cleanAllergies,
    });

    setEditPatientModalOpen(false);

    // Update opening chat greeting or add a system announcement
    setChatMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "msg-1") {
        return [
          {
            id: "msg-1",
            sender: "ai",
            text:
              lang === "ur"
                ? `السلام علیکم ${cleanName} صاحب/صاحبہ! میں میڈی فلو کلینیکل اسسٹنٹ ہوں۔ ${currentDoctor.nameUr} کا نسخہ آپ کے پورٹل میں کامیابی سے لوڈ ہو چکا ہے۔ کیا آپ ادویات، خوراک کے اوقات یا سائیڈ ایفیکٹس کے بارے میں کچھ پوچھنا چاہتے ہیں؟`
                : `Hello ${cleanName}! I am your MediFlow Clinical Navigator. Your prescription from ${currentDoctor.name} has been loaded. How can I guide you regarding your medications, meal timings, or side effects today?`,
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
                ? `مریض کا پروفائل کامیابی سے اپ ڈیٹ ہو گیا: ${cleanName} (عمر: ${cleanAge} سال، ${cleanGenderUr})۔`
                : `Patient profile updated: ${cleanName} (Age: ${cleanAge}, ${cleanGender}).`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            isUrdu: lang === "ur",
            tier: 1,
          },
        ];
      }
    });
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

  // Adherence calculation
  const takenCount = schedule.filter((s) => s.taken).length;
  const totalCount = schedule.length;
  const adherencePercent = Math.round((takenCount / totalCount) * 100);

  // Urdu and English dictionary for strings
  const t = {
    appName: lang === "ur" ? "میڈی فلو اے آئی" : "MediFlow AI",
    appSub: lang === "ur" ? "کلینیکل انٹیلیجنس اور مریض پورٹل" : "Clinical Intelligence & Patient Navigation Portal",
    mrnBadge: lang === "ur" ? `شناخت: ${patient.mrn}` : `MRN: ${patient.mrn}`,
    patientName:
      lang === "ur"
        ? `${patient.name} (عمر: ${patient.age} سال • ${patient.genderUr})`
        : `${patient.name} (Age: ${patient.age} • ${patient.gender})`,
    allergies: lang === "ur" ? `الرجی: ${patient.allergiesUr}` : `Allergies: ${patient.allergies}`,
    clinician:
      lang === "ur"
        ? `نگران ڈاکٹر: ${currentDoctor.nameUr} (${currentDoctor.specialtyUr})`
        : `Attending: ${currentDoctor.name} (${currentDoctor.specialty})`,
    tier1Status: lang === "ur" ? "سیفٹی اسٹیٹس: فعال (درجہ 1 معمول)" : "Safety Status: Active (Tier 1 Nominal)",
    emergencyBanner:
      lang === "ur"
        ? "⚠️ 24/7 ایمرجنسی گارڈ ریلز فعال ہیں۔ اگر آپ کو سینے میں شدید درد، سانس گھٹنے یا بے ہوشی کا احساس ہو تو فوراً ایمرجنسی بٹن دبائیں۔"
        : "⚠️ 24/7 Clinical Red-Flag Guardrails Armed. If experiencing sudden crushing chest pain, asphyxiation, or anaphylaxis, initiate Emergency Triage.",
    simulateEmergencyBtn:
      lang === "ur"
        ? "🚨 شدید ایمرجنسی کی جانچ کریں (سینے میں درد / سانس کی تنگی)"
        : "🚨 Simulate Acute Emergency (Chest Pain / Respiratory Distress)",
    documentIntakeTitle: lang === "ur" ? "دستاویزات اور وژن او سی آر (پِلر 1)" : "Document Intake & Vision OCR (Pillar 1)",
    documentIntakeSub:
      lang === "ur"
        ? "نسخہ جات، ایکسرے اور خون کے ٹیسٹ کی میڈیکل گریڈ خودکار اسکیننگ"
        : "Prescription OCR, active salt extraction & clinical safety breakdown",
    dragDropText:
      lang === "ur"
        ? "نسخہ یا لیب رپورٹ یہاں ڈریگ کریں یا فائل منتخب کریں"
        : "Drag & drop prescription, radiological scan, or blood test report here",
    browseFiles: lang === "ur" ? "فائل چنیں" : "Browse Files",
    supportsFormats: lang === "ur" ? "سپورٹ شدہ فارمیٹس: PDF, JPG, PNG, DICOM (زیادہ سے زیادہ 25MB)" : "Supports: PDF, JPG, PNG, DICOM (Max 25MB)",
    presetsLabel: lang === "ur" ? "ڈاکٹر اور نسخہ منتخب کریں:" : "Select Attending Doctor & Prescription:",
    presetStandard: lang === "ur" ? "نسخہ 8842: ڈاکٹر طارق خان (ماہر امراض سینہ)" : "Rx-8842: Dr. Tariq Khan (Pulmonology)",
    presetAmbiguous: lang === "ur" ? "نسخہ 4102: ڈاکٹر عائشہ ملک (جنرل میڈیسن)" : "Rx-4102: Dr. Ayesha Malik (General Medicine)",
    presetUpload: lang === "ur" ? "کسٹم نسخہ / نیا ڈاکٹر" : "Custom Upload / New Doctor",
    extractedSaltsTitle: lang === "ur" ? "دریافت شدہ ادویات اور ایکٹو سالٹس" : "Extracted Active Salts & Layman Schedules",
    pharmacistVerificationReq:
      lang === "ur"
        ? "درجہ 2 انتباہ: ہینڈ رائٹنگ واضح نہیں ہے۔ فارماسسٹ سے تصدیق ضروری ہے!"
        : "Tier 2 Ambiguity Alert: Handwriting confidence low (<70%). Requires Pharmacist Verification before ingestion.",
    confirmWithPharmacistBtn: lang === "ur" ? "فارماسسٹ سے تصدیق کریں" : "Confirm with Pharmacist",
    verifiedBadge: lang === "ur" ? "فارماسسٹ سے تصدیق شدہ" : "Verified by Licensed Pharmacist",
    journeyPlannerTitle: lang === "ur" ? "روزانہ ادویات کا شیڈول (پِلر 2)" : "Daily Care Journey Planner (Pillar 2)",
    journeyPlannerSub:
      lang === "ur"
        ? "صبح، دوپہر اور رات کے اوقات، الارم اور کھانے کے رہنما اصول"
        : "Chronological daily schedule, meal pairings, and medication reminders",
    adherenceTracker: lang === "ur" ? "آج کی ادویات کی پابندی:" : "Today's Adherence Score:",
    dosesCompleted:
      lang === "ur"
        ? `${takenCount} از ${totalCount} خوراکیں مکمل ہوئیں (${adherencePercent}%)`
        : `${takenCount} of ${totalCount} doses logged (${adherencePercent}%)`,
    markTaken: lang === "ur" ? "لی گئی" : "Mark Taken",
    completed: lang === "ur" ? "مکمل شدہ" : "Completed",
    alarmActive: lang === "ur" ? "الارم سیٹ ہے" : "Alarm Set",
    followUpCardTitle: lang === "ur" ? "اگلی ڈاکٹر اپائنٹمنٹ (فالو اپ)" : "Clinician Re-Evaluation Milestone",
    followUpDate: lang === "ur" ? "جمعہ، 17 اکتوبر - صبح 10:30 بجے" : "Friday, Oct 17 • 10:30 AM",
    followUpDoctor:
      lang === "ur"
        ? `${currentDoctor.nameUr} • ${currentDoctor.clinicUr}`
        : `${currentDoctor.name} • ${currentDoctor.clinic}`,
    followUpObjective: lang === "ur" ? currentDoctor.followUpGoalUr : currentDoctor.followUpGoal,
    chatTitle: lang === "ur" ? "بائی لنگوئل کلینیکل اسسٹنٹ (اردو + English)" : "Bilingual Clinical Assistant (English + اردو)",
    chatSub: lang === "ur" ? "محفوظ مریض نیویگیشن مع خودکار ریڈ فلیگ اسکینر" : "Interactive care guidance with clinical guardrails",
    quickQuestions: lang === "ur" ? "فوری پوچھے جانے والے سوالات:" : "Frequently Asked Questions:",
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
        ? "🔒 ریڈ فلیگ الرٹ: ایمرجنسی کی وجہ سے چیٹ لاک کر دی گئی ہے۔ فوری طور پر 1122 ملائیں۔"
        : "🔒 RED-FLAG ACTIVE: Interactive chat locked to prevent dangerous treatment delays. Call 1122 / 911 immediately.",
    emergencyModalTitle: lang === "ur" ? "انتہائی ہنگامی انتباہ (درجہ 3 ریڈ فلیگ)" : "CRITICAL TIER 3 RED-FLAG ALERT",
    emergencyModalSub:
      lang === "ur"
        ? "شدید طبی خطرہ (سینے میں درد یا سانس کی تنگی) کی علامات محسوس کی گئی ہیں!"
        : "Acute cardiopulmonary distress or high-priority clinical red-flag detected!",
    call1122Btn: lang === "ur" ? "ریسکیو 1122 پر کال کریں (پاکستان)" : "Call Rescue 1122 (Pakistan Dispatch)",
    call911Btn: lang === "ur" ? "911 ایمرجنسی پر کال کریں" : "Call 911 (International Emergency)",
    firstAidInstructionsTitle: lang === "ur" ? "فوری فرسٹ ایڈ اور حفاظتی ہدایات:" : "Immediate Patient Triage Protocol:",
    firstAid1:
      lang === "ur"
        ? "1. سیدھے بیٹھیں اور گردن یا سینے کے تنگ کپڑے ڈھیلے کر لیں۔ لیٹنے سے گریز کریں۔"
        : "1. Sit upright in a comfortable position. Loosen restrictive clothing around chest and neck. Do NOT lie flat.",
    firstAid2:
      lang === "ur"
        ? "2. خود گاڑی چلا کر ہسپتال جانے کی کوشش نہ کریں۔ ریسکیو ایمبولینس کا انتظار کریں۔"
        : "2. Do NOT attempt to drive yourself to the hospital. Await paramedic dispatch.",
    firstAid3:
      lang === "ur"
        ? "3. اگر ایمرجنسی آپریٹر ہدایت کرے تو 300 ملی گرام اسپرین چبا لیں۔"
        : "3. If instructed by emergency call handler and not allergic, chew 300mg un-coated Aspirin.",
    firstAid4:
      lang === "ur"
        ? "4. گھر کا بیرونی دروازہ کھول دیں تاکہ ایمبولینس عملہ بغیر رکاوٹ اندر آ سکے۔"
        : "4. Unlock your front door so emergency responders can enter without obstruction.",
    deescalateBtn: lang === "ur" ? "ایمرجنسی حالت ختم کریں (ٹیسٹ مکمل)" : "De-escalate & Resume Nominal Monitoring",
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
  };

  // Quick questions for patient assistant
  const sampleQuestions =
    lang === "ur"
      ? [
          "مجھے دوا کھانے کے بعد لینی ہے یا پہلے؟",
          "اگر دوپہر کی دوا چھوٹ جائے تو کیا کروں؟",
          "کیا پیناڈول سی ایف کے ساتھ چائے پی سکتے ہیں؟",
          "مجھے سینے میں شدید درد اور سانس لینے میں دشواری ہو رہی ہے!",
        ]
      : [
          "Should I take my medicine before or after meals?",
          "What should I do if I forget the afternoon dose?",
          "Can I drink tea while on Panadol CF?",
          "I have sudden severe chest pain and breathlessness!",
        ];

  return (
    <div
      dir={lang === "ur" ? "rtl" : "ltr"}
      className={`min-h-screen bg-slate-50 text-slate-900 transition-all duration-300 font-sans ${
        lang === "ur" ? "font-serif leading-relaxed" : ""
      }`}
    >
      {/* =========================================================================
          EDIT PATIENT PROFILE MODAL
          ========================================================================= */}
      {editPatientModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto flex flex-col max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-teal-300 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between bg-teal-600 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <User className="h-5 w-5" />
                <h3 className="font-bold text-base sm:text-lg">
                  {lang === "ur" ? "مریض کی پروفائل میں ترمیم کریں" : "Edit Patient Profile"}
                </h3>
              </div>
              <button
                onClick={() => setEditPatientModalOpen(false)}
                className="rounded-lg bg-teal-700/60 p-1 text-white hover:bg-teal-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePatientProfile} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {lang === "ur" ? "مریض کا پورا نام:" : "Patient Full Name:"}
                </label>
                <input
                  type="text"
                  required
                  value={patientFormName}
                  onChange={(e) => setPatientFormName(e.target.value)}
                  placeholder="e.g. Farhan Ahmed"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    {lang === "ur" ? "جنس:" : "Gender:"}
                  </label>
                  <select
                    value={patientFormGender}
                    onChange={(e) => setPatientFormGender(e.target.value as "Male" | "Female" | "Other")}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="Male">{lang === "ur" ? "مرد (Male)" : "Male"}</option>
                    <option value="Female">{lang === "ur" ? "عورت (Female)" : "Female"}</option>
                    <option value="Other">{lang === "ur" ? "دیگر (Other)" : "Other"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {lang === "ur" ? "معلوم طبی الرجیز:" : "Known Drug Allergies:"}
                </label>
                <input
                  type="text"
                  value={patientFormAllergies}
                  onChange={(e) => setPatientFormAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, Sulfa drugs, None"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="rounded-xl bg-teal-50 p-3.5 border border-teal-200 text-xs text-teal-900 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  {lang === "ur"
                    ? "نام تبدیل کرنے سے پورٹل کا ہیڈر اور کلینیکل چیٹ اسسٹنٹ کا سلام فوراً اپ ڈیٹ ہو جائے گا۔"
                    : "Updating this profile will immediately synchronize your header credentials and clinical chat greeting."}
                </span>
              </div>

              <div className="shrink-0 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditPatientModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  {t.dismiss}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 shadow flex items-center gap-2 transition"
                >
                  <Check className="h-4 w-4" />
                  <span>{lang === "ur" ? "پروفائل محفوظ کریں" : "Save & Update Profile"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 3 ACUTE EMERGENCY MODAL (High-Priority Clinical Red-Flag Overlay)
          ========================================================================= */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-red-950/85 backdrop-blur-md p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl my-auto flex flex-col max-h-[92vh] rounded-2xl border-4 border-red-600 bg-white shadow-2xl overflow-hidden">
            {/* Flashing Beacon Header - Sticky Top */}
            <div className="shrink-0 flex items-center justify-between bg-red-600 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-5 w-5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex h-5 w-5 rounded-full bg-white text-red-600 font-bold text-xs items-center justify-center">
                    !
                  </span>
                </span>
                <div className="text-base sm:text-lg font-black tracking-wide uppercase">
                  {t.emergencyModalTitle}
                </div>
              </div>
              <button
                onClick={() => setEmergencyModalOpen(false)}
                className="rounded-lg bg-red-700/60 p-1.5 text-white hover:bg-red-700 transition"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Alert Banner Description */}
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-900">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-7 w-7 text-red-600 shrink-0 mt-0.5" />
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

              {/* Direct Hotline Dispatch Buttons */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <a
                  href="tel:1122"
                  className="flex items-center justify-center gap-2.5 rounded-xl bg-red-600 px-4 py-3.5 text-white font-bold text-base shadow-md hover:bg-red-700 transition transform active:scale-95"
                >
                  <Phone className="h-5 w-5 animate-bounce" />
                  <span>{t.call1122Btn}</span>
                </a>
                <a
                  href="tel:911"
                  className="flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3.5 text-white font-bold text-base shadow-md hover:bg-slate-800 transition transform active:scale-95"
                >
                  <Phone className="h-5 w-5" />
                  <span>{t.call911Btn}</span>
                </a>
              </div>

              {/* Triage First-Aid Guidance */}
              <div className="rounded-xl bg-slate-100 p-4 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-2.5 flex items-center gap-2 text-sm">
                  <HeartPulse className="h-4 w-4 text-red-600" />
                  {t.firstAidInstructionsTitle}
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

            {/* Simulation Reset Footer - Sticky Bottom */}
            <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-3 sm:px-6 bg-slate-50 border-t border-slate-200">
              <span className="text-[11px] text-slate-500">
                Emergency ID: RED-FLG-9024 • Timestamp: {new Date().toLocaleTimeString()}
              </span>
              <button
                onClick={resetEmergency}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.deescalateBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TIER 2 AMBIGUITY VERIFICATION MODAL (Pharmacist Review Drawer)
          ========================================================================= */}
      {pharmacistModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-center justify-center animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl my-auto flex flex-col max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-amber-300 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between bg-amber-500 px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-base sm:text-lg">{t.pharmacistModalTitle}</h3>
              </div>
              <button
                onClick={() => setPharmacistModalOpen(false)}
                className="rounded-lg bg-amber-600/50 p-1 text-white hover:bg-amber-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-bold text-sm">
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
                <div className="mt-2 text-xs font-mono bg-white/80 p-2 rounded border border-amber-200 text-slate-800">
                  Rx ID: 4102 • Resolved Active Salt: Azithromycin 500mg • Frequency: 1 Tab PO OD x 3 Days
                </div>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setPharmacistModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 transition"
              >
                {t.dismiss}
              </button>
              <button
                onClick={() => {
                  setAmbiguityVerified(true);
                  setPharmacistModalOpen(false);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow flex items-center gap-2 transition"
              >
                <Check className="h-4 w-4" />
                {t.approveRxBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOP EMERGENCY & SAFETY SYSTEM BANNER (Always Visible Triage Strip)
          ========================================================================= */}
      <div
        className={`w-full py-2.5 px-4 transition-colors duration-300 ${
          isEmergencyActive
            ? "bg-red-700 text-white animate-pulse"
            : "bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white"
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 font-medium text-center md:text-left">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{t.emergencyBanner}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEmergencyActive ? (
              <button
                onClick={resetEmergency}
                className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-red-700 shadow hover:bg-red-50 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t.deescalateBtn}</span>
              </button>
            ) : (
              <button
                onClick={triggerEmergency}
                className="flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 px-3.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-white hover:text-red-600 transition"
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-200" />
                <span>{t.simulateEmergencyBtn}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN PORTAL HEADER (Branding, Clickable Patient Badge & Controls)
          ========================================================================= */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-md shadow-teal-500/20">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{t.appName}</h1>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 border border-teal-200">
                    v2.5 Dynamic
                  </span>
                </div>
                <p className="text-xs text-slate-500">{t.appSub}</p>
              </div>
            </div>

            {/* Patient Meta Strip & Controls */}
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3">
              {/* Clickable Patient Badge (Desktop) */}
              <button
                onClick={() => {
                  setPatientFormName(patient.name);
                  setPatientFormAge(patient.age);
                  setPatientFormGender(patient.gender);
                  setPatientFormAllergies(patient.allergies);
                  setEditPatientModalOpen(true);
                }}
                className="hidden lg:flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-1.5 text-xs text-slate-700 hover:border-teal-400 hover:bg-teal-50/50 transition-all cursor-pointer group text-left"
                title="Click to edit patient profile"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white font-bold text-xs group-hover:bg-teal-700 transition">
                  {patientInitials}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{t.patientName}</span>
                    <Pencil className="h-3 w-3 text-slate-400 group-hover:text-teal-600 transition" />
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span>{t.mrnBadge}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">{t.clinician}</span>
                  </div>
                </div>
              </button>

              {/* Safety Tier Pill */}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                  isEmergencyActive
                    ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                <ShieldCheck className={`h-4 w-4 ${isEmergencyActive ? "text-red-600" : "text-emerald-600"}`} />
                <span>
                  {isEmergencyActive
                    ? lang === "ur"
                      ? "سیفٹی: درجہ 3 (ریڈ فلیگ)"
                      : "Safety: Tier 3 (Red Flag)"
                    : t.tier1Status}
                </span>
              </div>

              {/* Language Switcher (Pillar 1: Bilingual Engine) */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  onClick={() => setLang("en")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    lang === "en"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>English</span>
                </button>
                <button
                  onClick={() => setLang("ur")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    lang === "ur"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>اردو</span>
                  <span className="text-[10px] bg-teal-100 text-teal-800 px-1 rounded">RTL</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN CONTAINER: 4 PILLARS GRID LAYOUT
          ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Patient Summary on mobile (Clickable) */}
        <div
          onClick={() => {
            setPatientFormName(patient.name);
            setPatientFormAge(patient.age);
            setPatientFormGender(patient.gender);
            setPatientFormAllergies(patient.allergies);
            setEditPatientModalOpen(true);
          }}
          className="block lg:hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs cursor-pointer hover:border-teal-400 transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white font-bold text-xs">
                {patientInitials}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{t.patientName}</span>
                  <Pencil className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <div className="text-xs text-slate-500">{t.mrnBadge}</div>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-semibold text-slate-700">{t.clinician}</div>
              <div className="text-amber-700">{t.allergies}</div>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout: Left (Pillars 1 & 2), Right (Pillar 5 Chat + Safety Guide) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* =====================================================================
              LEFT COLUMN (COL 1-7): PILLAR 1 (Vision OCR) & PILLAR 2 (Timeline)
              ===================================================================== */}
          <div className="lg:col-span-7 space-y-8">
            {/* -------------------------------------------------------------------
                PILLAR 1: DOCUMENT INTAKE & VISION OCR CARD
                ------------------------------------------------------------------- */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                      1
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{t.documentIntakeTitle}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{t.documentIntakeSub}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md font-medium border border-teal-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>MediFlow Vision OCR Engine</span>
                </div>
              </div>

              {/* Prescribing Clinician & Ref Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-teal-50/70 rounded-xl border border-teal-200">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-teal-700 shrink-0" />
                  <span className="text-xs text-teal-950 font-medium">
                    {lang === "ur" ? "نسخہ برائے معالج: " : "Prescribing Clinician: "}
                    <strong className="text-teal-900 font-bold">{currentDoctor.name}</strong> ({currentDoctor.specialty})
                  </span>
                </div>
                <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-slate-700">
                  Ref: {currentDoctor.rxRef}
                </span>
              </div>

              {/* Sample Prescriptions & Doctor Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t.presetsLabel}
                  </label>
                  <span className="text-[11px] text-slate-400">Syncs doctor &amp; OCR cards</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleSelectPreset("standard")}
                    className={`flex flex-col p-3 rounded-xl border text-left transition ${
                      selectedPreset === "standard"
                        ? "border-teal-600 bg-teal-50/60 text-teal-950 font-semibold shadow-xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">Rx-8842</span>
                      {selectedPreset === "standard" && <Check className="h-3.5 w-3.5 text-teal-600" />}
                    </div>
                    <span className="text-[11px] text-slate-600">Dr. Tariq Khan</span>
                    <span className="text-[10px] text-teal-700 font-medium">Pulmonology (98% Conf.)</span>
                  </button>

                  <button
                    onClick={() => handleSelectPreset("ambiguous")}
                    className={`flex flex-col p-3 rounded-xl border text-left transition ${
                      selectedPreset === "ambiguous"
                        ? "border-amber-500 bg-amber-50/70 text-amber-950 font-semibold shadow-xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">Rx-4102</span>
                      {selectedPreset === "ambiguous" && <Check className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <span className="text-[11px] text-slate-600">Dr. Ayesha Malik</span>
                    <span className="text-[10px] text-amber-700 font-medium">Tier 2 Ambiguity (68%)</span>
                  </button>

                  <button
                    onClick={() => handleSelectPreset("custom")}
                    className={`flex flex-col p-3 rounded-xl border text-left transition ${
                      selectedPreset === "custom"
                        ? "border-teal-600 bg-teal-50/60 text-teal-950 font-semibold shadow-xs"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold">{lang === "ur" ? "نیا ڈاکٹر" : "New Doctor"}</span>
                      {selectedPreset === "custom" && <Check className="h-3.5 w-3.5 text-teal-600" />}
                    </div>
                    <span className="text-[11px] text-slate-600 truncate">{customDoctorName}</span>
                    <span className="text-[10px] text-emerald-700 font-medium">{lang === "ur" ? "کسٹم اپ لوڈ" : "Custom Upload"}</span>
                  </button>
                </div>
              </div>

              {/* Custom Doctor Specification Editor (Visible when Custom is active) */}
              {selectedPreset === "custom" && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                      <Pencil className="h-3.5 w-3.5 text-teal-600" />
                      <span>{lang === "ur" ? "نئے معالج کی تفصیلات درج کریں:" : "Specify Custom Attending Clinician:"}</span>
                    </div>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded">
                      Live Synchronized
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        {lang === "ur" ? "ڈاکٹر کا نام:" : "Doctor Name:"}
                      </label>
                      <input
                        type="text"
                        value={customDoctorName}
                        onChange={(e) => setCustomDoctorName(e.target.value)}
                        placeholder="e.g. Dr. Zeeshan Ali"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        {lang === "ur" ? "شعبہ / اسپیشلٹی:" : "Doctor Specialty:"}
                      </label>
                      <input
                        type="text"
                        value={customDoctorSpecialty}
                        onChange={(e) => setCustomDoctorSpecialty(e.target.value)}
                        placeholder="e.g. Cardiology & Internal Medicine"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragOver
                    ? "border-teal-500 bg-teal-50/60 scale-[1.01]"
                    : "border-slate-300 bg-slate-50/60 hover:bg-slate-50"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700 mb-3 shadow-inner">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800">{t.dragDropText}</div>
                <p className="mt-1 text-xs text-slate-500">{t.supportsFormats}</p>

                <div className="mt-4 flex items-center gap-2">
                  <label className="cursor-pointer rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-teal-700 transition">
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
                  <span className="text-xs text-slate-400">or drop scans</span>
                </div>

                {/* Active loaded file badge */}
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                  <FileText className="h-3.5 w-3.5 text-teal-600" />
                  <span className="font-mono font-medium truncate max-w-xs">{uploadedFileName}</span>
                  <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 font-bold">
                    Scanned
                  </span>
                </div>
              </div>

              {/* Vision OCR Progress Bar */}
              {isOcrProcessing && (
                <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 space-y-2 animate-in fade-in">
                  <div className="flex justify-between text-xs text-teal-900 font-semibold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-600" />
                      Multimodal Vision Parsing &amp; Chemical Salt Disambiguation...
                    </span>
                    <span>{ocrProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-teal-200 overflow-hidden">
                    <div
                      className="h-full bg-teal-600 transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Tier 2 Ambiguity Warning Banner if ambiguous sample selected and unverified */}
              {selectedPreset === "ambiguous" && !ambiguityVerified && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 space-y-3 animate-in shake">
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
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-700 transition"
                    >
                      <Stethoscope className="h-4 w-4" />
                      <span>{t.confirmWithPharmacistBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Verified Success Badge */}
              {selectedPreset === "ambiguous" && ambiguityVerified && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>{t.verifiedBadge}</span>
                    <span className="text-slate-500 font-normal">
                      (Pharmacist: Dr. Sana Bashir, PharmD)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                    Confidence: 100%
                  </span>
                </div>
              )}

              {/* Extracted Active Salts Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-teal-600" />
                    <span>{t.extractedSaltsTitle}</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    {extractedMeds.length} Active Salts Verified for {currentDoctor.name}
                  </span>
                </div>

                <div className="space-y-3">
                  {extractedMeds.map((med) => (
                    <div
                      key={med.id}
                      className={`rounded-xl border p-4 transition ${
                        med.isAmbiguous
                          ? "border-amber-300 bg-amber-50/40"
                          : "border-slate-200 bg-slate-50/50 hover:bg-white"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {lang === "ur" ? med.brandNameUr : med.brandName}
                            </h4>
                            <span className="rounded bg-teal-100 text-teal-800 text-[11px] px-2 py-0.2 font-mono font-semibold">
                              {lang === "ur" ? med.activeSaltUr : med.activeSalt}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            <strong>{lang === "ur" ? "ہدایت: " : "Schedule: "}</strong>
                            {lang === "ur" ? med.dosageUr : med.dosage}
                          </div>
                        </div>

                        {/* OCR Confidence Badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              med.confidence > 90
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {med.confidence}% {lang === "ur" ? "درستگی" : "OCR Conf."}
                          </span>
                        </div>
                      </div>

                      {/* Layman Explanation Strip */}
                      <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-700 space-y-1">
                        <div className="flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>{lang === "ur" ? "آسان وضاحت: " : "Layman Guide: "}</strong>
                            {lang === "ur" ? med.laymanExplanationUr : med.laymanExplanation}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-teal-800">
                          <Clock className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>{lang === "ur" ? "کھانے کے اوقات: " : "Food Pairing: "}</strong>
                            {lang === "ur" ? med.mealAdviceUr : med.mealAdvice}
                          </span>
                        </div>
                      </div>

                      {/* Ambiguity Reason warning badge if unverified */}
                      {med.isAmbiguous && (
                        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-amber-100/70 p-2 text-xs text-amber-900">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                            {lang === "ur" ? med.ambiguityReasonUr : med.ambiguityReason}
                          </span>
                          <button
                            onClick={() => setPharmacistModalOpen(true)}
                            className="font-bold underline text-amber-950 hover:text-amber-800"
                          >
                            {t.confirmWithPharmacistBtn}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* -------------------------------------------------------------------
                PILLAR 2: JOURNEY PLANNER TIMELINE (Daily Care Slots & Milestone)
                ------------------------------------------------------------------- */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                      2
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{t.journeyPlannerTitle}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{t.journeyPlannerSub}</p>
                </div>

                {/* Adherence Mini Meter */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs">
                    <div className="font-bold text-slate-900">{t.dosesCompleted}</div>
                  </div>
                </div>
              </div>

              {/* Chronological Daily Slots (Morning, Afternoon, Evening) */}
              <div className="space-y-4">
                {schedule.map((item) => (
                  <div
                    key={item.id}
                    className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4.5 transition-all ${
                      item.taken
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-200 bg-white hover:border-teal-300"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Checkbox Button */}
                      <button
                        onClick={() => toggleDose(item.id)}
                        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                          item.taken
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-300 bg-white text-transparent hover:border-teal-500"
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

                        <p className="text-xs text-slate-600 pt-0.5">
                          {lang === "ur" ? item.instructionsUr : item.instructions}
                        </p>
                      </div>
                    </div>

                    {/* Alarm & Quick Action */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        <BellRing className="h-3 w-3 text-teal-600" />
                        <span>{t.alarmActive}</span>
                      </div>
                      <button
                        onClick={() => toggleDose(item.id)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                          item.taken
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-teal-600 text-white hover:bg-teal-700 shadow-xs"
                        }`}
                      >
                        {item.taken ? t.completed : t.markTaken}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clinician Follow-up Re-evaluation Milestone Card - Dynamically linked to Doctor */}
              <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 via-emerald-50/30 to-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                    <Calendar className="h-4 w-4 text-teal-600" />
                    <span>{t.followUpCardTitle}</span>
                  </div>
                  <span className="rounded-full bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5">
                    Confirmed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{t.followUpDoctor}</div>
                    <div className="text-teal-700 font-medium">{t.followUpDate}</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-2.5 border border-teal-100 text-slate-600">
                    <strong>{lang === "ur" ? "مقصد: " : "Clinical Goal: "}</strong>
                    {t.followUpObjective}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* =====================================================================
              RIGHT COLUMN (COL 8-12): PILLAR 5 (Chat Assistant) & SAFETY TIERS GUIDE
              ===================================================================== */}
          <div className="lg:col-span-5 space-y-8">
            {/* -------------------------------------------------------------------
                PILLAR 5: BILINGUAL PATIENT ASSISTANT CHAT
                ------------------------------------------------------------------- */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col h-[640px]">
              {/* Chat Header */}
              <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500 text-white font-bold">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">{t.chatTitle}</h3>
                    <p className="text-[11px] text-teal-300">{t.chatSub}</p>
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
                    className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Refresh conversation"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Safety Notice Strip */}
              <div className="bg-teal-50 border-b border-teal-100 px-4 py-2 text-[11px] text-teal-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  <span>Clinical Safety Engine: Active (Tier 1 Verified)</span>
                </span>
                <span className="text-[10px] font-mono text-teal-600">Strict Red-Flag Interceptor</span>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
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
                        className={`w-full my-2 rounded-xl border border-red-300 bg-red-100 p-3 text-red-900 text-xs font-semibold shadow-xs flex items-start gap-2 ${
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
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                          msg.isUrdu ? "text-right font-serif" : "text-left font-sans"
                        } ${
                          msg.sender === "user"
                            ? "bg-teal-600 text-white rounded-br-xs"
                            : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                        }`}
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
                            <span className="text-teal-600 font-bold">
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
                    <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                    <span>
                      {lang === "ur"
                        ? "کلینیکل فارماکولوجی ڈیٹابیس سے تصدیق کی جا رہی ہے..."
                        : "Analyzing clinical pharmacology database..."}
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Prompt Suggestions */}
              {!isEmergencyActive && (
                <div className="border-t border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] font-bold text-slate-500 mb-1.5 px-1">
                    {t.quickQuestions}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {sampleQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(q)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                          idx === 3
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

              {/* Input Area / Locked Emergency Area */}
              <div className="border-t border-slate-200 bg-slate-50 p-3">
                {isEmergencyActive ? (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-red-700 font-bold text-xs">
                      <Lock className="h-4 w-4" />
                      <span>{t.chatLockedNotice}</span>
                    </div>
                    <div className="flex justify-center gap-2">
                      <a
                        href="tel:1122"
                        className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-red-700 flex items-center gap-1.5"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Call 1122</span>
                      </a>
                      <button
                        onClick={resetEmergency}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isEmergencyActive}
                      className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-teal-700 disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      <span>{t.sendBtn}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </form>
                )}

                {/* Clinical Disclaimer */}
                <p className="mt-2 text-[10px] text-slate-500 text-center leading-tight">
                  {t.chatDisclaimer}
                </p>
              </div>
            </section>

            {/* -------------------------------------------------------------------
                CLINICAL SAFETY ARCHITECTURE LEGEND (Pillar 4 Reference Card)
                ------------------------------------------------------------------- */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-600" />
                <span>MediFlow 4-Tier Clinical Safety Architecture</span>
              </h4>

              <div className="space-y-2.5 text-xs">
                {/* Tier 1 */}
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-950">Tier 1: Nominal Autonomous Guidance</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Standard drug-drug interactions verified, meal pairing reminders, safe autonomous answering.
                    </p>
                  </div>
                </div>

                {/* Tier 2 */}
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-950">Tier 2: Ambiguity Hold Gate</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Low OCR confidence (&lt;85%), conflicting doctor handwriting, or dosage ambiguities require pharmacist review.
                    </p>
                  </div>
                </div>

                {/* Tier 3 */}
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/50 p-2.5">
                  <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-950">Tier 3: Acute Emergency Lockout</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Cardiopulmonary distress, anaphylaxis, severe chest pain. Immediate chat lock &amp; 1122/911 dispatch.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          FOOTER WITH CLINICAL CREDENTIALS
          ========================================================================= */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-teal-600" />
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
