export type QuestionType =
  | "checkbox"
  | "number"
  | "text"
  | "date"
  | "datetime"
  | "dropdown"
  | "photo"
  | "signature"
  | "multiple_choice";

export type ChecklistFrequency =
  | "per_shift_am"
  | "per_shift_pm"
  | "per_delivery"
  | "per_dispatch"
  | "per_shift_eod"
  | "weekly"
  | "monthly"
  | "adhoc"
  | "per_new_start"
  | "per_complaint"
  | "per_corrective_action";

export interface Checklist {
  id: string;
  name: string;
  frequency: ChecklistFrequency;
  description: string | null;
  category: string | null;
  active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  checklist_id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  order_index: number;
  options: string[] | null; // for dropdown / multiple_choice
  hint: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  checklist_id: string;
  submitted_by: string;
  submitted_at: string;
  signed_off_by: string | null;
  signed_off_at: string | null;
  notes: string | null;
  checklist?: Checklist;
  answers?: Answer[];
}

export interface Answer {
  id: string;
  submission_id: string;
  question_id: string;
  value: string | null; // JSON string for complex values
  question?: Question;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
  active: boolean;
  created_at: string;
}

export interface AlertLog {
  id: string;
  checklist_id: string;
  sent_at: string;
  recipient: string;
  message: string;
}

