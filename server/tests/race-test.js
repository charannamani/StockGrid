// Race condition test — fires two outbound requests at the exact same time
// against a stock record with currentQuantity: 10, each asking for qty: 8.
//
// Expected AFTER the fix: exactly ONE succeeds (201), the other fails (400,
// "Insufficient stock for outbound movement"), and final currentQuantity is 2.
//
// If you saw this against the OLD (pre-fix) code, both would likely succeed
// and currentQuantity would go to -6 — that's the bug that's now closed.

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNzhkMWVhZDhjNWI5NWQyM2RmODFjNyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4Nzg1MjgyMCwiZXhwIjoxNzg4NDU3NjIwfQ.htqQDM784T1kja4rKEku-l__sTtxO-vKjqgkkA5rAa8";
const PRODUCT_ID = "6a9077518c7ea9eab9185b62";
const WAREHOUSE_ID = "6a9076e18c7ea9eab9185b61";
const BASE_URL = "http://localhost:5000/api";

async function fireOutbound(label) {
  const res = await fetch(`${BASE_URL}/movements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      product: PRODUCT_ID,
      warehouse: WAREHOUSE_ID,
      type: "outbound",
      quantity: 8,
      reason: `race test ${label}`,
    }),
  });
  const body = await res.json();
  return { label, status: res.status, body };
}

async function main() {
  console.log("Firing two concurrent outbound requests of qty 8 each...\n");

  const [resultA, resultB] = await Promise.all([
    fireOutbound("A"),
    fireOutbound("B"),
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

main().catch((err) => console.error("Script error:", err));