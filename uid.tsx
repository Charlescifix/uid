import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Shield, Users } from "lucide-react";

// Production-ready React page component with accessibility-first form UX,
// explicit consent, UK-specific validation, and transparent client-side classification.
// IMPORTANT: Server-side validation is required for integrity and security.

// ---------- Constants ----------
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || "/api/intake";
const MAX_TEXT_LENGTH = 5000;
const MAX_NAME_LENGTH = 100;

// ---------- Types ----------
type IntakeData = {
  // 1) Identity & Contact
  firstName: string;
  lastName: string;
  pronouns?: string;
  email: string;
  phone?: string;
  postcode?: string;
  ageBand?: "under18" | "18to24" | "25to34" | "35to44" | "45to54" | "55to64" | "65plus";

  // 2) Background
  employmentStatus?:
    | "employed"
    | "selfEmployed"
    | "unemployed"
    | "student"
    | "carer"
    | "retired"
    | "unableToWork";
  relationshipStatus?: "single" | "inRelationship" | "marriedCivil" | "separated" | "divorced" | "widowed";
  housing?: "secure" | "temporary" | "sofaSurfing" | "atRisk" | "homeless";
  dependents?: "none" | "children" | "adultDependents" | "both";

  // 3) Presenting issues
  concerns: string[];
  concernDetails?: string;
  severity?: "low" | "moderate" | "high" | "crisis";
  riskFlags: { selfHarm: boolean; harmToOthers: boolean; domesticAbuse: boolean; substanceRisk: boolean };
  gpRegistered?: boolean;

  // 4) Preferences & logistics
  supportPreferences: string[];
  availability?: string;
  preferredContact?: "email" | "phone" | "sms";

  // 5) Safeguarding & consent
  consent: {
    privacyPolicyAccepted: boolean;
    shareWithPartners: boolean;
    anonymisedInsights: boolean;
    crisisProtocolOk: boolean;
  };

  // meta
  source?: "web" | "facebook" | "referral" | "walkIn" | "other";
};

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

const CONCERNS: { key: string; label: string; description: string }[] = [
  { key: "employment", label: "Employment & Skills", description: "Job search, CV, workplace issues" },
  { key: "relationships", label: "Relationships & Family", description: "Separation, conflict, parenting" },
  { key: "emotional", label: "Emotional Wellbeing", description: "Anxiety, low mood, loneliness" },
  { key: "finance", label: "Money & Debt", description: "Benefits, budgeting, debt advice" },
  { key: "housing", label: "Housing", description: "Insecurity, eviction risk, homelessness" },
  { key: "legal", label: "Legal", description: "Rights at work, family, immigration" },
  { key: "addiction", label: "Addiction", description: "Alcohol, drugs, gambling" },
  { key: "health", label: "Physical Health", description: "Long-term conditions, access to GP" },
  { key: "abuse", label: "Abuse & Safety", description: "Domestic abuse, coercive control" },
  { key: "social", label: "Social Connection", description: "Isolation, building community" },
];

// ---------- Security Helpers ----------

/**
 * Basic sanitization to prevent XSS attacks
 * Note: This is client-side only - server must also sanitize!
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

/**
 * Secure UUID generation with proper fallback
 */
function generateSecureId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback to secure random values instead of Date.now()
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error("Crypto API not available");
}

/**
 * Get CSRF token from meta tag or cookie
 */
function getCsrfToken(): string | null {
  // Try to get from meta tag first
  const metaTag = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  if (metaTag?.content) {
    return metaTag.content;
  }

  // Try to get from cookie
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "XSRF-TOKEN") {
      return decodeURIComponent(value);
    }
  }

  return null;
}

