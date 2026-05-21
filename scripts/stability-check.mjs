const baseUrl = process.env.BASE_URL || "http://127.0.0.1:6446";
const token = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "admin";

if (!token) {
  console.error("ADMIN_PASSWORD is required for stability checks");
  process.exit(1);
}

const adminGet = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
};

const runtime = (await adminGet("/admin/runtime")).data;
const metrics = (await adminGet("/admin/metrics")).data;

const failures = [];
if (runtime.runtime.draining) failures.push("server is unexpectedly draining");
if (runtime.runtime.inFlightRequests !== 0) failures.push(`inFlightRequests is ${runtime.runtime.inFlightRequests}, expected 0`);
if (!metrics.http.totalRequests || metrics.http.totalRequests < 1) failures.push("http totalRequests did not increase");
if (!metrics.http.byStatus || Object.keys(metrics.http.byStatus).length === 0) failures.push("http status distribution is empty");

console.log(JSON.stringify({
  runtime: runtime.runtime,
  limiter: runtime.limiter,
  http: {
    totalRequests: metrics.http.totalRequests,
    errorRequests: metrics.http.errorRequests,
    errorRate: metrics.http.errorRate,
    latencyMs: metrics.http.latencyMs,
    byStatus: metrics.http.byStatus,
  },
}, null, 2));

if (failures.length) {
  for (const failure of failures) console.error(`[fail] ${failure}`);
  process.exit(1);
}
console.log("[pass] stability checks passed");
