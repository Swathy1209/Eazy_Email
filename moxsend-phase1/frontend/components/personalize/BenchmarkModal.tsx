'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { postJson } from '@/lib/fetch-json';
import { ScoreBar } from '@/components/personalize/ScoreBar';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { ProgressBar } from '@/components/personalize/ProgressBar';

interface BenchmarkResult {
  model: string;
  quality_score: number;
  humanization_score: number;
  regional_fit_score: number;
  latency_ms: number;
  retry_count: number;
  estimated_cost: string;
  hallucination_detected: boolean;
  workflow_stage: 'queued' | 'generating' | 'humanizing' | 'evaluating' | 'scoring' | 'completed' | 'failed';
  subject: string;
  body: string;
  strengths: string[];
  weaknesses: string[];
  evaluator_summary: string;
  humanization_summary?: string;
  regional_summary?: string;
  error?: string;
  success?: boolean;
}

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: any[];
  aiConfig: {
    offer: string;
    emailLength: string;
    personalizeWith: string[];
    extraInstructions: string;
    language?: string;
  };
  onSelectOutput: (subject: string, bodyHtml: string, metrics: any) => void;
}

const AVAILABLE_MODELS = [
  { id: 'qwen', name: 'Qwen 2.5 (Local)', provider: 'Ollama' },
  { id: 'mistral', name: 'Mistral Small', provider: 'Ollama' },
  { id: 'groq-llama', name: 'Groq Llama 3', provider: 'Groq' },
  { id: 'gemini', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'gpt-4', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openrouter', name: 'DeepSeek R1', provider: 'OpenRouter' },
];

const PIPELINE_STEPS = [
  "Executing LangGraph Workflow...",
  "Provider Routing Active...",
  "Evaluator Intelligence Running...",
  "Humanization Layer Active...",
  "Calculating Quality Scores..."
];

export function BenchmarkModal({ isOpen, onClose, leads, aiConfig, onSelectOutput }: BenchmarkModalProps) {
  const [selectedModels, setSelectedModels] = useState<string[]>(['qwen', 'groq-llama', 'gpt-4']);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowStates, setWorkflowStates] = useState<Record<string, string>>({});
  const [pipelineStepIndex, setPipelineStepIndex] = useState(0);

  // Rotate pipeline messages
  useEffect(() => {
    if (running) {
      const interval = setInterval(() => {
        setPipelineStepIndex((prev) => (prev + 1) % PIPELINE_STEPS.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [running]);

  useEffect(() => {
    if (!isOpen) {
      setResults([]);
      setError(null);
      setRunning(false);
    }
  }, [isOpen]);

  const toggleModel = (id: string) => {
    if (running) return;
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const runBenchmark = async () => {
    if (selectedModels.length === 0) return;
    setRunning(true);
    setResults([]);
    setError(null);
    
    const initialStates: Record<string, string> = {};
    selectedModels.forEach(m => initialStates[m] = 'Queued');
    setWorkflowStates(initialStates);

    try {
      const finalResults: BenchmarkResult[] = [];
      
      for (const model of selectedModels) {
        setWorkflowStates(prev => ({ ...prev, [model]: 'Generating' }));
        
        try {
          const data = await postJson<{ success: boolean; results: BenchmarkResult[] }>(
            '/api/ai/benchmark-run',
            {
              leads: leads.slice(0, 1),
              models: [model],
              aiConfig,
              language: aiConfig.language || 'english'
            }
          );

          console.log(`[DEBUG] Benchmark API response for ${model}:`, data);

          if (!data.success || !data.results?.[0]) {
             console.error(`[ERROR] Benchmark failed for ${model}`, data);
             setWorkflowStates(prev => ({ ...prev, [model]: 'Failed' }));
             finalResults.push({
                model,
                workflow_stage: 'failed',
                error: data.results?.[0]?.error || 'Generation failed',
             } as any);
          } else {
             const raw = data.results[0];
             
             // Normalize backend response: ensure numbers are numbers and keys are present
             const benchmarkResult: BenchmarkResult = {
               ...raw,
               quality_score: Number(raw.quality_score || 0),
               humanization_score: Number(raw.humanization_score || 0),
               regional_fit_score: Number(raw.regional_fit_score || 0),
               latency_ms: Number(raw.latency_ms || 0),
               retry_count: Number(raw.retry_count || 0),
               workflow_stage: (raw.workflow_stage || 'completed').toLowerCase() as any,
               estimated_cost: String(raw.estimated_cost || 'Low'),
               subject: String(raw.subject || ''),
               body: String(raw.body || ''),
               strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
               weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : [],
             };

             console.log(`[DEBUG] Normalized Benchmark Result for ${model}:`, benchmarkResult);
             
             setWorkflowStates(prev => ({ ...prev, [model]: 'Humanizing' }));
             await new Promise(r => setTimeout(r, 400));
             setWorkflowStates(prev => ({ ...prev, [model]: 'Evaluating' }));
             await new Promise(r => setTimeout(r, 400));
             setWorkflowStates(prev => ({ ...prev, [model]: 'Scoring' }));
             await new Promise(r => setTimeout(r, 400));
             setWorkflowStates(prev => ({ ...prev, [model]: 'Completed' }));
             
             finalResults.push(benchmarkResult);
          }
        } catch (e) {
          console.error(`[ERROR] Benchmark exception for ${model}:`, e);
          setWorkflowStates(prev => ({ ...prev, [model]: 'Failed' }));
          finalResults.push({
             model,
             workflow_stage: 'failed',
             error: e instanceof Error ? e.message : 'Unknown error',
          } as any);
        }
        setResults([...finalResults]);
        console.log(`[DEBUG] Current benchmark results state:`, finalResults);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Benchmark execution failed');
    } finally {
      setRunning(false);
    }
  };

  const insights = useMemo(() => {
    if (results.length === 0) return null;
    const validResults = results.filter(r => !r.error && r.quality_score > 0);
    if (validResults.length === 0) return null;

    const bestOverall = [...validResults].sort((a, b) => (b.quality_score + b.humanization_score) - (a.quality_score + a.humanization_score))[0];
    const fastest = [...validResults].sort((a, b) => a.latency_ms - b.latency_ms)[0];
    const cheapest = [...validResults].sort((a, b) => (a.estimated_cost === 'Low' ? 0 : 1) - (b.estimated_cost === 'Low' ? 0 : 1))[0];
    const bestCultural = [...validResults].sort((a, b) => b.regional_fit_score - a.regional_fit_score)[0];

    return { 
      bestOverall, 
      fastest, 
      cheapest, 
      bestCultural,
      avgQuality: Math.round(validResults.reduce((acc, curr) => acc + curr.quality_score, 0) / validResults.length),
      completedCount: validResults.length
    };
  }, [results]);

  if (!isOpen) return null;

  const isArabic = aiConfig.language?.toLowerCase() === 'arabic';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md transition-all animate-in fade-in duration-300 p-4">
      <div className="relative w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] dark:border-sky-400/20 dark:bg-[#060D17] flex flex-col">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-sky-400/10 flex items-center justify-between bg-white/50 dark:bg-[#081522]/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
             <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
             </div>
             <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Model Intelligence Benchmark
                  <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-sky-500/10 text-sky-400 rounded-full font-bold border border-sky-500/20">MVP</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#6B8CA5] mt-0.5">
                  Evaluate multi-provider AI performance for the current outbound cohort.
                </p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-all hover:rotate-90 duration-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Section A: Model Selection */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-[#52718A]">
                 Intelligence Providers
               </h3>
               <span className="text-[10px] text-slate-400 dark:text-[#52718A]">{selectedModels.length} providers selected</span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {AVAILABLE_MODELS.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={running}
                    className={`group relative flex flex-col items-start p-4 rounded-2xl border transition-all duration-300 ${
                      isSelected 
                        ? 'border-sky-500/50 bg-sky-500/5 dark:border-[#00C8FF]/40 dark:bg-[#00C8FF]/5 shadow-[0_8px_20px_-8px_rgba(0,200,255,0.2)]' 
                        : 'border-slate-200 bg-white dark:border-white/5 dark:bg-white/2 hover:border-slate-300 dark:hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                       <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-[#52718A]'
                       }`}>
                          {model.provider}
                       </span>
                       <div className={`w-4 h-4 rounded-full border transition-all duration-300 flex items-center justify-center ${
                          isSelected ? 'bg-sky-500 border-sky-500 scale-110 shadow-[0_0_8px_rgba(14,165,233,0.5)]' : 'border-slate-300 dark:border-white/10'
                       }`}>
                          {isSelected && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" className="w-2.5 h-2.5" strokeWidth={4}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                       </div>
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-[#6B8CA5]'}`}>
                       {model.name}
                    </span>
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={runBenchmark}
                disabled={running || selectedModels.length === 0}
                className="group relative px-10 py-4 bg-slate-900 dark:bg-sky-500 text-white dark:text-[#060D17] rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 overflow-hidden"
              >
                <div className="relative z-10 flex items-center gap-3">
                  {running ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      {PIPELINE_STEPS[pipelineStepIndex]}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run Benchmark Analysis
                    </>
                  )}
                </div>
                {!running && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>}
              </button>

              {running && (
                 <div className="flex items-center gap-2 text-[10px] font-bold text-sky-500">
                    <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping"></span>
                    Live LangGraph Orchestration in Progress
                 </div>
              )}
            </div>
          </section>

          {error && (
            <div className="p-5 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-400 text-xs font-medium flex items-center gap-3">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
               {error}
            </div>
          )}

          {/* Section B: Insights & Summary */}
          {insights && (
             <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden group">
                   <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">🏆 Best Overall</p>
                   <h4 className="text-sm font-bold text-slate-900 dark:text-white">{insights.bestOverall.model}</h4>
                   <p className="text-[10px] text-slate-500 dark:text-[#6B8CA5] mt-1">Highest quality + human tone</p>
                </div>
                <div className="p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20 relative overflow-hidden group">
                   <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1">⚡ fastest</p>
                   <h4 className="text-sm font-bold text-slate-900 dark:text-white">{insights.fastest.model}</h4>
                   <p className="text-[10px] text-slate-500 dark:text-[#6B8CA5] mt-1">{(insights.fastest.latency_ms / 1000).toFixed(1)}s turnaround</p>
                </div>
                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 relative overflow-hidden group">
                   <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">🌍 Cultural Fit</p>
                   <h4 className="text-sm font-bold text-slate-900 dark:text-white">{insights.bestCultural.model}</h4>
                   <p className="text-[10px] text-slate-500 dark:text-[#6B8CA5] mt-1">{isArabic ? 'GCC localized tone' : 'Region-aware nuance'}</p>
                </div>
                <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 relative overflow-hidden group">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">💰 lowest cost</p>
                   <h4 className="text-sm font-bold text-slate-900 dark:text-white">{insights.cheapest.model}</h4>
                   <p className="text-[10px] text-slate-500 dark:text-[#6B8CA5] mt-1">Optimized for scale</p>
                </div>
             </section>
          )}

          {/* Section C: Comparison Table */}
          {(results.length > 0 || running) && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-[#52718A]">
                   Provider Comparison Analysis
                </h3>
                {!running && insights && (
                   <div className="text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                      Workflow Analysis Complete: {insights.completedCount} providers evaluated
                   </div>
                )}
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-white/5 dark:bg-[#08111B]/60 shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/50 dark:bg-white/[0.02] text-[10px] uppercase tracking-widest text-slate-500 dark:text-[#52718A] font-black border-b border-slate-100 dark:border-white/5">
                    <tr>
                      <th className="px-8 py-5">Intelligence Agent</th>
                      <th className="px-6 py-5 text-center">Workflow Stage</th>
                      <th className="px-6 py-5 text-center">Quality</th>
                      <th className="px-6 py-5 text-center">Human tone</th>
                      <th className="px-6 py-5 text-center">{isArabic ? 'Cultural fit' : 'Regional Fit'}</th>
                      <th className="px-6 py-5 text-center">Latency</th>
                      <th className="px-6 py-5 text-center">Cost</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {selectedModels.map((modelId) => {
                       const res = results.find(r => r.model === modelId);
                       const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
                       const state = (res?.workflow_stage || workflowStates[modelId]) || 'Queued';
                       
                       return (
                        <React.Fragment key={modelId}>
                          <tr className={`transition-all duration-300 ${res ? 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]' : 'opacity-60'}`}>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className={`h-2.5 w-2.5 rounded-full ${
                                   state.toLowerCase() === 'completed' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' :
                                   state.toLowerCase() === 'failed' || state.toLowerCase() === 'error' ? 'bg-rose-500' :
                                   state.toLowerCase() === 'queued' ? 'bg-slate-500/30' : 
                                   state.toLowerCase() === 'humanizing' ? 'bg-cyan-500 animate-pulse' :
                                   state.toLowerCase() === 'evaluating' ? 'bg-amber-500 animate-pulse' :
                                   'bg-sky-500 animate-pulse'
                                }`}></div>
                                <div>
                                   <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">{modelInfo?.name}</span>
                                   <span className="text-[10px] text-slate-500 dark:text-[#52718A] uppercase tracking-wider">{modelInfo?.provider}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                               <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full border ${
                                  state.toLowerCase() === 'completed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                                  state.toLowerCase() === 'generating' ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' :
                                  state.toLowerCase() === 'humanizing' ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400' :
                                  state.toLowerCase() === 'evaluating' ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                                  state.toLowerCase() === 'failed' || state.toLowerCase() === 'error' ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' :
                                  'border-slate-200 bg-slate-50 text-slate-400 dark:border-white/5 dark:bg-white/5 dark:text-[#52718A]'
                               }`}>
                                  {state}
                               </span>
                               {res && res.retry_count > 0 && (
                                  <div className="mt-1 text-[8px] font-bold text-amber-500 uppercase">Retry Successful</div>
                               )}
                            </td>
                            <td className="px-6 py-6">
                              {res && !res.error ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span className={`text-xs font-black ${res.quality_score > 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                     {res.quality_score}%
                                  </span>
                                  <div className="w-20">
                                    <ProgressBar value={res.quality_score} fillClassName={res.quality_score > 85 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-amber-500'} />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 dark:text-white/5">—</div>
                              )}
                            </td>
                            <td className="px-6 py-6">
                              {res && !res.error ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-xs font-black text-cyan-400">{res.humanization_score}%</span>
                                  <div className="w-20">
                                    <ProgressBar value={res.humanization_score} fillClassName="bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.3)]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 dark:text-white/10">—</div>
                              )}
                            </td>
                            <td className="px-6 py-6">
                              {res && !res.error ? (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-xs font-black text-amber-400">{res.regional_fit_score}%</span>
                                  <div className="w-20">
                                    <ProgressBar value={res.regional_fit_score} fillClassName="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 dark:text-white/10">—</div>
                              )}
                            </td>
                            <td className="px-6 py-6 text-center">
                              {res && !res.error ? (
                                <div className="flex flex-col items-center gap-1">
                                   <span className="text-xs text-slate-600 dark:text-slate-300 font-black tabular-nums">
                                     {(res.latency_ms / 1000).toFixed(1)}s
                                   </span>
                                   <span className="text-[8px] text-[#52718A] uppercase font-bold tracking-tighter">Response Time</span>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 dark:text-white/10">—</div>
                              )}
                            </td>
                            <td className="px-6 py-6 text-center">
                              {res && !res.error ? (
                                 <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                   res.estimated_cost === 'Free' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                                   res.estimated_cost === 'Low' ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' : 
                                   res.estimated_cost === 'Medium' ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' :
                                   'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                 }`}>
                                   {res.estimated_cost}
                                 </span>
                              ) : (
                                <div className="text-center text-slate-300 dark:text-white/10">—</div>
                              )}
                            </td>
                            <td className="px-8 py-6 text-right">
                              {res && !res.error ? (
                                <button
                                  onClick={() => setExpandedModel(expandedModel === modelId ? null : modelId)}
                                  className="group flex items-center gap-2 ml-auto text-[10px] font-black uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-all"
                                >
                                  {expandedModel === modelId ? 'Hide Output' : 'Inspect Intelligence'}
                                  <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${expandedModel === modelId ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                     <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              ) : (
                                <div className="text-center text-slate-300 dark:text-white/10">—</div>
                              )}
                            </td>
                          </tr>
                          
                          {/* Expanded Result Details */}
                          {expandedModel === modelId && res && (
                            <tr className="bg-[#08111B]/40 border-y border-white/5 animate-in slide-in-from-top-2 duration-500">
                              <td colSpan={8} className="px-8 py-10">
                                <div className="grid lg:grid-cols-12 gap-10">
                                  {/* Left: Content Preview */}
                                  <div className="lg:col-span-7 space-y-6">
                                    <div className="relative">
                                      <div className="flex items-center justify-between mb-3">
                                         <p className="text-[10px] uppercase font-black text-[#52718A] tracking-[0.2em] flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                            Strategic Subject Line
                                         </p>
                                         <span className="text-[9px] font-bold text-sky-400/50 uppercase">Character count: {res.subject.length}</span>
                                      </div>
                                      <div className="p-6 rounded-2xl bg-[#060D17] border border-white/5 text-sm font-bold text-white shadow-2xl">
                                        {res.subject}
                                      </div>
                                    </div>
                                    <div className="relative">
                                      <div className="flex items-center justify-between mb-3">
                                         <p className="text-[10px] uppercase font-black text-[#52718A] tracking-[0.2em] flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                            Intelligence-Driven Body
                                         </p>
                                         <span className="text-[9px] font-bold text-sky-400/50 uppercase">Word count: {res.body.split(' ').length}</span>
                                      </div>
                                      <div className="p-8 rounded-2xl bg-[#060D17] border border-white/5 text-sm leading-relaxed text-[#E9F8FF] max-h-[450px] overflow-y-auto whitespace-pre-wrap font-medium shadow-2xl custom-scrollbar border-l-4 border-l-sky-500/30">
                                        {res.body}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Right: Metrics & Insights */}
                                  <div className="lg:col-span-5 space-y-8">
                                     <div className="p-8 rounded-3xl bg-[#0B1522] border border-white/5 shadow-2xl space-y-8">
                                        {res.error && (
                                           <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 mb-6">
                                              <p className="text-[10px] uppercase font-black text-rose-400 tracking-[0.2em] mb-2">Execution Error</p>
                                              <p className="text-sm text-rose-200 font-medium">{res.error}</p>
                                           </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                           <h4 className="text-[10px] uppercase font-black text-sky-400 tracking-[0.2em]">Workflow Quality Analysis</h4>
                                           <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${res.hallucination_detected ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                              {res.hallucination_detected ? 'HALLUCINATION FLAG' : 'RELIABILITY VERIFIED'}
                                           </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-8">
                                           <ScoreBar label="Strategic Depth" value={res.quality_score} tone="emerald" compact />
                                           <ScoreBar label="Natural Cadence" value={res.humanization_score} tone="cyan" compact />
                                           <ScoreBar label={isArabic ? "Arabic Nuance" : "Regional Context"} value={res.regional_fit_score} tone="amber" compact />
                                           <div className="space-y-1">
                                              <span className="text-[10px] font-black text-[#52718A] uppercase tracking-widest">Latency</span>
                                              <div className="text-xl font-black text-white tabular-nums">{(res.latency_ms / 1000).toFixed(2)}s</div>
                                           </div>
                                        </div>

                                        <div className="space-y-4 pt-6 border-t border-white/5">
                                           <div>
                                              <p className="text-[10px] uppercase font-black text-sky-400/70 tracking-[0.2em] mb-2">Evaluator Intelligence</p>
                                              <p className="text-xs text-slate-300 italic leading-relaxed font-medium">"{res.evaluator_summary}"</p>
                                           </div>
                                           {res.humanization_summary && (
                                              <div>
                                                 <p className="text-[10px] uppercase font-black text-cyan-400/70 tracking-[0.2em] mb-2">Humanization Analysis</p>
                                                 <p className="text-[11px] text-slate-400 leading-relaxed">{res.humanization_summary}</p>
                                              </div>
                                           )}
                                           {res.regional_summary && (
                                              <div>
                                                 <p className="text-[10px] uppercase font-black text-amber-400/70 tracking-[0.2em] mb-2">Regional Alignment</p>
                                                 <p className="text-[11px] text-slate-400 leading-relaxed">{res.regional_summary}</p>
                                              </div>
                                           )}
                                        </div>
                                     </div>

                                     <div className="grid grid-cols-2 gap-8 px-4">
                                        <div className="space-y-4">
                                           <p className="text-[9px] uppercase font-black text-emerald-500 tracking-widest flex items-center gap-2">
                                              <span className="h-[1px] flex-1 bg-emerald-500/20"></span>
                                              Strengths
                                              <span className="h-[1px] flex-1 bg-emerald-500/20"></span>
                                           </p>
                                           <ul className="space-y-2.5">
                                              {res.strengths?.map((s, i) => (
                                                 <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2 leading-tight">
                                                    <span className="text-emerald-500 font-bold">✓</span> {s}
                                                 </li>
                                              ))}
                                           </ul>
                                        </div>
                                        <div className="space-y-4">
                                           <p className="text-[9px] uppercase font-black text-amber-500 tracking-widest flex items-center gap-2">
                                              <span className="h-[1px] flex-1 bg-amber-500/20"></span>
                                              Nuances
                                              <span className="h-[1px] flex-1 bg-amber-500/20"></span>
                                           </p>
                                           <ul className="space-y-2.5">
                                              {res.weaknesses?.map((w, i) => (
                                                 <li key={i} className="text-[11px] text-slate-300 flex items-start gap-2 leading-tight">
                                                    <span className="text-amber-500 font-bold">•</span> {w}
                                                 </li>
                                              ))}
                                           </ul>
                                        </div>
                                     </div>

                                     <button
                                        onClick={() => {
                                          onSelectOutput(res.subject, res.body, res);
                                          onClose();
                                        }}
                                        className="group relative w-full py-5 bg-emerald-500 text-[#060D17] rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_20px_50px_-12px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.03] hover:bg-emerald-400 active:scale-95 flex items-center justify-center gap-3"
                                     >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                           <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Adopt Intelligence
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                     </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                       );
                    })}
                  </tbody>
                </table>
              </div>
              
              {insights && (
                 <div className="mt-8 flex items-center justify-center p-6 border border-emerald-500/10 bg-emerald-500/2 rounded-2xl">
                    <p className="text-xs text-slate-400 flex items-center gap-3">
                       <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                       <span className="font-bold text-slate-200">Executive Summary:</span> 
                       {insights.bestOverall.model} is recommended for this cohort due to its superior balance of personalization and regional nuance.
                    </p>
                 </div>
              )}
            </section>
          )}

        </div>

        {/* Footer info */}
        <div className="p-8 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#08111B] flex justify-between items-center text-[10px] text-slate-400 dark:text-[#52718A] font-black tracking-[0.3em] uppercase">
          <div className="flex gap-10">
             <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                Lead Dataset: <span className="text-white ml-1">{leads.length} Active</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Workflow: <span className="text-white ml-1">{aiConfig.emailLength} Refinement</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <span className="opacity-40">Moxsend Intelligence Engine</span>
             <div className="h-4 w-[1px] bg-white/10"></div>
             <span className="text-sky-400 font-black">Strategic Benchmark v1.0</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
