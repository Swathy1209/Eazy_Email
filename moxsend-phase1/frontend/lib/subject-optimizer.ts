import { postJson } from '@/lib/fetch-json';

export type SubjectOptimizerRequest = {
  subject_input: string;
  campaign_context?: string;
  lead_context?: string;
  offer_context?: string;
  tone?: string;
};

export type SubjectOptimizerVariant = {
  id: number;
  subject: string;
  score: number;
  label: string;
  angle: string;
};

export type SubjectOptimizerResponse = {
  success: boolean;
  variants: SubjectOptimizerVariant[];
  error?: string;
};

export function requestSubjectOptimizer(payload: SubjectOptimizerRequest): Promise<SubjectOptimizerResponse> {
  return postJson<SubjectOptimizerResponse>('/api/leads/personalize/subject-optimizer', payload);
}
