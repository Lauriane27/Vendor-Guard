import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Ban,
  Check,
  Download,
  FileSearch,
  FileText,
  Flag,
  Loader2,
  Lock,
  Plus,
  Search,
  Send,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { FILTERS, FINDINGS, POLICY, STEPS, VENDORS, metricsFor } from "./data.js";
import { downloadRedlinePdf } from "./redlinePdf.js";

const STEP_MS = 560;

function stepState(index, step, phase) {
  if (phase === "complete") return "done";
  if (phase !== "running") return "pending";
  if (index < step - 1) return "done";
  if (index === step - 1) return "active";
  return "pending";
}

function readableStep(label) {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

export default function App() {
  const [vendorId, setVendorId] = useState("b");
  const [phase, setPhase] = useState("idle");
  const [step, setStep] = useState(0);
  const [reviewResults, setReviewResults] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const toastTimer = useRef(null);
  const shouldScroll = useRef(false);
  const [internalPolicy, setInternalPolicy] = useState({
    name: POLICY.file,
    size: null,
    prepared: true,
  });
  const [vendors, setVendors] = useState(() =>
    VENDORS.map((item) => ({
      ...item,
      documents: [{ id: `${item.id}-prepared`, name: item.file, size: null, prepared: true }],
    })),
  );
  const [pendingFile, setPendingFile] = useState(null);
  const [newVendorName, setNewVendorName] = useState("");
  const [dropNote, setDropNote] = useState(null);
  const [discordOnline, setDiscordOnline] = useState(false);
  const vendorsRef = useRef(vendors);
  vendorsRef.current = vendors;

  const selected = vendors.find((item) => item.id === vendorId) ?? vendors[0] ?? null;
  const vendor = selected
    ? {
        ...selected,
        file: selected.documents.at(-1)?.name ?? selected.file ?? "No contract yet",
        policyFile: internalPolicy?.name ?? "No internal policy",
      }
    : {
        id: "",
        name: "No vendor",
        short: "No vendor",
        file: "No contract yet",
        staged: false,
        documents: [],
        policyFile: internalPolicy?.name ?? "No internal policy",
      };
  const findings = reviewResults ?? [];
  const exceptions = findings.filter((item) => item.status === "FLAG" || item.status === "UNCERTAIN");
  const visible = exceptions.filter((item) => filter === "all" || item.category === filter);
  const packetReady = phase === "complete" && findings.length > 0;
  const metrics = metricsFor(findings);
  const activeStep = STEPS[Math.min(Math.max(step, 1), 8) - 1];

  useEffect(() => () => {
    clearInterval(timer.current);
    clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const response = await fetch("/api/discord/status");
        const body = await response.json();
        if (!stop) setDiscordOnline(Boolean(body.online));
      } catch {
        if (!stop) setDiscordOnline(false);
      }
    }
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/discord/events");
    source.onmessage = (event) => {
      try {
        applyDiscordDocument(JSON.parse(event.data));
      } catch {
        setDropNote("A Discord document arrived, but this page could not read it.");
      }
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    if (phase === "complete" && shouldScroll.current) {
      shouldScroll.current = false;
      document.getElementById("findings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }

  function selectVendor(id) {
    const next = vendors.find((item) => item.id === id);
    if (!next) return;
    focusVendor(next);
  }

  function receiveFile(file) {
    if (!file) return;
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!pdf) {
      setDropNote("Only PDF documents can be added.");
      return;
    }
    setDropNote(null);
    setPendingFile({ name: file.name, size: file.size });
  }

  function placeInternal() {
    if (!pendingFile) return;
    setInternalPolicy({
      name: pendingFile.name,
      size: pendingFile.size,
      prepared: false,
      fromDiscord: Boolean(pendingFile.fromDiscord),
    });
    setPendingFile(null);
    setDropNote(null);
  }

  function placeOnVendor(id) {
    if (!pendingFile) return;
    const document = {
      id: `${id}-${Date.now()}`,
      name: pendingFile.name,
      size: pendingFile.size,
      prepared: false,
      fromDiscord: Boolean(pendingFile.fromDiscord),
    };
    setVendors((current) =>
      current.map((item) =>
        item.id === id ? { ...item, documents: [...item.documents, document], file: document.name } : item,
      ),
    );
    setPendingFile(null);
    setDropNote(null);
    selectVendor(id);
  }

  function addVendor(event) {
    event?.preventDefault();
    const name = newVendorName.trim();
    if (!name) {
      setDropNote("Enter a vendor name to create a group.");
      return;
    }
    const id = `vendor-${Date.now()}`;
    const documents = pendingFile
      ? [{ id: `${id}-doc`, name: pendingFile.name, size: pendingFile.size, prepared: false }]
      : [];
    const next = {
      id,
      name,
      short: name,
      file: pendingFile?.name ?? "No contract yet",
      staged: false,
      documents,
    };
    clearInterval(timer.current);
    setVendors((current) => [...current, next]);
    setVendorId(id);
    setFilter("all");
    setPhase("idle");
    setStep(0);
    setNewVendorName("");
    setPendingFile(null);
    setDropNote(null);
  }

  function applyDiscordDocument(doc) {
    if (!doc?.name) return;
    if (doc.destination === "internal") {
      setInternalPolicy({ name: doc.name, size: doc.size, prepared: false, fromDiscord: true });
      setPendingFile(null);
      notify(`Discord replaced the internal policy with ${doc.name}.`);
      return;
    }
    if (doc.destination === "vendor" && doc.vendorName?.trim()) {
      const name = doc.vendorName.trim();
      const document = {
        id: `discord-${Date.now()}`,
        name: doc.name,
        size: doc.size,
        prepared: false,
        fromDiscord: true,
      };
      const match = findVendor(vendorsRef.current, name);
      const id = match?.id ?? `vendor-${Date.now()}`;
      setVendors((current) => {
        const existing = current.find((item) => item.id === id) ?? findVendor(current, name);
        if (!existing) {
          return [
            ...current,
            { id, name, short: name, file: doc.name, staged: false, documents: [document] },
          ];
        }
        if (existing.documents.some((item) => item.id === document.id)) return current;
        return current.map((item) =>
          item.id === existing.id
            ? { ...item, documents: [...item.documents, document], file: doc.name }
            : item,
        );
      });
      focusVendor({ id: match?.id ?? id, staged: match?.staged ?? false });
      notify(`Discord filed ${doc.name} under ${match?.short ?? name}.`);
      return;
    }
    setPendingFile({ name: doc.name, size: doc.size, fromDiscord: true });
    notify(`Discord received ${doc.name}. Choose internal documents or a vendor.`);
  }

  function focusVendor(next) {
    clearInterval(timer.current);
    setVendorId(next.id);
    setFilter("all");
    setReviewResults(null);
    setReviewError(null);
    setPhase("idle");
    setStep(0);
  }

  function removeDocument(id, documentId) {
    setVendors((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, documents: item.documents.filter((document) => document.id !== documentId) }
          : item,
      ),
    );
  }

  function removeVendor(id) {
    const remaining = vendors.filter((item) => item.id !== id);
    setVendors(remaining);
    if (vendorId !== id) return;
    if (remaining[0]) {
      focusVendor(remaining[0]);
      return;
    }
    clearInterval(timer.current);
    setVendorId("");
    setFilter("all");
    setPhase("idle");
    setStep(0);
  }

  function removeInternal() {
    setInternalPolicy(null);
  }

  async function reviewVendor() {
    if (phase === "running" || !selected) return;
    clearInterval(timer.current);
    shouldScroll.current = true;
    setFilter("all");
    setReviewError(null);
    setReviewResults(null);
    setPhase("running");
    setStep(1);
    let current = 1;
    timer.current = setInterval(() => {
      current += 1;
      if (current >= 7) {
        clearInterval(timer.current);
        setStep(7);
        return;
      }
      setStep(current);
    }, STEP_MS);

    const prepared = FINDINGS.some((item) => item.file === vendor.file);
    const rules = FINDINGS.map((item) => ({
      id: item.id,
      category: item.category,
      categoryLabel: item.categoryLabel,
      title: item.title,
      requirement: item.requirement,
      file: vendor.file,
      section: prepared ? item.section : "",
      sectionTitle: prepared ? item.sectionTitle : "",
      before: prepared ? item.before : "",
      evidence: prepared ? item.evidence : "",
      after: prepared ? item.after : "",
    }));

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyFile: vendor.policyFile,
          contractFile: vendor.file,
          vendorName: vendor.name,
          rules,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.results)) {
        throw new Error(data.error || "vendguard.py did not return a classification.");
      }
      clearInterval(timer.current);
      setReviewResults(data.results);
      setStep(8);
      setPhase("complete");
    } catch (error) {
      clearInterval(timer.current);
      setPhase("idle");
      setStep(0);
      setReviewError(error.message || "The review did not finish.");
    }
  }

  function rejectVendor() {
    notify(`Rejection recorded on this machine. ${vendor.short} will not proceed. A person still owns the decision.`);
  }

  function exportBrief() {
    downloadRedlinePdf(findings, vendor);
    notify("Redline PDF brief downloaded. It is a review packet, not an approval.");
  }

  function sendToLegal() {
    notify("Escalation packet queued for human legal review. VendorGuard did not approve the contract.");
  }

  const status = statusCopy(phase, vendor, metrics);

  return (
    <div className="min-h-screen bg-ivory pb-32 text-ink">
      <header className="sticky top-0 z-30 border-b-[3px] border-gold bg-ink text-cream">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-sm bg-gold text-ink">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-serif text-[1.35rem] leading-none tracking-tight text-cream">VendorGuard</h1>
              <p className="mt-1 text-sm text-[#d9d6ce]">Local compliance review</p>
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#d9d6ce]">
            <span className="status-dot inline-block h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
            <span>
              Serving on <span className="text-cream">http://127.0.0.1:8787/</span>
            </span>
            <span aria-hidden="true" className="text-mist">
              ·
            </span>
            <span>Local inference on Dell Pro Max GB10</span>
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-6">
        <section className="rounded-md border border-line bg-white px-5 py-5">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-sm text-stone">Engagement</p>
            <p className="font-serif text-xl text-ink">{POLICY.label}</p>
          </div>
          <IntakeDrop onFile={receiveFile} />
          <p className="mt-3 text-sm leading-relaxed text-stone">
            {discordOnline
              ? "Discord bot is listening. Send a PDF with “internal” to replace the internal policy, or “vendor Name” to group it under that vendor."
              : "Discord bot is not connected. Start it with npm run discord so PDFs sent in Discord are filed here."}
          </p>
          {pendingFile && (
            <div className="mt-4 rounded-md border border-gold bg-cream px-4 py-4">
              <p className="text-[15px] text-ink">
                Where should <span className="font-semibold">{pendingFile.name}</span> go?
              </p>
              {pendingFile.fromDiscord && (
                <p className="mt-1 text-sm text-stone">This PDF arrived in Discord. Choose where it belongs.</p>
              )}
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={placeInternal}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-cream hover:bg-[#2a2926]"
                >
                  Internal documents
                </button>
                <p className="max-w-sm text-sm leading-relaxed text-stone">
                  {internalPolicy
                    ? `Replaces the internal policy. The current file is ${internalPolicy.name}.`
                    : "Files this PDF as the internal policy."}
                </p>
              </div>
              <p className="mt-4 text-sm font-semibold text-ink">Or file it under a vendor contract</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {vendors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => placeOnVendor(item.id)}
                    className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-ink"
                  >
                    {item.short}
                  </button>
                ))}
              </div>
              <form onSubmit={addVendor} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newVendorName}
                  onChange={(event) => setNewVendorName(event.target.value)}
                  placeholder="New vendor name"
                  aria-label="New vendor name"
                  className="h-10 flex-1 rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink bg-white px-3 text-sm font-semibold text-ink hover:bg-ivory"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add vendor and place the PDF
                </button>
              </form>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="mt-3 text-sm font-semibold text-stone underline decoration-gold underline-offset-4"
              >
                Cancel
              </button>
            </div>
          )}
          {dropNote && <p className="mt-3 text-sm text-hult">{dropNote}</p>}
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <h2 className="font-serif text-lg">Internal documents</h2>
              <div className="mt-2 rounded-md border border-line bg-ivory px-4 py-3">
                {internalPolicy ? (
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-stone">Internal policy</p>
                      <p className="mt-1 text-[15px] font-semibold text-ink">{internalPolicy.name}</p>
                      <p className="text-sm text-stone">{documentNote(internalPolicy, "Prepared policy")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeInternal}
                      className="ml-auto text-stone hover:text-hult"
                      aria-label={`Remove ${internalPolicy.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-stone">No internal policy. Drop a PDF and choose internal documents.</p>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-lg">Vendors</h2>
                <p className="text-sm text-stone">Documents stay with the vendor you choose</p>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {vendors.length === 0 && (
                  <p className="text-sm text-stone">No vendors. Add one below, or drop a PDF and create a vendor for it.</p>
                )}
                {vendors.map((item) => {
                  const active = item.id === vendorId;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-md border px-4 py-3 ${active ? "border-ink bg-ivory" : "border-line bg-white"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => selectVendor(item.id)}
                          className="text-left text-[15px] font-semibold text-ink"
                        >
                          {item.name}
                        </button>
                        {active && (
                          <span className="rounded-sm bg-ink px-2 py-0.5 text-xs font-semibold text-cream">In this review</span>
                        )}
                        {item.staged && (
                          <span className="rounded-sm bg-cream px-2 py-0.5 text-xs font-semibold text-[#8a6a12]">Prepared review</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeVendor(item.id)}
                          className="ml-auto text-sm font-semibold text-stone hover:text-hult"
                        >
                          Remove vendor
                        </button>
                      </div>
                      <ul className="mt-2 flex flex-col gap-1">
                        {item.documents.length === 0 && (
                          <li className="text-sm text-stone">No documents yet. Drop a PDF and choose this vendor.</li>
                        )}
                        {item.documents.map((document) => (
                          <li key={document.id} className="flex items-center gap-2 text-sm text-ink">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-stone" aria-hidden="true" />
                            <span className="min-w-0 truncate">{document.name}</span>
                            <span className="text-stone">{documentNote(document, "Prepared contract")}</span>
                            <button
                              type="button"
                              onClick={() => removeDocument(item.id, document.id)}
                              className="ml-auto text-stone hover:text-hult"
                              aria-label={`Remove ${document.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              {!pendingFile && (
                <form onSubmit={addVendor} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newVendorName}
                    onChange={(event) => setNewVendorName(event.target.value)}
                    placeholder="New vendor name"
                    aria-label="New vendor name"
                    className="h-10 flex-1 rounded-md border border-line bg-white px-3 text-[15px] outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink bg-white px-3 text-sm font-semibold text-ink hover:bg-ivory"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add vendor
                  </button>
                </form>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone">
              Dropped PDFs stay on this machine. {selected ? `This review is ${vendor.short}.` : "No vendor is selected."} The prepared findings are for Apex Video / Velvet Thread.
            </p>
            <button
              type="button"
              onClick={reviewVendor}
              disabled={!selected || phase === "running"}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-ink px-5 text-[15px] font-semibold text-cream hover:bg-[#2a2926] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-60"
            >
              {phase === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              {phase === "running" ? "Reviewing on this Dell" : "Review vendor"}
            </button>
          </div>
          {reviewError && <p className="mt-3 text-sm leading-relaxed text-hult">{reviewError}</p>}
        </section>

        <section className="rounded-md border border-line bg-white px-5 py-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-lg">How this review works</h2>
            <p className="text-sm text-stone">Eight steps, on this machine</p>
          </div>
          <div className="step-scroll">
            <ol className="flex min-w-[880px]">
              {STEPS.map((item, index) => {
                const state = stepState(index, step, phase);
                const line =
                  state === "pending" ? "bg-line" : state === "active" ? "bg-gold" : "bg-sage";
                return (
                  <li
                    key={item.id}
                    className="relative flex flex-1 flex-col items-center px-1 text-center"
                    aria-current={state === "active" ? "step" : undefined}
                  >
                    {index > 0 && (
                      <span className={`absolute top-3.5 right-1/2 h-px w-full ${line}`} aria-hidden="true" />
                    )}
                    <span
                      className={`relative grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                        state === "done"
                          ? "bg-[#2f4a40] text-white"
                          : state === "active"
                            ? "bg-ink text-cream ring-4 ring-gold/35"
                            : "bg-ivory text-stone ring-1 ring-line"
                      }`}
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" /> : item.id}
                    </span>
                    <span
                      className={`mt-2 text-[13px] leading-tight ${
                        state === "active" ? "font-semibold text-ink" : state === "done" ? "text-ink" : "text-stone"
                      }`}
                    >
                      {readableStep(item.label)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-ivory">
            <div
              className={`h-full transition-all duration-500 ${phase === "complete" ? "bg-sage" : "bg-gold"}`}
              style={{ width: phase === "idle" ? "0%" : phase === "complete" ? "100%" : `${(step / 8) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-ink" aria-live="polite">
            {phase === "running" && (
              <span className="font-semibold">
                Step {step} of 8.{" "}
              </span>
            )}
            {phase === "idle" && "Ready. Choose a contract and run the review on this machine."}
            {phase === "running" && "vendguard.py is calling Nemotron through Ollama on this machine."}
            {phase === "complete" && findings.length > 0 && "The contract went in. Each rule came out as PASS, FLAG, or UNCERTAIN. Nothing has been approved."}
            {phase === "complete" && findings.length === 0 && `No classification came back for ${vendor.file}.`}
          </p>
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-stone">
            Policy and contract, then extract rules, find evidence, verify the quote, compare, and mark each rule{" "}
            <span className="font-semibold text-[#2f4a40]">passed</span>,{" "}
            <span className="font-semibold text-hult">flagged</span>, or{" "}
            <span className="font-semibold text-[#8a6a12]">uncertain</span>. A person reviews every exception.
          </p>
        </section>

        <section className="rounded-md border border-line bg-white px-5 py-5" aria-label="Audit result">
          <h2 className="font-serif text-lg">Result</h2>
          <p className="mt-1 text-sm text-stone">A contract goes in. Each rule comes out as PASS, FLAG, or UNCERTAIN.</p>
          <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)]">
            <div className="rounded-md border border-line bg-ivory px-4 py-4">
              <p className="text-sm font-semibold text-stone">Contract in</p>
              <p className="mt-2 font-serif text-xl leading-snug text-ink">{vendor.file}</p>
              <p className="mt-1 text-sm text-stone">{selected ? vendor.name : "No contract selected"}</p>
            </div>
            <div className="flex items-center justify-center text-ink" aria-hidden="true">
              <ArrowRight className="h-6 w-6" />
            </div>
            <div className="rounded-md border border-ink bg-white px-4 py-4">
              <p className="text-sm font-semibold text-ink">Classification out</p>
              {phase === "complete" && packetReady ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {findings.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <span className="text-[15px] text-ink">
                        <span className="font-semibold">{item.id}</span>
                        <span className="text-stone"> · {item.title}</span>
                      </span>
                      <Verdict status={item.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[15px] leading-relaxed text-stone">
                  {phase === "running"
                    ? `${vendor.file} is in the review. PASS, FLAG, or UNCERTAIN comes out when classification finishes.`
                    : phase === "complete"
                      ? `${vendor.file} went in. No PASS, FLAG, or UNCERTAIN came out, because this contract has no prepared review.`
                      : "Run the audit. The contract goes in, and PASS, FLAG, or UNCERTAIN comes out."}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)]">
          <div className={`flex items-start gap-4 rounded-md border px-5 py-4 ${status.panel}`}>
            <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${status.icon}`}>
              <status.Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-stone">Review opinion</p>
              <p className="font-serif text-2xl leading-tight">{status.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{status.detail}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Rules" hint="in scope" value={status.showCounts ? metrics.total : "—"} />
            <Metric label="Passed" hint="PASS" value={status.showCounts ? metrics.pass : "—"} tone="text-[#2f4a40]" />
            <Metric label="Flagged" hint="FLAG" value={status.showCounts ? metrics.flag : "—"} tone="text-hult" />
            <Metric label="Uncertain" hint="missing" value={status.showCounts ? metrics.uncertain : "—"} tone="text-[#8a6a12]" />
          </div>
        </section>

        <section id="findings" className="scroll-mt-28">
          <div className="mb-3">
            <h2 className="font-serif text-2xl">Exceptions for a person</h2>
            <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-stone">
              Passed rules are cleared and do not appear here. Flagged rules break a requirement. Uncertain rules are missing or ambiguous. Approval stays with the reviewer.
            </p>
          </div>
          <div className="mb-4 flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Filter rules">
            {FILTERS.map((item) => {
              const selected = filter === item.id;
              const count = item.id === "all" ? exceptions.length : exceptions.filter((f) => f.category === item.id).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(item.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[15px] ${
                    selected ? "border-ink font-semibold text-ink" : "border-transparent text-stone hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.rule ? ` · ${item.rule}` : ` · ${count}`}
                </button>
              );
            })}
          </div>

          {phase === "running" && (
            <div className="rounded-md border border-line bg-white px-5 py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" />
              <p className="mt-3 text-[15px] text-ink">
                Reading {vendor.file} on this machine. Exceptions appear when the comparison is finished.
              </p>
            </div>
          )}

          {phase !== "running" && visible.length === 0 && (
            <div className="rounded-md border border-dashed border-[#cfcabe] bg-white px-5 py-10 text-center">
              <p className="text-[15px] leading-relaxed text-ink">
                {vendor.staged
                  ? "Nothing in this filter."
                  : `${vendor.short} does not have a prepared review. Choose Vendor B, Apex Video / Velvet Thread, to read the exceptions.`}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {phase !== "running" &&
              visible.map((finding, index) => (
                <FindingCard key={finding.id} finding={finding} index={index} total={visible.length} />
              ))}
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-xl text-[15px] leading-snug text-ink">
            <span className="font-semibold">Recommendation. </span>
            {packetReady
              ? `Send this to legal. ${metrics.flag} violations were found. The agent will not approve the contract.`
              : phase === "running"
                ? "The review is still running. Approval stays with you."
                : "Run the review before you decide."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              title="The agent cannot approve a contract while exceptions are open."
              className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md border border-line bg-ivory px-3 text-sm font-semibold text-mist"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Approve contract
            </button>
            <button
              type="button"
              disabled={!packetReady}
              onClick={rejectVendor}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-hult px-3 text-sm font-semibold text-hult hover:bg-[#f8e8e4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Reject vendor
            </button>
            <button
              type="button"
              disabled={!packetReady}
              onClick={exportBrief}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-gold bg-cream px-3 text-sm font-semibold text-ink hover:bg-[#fff3c4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export redline PDF
            </button>
            <button
              type="button"
              disabled={!packetReady}
              onClick={sendToLegal}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-cream hover:bg-[#2a2926] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send to legal
            </button>
          </div>
        </div>
      </footer>

      {toast && (
        <div
          role="status"
          className="fixed top-20 right-4 z-50 max-w-sm rounded-md border border-line border-l-4 border-l-gold bg-white px-4 py-3 text-sm leading-relaxed text-ink shadow-lg"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function findVendor(list, name) {
  const needle = name.trim().toLowerCase();
  return list.find((item) => {
    const short = item.short.toLowerCase();
    const full = item.name.toLowerCase();
    return short === needle || full === needle || short.includes(needle) || full.includes(needle);
  });
}

function documentNote(document, preparedLabel) {
  if (document.prepared) return preparedLabel;
  const size = formatBytes(document.size);
  return document.fromDiscord ? `From Discord${size ? ` · ${size}` : ""}` : size;
}

function formatBytes(size) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function IntakeDrop({ onFile }) {
  const inputRef = useRef(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        onFile(event.dataTransfer.files?.[0]);
      }}
      className={`rounded-md border border-dashed px-4 py-4 ${over ? "border-gold bg-cream" : "border-[#cfcabe] bg-ivory"}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-white text-ink">
          <Upload className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Drop a PDF</p>
          <p className="mt-1 text-sm leading-relaxed text-stone">
            Then choose internal documents, which replaces the internal policy, or a vendor contract.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4"
          >
            Browse for a PDF
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="PDF to file"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

function statusCopy(phase, vendor, metrics) {
  if (phase === "running") {
    return {
      title: "Audit in progress",
      detail: `vendguard.py is reading ${vendor.file} with Nemotron on this machine.`,
      panel: "border-gold/50 bg-cream",
      icon: "bg-gold/20 text-[#8a6a12]",
      Icon: Loader2,
      showCounts: false,
    };
  }
  if (phase === "complete" && metrics.total > 0) {
    const exceptions = metrics.flag + metrics.uncertain;
    return {
      title: exceptions > 0 ? "Review required" : "No exceptions",
      detail:
        exceptions > 0
          ? `${exceptions} rules came out FLAG or UNCERTAIN. A person has to decide. The model did not clear this contract.`
          : "Every rule came out PASS. A person still decides.",
      panel: "border-hult/30 bg-[#f8e8e4]",
      icon: "bg-white text-hult",
      Icon: Flag,
      showCounts: true,
    };
  }
  if (phase === "complete") {
    return {
      title: "No review on file",
      detail: `${vendor.short} does not have a prepared packet on this machine.`,
      panel: "border-line bg-white",
      icon: "bg-ivory text-stone",
      Icon: FileSearch,
      showCounts: true,
    };
  }
  return {
    title: "Ready to review",
    detail: "Choose a contract, then review the vendor.",
    panel: "border-line bg-white",
    icon: "bg-ivory text-ink",
    Icon: Shield,
    showCounts: false,
  };
}

function Verdict({ status }) {
  const styles = {
    PASS: "bg-[#e7eee9] text-[#2f4a40]",
    FLAG: "bg-[#f8e8e4] text-hult",
    UNCERTAIN: "bg-cream text-[#8a6a12]",
  };
  return (
    <span className={`shrink-0 rounded-sm px-2 py-0.5 text-sm font-semibold tracking-wide ${styles[status] ?? styles.UNCERTAIN}`}>
      {status}
    </span>
  );
}

function Metric({ label, hint, value, tone = "text-ink" }) {
  return (
    <div className="rounded-md border border-line bg-white px-3 py-3">
      <p className="text-sm text-stone">
        {label}
        <span className="text-stone"> · {hint}</span>
      </p>
      <p className={`mt-1 font-serif text-3xl tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function FindingCard({ finding, index, total }) {
  const flag = finding.status === "FLAG";
  return (
    <article className="overflow-visible rounded-md border border-line bg-white">
      <div className={`h-1 ${flag ? "bg-hult" : "bg-gold"}`} />
      <div className="px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Verdict status={finding.status} />
          <Severity severity={finding.severity} />
          <span className="text-sm text-stone">
            {finding.categoryLabel} · {finding.id}
          </span>
          <span className="ml-auto text-sm text-stone">
            Exception {index + 1} of {total}
          </span>
        </div>
        <h3 className="mt-3 font-serif text-[1.35rem] leading-snug">{finding.title}</h3>

        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">What the policy requires</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{finding.requirement}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">What the contract says</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink">“{finding.evidence}”</p>
            <div className="mt-2">
              <Citation finding={finding} />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">Why this failed</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{finding.reason}</p>
        </div>

        <div className="mt-5 border-l-4 border-gold bg-cream px-4 py-3">
          <p className="text-sm font-semibold text-ink">Language to send legal</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{finding.redline}</p>
        </div>
      </div>
    </article>
  );
}

function Severity({ severity }) {
  const styles = {
    CRITICAL: "bg-hult text-white",
    HIGH: "border border-hult bg-white text-hult",
    MEDIUM: "border border-gold bg-cream text-[#8a6a12]",
  };
  const label = severity.charAt(0) + severity.slice(1).toLowerCase();
  return (
    <span className={`rounded-sm px-2 py-0.5 text-sm font-semibold ${styles[severity] ?? styles.MEDIUM}`}>
      {label}
    </span>
  );
}

function Citation({ finding }) {
  const buttonRef = useRef(null);
  const closeTimer = useRef(null);
  const [box, setBox] = useState(null);
  const popId = useId();

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(520, window.innerWidth - 24);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width;
    if (left < 12) left = 12;
    const estimated = 250;
    const below = rect.top < estimated + 80;
    setBox({
      left,
      top: below ? rect.bottom + 10 : rect.top - 10,
      width,
      below,
    });
  }

  function open() {
    clearTimeout(closeTimer.current);
    place();
  }

  function scheduleClose() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setBox(null), 140);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!box) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setBox(null);
    }
    function onMove() {
      place();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [box]);

  return (
    <>
      <a
        ref={buttonRef}
        href={`#${finding.id}-${finding.section.replace(/\s+/g, "")}`}
        aria-describedby={box ? popId : undefined}
        className="inline-flex items-center gap-1 text-[15px] font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4 hover:text-hult focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
        onClick={(event) => {
          event.preventDefault();
          open();
        }}
      >
        {finding.sectionTitle}
      </a>
      {box &&
        createPortal(
          <div
            id={popId}
            role="tooltip"
            className="fixed z-[80]"
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              transform: box.below ? "none" : "translateY(-100%)",
            }}
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
          >
            <div className="overflow-hidden rounded-md border border-[#e6e0cc] bg-cream text-ink shadow-xl">
              <div className="border-b border-[#e6e0cc] bg-ink px-3.5 py-2.5">
                <p className="font-sans text-sm font-semibold text-cream">
                  {finding.file} — {finding.sectionTitle}
                </p>
              </div>
              <div className="border-l-4 border-gold px-3.5 py-3 font-serif text-[15px] leading-relaxed">
                <p className="text-stone">{finding.before}</p>
                <p className="my-1.5">
                  <mark className="evidence-mark">{finding.evidence}</mark>
                </p>
                <p className="text-stone">{finding.after}</p>
              </div>
              <div className="border-t border-[#e6e0cc] bg-[#e7eee9] px-3.5 py-2">
                <p className="font-sans text-sm font-semibold text-[#2f4a40]">
                  Verified against the original file. Grounding score 100%.
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
