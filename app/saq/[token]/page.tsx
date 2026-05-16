"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SupplierType = "raw_material" | "packaging" | "service";

interface SupplierRow {
  id: string;
  name: string;
  type: SupplierType;
  saq_token: string | null;
  saq_completed: boolean;
  saq_date: string | null;
}

type AnswerType = "yesnona" | "text" | "textarea" | "date";

interface QuestionDef {
  id: string;
  text: string;
  type: AnswerType;
  placeholder?: string;
  required?: boolean;
  forTypes?: SupplierType[];
}

interface SectionDef {
  number: string;
  title: string;
  forTypes?: SupplierType[];
  questions: QuestionDef[];
}

const SECTIONS: SectionDef[] = [
  {
    number: "1",
    title: "Company Details",
    questions: [
      { id: "1_company_name", text: "Company / trading name", type: "text", required: true },
      { id: "1_address", text: "Full address (including postcode)", type: "textarea", required: true },
      { id: "1_contact_name", text: "Main contact name", type: "text", required: true },
      { id: "1_contact_position", text: "Job title / position", type: "text", required: true },
      { id: "1_tel", text: "Telephone number", type: "text", required: true },
      { id: "1_email", text: "Email address", type: "text", required: true },
      { id: "1_products", text: "Products / services you supply to us", type: "text", required: true },
    ],
  },
  {
    number: "2",
    title: "Food Safety Certification",
    questions: [
      { id: "2_cert_held", text: "Do you hold a recognised food safety certification? (e.g. BRCGS, IFS, FSSC 22000, SQF, SALSA, ISO 22000)", type: "yesnona" },
      { id: "2_cert_name", text: "Name of certification(s) held", type: "text", placeholder: "e.g. BRCGS Food Issue 9 – Grade A" },
      { id: "2_cert_number", text: "Certificate number", type: "text" },
      { id: "2_cert_expiry", text: "Certificate expiry date", type: "date" },
      { id: "2_cert_body", text: "Certifying body", type: "text", placeholder: "e.g. NSF, Intertek, SGS" },
      { id: "2_unannounced", text: "Are your audits unannounced?", type: "yesnona" },
    ],
  },
  {
    number: "3",
    title: "Quality Management System",
    questions: [
      { id: "3_qms", text: "Do you have a documented Quality Management System (QMS)?", type: "yesnona" },
      { id: "3_qms_review", text: "Is your QMS reviewed and updated at least annually?", type: "yesnona" },
      { id: "3_food_safety_policy", text: "Do you have a documented food safety policy signed by senior management?", type: "yesnona" },
      { id: "3_internal_audit", text: "Do you conduct internal audits of your food safety systems?", type: "yesnona" },
      { id: "3_supplier_approval", text: "Do you have a documented supplier approval and monitoring procedure?", type: "yesnona" },
      { id: "3_complaints", text: "Do you have a documented customer complaints procedure?", type: "yesnona" },
      { id: "3_recall", text: "Do you have a documented product recall / withdrawal procedure?", type: "yesnona" },
    ],
  },
  {
    number: "4",
    title: "HACCP & Food Safety Management",
    questions: [
      { id: "4_haccp", text: "Do you have a documented HACCP plan in place?", type: "yesnona" },
      { id: "4_haccp_review", text: "Is your HACCP plan reviewed at least annually or after any significant change?", type: "yesnona" },
      { id: "4_ccp_monitored", text: "Are all Critical Control Points (CCPs) monitored and records maintained?", type: "yesnona" },
      { id: "4_corrective_actions", text: "Are corrective actions documented and followed up?", type: "yesnona" },
      { id: "4_verification", text: "Is your HACCP system verified by a competent person?", type: "yesnona" },
    ],
  },
  {
    number: "5",
    title: "Premises & Environment",
    questions: [
      { id: "5_premises_condition", text: "Is the site and building maintained in a good state of repair?", type: "yesnona" },
      { id: "5_pest_control", text: "Is there a documented and active pest control programme in place?", type: "yesnona" },
      { id: "5_pest_records", text: "Are pest control visits recorded and reviewed?", type: "yesnona" },
      { id: "5_waste_management", text: "Is there a documented waste management procedure?", type: "yesnona" },
      { id: "5_water_quality", text: "Is the water used in production potable / tested regularly?", type: "yesnona" },
    ],
  },
  {
    number: "6",
    title: "Equipment & Maintenance",
    questions: [
      { id: "6_maintenance", text: "Is there a documented preventive maintenance programme for food contact equipment?", type: "yesnona" },
      { id: "6_calibration", text: "Is measuring and monitoring equipment calibrated at defined intervals?", type: "yesnona" },
      { id: "6_calibration_records", text: "Are calibration records maintained?", type: "yesnona" },
      { id: "6_breakdowns", text: "Are equipment breakdown/repair records maintained?", type: "yesnona" },
    ],
  },
  {
    number: "7",
    title: "Staff Hygiene & Welfare",
    questions: [
      { id: "7_welfare", text: "Are adequate staff welfare facilities provided (toilets, changing, rest areas)?", type: "yesnona" },
      { id: "7_handwashing", text: "Are hand-washing facilities available at all critical points in production?", type: "yesnona" },
      { id: "7_hygiene_policy", text: "Do you have a documented personal hygiene policy for all food handlers?", type: "yesnona" },
      { id: "7_illness_reporting", text: "Is there a procedure for reporting illness and exclusion of food handlers?", type: "yesnona" },
      { id: "7_visitor_control", text: "Are visitor hygiene requirements enforced?", type: "yesnona" },
    ],
  },
  {
    number: "8",
    title: "Contamination Control",
    questions: [
      { id: "8_glass_policy", text: "Do you have a glass and brittle plastic policy?", type: "yesnona" },
      { id: "8_foreign_body", text: "Do you have a foreign body detection / control procedure?", type: "yesnona" },
      { id: "8_metal_detection", text: "Is metal detection or X-ray equipment used where appropriate?", type: "yesnona" },
      { id: "8_colour_coding", text: "Is colour-coded equipment used to prevent cross-contamination?", type: "yesnona" },
      { id: "8_chemicals", text: "Are cleaning chemicals and food-grade chemicals stored separately from food?", type: "yesnona" },
    ],
  },
  {
    number: "9",
    title: "Allergen Management",
    forTypes: ["raw_material"],
    questions: [
      { id: "9_allergen_policy", text: "Do you have a documented allergen management policy?", type: "yesnona" },
      { id: "9_allergen_risk", text: "Have you completed an allergen risk assessment for all products?", type: "yesnona" },
      { id: "9_allergen_labelling", text: "Are allergens correctly declared on product labels and/or specifications?", type: "yesnona" },
      { id: "9_allergen_cleaning", text: "Do you have allergen-specific cleaning procedures to prevent cross-contact?", type: "yesnona" },
      { id: "9_allergen_segregation", text: "Are allergenic ingredients physically segregated during storage and production?", type: "yesnona" },
      { id: "9_allergen_training", text: "Are all relevant staff trained in allergen awareness?", type: "yesnona" },
    ],
  },
  {
    number: "10",
    title: "Product Integrity & Specifications",
    questions: [
      { id: "10_specs", text: "Do you have up-to-date written product specifications for all products supplied to us?", type: "yesnona" },
      { id: "10_testing", text: "Do you conduct microbiological and/or chemical product testing?", type: "yesnona" },
      { id: "10_testing_freq", text: "If yes, how frequently is testing carried out?", type: "text", placeholder: "e.g. Every batch, monthly, annually" },
      { id: "10_shelf_life", text: "Are shelf-life / durability studies carried out and documented?", type: "yesnona" },
      { id: "10_labelling", text: "Do your products comply with applicable food labelling legislation?", type: "yesnona" },
    ],
  },
  {
    number: "11",
    title: "Cleaning & Housekeeping",
    questions: [
      { id: "11_cleaning_schedule", text: "Do you have a documented cleaning schedule for all food contact surfaces and equipment?", type: "yesnona" },
      { id: "11_cleaning_verified", text: "Is the effectiveness of cleaning verified (e.g. swabbing, visual inspection)?", type: "yesnona" },
      { id: "11_cleaning_records", text: "Are cleaning records maintained?", type: "yesnona" },
      { id: "11_detergents", text: "Are cleaning chemicals approved for use in a food environment?", type: "yesnona" },
    ],
  },
  {
    number: "12",
    title: "Process Controls & Traceability",
    questions: [
      { id: "12_process_controls", text: "Do you have documented process controls (e.g. temperature, time, pH)?", type: "yesnona" },
      { id: "12_monitoring_records", text: "Are process monitoring records maintained and reviewed?", type: "yesnona" },
      { id: "12_traceability", text: "Can you trace all raw materials from receipt through to finished product despatch?", type: "yesnona" },
      { id: "12_traceability_test", text: "Do you conduct traceability exercises to verify your system?", type: "yesnona" },
      { id: "12_batch_coding", text: "Are all products batch-coded to allow traceability?", type: "yesnona" },
    ],
  },
  {
    number: "13",
    title: "Transport & Storage",
    questions: [
      { id: "13_storage_conditions", text: "Are raw materials and finished goods stored under appropriate conditions (temp, humidity)?", type: "yesnona" },
      { id: "13_temp_monitoring", text: "Are storage temperatures monitored and recorded?", type: "yesnona" },
      { id: "13_vehicle_hygiene", text: "Are delivery vehicles maintained in a clean and hygienic condition?", type: "yesnona" },
      { id: "13_delivery_checks", text: "Are incoming deliveries inspected and documented?", type: "yesnona" },
      { id: "13_fifo", text: "Is a FIFO (first in, first out) system applied to stock rotation?", type: "yesnona" },
    ],
  },
  {
    number: "14",
    title: "Training & Personnel",
    questions: [
      { id: "14_training_records", text: "Are documented training records maintained for all food handlers?", type: "yesnona" },
      { id: "14_food_hygiene_training", text: "Have all food handlers received appropriate food hygiene training?", type: "yesnona" },
      { id: "14_training_refreshed", text: "Is training refreshed at regular intervals or when practices change?", type: "yesnona" },
      { id: "14_management_training", text: "Has management received advanced food safety / HACCP training?", type: "yesnona" },
    ],
  },
  {
    number: "15",
    title: "Genetically Modified & Irradiated Products",
    forTypes: ["raw_material"],
    questions: [
      { id: "15_gm", text: "Do any of the products you supply contain or are derived from genetically modified organisms (GMOs)?", type: "yesnona" },
      { id: "15_gm_detail", text: "If yes, please provide details", type: "text", placeholder: "Which products and which GM ingredient" },
      { id: "15_irradiated", text: "Have any of the products you supply been treated with ionising radiation?", type: "yesnona" },
      { id: "15_irradiated_detail", text: "If yes, please provide details", type: "text" },
    ],
  },
  {
    number: "16",
    title: "Declaration",
    questions: [
      { id: "16_declaration_name", text: "Full name of person completing this questionnaire", type: "text", required: true },
      { id: "16_declaration_position", text: "Job title / position", type: "text", required: true },
      { id: "16_declaration_date", text: "Date", type: "date", required: true },
      { id: "16_additional_info", text: "Any additional information you would like to share", type: "textarea", placeholder: "Optional" },
    ],
  },
];

