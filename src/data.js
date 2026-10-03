export const POLICY = {
  id: "luminastream-v2026",
  label: "LuminaStream Media — Production & Vendor Policy v2026",
  file: "LuminaStream_Policy.pdf",
};

export const VENDORS = [
  {
    id: "a",
    name: "Vendor A: OmniLens",
    short: "OmniLens",
    file: "Vendor_A_Contract.pdf",
    staged: false,
  },
  {
    id: "b",
    name: "Vendor B: Apex Video / Velvet Thread",
    short: "Apex Video / Velvet Thread",
    file: "Vendor_B_Contract.pdf",
    staged: true,
  },
  {
    id: "c",
    name: "Vendor C: ChromaCore",
    short: "ChromaCore",
    file: "Vendor_C_Contract.pdf",
    staged: false,
  },
];

export const STEPS = [
  {
    id: 1,
    label: "Receive",
    detail: (vendor) => `Loading ${vendor.policyFile || POLICY.file} and ${vendor.file}.`,
  },
  {
    id: 2,
    label: "Extract Rules",
    detail: () =>
      "Converting internal policy into structured requirements AUD-01, INF-02, COP-03, and SUB-04.",
  },
  {
    id: 3,
    label: "Find Evidence",
    detail: (vendor) => `Searching ${vendor.file} for the clauses that bear on each rule.`,
  },
  {
    id: 4,
    label: "Verify",
    detail: () =>
      "Grounding every quote against the original document so the agent cannot invent a clause.",
  },
  {
    id: 5,
    label: "Compare",
    detail: () => "Testing vendor evidence against the company policy requirement.",
  },
  {
    id: 6,
    label: "Classify",
    detail: () => "Assigning PASS, FLAG, or UNCERTAIN to each rule.",
  },
  {
    id: 7,
    label: "Escalate",
    detail: () =>
      "PASS items clear. FLAG and UNCERTAIN items escalate with the rule, the evidence, and the reason.",
  },
  {
    id: 8,
    label: "Human Decision",
    detail: () => "Final approval stays with the human reviewer. The agent does not auto-approve.",
  },
];

export const FILTERS = [
  { id: "all", label: "All rules" },
  { id: "privacy", label: "Privacy", rule: "AUD-01" },
  { id: "security", label: "Security", rule: "INF-02" },
  { id: "legal", label: "Risk/Legal", rule: "COP-03" },
  { id: "procurement", label: "Procurement", rule: "SUB-04" },
];

export const FINDINGS = [
  {
    id: "AUD-01",
    category: "privacy",
    categoryLabel: "Privacy",
    title: "Viewer Data Retention",
    status: "FLAG",
    severity: "HIGH",
    requirement: "Maximum 24 months retention of viewer interaction profiles.",
    file: "Vendor_B_Contract.pdf",
    section: "Sec 2.2",
    sectionTitle: "Section 2.2",
    before: "Contractor agrees to maintain standard user activity logs.",
    evidence:
      "Viewer interaction profiles shall be stored for a period of up to 5 years (60 months) from creation.",
    after: "Data will be archived in secondary storage systems.",
    reason:
      "Policy AUD-01 caps retention of viewer interaction profiles at 24 months. Section 2.2 keeps those profiles for up to 5 years (60 months) — 36 months past the ceiling — and then moves them into secondary archival storage with no shorter limit. The clause fails the retention rule and extends LuminaStream’s exposure on viewer data.",
    redline:
      "Viewer interaction profiles shall be stored for no longer than twenty-four (24) months from creation, then deleted or irreversibly anonymized. Archival and secondary storage are subject to the same limit.",
  },
  {
    id: "INF-02",
    category: "security",
    categoryLabel: "Security",
    title: "Security Certification",
    status: "FLAG",
    severity: "MEDIUM",
    requirement: "Active ISO 27001 or SOC 2 Type II certification required.",
    file: "Vendor_B_Contract.pdf",
    section: "Sec 5.3",
    sectionTitle: "Section 5.3",
    before: "Security audit compliance is reviewed annually.",
    evidence:
      "Vendor maintains commercial security protocols, with formal SOC2 Type II certification currently pending.",
    after: "Audating reports will be shared upon request once finalized.",
    reason:
      "Policy INF-02 requires an active ISO 27001 certification or a current SOC 2 Type II report before the vendor processes production data. Section 5.3 cites only commercial security protocols and states that formal SOC 2 Type II certification is pending. An annual review sentence does not replace a current attestation. The control is not in force, so the rule fails.",
    redline:
      "Before processing any LuminaStream data, and throughout the term, Vendor shall maintain a current SOC 2 Type II report or ISO/IEC 27001 certification and shall deliver the most recent report on request. A certification described as pending does not satisfy this section.",
  },
  {
    id: "COP-03",
    category: "legal",
    categoryLabel: "Risk/Legal",
    title: "IP & Copyright Insurance",
    status: "FLAG",
    severity: "CRITICAL",
    requirement: "Minimum $2,000,000 USD IP/Copyright insurance required.",
    file: "Vendor_B_Contract.pdf",
    section: "Sec 8.1",
    sectionTitle: "Section 8.1",
    before: "Vendor agrees to hold standard business operations insurance.",
    evidence:
      "Total aggregate liability for copyright or IP disputes shall not exceed $250,000 USD.",
    after: "This cap applies to all work deliverables under this SOW.",
    reason:
      "Policy COP-03 requires a minimum of $2,000,000 USD in IP and copyright insurance. Section 8.1 instead caps aggregate liability for copyright or IP disputes at $250,000 USD. That cap is $1,750,000 under the required floor, and it is 12.5% of the policy minimum. A liability cap does not satisfy an insurance requirement. The shortfall is critical: a single copyright claim on production media can exhaust the cap.",
    redline:
      "Vendor shall carry intellectual-property and copyright liability insurance of not less than USD $2,000,000 per claim and in the aggregate, and shall name LuminaStream as an additional insured. Any cap on liability for copyright or IP disputes shall be no lower than that insured amount.",
  },
  {
    id: "SUB-04",
    category: "procurement",
    categoryLabel: "Procurement",
    title: "Subcontractor Consent",
    status: "FLAG",
    severity: "HIGH",
    requirement: "Prior written consent required before subcontracting.",
    file: "Vendor_B_Contract.pdf",
    section: "Sec 11.4",
    sectionTitle: "Section 11.4",
    before: "Services will be managed by primary agency staff.",
    evidence:
      "Vendor reserves the right to outsource video editing and post-production to offshore freelance networks.",
    after: "Subcontractors shall adhere to internal quality standards.",
    reason:
      "Policy SUB-04 requires LuminaStream’s prior written consent before any subcontracting. Section 11.4 reserves a unilateral right to outsource video editing and post-production to offshore freelance networks. A promise that subcontractors will follow internal quality standards does not create consent, and it weakens chain of custody for production assets. The clause fails the procurement rule.",
    redline:
      "Vendor shall not subcontract, outsource, or delegate any services, including video editing and post-production, whether to employees, affiliates, or freelance networks and whether onshore or offshore, without LuminaStream’s prior written consent.",
  },
];

export function metricsFor(findings) {
  const flag = findings.filter((item) => item.status === "FLAG").length;
  const uncertain = findings.filter((item) => item.status === "UNCERTAIN").length;
  const pass = findings.filter((item) => item.status === "PASS").length;
  return {
    total: findings.length,
    pass,
    flag,
    uncertain,
  };
}