// ---------- Validators ----------
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ukPhoneRe = /^(\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|01\d{3}|\+44\s?2\d{2}|02\d{2})\s?\d{3,4}\s?\d{3,4}$/;
const postcodeRe = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function validateStep(step: number, d: IntakeData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!d.firstName?.trim()) {
      errors.firstName = "First name is required";
    } else if (d.firstName.length > MAX_NAME_LENGTH) {
      errors.firstName = `First name must be less than ${MAX_NAME_LENGTH} characters`;
    }

    if (!d.lastName?.trim()) {
      errors.lastName = "Last name is required";
    } else if (d.lastName.length > MAX_NAME_LENGTH) {
      errors.lastName = `Last name must be less than ${MAX_NAME_LENGTH} characters`;
    }

    if (!d.email?.trim() || !emailRe.test(d.email)) {
      errors.email = "Enter a valid email address";
    }

    if (d.phone && !ukPhoneRe.test(d.phone)) {
      errors.phone = "Enter a valid UK phone number";
    }

    if (d.postcode && !postcodeRe.test(d.postcode)) {
      errors.postcode = "Enter a valid UK postcode (e.g., SW1A 1AA)";
    }
  }

  if (step === 2) {
    if (!d.employmentStatus) errors.employmentStatus = "Select your current employment status";
    if (!d.relationshipStatus) errors.relationshipStatus = "Select your current relationship status";
    if (!d.housing) errors.housing = "Select your housing situation";
  }

  if (step === 3) {
    if (!d.concerns || d.concerns.length === 0) {
      errors.concerns = "Pick at least one area you want help with";
    }
    if (!d.severity) {
      errors.severity = "How urgent/severe does this feel right now?";
    }
    if (d.concernDetails && d.concernDetails.length > MAX_TEXT_LENGTH) {
      errors.concernDetails = `Details must be less than ${MAX_TEXT_LENGTH} characters`;
    }
  }

  if (step === 4) {
    if (!d.preferredContact) {
      errors.preferredContact = "Choose how we should contact you";
    }
  }

  if (step === 5) {
    if (!d.consent?.privacyPolicyAccepted) {
      errors.privacy = "You must accept the Privacy Policy to continue";
    }
    if (!d.consent?.crisisProtocolOk && (d.severity === "high" || d.severity === "crisis")) {
      errors.crisis = "Please acknowledge the crisis protocol";
    }
  }

  return errors;
}

// ---------- Client-side triage (transparent) ----------
function computeClassification(d: IntakeData) {
  let riskScore = 0;

  if (d.severity === "moderate") riskScore += 2;
  if (d.severity === "high") riskScore += 4;
  if (d.severity === "crisis") riskScore += 6;

  if (d.riskFlags?.selfHarm) riskScore += 6;
  if (d.riskFlags?.domesticAbuse) riskScore += 6;
  if (d.riskFlags?.harmToOthers) riskScore += 4;
  if (d.riskFlags?.substanceRisk) riskScore += 3;

  if (d.housing === "homeless" || d.housing === "atRisk") riskScore += 3;
  if (d.employmentStatus === "unemployed" || d.employmentStatus === "unableToWork") riskScore += 2;

  const buckets: string[] = [];
  const c = new Set(d.concerns || []);

  if (c.has("abuse")) buckets.push("Safety/Crisis");
  if (c.has("emotional") || c.has("addiction")) buckets.push("Mental Health & Addiction");
  if (c.has("employment")) buckets.push("Employment & Skills");
  if (c.has("finance")) buckets.push("Money/Debt Advice");
  if (c.has("housing")) buckets.push("Housing Support");
  if (c.has("relationships")) buckets.push("Family/Relationship Support");
  if (c.has("health")) buckets.push("Physical Health Navigation");
  if (c.has("social")) buckets.push("Connection/Peer Support");

  let priority: "Low" | "Medium" | "High" | "Immediate" = "Low";
  if (riskScore >= 12) priority = "Immediate";
  else if (riskScore >= 8) priority = "High";
  else if (riskScore >= 4) priority = "Medium";

  return { riskScore, buckets, priority };
}

