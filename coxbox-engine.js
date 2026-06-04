/* coxbox-engine.js — Oara / OmniRace
 * Pure, deterministic CoxBox analysis. No DOM, no network, no invented numbers.
 * Every value here is arithmetic on the pasted log. Anything requiring external
 * literature (e.g. the Garland 2005 "elite template") is intentionally left null
 * until a real, verified source is supplied — see CLAUDE.md, First Law.
 *
 * Mirrors the dashboard's parseTime/fmt conventions so it inlines into index.html.
 * Run `node coxbox-engine.js` to execute the self-test at the bottom.
 */

function parseClock(str) {
  if (str == null) return null;
  str = String(str).trim();
  const m = str.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/); // m:ss(.s)
  if (m) { const s = parseFloat(m[2]); if (s >= 60) return null; return parseInt(m[1], 10) * 60 + s; }
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str); // bare seconds
  return null;
}

function fmtClock(sec) {
  if (sec == null || isNaN(sec)) return "—";
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
}

/* Parse a pasted CoxBox table (markdown-pipe, CSV, or whitespace).
 * Expected columns: Distance | Time(cumulative) | Split(/500) | Rate
 * Returns { rows:[{distance,time,split,rate}], skipped:[...], errors:[...] } */
function parseCoxBox(text) {
  const rows = [], skipped = [], errors = [];
  if (!text) return { rows, skipped, errors };
  const lines = String(text).replace(/\r/g, "").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[|\s:+-]+$/.test(line)) { continue; } // markdown separator like |---|---|
    let cells = line.indexOf("|") !== -1
      ? line.split("|").map(c => c.trim())
      : line.split(/[,\t]+|\s{2,}|\s+/).map(c => c.trim());
    cells = cells.filter(c => c !== "");
    if (cells.length < 2) { skipped.push(line); continue; }
    const distance = parseFloat(cells[0]);
    if (!isFinite(distance)) { skipped.push(line); continue; } // header etc.
    const time = parseClock(cells[1]);
    const split = cells.length > 2 ? parseClock(cells[2]) : null;
    const rate = cells.length > 3 ? parseFloat(cells[3]) : NaN;
    if (time == null) { errors.push("Could not read cumulative time on: " + line); continue; }
    rows.push({ distance, time, split, rate: isFinite(rate) ? rate : null });
  }
  rows.sort((a, b) => a.distance - b.distance);
  return { rows, skipped, errors };
}

function mean(xs) { const v = xs.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function stddev(xs) {
  const v = xs.filter(x => x != null && isFinite(x));
  if (v.length < 2) return null;
  const mu = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - mu) * (b - mu), 0) / v.length); // population SD
}

/* Compute all derived metrics. Pure arithmetic on the parsed rows. */
function computeMetrics(rows) {
  if (!rows || rows.length < 2) return null;
  const total = rows[rows.length - 1].distance;
  const totalTime = rows[rows.length - 1].time;
  const segments = [];
  let prevD = 0, prevT = 0;
  for (const r of rows) {
    const interval = r.distance - prevD;          // metres in this segment (usually 100)
    const sectional = r.time - prevT;             // seconds for this segment
    if (interval <= 0 || sectional <= 0) { prevD = r.distance; prevT = r.time; continue; }
    const speed = interval / sectional;           // m/s, real
    const split500 = sectional * (500 / interval);// per-500 pace from time deltas, real
    const strokes = r.rate != null ? r.rate * sectional / 60 : null; // strokes in segment
    const run = strokes ? interval / strokes : null;                 // metres per stroke
    segments.push({
      distance: r.distance, interval, sectional, speed, split500,
      rate: r.rate, run,
      reportedSplit: r.split            // CoxBox's own instantaneous /500 reading
    });
    prevD = r.distance; prevT = r.time;
  }

  // Quarters by actual total distance (works for 1900 TT or 2000 final)
  const qLen = total / 4;
  const quarters = [0, 1, 2, 3].map(q => {
    const lo = q * qLen, hi = (q + 1) * qLen + 1e-6;
    const segs = segments.filter(s => s.distance > lo && s.distance <= hi);
    const dist = segs.reduce((a, s) => a + s.interval, 0);
    const time = segs.reduce((a, s) => a + s.sectional, 0);
    return {
      label: Math.round(lo) + "–" + Math.round((q + 1) * qLen),
      dist, time,
      split500: dist > 0 ? time * (500 / dist) : null,
      rate: mean(segs.map(s => s.rate))
    };
  });

  const firstHalf = quarters.slice(0, 2), secondHalf = quarters.slice(2);
  const halfSplit = hs => {
    const d = hs.reduce((a, q) => a + q.dist, 0), t = hs.reduce((a, q) => a + q.time, 0);
    return d > 0 ? t * (500 / d) : null;
  };
  const firstHalfSplit = halfSplit(firstHalf);
  const secondHalfSplit = halfSplit(secondHalf);
  const fade = (firstHalfSplit != null && secondHalfSplit != null) ? secondHalfSplit - firstHalfSplit : null;

  const splits = segments.map(s => s.split500);
  const fastestSeg = segments.reduce((a, s) => (a == null || s.split500 < a.split500 ? s : a), null);
  const slowestSeg = segments.reduce((a, s) => (a == null || s.split500 > a.split500 ? s : a), null);

  // Profile label: arithmetic only (NOT a literature claim). Threshold is a stated heuristic.
  const EVEN = 1.0; // s/500 tolerance
  let profile = "even";
  if (fade != null) profile = fade > EVEN ? "positive split (slowed)" : fade < -EVEN ? "negative split (built)" : "even";

  return {
    total, totalTime,
    avgSplit500: totalTime * (500 / total),
    avgSpeed: total / totalTime,
    segments, quarters,
    firstHalfSplit, secondHalfSplit, fade, profile,
    rate: { mean: mean(segments.map(s => s.rate)), sd: stddev(segments.map(s => s.rate)), min: Math.min(...segments.map(s => s.rate ?? Infinity)), max: Math.max(...segments.map(s => s.rate ?? -Infinity)) },
    run: { mean: mean(segments.map(s => s.run)), min: Math.min(...segments.filter(s => s.run != null).map(s => s.run)), max: Math.max(...segments.filter(s => s.run != null).map(s => s.run)) },
    fastestSeg, slowestSeg,
    eliteTemplate: null // requires VERIFIED Garland 2005 profile before it can be drawn
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseClock, fmtClock, parseCoxBox, computeMetrics, mean, stddev };
}