function visibleSections(supplierType: SupplierType): SectionDef[] {
  return SECTIONS.filter(s => !s.forTypes || s.forTypes.includes(supplierType));
}

function visibleQuestions(questions: QuestionDef[], supplierType: SupplierType): QuestionDef[] {
  return questions.filter(q => !q.forTypes || q.forTypes.includes(supplierType));
}

function YesNoNa({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-4">
      {(["Yes", "No", "N/A"] as const).map(opt => (
        <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="radio"
            name={id}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-4 w-4 border-gray-300 text-brown accent-amber-400"
          />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}

export default function SAQPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : "";

  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [status, setStatus] = useState<"loading" | "not_found" | "already_done" | "form" | "submitted">("loading");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("not_found"); return; }
    (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .eq("saq_token", token)
        .maybeSingle();
      if (!data) { setStatus("not_found"); return; }
      setSupplier(data as SupplierRow);
      if ((data as SupplierRow).saq_completed) {
        setStatus("already_done");
      } else {
        setStatus("form");
      }
    })();
  }, [token]);

  function setAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplier) return;
    setSubmitting(true);

    const now = new Date().toISOString();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    await supabase.from("saq_responses").insert({
      supplier_id: supplier.id,
      responses: answers,
      submitted_at: now,
    });

    await supabase.from("suppliers").update({
      saq_completed: true,
      saq_date: now,
      next_review_due: nextYear.toISOString().split("T")[0],
    }).eq("id", supplier.id);

    setSubmitting(false);
    setStatus("submitted");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6 flex items-center gap-3">
          <img src="/kernel.png" alt="Kernel" className="h-8 w-auto" />
          <span className="font-serif text-lg font-bold text-brown">Kernel</span>
          <span className="text-gray-300 text-sm">|</span>
          <span className="text-sm text-gray-500">Supplier Self-Assessment Questionnaire</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {status === "loading" && (
          <div className="py-24 text-center text-gray-400 text-sm">Loading questionnaire…</div>
        )}

        {status === "not_found" && (
          <div className="py-24 text-center space-y-3">
            <p className="text-2xl font-serif text-brown font-bold">Link not found</p>
            <p className="text-sm text-gray-500">This questionnaire link is invalid or has expired. Please contact the team who sent you this link.</p>
          </div>
        )}

        {status === "already_done" && supplier && (
          <div className="py-24 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-2xl font-serif text-brown font-bold">Already submitted</p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{supplier.name}</span> has already completed this self-assessment questionnaire.
            </p>
            <p className="text-sm text-gray-400">If you believe this is an error, please contact the team who sent you this link.</p>
          </div>
        )}

        {status === "submitted" && supplier && (
          <div className="py-24 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <p className="text-2xl font-serif text-brown font-bold">Thank you, {supplier.name}!</p>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              Your self-assessment has been received and will be reviewed shortly.
            </p>
            <p className="text-sm text-gray-400">You can now close this window.</p>
          </div>
        )}

        {status === "form" && supplier && (
          <form onSubmit={handleSubmit} noValidate>
            {/* Supplier name */}
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Questionnaire for</p>
              <h1 className="text-2xl font-serif font-bold text-brown">{supplier.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Please complete all sections as fully as possible. Your responses will be treated confidentially.
              </p>
            </div>

            {visibleSections(supplier.type).map(section => {
              const qs = visibleQuestions(section.questions, supplier.type);
              if (qs.length === 0) return null;
              return (
                <div key={section.number} className="mb-8">
                  <h2 className="text-sm font-semibold text-brown bg-brand/20 px-4 py-2 rounded-t-lg border border-brand/30">
                    Section {section.number}: {section.title}
                  </h2>
                  <div className="border border-t-0 border-brand/30 rounded-b-lg divide-y divide-gray-100">
                    {qs.map(q => (
                      <div key={q.id} className="px-4 py-4">
                        <label className="block text-sm text-gray-800 mb-2">
                          {q.text}
                          {q.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {q.type === "yesnona" && (
                          <YesNoNa
                            id={q.id}
                            value={answers[q.id] ?? ""}
                            onChange={v => setAnswer(q.id, v)}
                          />
                        )}
                        {q.type === "text" && (
                          <input
                            className="input w-full"
                            type="text"
                            value={answers[q.id] ?? ""}
                            onChange={e => setAnswer(q.id, e.target.value)}
                            placeholder={q.placeholder}
                            required={q.required}
                          />
                        )}
                        {q.type === "textarea" && (
                          <textarea
                            className="input w-full"
                            rows={3}
                            value={answers[q.id] ?? ""}
                            onChange={e => setAnswer(q.id, e.target.value)}
                            placeholder={q.placeholder}
                            required={q.required}
                          />
                        )}
                        {q.type === "date" && (
                          <input
                            className="input w-full"
                            type="date"
                            value={answers[q.id] ?? ""}
                            onChange={e => setAnswer(q.id, e.target.value)}
                            required={q.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-sm font-semibold"
              >
                {submitting ? "Submitting…" : "Submit Self-Assessment"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
