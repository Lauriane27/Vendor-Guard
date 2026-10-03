"""Local VendorGuard review. Talks only to Ollama on this machine."""

import json
import sys
import urllib.error
import urllib.request

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "nemotron-3-nano:30b"
ALLOWED = {"PASS", "FLAG", "UNCERTAIN"}


def build_prompt(payload):
    rules = payload.get("rules") or []
    lines = [
        "You are VendorGuard, a local compliance reviewer on this machine.",
        "A vendor contract goes in. For every rule, exactly one label comes out: PASS, FLAG, or UNCERTAIN.",
        "PASS means the contract meets the requirement.",
        "FLAG means the contract violates the requirement.",
        "UNCERTAIN means the contract text is missing or too ambiguous to decide.",
        "Do not invent a clause that is not in the evidence. Do not approve the contract.",
        f"Policy file: {payload.get('policyFile') or 'unknown'}",
        f"Vendor: {payload.get('vendorName') or 'unknown'}",
        f"Contract file: {payload.get('contractFile') or 'unknown'}",
        "",
        "Rules:",
    ]
    for rule in rules:
        evidence = (rule.get("evidence") or "").strip()
        lines.append(f"- {rule.get('id')}: {rule.get('title')}. Requirement: {rule.get('requirement')}")
        if evidence:
            before = (rule.get("before") or "").strip()
            after = (rule.get("after") or "").strip()
            lines.append(f"  Section: {rule.get('sectionTitle') or rule.get('section') or 'unspecified'}")
            if before:
                lines.append(f"  Before: {before}")
            lines.append(f"  Evidence: {evidence}")
            if after:
                lines.append(f"  After: {after}")
        else:
            lines.append("  Evidence: none. Use UNCERTAIN.")
    lines.append("")
    lines.append(
        'Return JSON only: {"results":[{"id":"AUD-01","status":"FLAG","reason":"one or two sentences","redline":"replacement sentence or empty"}]}'
    )
    return "\n".join(lines)


def call_ollama(prompt):
    body = json.dumps(
        {
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0, "num_predict": 900},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.load(response)
    except urllib.error.URLError as error:
        raise SystemExit(
            "Ollama is not answering on http://127.0.0.1:11434. Start Ollama, confirm nemotron-3-nano:30b with ollama list, then review the vendor again. "
            + str(error.reason)
        ) from error


def parse_model_json(text):
    raw = (text or "").strip()
    if not raw:
        raise SystemExit("Nemotron returned an empty classification.")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end <= start:
            raise SystemExit("Nemotron did not return JSON.")
        return json.loads(raw[start : end + 1])


def normalize(payload, parsed):
    by_id = {}
    for item in parsed.get("results") or []:
        rule_id = str(item.get("id") or "").strip()
        if rule_id:
            by_id[rule_id] = item
    results = []
    for rule in payload.get("rules") or []:
        decision = by_id.get(rule.get("id"), {})
        status = str(decision.get("status") or "").strip().upper()
        if status not in ALLOWED:
            status = "UNCERTAIN" if not (rule.get("evidence") or "").strip() else "FLAG"
        reason = str(decision.get("reason") or "").strip()
        if not reason:
            reason = {
                "PASS": "The contract evidence meets this requirement.",
                "FLAG": "The contract evidence does not meet this requirement.",
                "UNCERTAIN": "The contract does not contain enough evidence to decide.",
            }[status]
        redline = str(decision.get("redline") or "").strip()
        severity = "HIGH" if status == "FLAG" else "MEDIUM" if status == "UNCERTAIN" else ""
        results.append(
            {
                **rule,
                "status": status,
                "severity": severity,
                "reason": reason,
                "redline": redline,
                "file": payload.get("contractFile") or rule.get("file") or "",
            }
        )
    return {"ok": True, "model": MODEL, "contractFile": payload.get("contractFile") or "", "results": results}


def main():
    payload = json.load(sys.stdin)
    ollama = call_ollama(build_prompt(payload))
    parsed = parse_model_json(ollama.get("response", ""))
    json.dump(normalize(payload, parsed), sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except SystemExit as error:
        print(str(error), file=sys.stderr)
        raise
