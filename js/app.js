(function () {
  "use strict";

  const form = document.getElementById("calc-form");
  const resultEl = document.getElementById("result");
  const ratesStatusEl = document.getElementById("rates-status");
  const billMonthEl = document.getElementById("billMonth");

  const hints = {
    protected:
      "Protected: first 100 units @ Rs.10.54, next up to 200 @ Rs.13.01 (one previous slab). Needs ≤200 units for required prior months — confirm on your bill.",
    unprotected:
      "Unprotected: every unit is charged at the rate of the slab your total lands in. Example: 201 units → all 201 × Rs.33.10 (not progressive).",
    lifeline:
      "Lifeline: up to 50 @ Rs.3.95 or 51–100 @ Rs.7.74 for the whole month (no previous-slab split). Usually single-phase / special eligibility.",
  };

  function money(n) {
    return "Rs. " + Number(n).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function badgeClass(status) {
    if (!status) return "";
    if (
      status === "MANUAL_ONLY" ||
      status === "PROVISIONAL" ||
      status === "NOT_AVAILABLE" ||
      status === "NEEDS_REVIEW"
    ) {
      return "manual";
    }
    if (status === "OFFICIAL_GUIDANCE" || status === "CROSS_CHECKED") return "warn";
    return "";
  }

  function fillBillMonths(preferred) {
    const opts = LescoCalc.getBillMonthOptions();
    const keep = preferred || billMonthEl.value;
    billMonthEl.innerHTML = opts
      .map((o) => {
        const tag =
          o.fcaStatus === "NOTIFIED" ? "" : o.fcaStatus === "NEEDS_REVIEW" ? " · FCA review" : " · FCA n/a";
        return `<option value="${o.value}">${o.label}${tag}</option>`;
      })
      .join("");
    if (keep && opts.some((o) => o.value === keep)) billMonthEl.value = keep;
    else if (opts[0]) billMonthEl.value = opts[0].value;
  }

  function showRatesStatus() {
    if (!ratesStatusEl) return;
    const meta = LescoCalc.getRatesMeta();
    const updated = meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleDateString() : "built-in";
    const scanned = meta.lastScanAt ? new Date(meta.lastScanAt).toLocaleDateString() : "not scanned yet";
    ratesStatusEl.innerHTML = `Rates: <strong>${meta.source}</strong> · tariff ${meta.tariffVersion} · file updated ${updated} · last NEPRA scan ${scanned}. Provisional FCA is never auto-applied.`;
  }

  function readForm() {
    const fd = new FormData(form);
    const unitsMode = fd.get("unitsMode") || "direct";
    return {
      category: fd.get("category"),
      a1Status: fd.get("a1Status") || "unprotected",
      meterMode: fd.get("meterMode"),
      phase: fd.get("phase"),
      sanctionedLoad: fd.get("sanctionedLoad"),
      mdi: fd.get("mdi"),
      a2Band: fd.get("a2Band"),
      unitsMode,
      units: fd.get("units"),
      previousReading: fd.get("previousReading"),
      currentReading: fd.get("currentReading"),
      meterMultiplier: fd.get("meterMultiplier"),
      peakUnits: fd.get("peakUnits"),
      offPeakUnits: fd.get("offPeakUnits"),
      billMonth: fd.get("billMonth"),
      applyQTA: document.getElementById("applyQTA").checked,
      applyFCA: document.getElementById("applyFCA").checked,
      applyFC: document.getElementById("applyFC").checked,
      applyED: document.getElementById("applyED").checked,
      applyGST: document.getElementById("applyGST").checked,
      applyWHT: document.getElementById("applyWHT").checked,
      onATL: document.getElementById("onATL").checked,
      fcaOverride: document.getElementById("fcaOverride").value,
      fcOverride: document.getElementById("fcOverride").value,
      arrears: document.getElementById("arrears").value,
      meterRent: document.getElementById("meterRent").value,
      instalment: document.getElementById("instalment").value,
      lps: document.getElementById("lps").value,
      other: document.getElementById("other").value,
    };
  }

  function syncUI() {
    const category = document.getElementById("category").value;
    const meterMode = document.getElementById("meterMode").value;
    const unitsMode = form.querySelector('input[name="unitsMode"]:checked')?.value || "direct";
    const a1Status = form.querySelector('input[name="a1Status"]:checked')?.value || "protected";

    document.getElementById("a1-status-wrap").classList.toggle("hidden", category !== "a1" || meterMode !== "regular");
    document.getElementById("a2-band-wrap").classList.toggle("hidden", category !== "a2" || meterMode !== "regular");
    document.getElementById("phase-wrap").classList.toggle("hidden", category !== "a1");
    document.getElementById("mdi-wrap").classList.toggle(
      "hidden",
      !(meterMode === "tou" || (category === "a2" && meterMode !== "regular") || category === "b2")
    );

    const tou = meterMode === "tou";
    document.getElementById("tou-units").classList.toggle("hidden", !tou);
    document.getElementById("direct-units").classList.toggle("hidden", tou || unitsMode !== "direct");
    document.getElementById("reading-units").classList.toggle("hidden", tou || unitsMode !== "readings");

    if (category === "a1" && meterMode === "regular") {
      document.getElementById("status-hint").textContent = hints[a1Status] || "";
    }

    if (unitsMode === "readings" && !tou) {
      const prev = Number(document.getElementById("previousReading").value) || 0;
      const curr = Number(document.getElementById("currentReading").value) || 0;
      const mult = Number(document.getElementById("meterMultiplier").value) || 1;
      const delta = (curr - prev) * mult;
      document.getElementById("delta-hint").textContent =
        curr >= prev
          ? `Units = (${curr} − ${prev}) × ${mult} = ${delta} kWh`
          : "Current reading must be ≥ previous reading.";
    }
  }

  function render(result) {
    if (result.error) {
      resultEl.innerHTML = `<h2>Estimate</h2><div class="error-box">${result.error}</div>`;
      return;
    }

    const statusLabel = result.a1Status
      ? ` · ${result.a1Status.charAt(0).toUpperCase() + result.a1Status.slice(1)}`
      : "";

    const lines = result.components
      .map((c) => {
        const bc = badgeClass(c.status);
        return `<li>
          <span>${c.label}<span class="badge ${bc}">${c.status || ""}</span></span>
          <strong>${money(c.amount)}</strong>
          ${c.note ? `<span class="note">${c.note}</span>` : ""}
        </li>`;
      })
      .join("");

    const warns = (result.warnings || []).map((w) => `<div class="callout warn">${w}</div>`).join("");
    const assumptions = (result.assumptions || []).length
      ? `<div class="callout info"><strong>Assumptions</strong><ul>${result.assumptions
          .map((a) => `<li>${a}</li>`)
          .join("")}</ul></div>`
      : "";

    resultEl.innerHTML = `
      <h2>Estimate</h2>
      <p class="total">${money(result.estimatedTotal)}</p>
      <p class="meta">${result.units} kWh · ${result.billMonth}${statusLabel} · ${result.tariffVersion}</p>
      <ul class="lines">${lines}</ul>
      ${warns}
      ${assumptions}
      <p class="hint" style="margin-top:1rem">
        This is an estimate. Actual LESCO bills can differ due to classification, MDI, arrears, later FCA/QTA notices, and tax treatment.
      </p>
    `;
  }

  function run() {
    syncUI();
    render(LescoCalc.estimate(readForm()));
  }

  async function loadRates() {
    try {
      const res = await fetch("data/rates.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      LescoCalc.applyRatesData(data);
      fillBillMonths();
      showRatesStatus();
      run();
    } catch (err) {
      console.warn("Using embedded rates fallback:", err);
      fillBillMonths();
      showRatesStatus();
      if (ratesStatusEl) {
        ratesStatusEl.textContent +=
          " (Could not fetch data/rates.json — serve over http:// or GitHub Pages, not file://)";
      }
      run();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });

  form.addEventListener("change", syncUI);
  form.addEventListener("input", syncUI);

  document.getElementById("reset-btn").addEventListener("click", () => {
    form.reset();
    fillBillMonths();
    syncUI();
    resultEl.innerHTML = `<h2>Estimate</h2><p class="muted">Fill the form and tap Estimate.</p>`;
  });

  syncUI();
  loadRates();

  const checks = LescoCalc.selfCheck();
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) console.warn("LESCO calc self-check failed:", failed);
  else console.info("LESCO calc self-check OK:", checks.map((c) => c.id).join(", "));
})();
