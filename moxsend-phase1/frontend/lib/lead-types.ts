export type Progress = {
  total: number;
  processed: number;
  success: number;
  failed: number;
  percentage: number;
};

export type RowOutput = {
  openingLine: string;
  email: string;
  subjects: [string, string];
};

export type RowResult = {
  email: string;
  firstname: string;
  lastname: string;
  name: string;
  phone: string;
  company: string;
  companyurl: string;
  city: string;
  country: string;
  designation: string;
  industry: string;
  company_size: string;
  lead_type: string;
  source: string;
  tags: string;
  notes: string;
  status: 'success' | 'failed';
  output: RowOutput | null;
  error?: string;
  /** Present when row was loaded from Supabase `leads`. */
  dbId?: string;
  importJobId?: string | null;
};

export type LeadsSessionPayload = {
  jobId: string | null;
  fileName: string | null;
  leads: RowResult[];
  selectedIndices?: number[];
  savedAt: number;
};

export const LEADS_SESSION_KEY = 'easyhawk-leads-workflow';
