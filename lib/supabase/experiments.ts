import type { ExperimentStatus, ParameterPermission, PredictionConfig, ResultVisibility, ScoringWeights, SuccessCondition } from "@/lib/experiments/types";
import type { FocusedModelKey } from "@/lib/experiments/model-runtime";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ExperimentRow = {
  id: string; teacher_id: string; code: string; title: string; model_key: FocusedModelKey; context: string; objective: string; status: ExperimentStatus;
  prediction_question: string; prediction_type: "choice" | "numeric" | "text"; prediction_options: string[]; attempt_limit: number | null;
  explanation_required: boolean; immediate_feedback: boolean; result_visibility: ResultVisibility; aggregate_published: boolean; scoring_weights: ScoringWeights;
  created_at: string; updated_at: string; published_at: string | null; closed_at: string | null;
};
export type ParameterPermissionRow = { id: string; experiment_id: string; parameter_key: string; is_editable: boolean; minimum: number; maximum: number; initial_value: number };
export type ConditionRow = { id: string; experiment_id: string; condition_kind: "prediction" | "result"; metric_key: string | null; operator: "gte" | "lte" | "between" | "equals"; target_minimum: number; target_maximum: number; tolerance: number; expected_value: Record<string, unknown> };
export type ParticipantRow = { id: string; experiment_id: string; student_id: string; status: "joined" | "in_progress" | "submitted"; attempt_epoch: number; joined_at: string; updated_at: string; profile?: { display_name: string | null } | null };
export type AttemptRow = { id: string; experiment_id: string; participant_id: string; student_id: string; attempt_epoch: number; attempt_number: number; parameters: Record<string, number>; results: Record<string, number>; mechanism_chain: unknown[]; score_details: Record<string, unknown>; created_at: string };
export type SubmissionRow = { id: string; experiment_id: string; participant_id: string; attempt_id: string; student_id: string; prediction: unknown; final_parameters: Record<string, number>; calculated_results: Record<string, number>; mechanism_chain: unknown[]; explanation: { schemaVersion?: number; schema_version?: number; response: string }; auto_score: number; final_score: number; feedback_released: boolean; completion_status: string; created_at: string; experiment?: ExperimentRow; feedback?: FeedbackRow[] };
export type FeedbackRow = { id: string; submission_id: string; teacher_id: string; explanation_score: number | null; feedback: string; override_final_score: number | null; released_at: string | null; updated_at: string };

function client() { const value = getSupabaseBrowserClient(); if (!value) throw new Error("Supabase is not configured."); return value; }
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function listPublishedExperiments() {
  const { data, error } = await client().rpc("list_public_experiments");
  fail(error); return (data ?? []) as ExperimentRow[];
}

export async function getPublishedExperiment(code: string) {
  const { data, error } = await client().rpc("get_public_experiment", { p_code: code.trim().toUpperCase() });
  fail(error); return data as (ExperimentRow & { experiment_parameter_permissions: ParameterPermissionRow[] }) | null;
}

export async function listTeacherExperiments() {
  const { data, error } = await client().rpc("list_teacher_experiments");
  fail(error); return (data ?? []) as ExperimentRow[];
}

export async function getTeacherExperiment(experimentId: string) {
  const { data, error } = await client().rpc("get_teacher_experiment", { p_experiment_id: experimentId });
  fail(error); return data as (ExperimentRow & { experiment_parameter_permissions: ParameterPermissionRow[]; experiment_success_conditions: ConditionRow[] }) | null;
}

export async function saveTeacherExperiment(input: {
  id?: string; teacherId: string; title: string; modelKey: FocusedModelKey; context: string; objective: string; status: ExperimentStatus; prediction: PredictionConfig;
  permissions: ParameterPermission[]; conditions: SuccessCondition[]; attemptLimit: number | null; explanationRequired: boolean; immediateFeedback: boolean;
  resultVisibility: ResultVisibility; scoringWeights: ScoringWeights;
}) {
  const payload = { title: input.title, model_key: input.modelKey, context: input.context, objective: input.objective, status: input.status, prediction_question: input.prediction.question, prediction_type: input.prediction.type, prediction_options: input.prediction.options, attempt_limit: input.attemptLimit, explanation_required: input.explanationRequired, immediate_feedback: input.immediateFeedback, result_visibility: input.resultVisibility, scoring_weights: input.scoringWeights };
  const permissionRows = input.permissions.map((item) => ({ parameter_key: item.parameterKey, is_editable: item.editable, minimum: item.minimum, maximum: item.maximum, initial_value: item.initialValue }));
  const expected = input.prediction.type === "choice" ? { choice: input.prediction.expectedChoice } : input.prediction.type === "numeric" ? { minimum: input.prediction.expectedMinimum, maximum: input.prediction.expectedMaximum } : {};
  const conditionRows = [{ condition_kind: "prediction", metric_key: null, operator: "equals", target_minimum: 0, target_maximum: 0, tolerance: 0, expected_value: expected }, ...input.conditions.map((item) => ({ condition_kind: "result", metric_key: item.metricKey, operator: item.operator, target_minimum: item.targetMinimum, target_maximum: item.targetMaximum, tolerance: item.tolerance, expected_value: {} }))];
  const { data, error } = await client().rpc("save_teacher_experiment", { p_experiment_id: input.id ?? null, p_payload: payload, p_permissions: permissionRows, p_conditions: conditionRows });
  fail(error); return data as ExperimentRow;
}

