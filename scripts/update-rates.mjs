#!/usr/bin/env node
/**
 * Weekly NEPRA scanner — refreshes data/rates.json FCA/QTA from official pages/PDFs.
 * Rules (from implementation spec):
 *  - Prefer NEPRA / Gazette sources over blogs
 *  - Never promote a hearing/request to NOTIFIED without an extracted decision rate
 *  - PROVISIONAL / NEEDS_REVIEW rates are discovered but not auto-applied by the calculator
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RATES_PATH = path.join(ROOT, "data", "rates.json");

const SOURCES = [
  "https://nepra.org.pk/tariff/Distribution%20LESCO.php",
  "https://nepra.org.pk/news.php",
];

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const UA =
  "LESCO-Bill-Estimator/1.0 (+https://github.com; weekly NEPRA rate refresh; respectful crawl)";

function ym(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(year, month, delta) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return ym(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const name = Object.keys(MONTHS).find((k) => MONTHS[k] === m);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/pdf,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // PDFs: keep binary-ish latin1 so regex still sees digit strings
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    return buf.toString("latin1");
  }
  return buf.toString("utf8");
}

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function extractLinks(html, baseUrl) {
  const out = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absUrl(m[1], baseUrl);
    if (url) out.push(url);
  }
  return [...new Set(out)];
}

/** Parse NEPRA listing rows: date | title */
function parseListing(html) {
  const rows = [];
  // markdown-ish or table cells dumped as text
  const lineRe =
    /(\d{2}-\d{2}-\d{4})\s*\|\s*([^|\n]+?(?:Fuel Charges Adjustment|Periodic Adjustment|Quarterly)[^|\n]*)/gi;
  let m;
  while ((m = lineRe.exec(html))) {
    rows.push({ date: m[1], title: m[2].replace(/\s+/g, " ").trim() });
  }
  // HTML table fallback
  const cellRe =
    />(\d{2}-\d{2}-\d{4})<[\s\S]{0,200}?>([^<]*(?:Fuel Charges Adjustment|Periodic Adjustment)[^<]*)</gi;
  while ((m = cellRe.exec(html))) {
    rows.push({ date: m[1], title: m[2].replace(/\s+/g, " ").trim() });
  }
  return rows;
}

function parseFcaTitle(title) {
  const m = title.match(
    /Fuel Charges Adjustment for the month of\s+([A-Za-z]+)\s+(\d{4})/i
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const year = Number(m[2]);
  const consumptionMonth = ym(year, month);
  const billMonth = addMonths(year, month, 2); // usual XWDISCO lag
  const isDecision = /Decision of the Authority/i.test(title) && !/Hearing|Notice/i.test(title);
  const isHearing = /Hearing|Notice of Admission|Notice of Hearing/i.test(title);
  return { consumptionMonth, billMonth, isDecision, isHearing, fuelMonthName: m[1], fuelYear: year };
}

function extractFcaRateFromPdf(text, fuelMonthName, fuelYear) {
  const month = fuelMonthName;
  const year = String(fuelYear);
  // Prefer the notification / approved block (usually near the end)
  const patterns = [
    new RegExp(
      `Fuel Charges Adjustment for ${month}\\s+${year}\\s+Rs\\.?\\s*([0-9]+\\.[0-9]+)\\s*/?\\s*kWh`,
      "gi"
    ),
    new RegExp(
      `positive FCA[^\\n]{0,80}${month}[^\\n]{0,40}Rs\\.?\\s*([0-9]+\\.[0-9]+)\\s*/?\\s*kWh`,
      "gi"
    ),
    new RegExp(
      `FCA for the month of ${month}\\s+${year}[^\\n]{0,60}Rs\\.?\\s*([0-9]+\\.[0-9]+)`,
      "gi"
    ),
  ];
  const hits = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) hits.push(Number(m[1]));
  }
  if (!hits.length) return null;
  // Last high-precision hit tends to be the notified figure (claimed vs approved)
  return hits[hits.length - 1];
}

function extractBillMonthFromPdf(text) {
  const m = text.match(/billing month of\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return ym(Number(m[2]), month);
}

function extractQtaRateFromPdf(text) {
  const m = text.match(
    /uniform rate of\s+Rs\.?\s*([0-9]+\.[0-9]+)\s*\/?\s*kWh/i
  );
  if (m) return Number(m[1]);
  const m2 = text.match(
    /positive quarterly adjustment of\s+Rs\.?\s*([0-9]+\.[0-9]+)\s*\/?\s*kWh/i
  );
  return m2 ? Number(m2[1]) : null;
}

function extractQtaMonthsFromPdf(text) {
  const m = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+to\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
  );
  if (!m) return [];
  const start = MONTHS[m[1].toLowerCase()];
  const end = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (!start || !end) return [];
  const keys = [];
  for (let mo = start; mo <= end; mo++) keys.push(ym(year, mo));
  return keys;
}

function ensureMonth(rates, key) {
  if (!rates.billMonths[key]) {
    rates.billMonths[key] = {
      label: monthLabel(key),
      qta: { rate: null, status: "NOT_AVAILABLE", note: "No QTA loaded for this month" },
      fca: { rate: null, status: "NOT_AVAILABLE", note: "No FCA loaded for this month" },
    };
  }
  return rates.billMonths[key];
}

function loadRates() {
  return JSON.parse(fs.readFileSync(RATES_PATH, "utf8"));
}

function saveRates(rates) {
  fs.writeFileSync(RATES_PATH, JSON.stringify(rates, null, 2) + "\n");
}

