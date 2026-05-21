import fs from "node:fs";

const total = Number(process.env.TOTAL || 20);
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:6446/v1";
const apiKey = process.env.API_KEY || "";
const model = process.env.MODEL || "deepseek-v4-flash-free";
const output = process.env.OUTPUT || `logs/upstream-capacity-${Date.now()}.jsonl`;

if (!apiKey) {
  console.error("API_KEY is required");
  process.exit(1);
}

fs.mkdirSync("logs", { recursive: true });
const stream = fs.createWriteStream(output, { flags: "a" });
const summary = { total, success: 0, failed: 0, statusCounts: {}, firstErrorAt: null, latencies: [] };

const write = (entry) => stream.write(`${JSON.stringify(entry)}\n`);

for (let i = 1; i <= total; i += 1) {
  const started = Date.now();
  let entry;
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    const latencyMs = Date.now() - started;
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }

    if (res.ok) {
      summary.success += 1;
      summary.latencies.push(latencyMs);
      entry = {
        i,
        total,
        ok: true,
        status: res.status,
        latencyMs,
        model: body.model,
        finishReason: body.choices?.[0]?.finish_reason,
      };
      console.log(`[${i}/${total}] OK status=${res.status} latency=${latencyMs}ms model=${entry.model || ""} finish=${entry.finishReason || ""}`);
    } else {
      summary.failed += 1;
      summary.firstErrorAt ??= i;
      entry = {
        i,
        total,
        ok: false,
        status: res.status,
        latencyMs,
        error: body.error?.message || body.message || text.slice(0, 500),
      };
      console.log(`[${i}/${total}] ERR status=${res.status} latency=${latencyMs}ms error=${entry.error}`);
    }
    summary.statusCounts[res.status] = (summary.statusCounts[res.status] || 0) + 1;
  } catch (error) {
    const latencyMs = Date.now() - started;
    summary.failed += 1;
    summary.firstErrorAt ??= i;
    summary.statusCounts.exception = (summary.statusCounts.exception || 0) + 1;
    entry = {
      i,
      total,
      ok: false,
      status: "exception",
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(`[${i}/${total}] ERR status=exception latency=${latencyMs}ms error=${entry.error}`);
  }
  write(entry);
}

const avgLatencyMs = summary.latencies.length ? Math.round(summary.latencies.reduce((a, b) => a + b, 0) / summary.latencies.length) : null;
const maxLatencyMs = summary.latencies.length ? Math.max(...summary.latencies) : null;
const finalSummary = { ...summary, avgLatencyMs, maxLatencyMs, output };
delete finalSummary.latencies;
console.log(JSON.stringify(finalSummary, null, 2));
write({ type: "summary", ...finalSummary });
stream.end();
