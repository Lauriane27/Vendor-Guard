#🛡️ VendorGuard

AI reviews everything. Humans handle the exceptions.

VendorGuard is an enterprise AI agent designed to run 100% locally. It automates first-pass contract reviews, security questionnaires, and Data Processing Agreements (DPAs) by auditing them against your internal company policies and compliance requirements.
##💡 Why VendorGuard?
Absolute Data Privacy: Sensitive vendor agreements and internal compliance documents never leave your machine—zero cloud LLM API calls required.
Significant Time & Cost Savings: Automates up to 70% of routine regulatory reviews, releasing hundreds of hours of high-cost legal and compliance labor.
Zero Evidence Hallucinations: Every finding (PASS or FLAG) is strictly verified against the original text. If evidence is missing, ambiguous, or unverifiable, VendorGuard defaults to UNCERTAIN—ensuring no risks are silently passed.

##⚙️ Core Features

Policy Rule Extraction: Converts complex company policies into structured, actionable compliance criteria (e.g., maximum retention limits, security certifications, IP liability caps).
Hybrid Evaluation Engine: Combines local LLM semantic understanding with deterministic programmatic checks (e.g., numerical data retention and liability cap comparisons).
Evidence-Backed Classification:
🟢 PASS: Explicit, verified contract evidence satisfies the requirement.
🔴 FLAG: Explicit evidence directly contradicts or violates the policy requirement.
🟠 UNCERTAIN: Evidence is missing, incomplete, vague, or cannot be verified in the source text.
Structured & Schema-Validated Outputs: Produces predictable JSON reports designed to integrate seamlessly into procurement and risk management workflows.
🔄 Agent Workflow
Company Policy + Vendor Contract
              │
              ▼
    1. Extract Policy Rules
              │
              ▼
  2. Search Evidence in Contract
              │
              ▼
   3. Verify Exact Quotes & Text
              │
              ▼
  4. Classify (PASS / FLAG / UNCERTAIN)
              │
              ▼
 5. Escalate Exceptions for Human Review
 
 ##🛠️ Technical Stack & Architecture
 
Local AI Inference: Dell Pro Max GB10 / Ollama / Local Model (nemotron-3-nano:30b)
Agentic Framework: NemoClaw / OpenClaw / OpenShell
Data Interchange: Schema-validated JSON