async function main() {
  const rates = loadRates();
  const warnings = [];
  const fcaDecisions = [];
  const qtaDecisions = [];
  const pdfCandidates = new Set();

  console.log("Scanning NEPRA sources…");

  for (const url of SOURCES) {
    try {
      const html = await fetchText(url);
      const listing = parseListing(html);
      for (const row of listing) {
        const fca = parseFcaTitle(row.title);
        if (fca) {
          fcaDecisions.push({ ...row, ...fca, page: url });
        }
        if (/Periodic Adjustment|Quarterly/i.test(row.title) && /Decision|Notification|S\.R\.O/i.test(row.title)) {
          qtaDecisions.push({ ...row, page: url });
        }
      }
      for (const link of extractLinks(html, url)) {
        if (/\.pdf($|\?)/i.test(link) && /FCA|MFPA|Fuel|Quarter|Periodic|ADJ/i.test(link)) {
          pdfCandidates.add(link);
        }
      }
      console.log(`  OK ${url} (${listing.length} listing hits)`);
    } catch (err) {
      warnings.push(`Fetch failed: ${url} — ${err.message}`);
      console.warn(`  FAIL ${url}: ${err.message}`);
    }
  }

  // Always re-check known source PDFs already in rates.json
  for (const month of Object.values(rates.billMonths)) {
    for (const part of [month.fca, month.qta]) {
      if (part?.sourceUrl && /\.pdf/i.test(part.sourceUrl)) pdfCandidates.add(part.sourceUrl);
    }
  }

  // Discover decision rows that lack a rate → mark bill month NEEDS_REVIEW
  for (const d of fcaDecisions) {
    if (!d.isDecision) continue;
    const slot = ensureMonth(rates, d.billMonth);
    const existing = slot.fca || {};
    if (existing.status === "NOTIFIED" && existing.rate != null) continue;
    slot.fca = {
      ...existing,
      rate: existing.rate ?? null,
      status: existing.rate != null ? existing.status : "NEEDS_REVIEW",
      consumptionMonth: d.consumptionMonth,
      decisionListedAt: d.date.split("-").reverse().join("-"), // DD-MM-YYYY → rough ISO-ish
      note:
        existing.note ||
        `NEPRA listed Decision for ${d.fuelMonthName} ${d.fuelYear} FCA on ${d.date}. Awaiting PDF rate extraction.`,
      sourceUrl: existing.sourceUrl || d.page,
    };
  }

  console.log(`Checking ${pdfCandidates.size} PDF candidate(s)…`);
  for (const pdfUrl of pdfCandidates) {
    try {
      const text = await fetchText(pdfUrl);
      const fcaMonth = text.match(
        /FUEL CHARGES ADJUSTMENT FOR THE MONTH OF\s+([A-Z]+)\s+(\d{4})/i
      ) || text.match(/Fuel Charges Adjustment for the month of\s+([A-Za-z]+)\s+(\d{4})/i);

      if (fcaMonth) {
        const fuelMonthName = fcaMonth[1];
        const fuelYear = Number(fcaMonth[2]);
        const monthNum = MONTHS[fuelMonthName.toLowerCase()];
        if (monthNum) {
          const rate = extractFcaRateFromPdf(text, fuelMonthName, fuelYear);
          const billFromPdf = extractBillMonthFromPdf(text);
          const billMonth = billFromPdf || addMonths(fuelYear, monthNum, 2);
          const consumptionMonth = ym(fuelYear, monthNum);
          if (rate != null && Number.isFinite(rate)) {
            const slot = ensureMonth(rates, billMonth);
            slot.fca = {
              rate,
              status: "NOTIFIED",
              consumptionMonth,
              note: `${fuelMonthName} ${fuelYear} fuel → ${monthLabel(billMonth)} billing (extracted from NEPRA PDF)`,
              sourceUrl: pdfUrl,
            };
            console.log(`  FCA ${consumptionMonth} → ${billMonth}: Rs.${rate}/kWh`);
          } else {
            warnings.push(`PDF had FCA title but no parseable rate: ${pdfUrl}`);
          }
        }
      }

      if (/PERIODIC ADJUSTMENT|QUARTER OF/i.test(text) && /uniform rate of\s+Rs/i.test(text)) {
        const qRate = extractQtaRateFromPdf(text);
        const months = extractQtaMonthsFromPdf(text);
        if (qRate != null && months.length) {
          for (const key of months) {
            const slot = ensureMonth(rates, key);
            slot.qta = {
              rate: qRate,
              status: "NOTIFIED",
              note: `QTA Rs.${qRate}/kWh for ${months[0]}–${months[months.length - 1]} (extracted from NEPRA PDF)`,
              sourceUrl: pdfUrl,
            };
          }
          console.log(`  QTA Rs.${qRate}/kWh → ${months.join(", ")}`);
          qtaDecisions.push({ title: "PDF QTA", rate: qRate, months, sourceUrl: pdfUrl });
        }
      }
    } catch (err) {
      warnings.push(`PDF fetch failed: ${pdfUrl} — ${err.message}`);
      console.warn(`  FAIL PDF ${pdfUrl}: ${err.message}`);
    }
  }

  rates.lastScanAt = new Date().toISOString();
  rates.lastScanOk = warnings.length === 0 || fcaDecisions.length + qtaDecisions.length > 0;
  rates.lastUpdated = rates.lastScanAt;
  rates.discovery = {
    fcaDecisions: fcaDecisions.slice(0, 40),
    qtaDecisions: qtaDecisions.slice(0, 20),
    warnings,
  };

  saveRates(rates);
  console.log(`Wrote ${RATES_PATH}`);
  console.log(`Warnings: ${warnings.length}`);
  // Always exit 0 after a successful write so Actions can commit scan metadata.
  // Incomplete NEPRA fetches are recorded in discovery.warnings instead of failing the job.
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
