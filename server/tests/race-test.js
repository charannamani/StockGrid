
const BASE_URL = process.env.BASE_URL || "http://localhost:5000/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PRODUCT_ID = process.env.PRODUCT_ID;
const WAREHOUSE_ID = process.env.WAREHOUSE_ID;
const QTY = Number(process.env.QTY || 8);

async function login() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to run this script.");
  }
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok || !body.token) {
    throw new Error(`Login failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function fireOutbound(token, label) {
  const res = await fetch(`${BASE_URL}/movements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      product: PRODUCT_ID,
      warehouse: WAREHOUSE_ID,
      type: "outbound",
      quantity: QTY,
      reason: `race test ${label}`,
    }),
  });
  const body = await res.json();
  return { label, status: res.status, body };
}

async function main() {
  if (!PRODUCT_ID || !WAREHOUSE_ID) {
    throw new Error("Set PRODUCT_ID and WAREHOUSE_ID env vars to run this script.");
  }

  const token = await login();

  console.log(`Firing two concurrent outbound requests of qty ${QTY} each...\n`);

  const [resultA, resultB] = await Promise.all([
    fireOutbound(token, "A"),
    fireOutbound(token, "B"),
  ]);

  for (const r of [resultA, resultB]) {
    console.log(`Request ${r.label}: HTTP ${r.status}`);
    console.log(JSON.stringify(r.body, null, 2));
    console.log("---");
  }

  const successCount = [resultA, resultB].filter((r) => r.status === 201).length;
  const failCount = [resultA, resultB].filter((r) => r.status === 400).length;

  console.log(`\nSummary: ${successCount} succeeded, ${failCount} failed.`);
  if (successCount === 1 && failCount === 1) {
    console.log("PASS: exactly one request succeeded — race condition is fixed.");
  } else if (successCount === 2) {
    console.log("FAIL: both requests succeeded — stock was oversold, race condition still present.");
  } else {
    console.log("UNEXPECTED: check the responses above manually.");
  }
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});