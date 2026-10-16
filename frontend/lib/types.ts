export type CruxCase = {
  id: string;
  title: string;
  question: string;
  decision_rule?: string;
  outcome_a: string;
  outcome_b: string;
  source_policy?: string;
  sponsor: string;
  bounty_atto: string;
  remaining_bounty_atto?: string;
  bond_atto: string;
  status: string;
  created_at?: string;
  closes_at: string;
  baseline_review?: { status?: string; outcome?: string; basis?: string } | null;
  accepted_evidence?: EvidenceItem[];
  submission_ids?: string[];
  winner?: string;
  final_outcome?: string;
  closing_submission?: string;
  can_submit?: boolean;
  can_expire?: boolean;
  pending_challenge_count?: number;
  final_decision_evidence?: Record<string, unknown> | null;
};

export type EvidenceItem = {
  id: string;
  url: string;
  fact: string;
  kind: "BASELINE" | "CONTRIBUTED" | string;
};

export type Submission = {
  id: string;
  case_id: string;
  contributor: string;
  commitment?: string;
  status: string;
  committed_at: string;
  reveal_deadline?: string;
  evidence_url: string;
  claimed_fact: string;
  revealed_at: string;
  settled_at: string;
  reward_atto: string;
  verification?: Record<string, unknown> | null;
  closure?: Record<string, unknown> | null;
  can_expire?: boolean;
};

export type ProtocolStats = {
  product: string;
  version: string;
  network: string;
  chain_id: string;
  rpc: string;
  verifier: string;
  judge: string;
  admin_controls: boolean;
  protocol_fee_bps: string;
  total_cases: string;
  total_submissions: string;
  cases_closed: string;
  verified_non_closing: string;
  rejected_submissions: string;
  retryable_submissions: string;
  accounting_balanced: boolean;
};

export type PendingReveal = {
  caseId: string;
  commitment: string;
  evidenceUrl: string;
  claimedFact: string;
  salt: string;
  createdAt: string;
  commitTxHash?: string;
  commitState?: "READY" | "SUBMITTED" | "FINALIZED";
  revealTxHash?: string;
  revealState?: "SUBMITTED" | "FINALIZED";
};

export type ChallengeRecord = {
  id: string;
  case_id: string;
  challenged_decision_id: string;
  challenged_evidence_id: string;
  challenger: string;
  commitment: string;
  bond_atto: string;
  status: string;
  committed_at: string;
  reveal_deadline: string;
  stage_deadline: string;
  source_url: string;
  counterclaim: string;
  revealed_at: string;
  review?: Record<string, unknown> | null;
  bond_released: boolean;
  bond_forfeited: boolean;
  settled_at: string;
};

export type ChallengeCase = CruxCase & {
  provisional_outcome?: string;
  provisional_submission?: string;
  provisional_winner?: string;
  challenge_deadline?: string;
  challenge_review_deadline?: string;
  challenge_recovery_deadline?: string;
  challenge_status?: string;
  pending_challenge?: string;
  challenge_count?: number;
  pending_challenge_count?: number;
  appeal_bond_atto?: string;
  can_appeal?: boolean;
  pending_invalid_challenge_penalty_atto?: string;
  pending_final_outcome?: string;
  pending_final_beneficiary?: string;
  can_finalize?: boolean;
  final_decision_evidence?: Record<string, unknown> | null;
};