// ---------- Main Component ----------
export default function ModernIntakePage() {
  const [step, setStep] = useState(1);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [data, setData] = useState<IntakeData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    postcode: "",
    pronouns: "",
    ageBand: undefined,

    employmentStatus: undefined,
    relationshipStatus: undefined,
    housing: undefined,
    dependents: "none",

    concerns: [],
    concernDetails: "",
    severity: undefined,
    riskFlags: { selfHarm: false, harmToOthers: false, domesticAbuse: false, substanceRisk: false },
    gpRegistered: undefined,

    supportPreferences: [],
    availability: "",
    preferredContact: undefined,

    consent: {
      privacyPolicyAccepted: false,
      shareWithPartners: false,
      anonymisedInsights: true,
      crisisProtocolOk: false
    },
    source: "web",
  });

  const progress = useMemo(() => (step / 5) * 100, [step]);
  const triage = useMemo(() => computeClassification(data), [data]);

  function next() {
    const e = validateStep(step, data);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setStep((s) => Math.min(5, s + 1));
    }
  }

  function prev() {
    setStep((s) => Math.max(1, s - 1));
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const e2 = validateStep(5, data);
    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    setSubmissionStatus("submitting");
    setSubmitError("");

    try {
      // Sanitize all text inputs before submission
      const sanitizedData = {
        ...data,
        firstName: sanitizeInput(data.firstName),
        lastName: sanitizeInput(data.lastName),
        email: sanitizeInput(data.email),
        phone: data.phone ? sanitizeInput(data.phone) : undefined,
        postcode: data.postcode ? sanitizeInput(data.postcode) : undefined,
        pronouns: data.pronouns ? sanitizeInput(data.pronouns) : undefined,
        concernDetails: data.concernDetails ? sanitizeInput(data.concernDetails) : undefined,
        availability: data.availability ? sanitizeInput(data.availability) : undefined,
      };

      const csrfToken = getCsrfToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-Idempotency-Key": generateSecureId(),
      };

      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }

      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...sanitizedData,
          triage,
          submittedAt: new Date().toISOString(),
          schemaVersion: 1,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || `Server returned ${res.status}`);
      }

      setSubmissionStatus("success");
    } catch (err) {
      console.error("Submission error:", err);
      setSubmissionStatus("error");
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Sorry, something went wrong. Please try again or contact us directly."
      );
    }
  }

  // Accessible error summary focus on step change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const el = document.getElementById("error-summary");
      el?.focus();
    }
  }, [errors]);

  // Show success message
  if (submissionStatus === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full rounded-2xl shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <CardTitle>Request Received</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Thank you for reaching out. Your request has been securely received.
              We'll be in touch within 2 working days using your preferred contact method.
            </p>
            <p className="text-sm text-gray-500">
              If your situation becomes urgent, please call 999 or contact your local NHS urgent helpline.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="rounded-2xl">
              Submit Another Request
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ---------- Sections ----------
  const Header = () => (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-black text-white grid place-items-center font-bold">U</div>
          <span className="font-semibold">Unity in Diversity</span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#how" className="hover:underline">How we help</a>
          <a href="#form" className="hover:underline">Get support</a>
          <a href="#faq" className="hover:underline">FAQs</a>
        </nav>
        <Button asChild className="rounded-2xl">
          <a href="#form">Request assistance</a>
        </Button>
      </div>
    </header>
  );

  const Hero = () => (
    <section className="bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Strength through connection. Growth through support.
          </h1>
          <p className="mt-4 text-gray-600 text-lg">
            Confidential, practical help for men across employment, relationships, and emotional wellbeing —
            plus housing, money, and legal signposting.
          </p>
          <div className="mt-6 flex gap-3">
            <Button className="rounded-2xl" asChild>
              <a href="#form">I need help</a>
            </Button>
            <Button variant="outline" className="rounded-2xl" asChild>
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            Your data is protected. Read our{" "}
            <a className="underline" href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>.
          </div>
        </div>
        <div className="space-y-4">
          <div className="w-full aspect-[4/3] rounded-2xl border overflow-hidden">
            <img src="/men.png" alt="Men supporting each other" className="w-full h-full object-cover" />
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5"/>
                Quick facts
              </CardTitle>
              <CardDescription>How we triage to get you the right help fast.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 mt-0.5"/>
                <div>
                  <p className="font-medium">One simple form</p>
                  <p className="text-sm text-gray-600">Tell us what&apos;s going on. We&apos;ll handle the rest.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 mt-0.5"/>
                <div>
                  <p className="font-medium">Transparent triage</p>
                  <p className="text-sm text-gray-600">
                    We classify needs (e.g., Employment, Relationships, Emotional Wellbeing) and set a fair priority.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5"/>
                <div>
                  <p className="font-medium">Crisis-ready</p>
                  <p className="text-sm text-gray-600">
                    If you&apos;re at immediate risk, we escalate to urgent support pathways.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );

  const Features = () => (
    <section id="how" className="bg-gradient-to-b from-blue-50 to-teal-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-blue-900">What we help with</h2>
        <p className="text-teal-700 mt-2">
          From a quick chat to ongoing support — we&apos;ll match you to the right option.
        </p>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CONCERNS.map((c) => (
            <Card key={c.key} className="rounded-2xl bg-white border-teal-200 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-800">{c.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-teal-700">{c.description}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );

  const ErrorSummary = () => (
    Object.keys(errors).length > 0 ? (
      <div
        id="error-summary"
        tabIndex={-1}
        className="rounded-xl border border-red-300 bg-red-50 p-4 mb-6"
        role="alert"
        aria-live="assertive"
      >
        <p className="font-medium text-red-800">Please check the form:</p>
        <ul className="list-disc ml-5 text-sm text-red-700">
          {Object.values(errors).map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      </div>
    ) : null
  );

  const StepIndicator = () => (
    <div className="mb-6">
      <Progress value={progress} className="h-2" />
      <p className="mt-2 text-xs text-gray-500">Step {step} of 5</p>
    </div>
  );

  function toggleArrayField(field: keyof IntakeData, value: string) {
    setData((prev) => {
      const currentArray = (prev[field] as string[]) || [];
      const arr = new Set(currentArray);
      arr.has(value) ? arr.delete(value) : arr.add(value);
      return { ...prev, [field]: Array.from(arr) };
    });
  }

  const Form = () => (
    <section id="form" className="bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Card className="rounded-2xl shadow-lg">
          <CardHeader>
            <CardTitle>Assistance required</CardTitle>
            <CardDescription>
              Tell us a bit about you so we can connect you to the right support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorSummary />
            {submitError && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            <StepIndicator />
            <form onSubmit={handleSubmit} noValidate>
              {step === 1 && (
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First name *</Label>
                      <Input
                        id="firstName"
                        value={data.firstName}
                        onChange={(e) => setData({ ...data, firstName: e.target.value })}
                        aria-invalid={!!errors.firstName}
                        aria-describedby={errors.firstName ? "firstName-error" : undefined}
                        maxLength={MAX_NAME_LENGTH}
                      />
                      {errors.firstName && (
                        <p id="firstName-error" className="text-sm text-red-700 mt-1">{errors.firstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last name *</Label>
                      <Input
                        id="lastName"
                        value={data.lastName}
                        onChange={(e) => setData({ ...data, lastName: e.target.value })}
                        aria-invalid={!!errors.lastName}
                        aria-describedby={errors.lastName ? "lastName-error" : undefined}
                        maxLength={MAX_NAME_LENGTH}
                      />
                      {errors.lastName && (
                        <p id="lastName-error" className="text-sm text-red-700 mt-1">{errors.lastName}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData({ ...data, email: e.target.value })}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "email-error" : undefined}
                      />
                      {errors.email && (
                        <p id="email-error" className="text-sm text-red-700 mt-1">{errors.email}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone (UK)</Label>
                      <Input
                        id="phone"
                        inputMode="tel"
                        placeholder="07…"
                        value={data.phone}
                        onChange={(e) => setData({ ...data, phone: e.target.value })}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? "phone-error" : undefined}
                      />
                      {errors.phone && (
                        <p id="phone-error" className="text-sm text-red-700 mt-1">{errors.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        placeholder="e.g., NN1 1AA"
                        value={data.postcode}
                        onChange={(e) => setData({ ...data, postcode: e.target.value })}
                        aria-invalid={!!errors.postcode}
                        aria-describedby={errors.postcode ? "postcode-error" : undefined}
                      />
                      {errors.postcode && (
                        <p id="postcode-error" className="text-sm text-red-700 mt-1">{errors.postcode}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="pronouns">Pronouns</Label>
                      <Input
                        id="pronouns"
                        placeholder="e.g., he/him"
                        value={data.pronouns}
                        onChange={(e) => setData({ ...data, pronouns: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ageBand">Age band</Label>
                      <Select
                        value={data.ageBand}
                        onValueChange={(v) => setData({ ...data, ageBand: v as IntakeData["ageBand"] })}
                      >
                        <SelectTrigger id="ageBand">
                          <SelectValue placeholder="Select"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="under18">Under 18</SelectItem>
                          <SelectItem value="18to24">18–24</SelectItem>
                          <SelectItem value="25to34">25–34</SelectItem>
                          <SelectItem value="35to44">35–44</SelectItem>
                          <SelectItem value="45to54">45–54</SelectItem>
                          <SelectItem value="55to64">55–64</SelectItem>
                          <SelectItem value="65plus">65+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employmentStatus">Employment status *</Label>
                      <Select
                        value={data.employmentStatus}
                        onValueChange={(v) => setData({ ...data, employmentStatus: v as IntakeData["employmentStatus"] })}
                      >
                        <SelectTrigger id="employmentStatus">
                          <SelectValue placeholder="Select"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employed">Employed</SelectItem>
                          <SelectItem value="selfEmployed">Self-employed</SelectItem>
                          <SelectItem value="unemployed">Unemployed</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="carer">Carer</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="unableToWork">Unable to work</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.employmentStatus && (
                        <p className="text-sm text-red-700 mt-1">{errors.employmentStatus}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="relationshipStatus">Relationship status *</Label>
                      <Select
                        value={data.relationshipStatus}
                        onValueChange={(v) => setData({ ...data, relationshipStatus: v as IntakeData["relationshipStatus"] })}
                      >
                        <SelectTrigger id="relationshipStatus">
                          <SelectValue placeholder="Select"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="inRelationship">In a relationship</SelectItem>
                          <SelectItem value="marriedCivil">Married / Civil partnership</SelectItem>
                          <SelectItem value="separated">Separated</SelectItem>
                          <SelectItem value="divorced">Divorced</SelectItem>
                          <SelectItem value="widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.relationshipStatus && (
                        <p className="text-sm text-red-700 mt-1">{errors.relationshipStatus}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="housing">Housing *</Label>
                      <Select
                        value={data.housing}
                        onValueChange={(v) => setData({ ...data, housing: v as IntakeData["housing"] })}
                      >
                        <SelectTrigger id="housing">
                          <SelectValue placeholder="Select"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="secure">Secure / stable</SelectItem>
                          <SelectItem value="temporary">Temporary / short-term</SelectItem>
                          <SelectItem value="sofaSurfing">Sofa surfing</SelectItem>
                          <SelectItem value="atRisk">At risk of homelessness</SelectItem>
                          <SelectItem value="homeless">Currently homeless</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.housing && (
                        <p className="text-sm text-red-700 mt-1">{errors.housing}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="dependents">Dependents</Label>
                      <Select
                        value={data.dependents}
                        onValueChange={(v) => setData({ ...data, dependents: v as IntakeData["dependents"] })}
                      >
                        <SelectTrigger id="dependents">
                          <SelectValue placeholder="Select"/>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="children">Children</SelectItem>
                          <SelectItem value="adultDependents">Adult dependents</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="gpRegistered">Registered with a GP?</Label>
                      <div className="flex items-center gap-3 py-2">
                        <Switch
                          id="gpRegistered"
                          checked={!!data.gpRegistered}
                          onCheckedChange={(v) => setData({ ...data, gpRegistered: v })}
                        />
                        <span className="text-sm text-gray-600">Yes</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-4">
                  <div>
                    <Label>What do you need help with? *</Label>
                    <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {CONCERNS.map((c) => (
                        <label
                          key={c.key}
                          className="flex items-start gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={data.concerns.includes(c.key)}
                            onCheckedChange={() => toggleArrayField("concerns", c.key)}
                          />
                          <div>
                            <p className="font-medium text-sm">{c.label}</p>
                            <p className="text-xs text-gray-600">{c.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {errors.concerns && (
                      <p className="text-sm text-red-700 mt-2">{errors.concerns}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="concernDetails">Tell us what&apos;s going on (optional)</Label>
                    <Textarea
                      id="concernDetails"
                      value={data.concernDetails}
                      onChange={(e) => setData({ ...data, concernDetails: e.target.value })}
                      placeholder="Share any context you feel comfortable with…"
                      maxLength={MAX_TEXT_LENGTH}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {data.concernDetails?.length || 0} / {MAX_TEXT_LENGTH}
                    </p>
                  </div>

                  <div>
                    <Label>How urgent/severe does this feel right now? *</Label>
                    <RadioGroup
                      value={data.severity}
                      onValueChange={(v) => setData({ ...data, severity: v as IntakeData["severity"] })}
                      className="mt-2 grid sm:grid-cols-4 gap-2"
                    >
                      {[
                        { key: "low", label: "Low" },
                        { key: "moderate", label: "Moderate" },
                        { key: "high", label: "High" },
                        { key: "crisis", label: "Crisis" },
                      ].map((o) => (
                        <label
                          key={o.key}
                          className="flex items-center gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50"
                        >
                          <RadioGroupItem value={o.key} id={`sev-${o.key}`} />
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {errors.severity && (
                      <p className="text-sm text-red-700 mt-2">{errors.severity}</p>
                    )}
                  </div>

                  <div>
                    <Label>Any risks we should be aware of?</Label>
                    <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <label className="flex items-center gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50">
                        <Checkbox
                          checked={data.riskFlags.selfHarm}
                          onCheckedChange={(v) => setData({
                            ...data,
                            riskFlags: { ...data.riskFlags, selfHarm: !!v }
                          })}
                        />
                        <span className="text-sm">Thoughts of self-harm</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50">
                        <Checkbox
                          checked={data.riskFlags.harmToOthers}
                          onCheckedChange={(v) => setData({
                            ...data,
                            riskFlags: { ...data.riskFlags, harmToOthers: !!v }
                          })}
                        />
                        <span className="text-sm">Risk of harm to others</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50">
                        <Checkbox
                          checked={data.riskFlags.domesticAbuse}
                          onCheckedChange={(v) => setData({
                            ...data,
                            riskFlags: { ...data.riskFlags, domesticAbuse: !!v }
                          })}
                        />
                        <span className="text-sm">Domestic abuse / unsafe at home</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50">
                        <Checkbox
                          checked={data.riskFlags.substanceRisk}
                          onCheckedChange={(v) => setData({
                            ...data,
                            riskFlags: { ...data.riskFlags, substanceRisk: !!v }
                          })}
                        />
                        <span className="text-sm">Substance-related risk</span>
                      </label>
                    </div>
                    {(data.riskFlags.selfHarm || data.riskFlags.domesticAbuse) && (
                      <Alert className="mt-3 border-amber-200 bg-amber-50">
                        <AlertTriangle className="h-4 w-4 text-amber-700" />
                        <AlertDescription className="text-amber-700">
                          If you&apos;re in immediate danger, call <strong>999</strong> or go to A&E.
                          For urgent mental health help, contact your local NHS urgent helpline.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="grid gap-4">
                  <div>
                    <Label>How would you like to receive support?</Label>
                    <div className="mt-2 grid sm:grid-cols-3 gap-2">
                      {[
                        { key: "oneToOne", label: "1:1 sessions" },
                        { key: "group", label: "Group support" },
                        { key: "peer", label: "Peer-led" },
                        { key: "online", label: "Online" },
                        { key: "phone", label: "Phone" },
                        { key: "inPerson", label: "In person" },
                      ].map((o) => (
                        <label
                          key={o.key}
                          className="flex items-center gap-2 rounded-xl border p-3 bg-white cursor-pointer hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={data.supportPreferences.includes(o.key)}
                            onCheckedChange={() => toggleArrayField("supportPreferences", o.key)}
                          />
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="availability">When are you generally available?</Label>
                      <Input
                        id="availability"
                        placeholder="e.g., weekday evenings, weekends"
                        value={data.availability}
                        onChange={(e) => setData({ ...data, availability: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Preferred contact *</Label>
                      <RadioGroup
                        value={data.preferredContact}
                        onValueChange={(v) => setData({ ...data, preferredContact: v as IntakeData["preferredContact"] })}
                        className="mt-2 flex flex-wrap gap-4"
                      >
                        {[
                          { key: "email", label: "Email" },
                          { key: "phone", label: "Phone" },
                          { key: "sms", label: "SMS" },
                        ].map((o) => (
                          <label key={o.key} className="flex items-center gap-2">
                            <RadioGroupItem value={o.key} id={`pc-${o.key}`} />
                            <span>{o.label}</span>
                          </label>
                        ))}
                      </RadioGroup>
                      {errors.preferredContact && (
                        <p className="text-sm text-red-700 mt-2">{errors.preferredContact}</p>
                      )}
                    </div>
                  </div>

                  {/* Live triage preview */}
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-sm text-gray-500">Live triage preview</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {triage.buckets.map((b) => (
                        <Badge key={b} variant="secondary" className="rounded-xl">{b}</Badge>
                      ))}
                    </div>
                    <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <span className="text-gray-500">Priority</span>
                        <p className="text-lg font-semibold">{triage.priority}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <span className="text-gray-500">Risk score</span>
                        <p className="text-lg font-semibold">{triage.riskScore}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3">
                        <span className="text-gray-500">Concerns selected</span>
                        <p className="text-lg font-semibold">{data.concerns.length}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Final decisions are made by a trained team member and may differ from this preview.
                    </p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="grid gap-4">
                  <div className="rounded-2xl border bg-white p-4">
                    <h3 className="font-semibold mb-2">Consent & data use</h3>
                    <p className="text-sm text-gray-600">
                      We use your information to provide support. Read our{" "}
                      <a className="underline" href="/privacy" target="_blank" rel="noreferrer">
                        Privacy & Cookies Policy
                      </a>.
                    </p>
                    <div className="mt-3 grid gap-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          checked={data.consent.privacyPolicyAccepted}
                          onCheckedChange={(v) => setData({
                            ...data,
                            consent: { ...data.consent, privacyPolicyAccepted: !!v }
                          })}
                        />
                        <span className="text-sm">I have read and accept the Privacy Policy *</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          checked={data.consent.shareWithPartners}
                          onCheckedChange={(v) => setData({
                            ...data,
                            consent: { ...data.consent, shareWithPartners: !!v }
                          })}
                        />
                        <span className="text-sm">
                          I agree you may share my details with trusted partners to arrange support (optional)
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <Checkbox
                          checked={data.consent.anonymisedInsights}
                          onCheckedChange={(v) => setData({
                            ...data,
                            consent: { ...data.consent, anonymisedInsights: !!v }
                          })}
                        />
                        <span className="text-sm">
                          I consent to anonymised data being used to improve services and report impact (optional)
                        </span>
                      </label>
                      {(data.severity === "high" || data.severity === "crisis") && (
                        <label className="flex items-start gap-2 cursor-pointer">
                          <Checkbox
                            checked={data.consent.crisisProtocolOk}
                            onCheckedChange={(v) => setData({
                              ...data,
                              consent: { ...data.consent, crisisProtocolOk: !!v }
                            })}
                          />
                          <span className="text-sm">
                            I understand that if I&apos;m at serious risk, you may contact emergency or safeguarding services *
                          </span>
                        </label>
                      )}
                    </div>
                    {errors.privacy && (
                      <p className="text-sm text-red-700 mt-2">{errors.privacy}</p>
                    )}
                    {errors.crisis && (
                      <p className="text-sm text-red-700 mt-2">{errors.crisis}</p>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    <p>
                      By submitting, you confirm the details are accurate to the best of your knowledge.
                      You can request deletion or correction at any time.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prev}
                  disabled={step === 1 || submissionStatus === "submitting"}
                  className="rounded-2xl"
                >
                  Back
                </Button>
                {step < 5 ? (
                  <Button type="button" onClick={next} className="rounded-2xl">
                    Continue <ArrowRight className="ml-2 h-4 w-4"/>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submissionStatus === "submitting"}
                    className="rounded-2xl"
                  >
                    {submissionStatus === "submitting" ? "Submitting…" : "Submit request"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );

  const FAQ = () => (
    <section id="faq" className="bg-gradient-to-b from-teal-50 to-blue-50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-blue-900">Common questions</h2>
        <div className="mt-6 grid md:grid-cols-2 gap-4 text-sm">
          <Card className="rounded-2xl bg-white border-teal-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-800">Is it confidential?</CardTitle>
            </CardHeader>
            <CardContent className="text-teal-700">
              Yes. We keep your information safe and only share with partners if you opt in or if there&apos;s a serious risk of harm.
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-white border-teal-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-800">How fast will you respond?</CardTitle>
            </CardHeader>
            <CardContent className="text-teal-700">
              We aim to respond within 2 working days. If urgent, call 999 or your local NHS urgent helpline.
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-white border-teal-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-800">Do I need a GP referral?</CardTitle>
            </CardHeader>
            <CardContent className="text-teal-700">
              No. You can contact us directly. Being registered with a GP helps us signpost effectively.
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-white border-teal-200 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-800">What does it cost?</CardTitle>
            </CardHeader>
            <CardContent className="text-teal-700">
              Core support is free. If we refer you to specialist services, we&apos;ll explain any costs first.
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );

  const Footer = () => (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-4 gap-6 text-sm">
        <div>
          <p className="font-semibold">Unity in Diversity</p>
          <p className="text-gray-600 mt-2">
            Helping men build healthier lives through practical support and community.
          </p>
        </div>
        <div>
          <p className="font-semibold">Contact</p>
          <p className="text-gray-600 mt-2">
            Email: <a className="underline" href="mailto:info@theuid.uk">info@theuid.uk</a>
          </p>
          <p className="text-gray-600">
            Phone: <a className="underline" href="tel:+447000000000">+44 7000 000000</a>
          </p>
          <p className="text-gray-600">Northampton, UK</p>
        </div>
        <div>
          <p className="font-semibold">Legal</p>
          <ul className="mt-2 space-y-1">
            <li><a className="underline" href="/privacy">Privacy & Cookies</a></li>
            <li><a className="underline" href="/accessibility">Accessibility</a></li>
            <li><a className="underline" href="/safeguarding">Safeguarding</a></li>
            <li><a className="underline" href="/terms">Terms</a></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Regulatory</p>
          <ul className="mt-2 space-y-1 text-gray-600">
            <li><strong>UNITY IN DIVERSITY CIC</strong></li>
            <li>Company number: <strong>15515502</strong></li>
            <li>Registered in England & Wales</li>
          </ul>
        </div>
      </div>
      <div className="py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Unity in Diversity CIC • Built with care
      </div>
    </footer>
  );

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Features />
      <Form />
      <FAQ />
      <Footer />
    </div>
  );
}
