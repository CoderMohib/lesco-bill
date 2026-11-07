/**
 * LESCO bill estimate engine — S.R.O. 279(I)/2026 GoP applicable rates.
 * Money in paisa (integer) where practical; round to 2dp for display lines.
 */
(function (global) {
  "use strict";

  const TARIFF = {
    version: "SRO-279-I-2026",
    effectiveFrom: "2026-02-12",
    gstRate: 0.18,
    fcRate: 0.43,
    edRates: { domestic: 0.015, commercial: 0.015, industrial: 0.01, agriculture: 0.01 },
    a1MinCharge: { single: 75, three: 150 },
    a1: {
      lifeline: [
        { max: 50, rate: 3.95, fixed: 0 },
        { max: 100, rate: 7.74, fixed: 0 },
      ],
      protected: [
        { max: 100, rate: 10.54, fixed: 200 },
        { max: 200, rate: 13.01, fixed: 300 },
      ],
      unprotected: [
        { max: 100, rate: 22.44, fixed: 275 },
        { max: 200, rate: 28.91, fixed: 300 },
        { max: 300, rate: 33.1, fixed: 350 },
        { max: 400, rate: 36.46, fixed: 400 },
        { max: 500, rate: 38.95, fixed: 500 },
        { max: 600, rate: 40.22, fixed: 675 },
        { max: 700, rate: 41.85, fixed: 675 },
        { max: Infinity, rate: 47.2, fixed: 675 },
      ],
      tou: { peak: 46.85, offPeak: 34.53, fixed: 675, demandFactor: 0.5 },
      prepaid: { rate: 42.12, fixed: 675 },
    },
    a2: {
      below5: { rate: 37.44, fixedPerConsumer: 1000 },
      above5: { rate: 39.76, fixed: 1250, demandFactor: 0.35 },
      tou: { peak: 43.82, offPeak: 35.15, fixed: 1250, demandFactor: 0.35 },
      prepaid: { rate: 42.38, fixed: 1250 },
    },
    a3: { rate: 42.48, fixedPerConsumer: 1000 },
    b1: {
      regular: { rate: 26.23, fixedPerConsumer: 1000 },
      tou: { peak: 35.74, offPeak: 25.48, fixedPerConsumer: 1000 },
    },
    b2: {
      regular: { rate: 26.16, fixed: 1250, demandFactor: 0.25 },
      tou: { peak: 35.68, offPeak: 22.83, fixed: 1250, demandFactor: 0.25 },
    },
  };

  /** Dated monthly adjustments — replaced by data/rates.json when loaded */
  let ADJUSTMENTS = {
    "2026-09": {
      qta: { rate: 0.5194, status: "NOTIFIED", note: "Q2 CY2026 QTA (Sep–Nov 2026)" },
      fca: { rate: 2.0581, status: "NOTIFIED", note: "July 2026 fuel month → Sep billing" },
    },
    "2026-10": {
      qta: { rate: 0.5194, status: "NOTIFIED", note: "Q2 CY2026 QTA (Sep–Nov 2026)" },
      fca: { rate: 1.1086, status: "NOTIFIED", note: "August 2026 fuel month → Oct billing" },
    },
    "2026-11": {
      qta: { rate: 0.5194, status: "NOTIFIED", note: "Q2 CY2026 QTA (Sep–Nov 2026)" },
      fca: {
        rate: null,
        status: "NEEDS_REVIEW",
        provisionalRequest: 2.5624,
        note: "Sep FCA decision listed — not auto-applied until rate transcribed",
      },
    },
  };

  let RATES_META = {
    lastUpdated: null,
    lastScanAt: null,
    tariffVersion: TARIFF.version,
    source: "embedded-fallback",
  };

  function applyRatesData(data) {
    if (!data || !data.billMonths) return false;
    if (data.tariffVersion) TARIFF.version = data.tariffVersion;
    if (data.static) {
      if (data.static.gstRate != null) TARIFF.gstRate = data.static.gstRate;
      if (data.static.fcRate != null) TARIFF.fcRate = data.static.fcRate;
      if (data.static.edRates) Object.assign(TARIFF.edRates, data.static.edRates);
    }
    const next = {};
    for (const [key, month] of Object.entries(data.billMonths)) {
      next[key] = {
        label: month.label,
        qta: month.qta || null,
        fca: month.fca || null,
      };
    }
    ADJUSTMENTS = next;
    RATES_META = {
      lastUpdated: data.lastUpdated || null,
      lastScanAt: data.lastScanAt || null,
      tariffVersion: data.tariffVersion || TARIFF.version,
      source: "data/rates.json",
      discoveryWarnings: data.discovery?.warnings || [],
    };
    return true;
  }

  function getBillMonthOptions() {
    return Object.keys(ADJUSTMENTS)
      .sort()
      .reverse()
      .map((key) => ({
        value: key,
        label: ADJUSTMENTS[key].label || key,
        fcaStatus: ADJUSTMENTS[key].fca?.status || "NOT_AVAILABLE",
        qtaStatus: ADJUSTMENTS[key].qta?.status || "NOT_AVAILABLE",
      }));
  }

  function getRatesMeta() {
    return RATES_META;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function bandFor(units, bands) {
    for (const b of bands) {
      if (units <= b.max) return b;
    }
    return bands[bands.length - 1];
  }

  function demandKW(sanctioned, mdi, factor) {
    return Math.max(factor * sanctioned, mdi || 0);
  }

  function resolveUnits(input) {
    if (input.unitsMode === "readings") {
      const prev = Number(input.previousReading);
      const curr = Number(input.currentReading);
      const mult = Number(input.meterMultiplier) || 1;
      if (!(curr >= prev)) {
        return { error: "Current reading must be ≥ previous reading (or enable rollover)." };
      }
      return { units: (curr - prev) * mult, fromReadings: true, multiplier: mult };
    }
    return { units: Number(input.units) || 0, fromReadings: false };
  }

  function calcA1Energy(units, status) {
    const assumptions = [];
    const warnings = [];

    if (status === "lifeline") {
      if (units > 100) {
        warnings.push("Lifeline is typically only for ≤100 units. Recheck tariff code on your bill.");
      }
      const band = bandFor(units, TARIFF.a1.lifeline);
      // No slab benefit: whole month at the band rate
      return {
        energy: round2(units * band.rate),
        fixedPerKW: 0,
        detail: `${units} × Rs.${band.rate} (lifeline band, no previous-slab benefit)`,
        assumptions,
        warnings,
        exemptAdjustments: true,
      };
    }

    if (status === "protected") {
      if (units > 200) {
        warnings.push(
          "Protected status normally requires ≤200 units this month (and history). Switched calculation needs unprotected rates — select Unprotected or confirm eligibility."
        );
        return null; // caller falls through / shows error
      }
      assumptions.push(
        "Protected eligibility assumed from your selection (needs ≤200 units for required prior months)."
      );
      if (units <= 100) {
        return {
          energy: round2(units * 10.54),
          fixedPerKW: 200,
          detail: `${units} × Rs.10.54 (protected, progressive)`,
          assumptions,
          warnings,
          exemptAdjustments: false,
        };
      }
      const rem = units - 100;
      return {
        energy: round2(100 * 10.54 + rem * 13.01),
        fixedPerKW: 300,
        detail: `100 × Rs.10.54 + ${rem} × Rs.13.01 (protected one-slab benefit)`,
        assumptions,
        warnings,
        exemptAdjustments: false,
      };
    }

    // unprotected — single band rate for ALL units
    const band = bandFor(units, TARIFF.a1.unprotected);
    return {
      energy: round2(units * band.rate),
      fixedPerKW: band.fixed,
      detail: `${units} × Rs.${band.rate} (unprotected band ≤${band.max === Infinity ? "700+" : band.max}; no slab benefit)`,
      assumptions,
      warnings,
      exemptAdjustments: false,
    };
  }

  function section235(category, gross, onATL) {
    const g = round2(gross);
    if (category === "domestic") {
      if (onATL) return { amount: 0, detail: "Domestic on ATL — nil" };
      if (g < 25000) return { amount: 0, detail: "Domestic non-ATL, bill < Rs.25,000 — nil" };
      return { amount: round2(g * 0.075), detail: `7.5% × Rs.${g.toLocaleString()}` };
    }
    if (category === "commercial") {
      if (g <= 500) return { amount: 0, detail: "Commercial ≤ Rs.500 — nil" };
      if (g <= 20000) return { amount: round2(g * 0.1), detail: `10% × Rs.${g.toLocaleString()}` };
      return {
        amount: round2(1950 + (g - 20000) * 0.12),
        detail: `Rs.1,950 + 12% × (Rs.${g.toLocaleString()} − 20,000)`,
      };
    }
    if (category === "industrial") {
      if (g <= 500) return { amount: 0, detail: "Industrial ≤ Rs.500 — nil" };
      if (g <= 20000) return { amount: round2(g * 0.1), detail: `10% × Rs.${g.toLocaleString()}` };
      return {
        amount: round2(1950 + (g - 20000) * 0.05),
        detail: `Rs.1,950 + 5% × (Rs.${g.toLocaleString()} − 20,000)`,
      };
    }
    return { amount: 0, detail: "N/A" };
  }

  function estimate(input) {
    const assumptions = [];
    const warnings = [];
    const components = [];

    const u = resolveUnits(input);
    if (u.error) return { error: u.error };

    let units = u.units;
    let peak = Number(input.peakUnits) || 0;
    let offPeak = Number(input.offPeakUnits) || 0;
    const sanctioned = Number(input.sanctionedLoad) || 0;
    const mdi = Number(input.mdi) || 0;
    const phase = input.phase || "single";
    const billMonth = input.billMonth || "2026-11";
    const category = input.category; // a1 | a2 | a3 | b1 | b2
    const meterMode = input.meterMode || "regular"; // regular | tou | prepaid
    const a1Status = input.a1Status || "unprotected"; // lifeline | protected | unprotected
    const onATL = !!input.onATL;
    const applyGST = input.applyGST !== false;
    const applyED = input.applyED !== false;
    const applyFC = input.applyFC !== false;
    const applyQTA = input.applyQTA !== false;
    const applyFCA = input.applyFCA !== false;
    const applyWHT = input.applyWHT !== false;

    if (u.fromReadings) {
      assumptions.push(`Units from meter: (${input.currentReading} − ${input.previousReading}) × ${u.multiplier}`);
    }

    let energy = 0;
    let fixed = 0;
    let energyDetail = "";
    let taxClass = "domestic";
    let exemptAdj = false;

    if (category === "a1") {
      taxClass = "domestic";
      if (meterMode === "tou") {
        energy = round2(peak * TARIFF.a1.tou.peak + offPeak * TARIFF.a1.tou.offPeak);
        units = peak + offPeak;
        const dk = demandKW(sanctioned, mdi, TARIFF.a1.tou.demandFactor);
        fixed = round2(dk * TARIFF.a1.tou.fixed);
        energyDetail = `${peak} peak × ${TARIFF.a1.tou.peak} + ${offPeak} off-peak × ${TARIFF.a1.tou.offPeak}`;
        assumptions.push("A-1 ToU: fixed on max(50% sanctioned load, MDI)");
      } else if (meterMode === "prepaid") {
        energy = round2(units * TARIFF.a1.prepaid.rate);
        fixed = round2(sanctioned * TARIFF.a1.prepaid.fixed);
        energyDetail = `${units} × Rs.${TARIFF.a1.prepaid.rate} (prepaid)`;
        exemptAdj = true;
        assumptions.push("Prepaid: FCA/QTA typically exempt per recent notices — confirm on bill.");
      } else {
        if (a1Status === "protected" && units > 200) {
          return {
            error:
              "Protected A-1 only applies up to 200 units for the month. Choose Unprotected, or enter ≤200 units.",
          };
        }
        const e = calcA1Energy(units, a1Status);
        if (!e) {
          return { error: "Could not calculate protected energy for these units." };
        }
        energy = e.energy;
        energyDetail = e.detail;
        exemptAdj = e.exemptAdjustments;
        assumptions.push(...e.assumptions);
        warnings.push(...e.warnings);
        if (e.fixedPerKW > 0 && sanctioned > 0) {
          fixed = round2(sanctioned * e.fixedPerKW);
        } else if (e.fixedPerKW > 0 && !sanctioned) {
          warnings.push("Sanctioned load missing — fixed charge not applied.");
          assumptions.push("Enter sanctioned load (kW) from your bill for fixed charges.");
        }
        // Lifeline / no fixed: minimum customer charge
        if (e.fixedPerKW === 0) {
          const min = phase === "three" ? TARIFF.a1MinCharge.three : TARIFF.a1MinCharge.single;
          if (fixed === 0) {
            fixed = min;
            components.push({
              code: "MIN",
              label: "Minimum monthly customer charge",
              amount: fixed,
              status: "NOTIFIED",
              note: phase === "three" ? "Three-phase Rs.150" : "Single-phase Rs.75",
            });
          }
        }
      }
    } else if (category === "a2") {
      taxClass = "commercial";
      const below5 = sanctioned > 0 && sanctioned < 5;
      if (meterMode === "tou") {
        energy = round2(peak * TARIFF.a2.tou.peak + offPeak * TARIFF.a2.tou.offPeak);
        units = peak + offPeak;
        const dk = demandKW(sanctioned, mdi, TARIFF.a2.tou.demandFactor);
        fixed = round2(dk * TARIFF.a2.tou.fixed);
        energyDetail = `ToU commercial`;
      } else if (meterMode === "prepaid") {
        energy = round2(units * TARIFF.a2.prepaid.rate);
        fixed = round2(demandKW(sanctioned, mdi, 0.35) * TARIFF.a2.prepaid.fixed);
        energyDetail = `Prepaid commercial`;
        exemptAdj = true;
      } else if (below5 || input.a2Band === "below5") {
        energy = round2(units * TARIFF.a2.below5.rate);
        fixed = TARIFF.a2.below5.fixedPerConsumer;
        energyDetail = `${units} × Rs.${TARIFF.a2.below5.rate} (A-2 < 5 kW)`;
      } else {
        energy = round2(units * TARIFF.a2.above5.rate);
        const dk = demandKW(sanctioned, mdi, TARIFF.a2.above5.demandFactor);
        fixed = round2(dk * TARIFF.a2.above5.fixed);
        energyDetail = `${units} × Rs.${TARIFF.a2.above5.rate} (A-2 ≥ 5 kW)`;
      }
    } else if (category === "a3") {
      taxClass = "commercial";
      energy = round2(units * TARIFF.a3.rate);
      fixed = TARIFF.a3.fixedPerConsumer;
      energyDetail = `${units} × Rs.${TARIFF.a3.rate}`;
    } else if (category === "b1") {
      taxClass = "industrial";
      if (meterMode === "tou") {
        energy = round2(peak * TARIFF.b1.tou.peak + offPeak * TARIFF.b1.tou.offPeak);
        units = peak + offPeak;
        fixed = TARIFF.b1.tou.fixedPerConsumer;
      } else {
        energy = round2(units * TARIFF.b1.regular.rate);
        fixed = TARIFF.b1.regular.fixedPerConsumer;
      }
      energyDetail = `B-1 industrial`;
    } else if (category === "b2") {
      taxClass = "industrial";
      if (meterMode === "tou") {
        energy = round2(peak * TARIFF.b2.tou.peak + offPeak * TARIFF.b2.tou.offPeak);
        units = peak + offPeak;
        const dk = demandKW(sanctioned, mdi, TARIFF.b2.tou.demandFactor);
        fixed = round2(dk * TARIFF.b2.tou.fixed);
      } else {
        energy = round2(units * TARIFF.b2.regular.rate);
        const dk = demandKW(sanctioned, mdi, TARIFF.b2.regular.demandFactor);
        fixed = round2(dk * TARIFF.b2.regular.fixed);
      }
      energyDetail = `B-2 industrial`;
    } else {
      return { error: "Select a consumer category." };
    }

    // Don't double-count min charge already pushed
    const hasMin = components.some((c) => c.code === "MIN");
    components.unshift({
      code: "ENERGY",
      label: "Electricity / variable charges",
      amount: energy,
      status: "NOTIFIED",
      note: energyDetail,
    });
    if (!hasMin) {
      components.push({
        code: "FIXED",
        label: "Fixed charges",
        amount: fixed,
        status: "NOTIFIED",
        note: sanctioned ? `Load ${sanctioned} kW` : "",
      });
    }

    const adj = ADJUSTMENTS[billMonth] || {};
    let qtaAmt = 0;
    let fcaAmt = 0;

    if (applyQTA && adj.qta && !exemptAdj) {
      qtaAmt = round2(units * adj.qta.rate);
      components.push({
        code: "QTA",
        label: "Quarterly tariff adjustment (QTA)",
        amount: qtaAmt,
        status: adj.qta.status,
        note: adj.qta.note,
      });
    } else if (exemptAdj && applyQTA) {
      assumptions.push("QTA skipped (lifeline/prepaid exemption assumption).");
    }

    const fcaOverride = input.fcaOverride;
    if (applyFCA && !exemptAdj) {
      let fcaRate = null;
      let fcaStatus = "NOT_AVAILABLE";
      let fcaNote = "";
      if (fcaOverride !== "" && fcaOverride != null && !Number.isNaN(Number(fcaOverride))) {
        fcaRate = Number(fcaOverride);
        fcaStatus = "MANUAL_ONLY";
        fcaNote = "Manual FCA override";
      } else if (adj.fca && adj.fca.rate != null) {
        fcaRate = adj.fca.rate;
        fcaStatus = adj.fca.status;
        fcaNote = adj.fca.note;
      } else if (adj.fca) {
        warnings.push(
          `No approved FCA for ${billMonth}. Provisional request was Rs.${adj.fca.provisionalRequest}/kWh — enter override only if your bill shows it.`
        );
        fcaNote = adj.fca.note;
      }
      if (fcaRate != null) {
        fcaAmt = round2(units * fcaRate);
        components.push({
          code: "FCA",
          label: "Fuel charges adjustment (FCA/FPA)",
          amount: fcaAmt,
          status: fcaStatus,
          note: fcaNote,
        });
      }
    } else if (exemptAdj && applyFCA) {
      assumptions.push("FCA skipped (lifeline/prepaid exemption assumption).");
    }

    let fcAmt = 0;
    if (applyFC && !exemptAdj) {
      const fcRate = input.fcOverride !== "" && input.fcOverride != null ? Number(input.fcOverride) : TARIFF.fcRate;
      fcAmt = round2(units * fcRate);
      components.push({
        code: "FC",
        label: "Financing cost surcharge",
        amount: fcAmt,
        status: "OFFICIAL_GUIDANCE",
        note: `Rs.${fcRate}/kWh — verify current notification`,
      });
    } else if (exemptAdj && applyFC) {
      assumptions.push("FC surcharge skipped for lifeline/prepaid.");
    }

    const edRate =
      taxClass === "industrial" ? TARIFF.edRates.industrial : taxClass === "commercial" ? TARIFF.edRates.commercial : TARIFF.edRates.domestic;
    let edAmt = 0;
    if (applyED) {
      edAmt = round2(energy * edRate);
      components.push({
        code: "ED",
        label: "Punjab electricity duty",
        amount: edAmt,
        status: "CROSS_CHECKED",
        note: `${(edRate * 100).toFixed(1)}% of variable charges (confirm Punjab schedule)`,
      });
    }

    // Manual extras before GST / WHT bases
    const extras = [
      ["arrears", "Arrears / balance forward"],
      ["meterRent", "Meter rent"],
      ["instalment", "Instalment"],
      ["lps", "Late payment surcharge"],
      ["other", "Other charges / credit"],
    ];
    let extrasTotal = 0;
    let lpsAmt = 0;
    for (const [key, label] of extras) {
      const v = Number(input[key]) || 0;
      if (v !== 0) {
        components.push({ code: key.toUpperCase(), label, amount: round2(v), status: "MANUAL_ONLY" });
        extrasTotal += v;
        if (key === "lps") lpsAmt = v;
      }
    }

    // GST base: energy + fixed + adj + fc + ed + extras except LPS (law excludes LPS from ST base)
    let gstBase = energy + (hasMin ? 0 : fixed) + (hasMin ? fixed : 0) + qtaAmt + fcaAmt + fcAmt + edAmt;
    // include non-LPS extras that are typically taxable — arrears may already include tax; keep simple
    gstBase += (Number(input.meterRent) || 0) + (Number(input.instalment) || 0) + (Number(input.other) || 0);
    // arrears often already taxed — still show; user can zero
    gstBase += Number(input.arrears) || 0;
    gstBase = round2(gstBase);

    let gstAmt = 0;
    if (applyGST) {
      gstAmt = round2(gstBase * TARIFF.gstRate);
      components.push({
        code: "GST",
        label: "General sales tax (18%)",
        amount: gstAmt,
        status: "CURRENT_LAW",
        note: `Base Rs.${gstBase.toLocaleString()} (excludes LPS)`,
      });
    }

    const grossFor235 = round2(
      energy +
        fixed +
        qtaAmt +
        fcaAmt +
        fcAmt +
        edAmt +
        gstAmt +
        extrasTotal -
        lpsAmt +
        lpsAmt /* LPS usually after; include in gross per bill practice */
    );
    // Spec: gross inclusive of sales tax and incidental charges, before Sec 235 itself
    const grossBeforeWHT = round2(
      energy + fixed + qtaAmt + fcaAmt + fcAmt + edAmt + gstAmt + extrasTotal
    );

    let whtAmt = 0;
    if (applyWHT) {
      const wht = section235(taxClass, grossBeforeWHT, onATL);
      whtAmt = wht.amount;
      components.push({
        code: "WHT_235",
        label: "Advance income tax (Sec. 235)",
        amount: whtAmt,
        status: "CURRENT_LAW",
        note: wht.detail,
      });
    }

    const total = round2(
      energy + fixed + qtaAmt + fcaAmt + fcAmt + edAmt + gstAmt + whtAmt + extrasTotal
    );

    return {
      currency: "PKR",
      billMonth,
      units,
      tariffVersion: TARIFF.version,
      a1Status: category === "a1" && meterMode === "regular" ? a1Status : null,
      calculationStatus: "ESTIMATE_WITH_ASSUMPTIONS",
      components,
      estimatedTotal: total,
      assumptions,
      warnings,
      sources: [
        "S.R.O. 279(I)/2026 GoP applicable rates",
        "NEPRA / Federal tariff rationalisation Feb 2026",
      ],
    };
  }

  /** Spec regression checks for energy+fixed layer */
  function selfCheck() {
    const cases = [];
    function add(id, input, expectEnergy, expectFixed) {
      const r = estimate({
        ...input,
        applyGST: false,
        applyED: false,
        applyFC: false,
        applyQTA: false,
        applyFCA: false,
        applyWHT: false,
        billMonth: "2026-11",
      });
      const energy = r.components.find((c) => c.code === "ENERGY")?.amount;
      const fixed =
        r.components.find((c) => c.code === "FIXED")?.amount ??
        r.components.find((c) => c.code === "MIN")?.amount;
      const ok = energy === expectEnergy && fixed === expectFixed;
      cases.push({ id, ok, energy, expectEnergy, fixed, expectFixed, error: r.error });
    }

    add("R-01", { category: "a1", a1Status: "protected", units: 100, sanctionedLoad: 2, phase: "single" }, 1054, 400);
    add("R-02", { category: "a1", a1Status: "protected", units: 150, sanctionedLoad: 2 }, 1704.5, 600);
    add("R-03", { category: "a1", a1Status: "protected", units: 200, sanctionedLoad: 2 }, 2355, 600);
    add("R-04", { category: "a1", a1Status: "unprotected", units: 201, sanctionedLoad: 2 }, 6653.1, 700);
    add("R-05", { category: "a1", a1Status: "unprotected", units: 250, sanctionedLoad: 2 }, 8275, 700);
    add("R-06", { category: "a2", a2Band: "below5", units: 300, sanctionedLoad: 3 }, 11232, 1000);
    add("R-09", { category: "a3", units: 250, sanctionedLoad: 1 }, 10620, 1000);
    add("R-10", { category: "b1", units: 250 }, 6557.5, 1000);

    return cases;
  }

  global.LescoCalc = {
    estimate,
    selfCheck,
    applyRatesData,
    getBillMonthOptions,
    getRatesMeta,
    get TARIFF() {
      return TARIFF;
    },
    get ADJUSTMENTS() {
      return ADJUSTMENTS;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
