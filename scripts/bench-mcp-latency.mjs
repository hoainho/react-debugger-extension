// scripts/bench-mcp-latency.mjs
// Cross-platform MCP tool latency benchmark
// Usage: node scripts/bench-mcp-latency.mjs [--runs 50]

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { platform, release, version } from "node:os";
import { execSync } from "node:child_process";

const RUNS = parseInt(process.argv[process.argv.indexOf("--runs") + 1] || "50");

function getNodeVersion() {
  return process.version;
}

function getChromeVersion() {
  try {
    if (platform() === "win32") {
      const out = execSync(
        `reg query "HKEY_CURRENT_USER\\Software\\Google\\Chrome\\BLBeacon" /v version`,
        { encoding: "utf8" }
      );
      return out.match(/version\s+REG_SZ\s+([\d.]+)/)?.[1] ?? "unknown";
    } else if (platform() === "linux") {
      return execSync(
        "google-chrome --version 2>/dev/null || chromium-browser --version 2>/dev/null",
        { encoding: "utf8" }
      ).trim();
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// Resolve the CLI binary path once — avoids repeated npx resolution overhead
function resolveBin() {
  try {
    const lines = execSync("where react-debugger", { encoding: "utf8" })
      .trim()
      .split("\n")
      .map(l => l.trim());

    // On Windows, prefer the .cmd file — the plain binary won't spawn without shell
    const cmdBin = lines.find(l => l.endsWith(".cmd"));
    const bin = cmdBin || lines[0];

    if (bin) return { cmd: bin, args: ["mcp"], useShell: false };
  } catch { /* not globally installed */ }

  return { cmd: "npx", args: ["@nhonh/react-debugger", "mcp"], useShell: true };
}

const BIN = resolveBin();
console.log(`\n🔧 Using binary: ${BIN.cmd} ${BIN.args.join(" ")}\n`);

async function measureRound() {
  return new Promise((resolve, reject) => {
    const start = performance.now();

    const child = spawn(BIN.cmd, BIN.args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: BIN.useShell,
    });

    let stdout = "";
    let responded = false;

    // Collect stdout — resolve as soon as ANY data comes back
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (!responded) {
        responded = true;
        const elapsed = performance.now() - start;
        child.kill("SIGTERM");
        resolve(elapsed);
      }
    });

    child.stderr.on("data", () => {}); // suppress stderr noise

    // Send initialize handshake — standard MCP protocol first message
    const initMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "bench", version: "0.0.1" },
      },
    }) + "\n";

    child.stdin.write(initMsg);

    child.on("error", (err) => {
      if (!responded) reject(err);
    });

    child.on("close", (code) => {
      if (!responded) {
        reject(new Error(`Process exited with code ${code} without responding`));
      }
    });

    // 15s timeout — generous for cold npx starts
    setTimeout(() => {
      if (!responded) {
        child.kill("SIGTERM");
        reject(new Error("Timeout after 15000ms"));
      }
    }, 15000);
  });
}

async function runBenchmark() {
  console.log(`Running ${RUNS} cold measurements on ${platform()}...\n`);

  const coldSamples = [];
  const warmSamples = [];

  // ---- cold runs ----
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`\r  cold [${i + 1}/${RUNS}]`);
    try {
      const ms = await measureRound();
      coldSamples.push(parseFloat(ms.toFixed(2)));
    } catch (e) {
      console.warn(`\n  ⚠ cold run ${i + 1} failed: ${e.message}`);
    }
  }

  console.log("\n");
  console.log(`Running ${RUNS} warm measurements...\n`);

  // ---- warm runs ----
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`\r  warm [${i + 1}/${RUNS}]`);
    try {
      const ms = await measureRound();
      warmSamples.push(parseFloat(ms.toFixed(2)));
    } catch (e) {
      console.warn(`\n  ⚠ warm run ${i + 1} failed: ${e.message}`);
    }
  }

  console.log("\n");

  const coldSorted = [...coldSamples].sort((a, b) => a - b);
  const warmSorted = [...warmSamples].sort((a, b) => a - b);

  const result = {
    meta: {
      generated_at: new Date().toISOString(),
      node_version: getNodeVersion(),
      chrome_version: getChromeVersion(),
      os: platform(),
      os_release: release(),
      os_version: version(),
      runs_attempted: RUNS,
      runs_cold_succeeded: coldSamples.length,
      runs_warm_succeeded: warmSamples.length,
      network_conditions: "loopback/localhost",
      binary_used: `${BIN.cmd} ${BIN.args.join(" ")}`,
    },
    cold: coldSamples.length ? {
      samples_ms: coldSamples,
      p50_ms: percentile(coldSorted, 50),
      p95_ms: percentile(coldSorted, 95),
      p99_ms: percentile(coldSorted, 99),
      min_ms: coldSorted[0],
      max_ms: coldSorted[coldSorted.length - 1],
      mean_ms: parseFloat(
        (coldSamples.reduce((a, b) => a + b, 0) / coldSamples.length).toFixed(2)
      ),
      target_ms: 1000,
      passed: percentile(coldSorted, 95) < 1000,
    } : { error: "all runs failed", passed: false },

    warm: warmSamples.length ? {
      samples_ms: warmSamples,
      p50_ms: percentile(warmSorted, 50),
      p95_ms: percentile(warmSorted, 95),
      p99_ms: percentile(warmSorted, 99),
      min_ms: warmSorted[0],
      max_ms: warmSorted[warmSorted.length - 1],
      mean_ms: parseFloat(
        (warmSamples.reduce((a, b) => a + b, 0) / warmSamples.length).toFixed(2)
      ),
      target_ms: 500,
      passed: percentile(warmSorted, 95) < 500,
    } : { error: "all runs failed", passed: false },

    issues: [],
  };

  // flag p95 failures
  if (result.cold.p95_ms && !result.cold.passed) {
    result.issues.push(`cold p95 (${result.cold.p95_ms.toFixed(1)}ms) exceeds 1000ms target`);
  }
  if (result.warm.p95_ms && !result.warm.passed) {
    result.issues.push(`warm p95 (${result.warm.p95_ms.toFixed(1)}ms) exceeds 500ms target`);
  }

  mkdirSync("evidence", { recursive: true });

  const osTag = platform() === "win32" ? "windows" : platform();
  const outPath = `evidence/phase0-latency-${osTag}.json`;
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`✅ Results written to ${outPath}`);
  if (result.cold.p95_ms != null) {
    console.log(`   cold p95: ${result.cold.p95_ms.toFixed(1)}ms (target <1000ms) ${result.cold.passed ? "✅" : "❌"}`);
  }
  if (result.warm.p95_ms != null) {
    console.log(`   warm p95: ${result.warm.p95_ms.toFixed(1)}ms  (target <500ms) ${result.warm.passed ? "✅" : "❌"}`);
  }

  if (result.issues.length) {
    console.log("\n⚠ Issues found:");
    result.issues.forEach((i) => console.log("  -", i));
  }
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