export async function setExperimentStatus(experimentId: string, status: ExperimentStatus) {
  const { error } = await client().rpc("set_experiment_status", { p_experiment_id: experimentId, p_status: status }); fail(error);
}

export async function setAggregatePublished(experimentId: string, published: boolean) { const { error } = await client().rpc("set_experiment_aggregate_published", { p_experiment_id: experimentId, p_published: published }); fail(error); }
export async function joinExperiment(experimentId: string) { const { data, error } = await client().rpc("join_experiment", { p_experiment_id: experimentId }); fail(error); return data as ParticipantRow; }
export async function getMyParticipation(experimentId: string, studentId: string) { const { data, error } = await client().from("experiment_participants").select("*").eq("experiment_id", experimentId).eq("student_id", studentId).maybeSingle(); fail(error); return data as ParticipantRow | null; }
export async function savePrediction(experimentId: string, answer: unknown) { const { data, error } = await client().rpc("submit_experiment_prediction", { p_experiment_id: experimentId, p_answer: answer }); fail(error); return data; }
export async function runStudentAttempt(experimentId: string, parameters: Record<string, number>) { const { data, error } = await client().rpc("run_experiment_attempt", { p_experiment_id: experimentId, p_parameters: parameters }); fail(error); return data as AttemptRow; }
export async function submitStudentExperiment(experimentId: string, explanation: string) { const { data, error } = await client().rpc("submit_experiment", { p_experiment_id: experimentId, p_explanation: { schema_version: 1, response: explanation } }); fail(error); return data as SubmissionRow; }
export async function listStudentSubmissions() { const { data, error } = await client().rpc("list_student_submissions"); fail(error); return (data ?? []) as SubmissionRow[]; }
export async function listExperimentParticipants(experimentId: string) { const { data, error } = await client().from("experiment_participants").select("*, profile:profiles(display_name)").eq("experiment_id", experimentId).order("joined_at"); fail(error); return (data ?? []) as ParticipantRow[]; }
export async function listExperimentSubmissions(experimentId: string) { const { data, error } = await client().rpc("list_teacher_experiment_submissions", { p_experiment_id: experimentId }); fail(error); return (data ?? []) as SubmissionRow[]; }
export async function saveTeacherFeedback(input: { submissionId: string; teacherId: string; explanationScore: number | null; feedback: string; overrideFinalScore: number | null; release: boolean }) { const { data, error } = await client().from("teacher_feedback").upsert({ submission_id: input.submissionId, teacher_id: input.teacherId, explanation_score: input.explanationScore, feedback: input.feedback, override_final_score: input.overrideFinalScore, released_at: input.release ? new Date().toISOString() : null }, { onConflict: "submission_id" }).select().single(); fail(error); return data as FeedbackRow; }
export async function resetParticipant(participantId: string) { const { error } = await client().rpc("reset_experiment_participant", { p_participant_id: participantId }); fail(error); }
export async function getPrivateReport(submissionId: string) { const { data, error } = await client().rpc("get_private_experiment_report", { p_submission_id: submissionId }); fail(error); return data as Record<string, unknown> | null; }
export async function getSharedReport(token: string) { const { data, error } = await client().rpc("get_shared_experiment_report", { p_token: token }); fail(error); return data as Record<string, unknown> | null; }
export async function createReportShare(submissionId: string) { const { data, error } = await client().rpc("create_report_share", { p_submission_id: submissionId }); fail(error); return String(data); }
export async function revokeReportShare(submissionId: string) { const { error } = await client().from("report_share_tokens").update({ revoked_at: new Date().toISOString() }).eq("submission_id", submissionId); fail(error); }
export async function getExperimentAggregate(experimentId: string) { const { data, error } = await client().rpc("get_experiment_aggregate", { p_experiment_id: experimentId }); fail(error); return data as Record<string, unknown>; }