/* ------------------------- self-test ------------------------- */
if (typeof require !== "undefined" && require.main === module) {
  // SYNTHETIC FIXTURE — not a real race. Used only to verify the math is correct.
  // Segment 1 is hand-checkable: 100 m in 20.0 s @ r40 => split 1:40.0, 5.00 m/s, run 7.50 m.
  const sectionals = [20.0, 19.0, 19.5, 19.5, 19.8, 20.0, 20.2, 20.1, 20.3, 20.4,
                      20.5, 20.6, 20.5, 20.4, 20.6, 20.7, 20.3, 20.0, 19.6, 19.2];
  const rates =      [40, 38, 36, 35, 35, 34, 34, 34, 33, 33, 33, 33, 34, 34, 34, 35, 36, 37, 39, 41];
  let cum = 0; const lines = ["| Distance | Time | Split | Rate |", "|---|---|---|---|"];
  sectionals.forEach((s, i) => {
    cum += s;
    lines.push("| " + (100 * (i + 1)) + " | " + fmtClock(cum) + " | " + fmtClock(s * 5) + " | " + rates[i] + " |");
  });
  const text = lines.join("\n");

  const { rows, errors } = parseCoxBox(text);
  const m = computeMetrics(rows);

  const approx = (a, b, t = 0.05) => Math.abs(a - b) <= t;
  const checks = [
    ["parsed 20 rows", rows.length === 20],
    ["no parse errors", errors.length === 0],
    ["total distance 2000", m.total === 2000],
    ["seg1 split == 1:40.0 (100.0s)", approx(m.segments[0].split500, 100.0)],
    ["seg1 speed == 5.00 m/s", approx(m.segments[0].speed, 5.0)],
    ["seg1 run == 7.50 m", approx(m.segments[0].run, 7.5)],
    ["quarters sum to total time", approx(m.quarters.reduce((a, q) => a + q.time, 0), m.totalTime, 0.001)],
    ["4 quarters of 500 m", m.quarters.every(q => q.dist === 500)],
    ["fade = 2ndHalf - 1stHalf", approx(m.fade, m.secondHalfSplit - m.firstHalfSplit, 0.001)],
    ["rate mean in range", m.rate.mean > 30 && m.rate.mean < 42]
  ];
  let pass = 0;
  console.log("CoxBox engine self-test (synthetic fixture, not a real race)\n");
  for (const [name, ok] of checks) { console.log((ok ? "  PASS  " : "  FAIL  ") + name); if (ok) pass++; }
  console.log("\n" + pass + "/" + checks.length + " checks passed");
  console.log("\nDerived summary (fixture):");
  console.log("  total time      " + fmtClock(m.totalTime) + "  over " + m.total + " m");
  console.log("  avg /500        " + fmtClock(m.avgSplit500) + "   avg speed " + m.avgSpeed.toFixed(2) + " m/s");
  console.log("  quarters /500   " + m.quarters.map(q => fmtClock(q.split500)).join("  "));
  console.log("  fade            " + (m.fade >= 0 ? "+" : "") + m.fade.toFixed(1) + " s/500  -> " + m.profile);
  console.log("  rate            mean " + m.rate.mean.toFixed(1) + "  SD " + m.rate.sd.toFixed(2) + "  (" + m.rate.min + "–" + m.rate.max + ")");
  console.log("  run             mean " + m.run.mean.toFixed(2) + " m  (" + m.run.min.toFixed(2) + "–" + m.run.max.toFixed(2) + ")");
  console.log("  elite template  " + (m.eliteTemplate === null ? "null (awaiting VERIFIED Garland 2005 data)" : "set"));
  if (pass !== checks.length) process.exitCode = 1;
}
