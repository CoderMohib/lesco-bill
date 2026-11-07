# LESCO Electricity Bill Estimator — Technical Research & Implementation Specification

**Document type:** Product requirements + tariff research + calculation specification  
**Target reader:** AI coding agent / software engineer building a LESCO bill-estimation calculator  
**Jurisdiction:** Lahore Electric Supply Company (LESCO), Punjab, Pakistan  
**Research snapshot:** 6 November 2026  
**Currency:** Pakistani Rupees (PKR / Rs.)  
**Units:** kWh (electricity units), kW (sanctioned load / demand), Rs./kWh and Rs./month

> **Critical disclaimer:** This document is a researched implementation brief, not a tariff notification and not an official LESCO bill. The static tariff tables below are transcribed from the 2026 NEPRA/Federal Government tariff decision and its notified consumer-end tariff. Monthly Fuel Charges Adjustment (FCA/FPA), Quarterly Tariff Adjustment (QTA), tax law, exemptions and bill-printing treatment can change. The application must retain source, effective date, approval status and a manual override for every non-static rate. Never describe an estimate as an exact bill.

---

## 1. Product goal

Build a transparent, itemised LESCO electricity **bill estimator**. A user enters their connection type, consumed units, meter/load information and relevant eligibility/tax inputs. The calculator estimates the bill by showing:

1. Energy / variable charges.
2. Fixed monthly charges or minimum monthly customer charge, whichever the tariff rules require.
3. FCA/FPA and QTA adjustments that are effective for the selected bill month and applicable to the selected consumer category.
4. Financing Cost (FC) surcharge where currently applicable.
5. Punjab Electricity Duty where applicable.
6. General Sales Tax (GST) using an explicitly configured taxable base.
7. Section 235 advance income tax where applicable.
8. User-supplied arrears, instalments, meter/service rent or other bill-specific lines, shown separately and never invented by the calculator.
9. Estimated payable amount by due date. Late-payment surcharge should be calculated only when the current LESCO rule and due-date data are implemented; otherwise accept a user-supplied amount.

The calculator should also explain why the result is an estimate and identify which inputs are assumptions.

### 1.1 MVP scope

Prioritise the consumer types most likely to use a public LESCO calculator:

- A-1 Domestic: lifeline, protected, unprotected and domestic ToU.
- A-2 Commercial: below 5 kW, 5 kW and above, ToU and prepaid where relevant.
- A-3 General Services.
- Industrial B-1 and B-2, then B-3/B-4.
- A manual adjustment/other-charge editor.

The complete tariff catalogue is documented below, but the first release should not pretend that every specialist tariff (C/D/E/F/G/H/K/railway/EV charging/net metering) has been fully implemented until its complete current rule set is tested.

### 1.2 What this calculator is not

- It is not an official LESCO portal and does not issue bills.
- It does not validate the meter, meter multiplier, tariff code, sanctioned load or MDI against LESCO's backend.
- It does not retrieve a customer's account balance or arrears unless an authorised official integration is later added.
- It is not a net-metering settlement calculator in the MVP.
- It is not a guarantee of tax advice or an official tax computation.

---

## 2. Source-of-truth hierarchy

The AI agent must use sources in this order. A lower-ranked source must never silently override a higher-ranked notification.

| Priority | Source | Use |
|---|---|---|
| 1 | Federal Government Gazette / SRO / notified Schedule of Tariff | Legally notified consumer-end tariff, amendments, taxes and applicability dates |
| 2 | NEPRA decisions and notifications | Tariff decisions, FCA/FPA, QTA, hearing/decision status, consumer service rules |
| 3 | FBR legislation and current tax rate card | GST and income-tax / withholding-tax rules |
| 4 | Punjab legislation / Punjab Government Energy Department | Punjab-specific Electricity Duty rules |
| 5 | LESCO / PITC official customer bill and consumer-service material | Bill component names, current LESCO operational treatment and real-bill validation |
| 6 | Ministry of Energy / Power Division | Official explanatory material; check publication date because some FAQ content can be stale |
| 7 | Reputable news reporting | Cross-check publication dates and explain notifications; never substitute a news story for the underlying order if the official order can be found |
| 8 | Third-party calculators/blogs | Discovery and comparison only; never a primary rate source |

### 2.1 Primary source URLs

1. **NEPRA LESCO tariff and notification index**  
   https://nepra.org.pk/tariff/Distribution%20LESCO.php

2. **NEPRA/Federal Government 2026 tariff rationalisation decision, 11 February 2026**  
   https://www.nepra.org.pk/tariff/Tariff/Ex-WAPDA%20DISCOS/2026/TRF-100%20XWDISCOS%20AND%20KE%20RATIONALIZATION%20OF%20TARIFF%2011-02-2026%202935-57.pdf  
   This is the principal source for the current 2026 GoP-applicable uniform tariff schedule, including fixed charges. The Federal Government notified the decision through S.R.O. 279(I)/2026 on 12 February 2026.

3. **S.R.O. 279(I)/2026 / Federal Government notification copy**  
   https://nepra.org.pk/Admission%20Notices/2026/02%20Feb/Complete%20motion%20alogwith%20Annexs_260206_150050.pdf

4. **NEPRA Consumer Service Manual (revised 2025)**  
   https://nepra.org.pk/Legislation/7-Manuals/2025/CONSUMER%20SERVICE%20MANUAL%20%28CSM%29%20REVISED%202025.pdf

5. **FBR current withholding-tax rate cards** (Tax Year 2027, updated through 30 June 2026)  
   https://www.fbr.gov.pk/withholding-taxes-rate-card/174298/174301

6. **Sales Tax Act 1990, updated through 30 June 2027 / Finance Act 2026**  
   https://www.tipp.gov.pk/site/display/169

7. **FBR Sales Tax Act index**  
   https://www.fbr.gov.pk/Categ/Sales-Tax-Act-1990/301/1000

8. **Punjab Energy Department — governing laws and policies** (lists Punjab Electricity Duty Rules 2012)  
   https://energy.punjab.gov.pk/governing_laws_and_policies

9. **Punjab Electricity Duty schedule reference** (the published schedule states domestic 1.5%, commercial 1.5%, industrial 1.0%, agricultural tube wells 1.0%; confirm against latest Punjab gazette amendments before release)  
   https://nasirlawsite.com/laws/pfa2007.htm

10. **Inspectorate of Electricity duty rate page** (use only as a cross-check; the host is a provincial inspectorate site outside Punjab, not LESCO)  
    https://ioekp.gov.pk/?page_id=30

11. **Ministry of Energy / Power Division electricity-bill FAQ**  
    https://power.gov.pk/Detail/YThmNWQ5OGQtZGY5NC00NDk0LTgzN2MtZThhZTEzMTY5NTg2

12. **Power Division official statement recording abolition of the PTV fee**  
    https://www.power.gov.pk/NewsDetail/ZDU4ZTNlMzUtMWVjYS00ZjRhLTk0YjMtOTYzZTFkNTM3ZDA5

13. **PITC bill portal** (for customer-side comparison, not a public rate authority)  
    https://bill.pitc.com.pk/

14. **LESCO official website**  
    https://lesco.gov.pk/

### 2.2 Important source interpretation rule

The 2026 NEPRA schedule contains multiple columns, including:

- NEPRA-determined / uniform determined tariff values; and
- **GoP Applicable Variable Charges** (consumer-end rates after Government tariff rationalisation/subsidy).

For the public-facing LESCO consumer estimator, select the **GoP Applicable** column from the notified schedule, not a neighbouring NEPRA-determined-cost column. The consumer pays the notified consumer-end tariff plus currently applicable adjustments and taxes, not the raw cost-of-service figure.

The 2026 S.R.O. 279(I)/2026 tariff is described as a uniform tariff for XWDISCOs (including LESCO). The tariff schedule should still be checked against any subsequent LESCO-specific notification or subsidy change before every release.

---

## 3. Data status and confidence labels

Every displayed number must carry an internal status:

- `NOTIFIED`: directly transcribed from a currently effective Gazette/SRO schedule.
- `NEPRA_DECIDED`: NEPRA has issued a decision, but check whether Government notification / bill effective date is complete.
- `CURRENT_LAW`: derived from legislation in force on the stated date.
- `OFFICIAL_GUIDANCE`: official explanatory web guidance, possibly older than current law.
- `CROSS_CHECKED`: corroborated by official notification and reputable secondary reporting.
- `PROVISIONAL`: an estimate/request, not an approved charge.
- `MANUAL_ONLY`: entered from the customer's bill or verified manually; no default automatic calculation.
- `NEEDS_REVIEW`: not safe to calculate until original schedule/notification is visually or legally checked.
- `EXPIRED`: historical value; never use for a current estimate.

Store this metadata for every rate:

```json
{
  "rateId": "fca_2026_09_consumption",
  "component": "FCA",
  "consumerCategory": ["A1", "A2", "A3", "B", "C", "D", "G", "H"],
  "amount": 2.5624,
  "unit": "PKR_PER_KWH",
  "status": "PROVISIONAL",
  "effectiveBillMonth": "2026-11",
  "consumptionMonth": "2026-09",
  "notificationNumber": null,
  "sourceUrl": "https://nepra.org.pk/tariff/Distribution%20LESCO.php",
  "sourcePublishedAt": null,
  "lastVerifiedAt": "2026-11-06",
  "verifiedBy": "research-agent",
  "notes": "CPPA-G request; hearing held; do not use as approved rate until NEPRA decision is found."
}
```

Never use one global `currentRate` for a rate that changes by billing month or consumer category.

---

## 4. Static 2026 consumer-end tariff data

**Basis:** 2026 NEPRA decision dated 11 February 2026 and Government notification S.R.O. 279(I)/2026, effective from the notified date. Values below are PKR. Energy rates are Rs./kWh; fixed charges are Rs./consumer/month or Rs./kW/month as specified.

**Important A-1 boundary:** The non-ToU domestic slab table below is the schedule row for sanctioned load **up to 5 kW**. The notified schedule has a separate domestic ToU treatment for sanctioned load **5 kW and above**. The exact tariff code and load recorded by LESCO on the consumer bill take precedence over a user's guess. At exactly 5 kW, do not silently choose a non-ToU slab; resolve the meter/tariff code.

### 4.1 A-1 — Domestic / residential, non-ToU

| Tariff band | Consumer status | Variable rate (Rs./kWh) | Fixed charge (Rs./kW/month) |
|---|---|---:|---:|
| Up to 50 units | Lifeline | 3.95 | — |
| 51–100 units | Lifeline | 7.74 | — |
| 1–100 units | Protected | 10.54 | 200 |
| 101–200 units | Protected | 13.01 | 300 |
| 1–100 units | Unprotected | 22.44 | 275 |
| 101–200 units | Unprotected | 28.91 | 300 |
| 201–300 units | Unprotected | 33.10 | 350 |
| 301–400 units | Unprotected | 36.46 | 400 |
| 401–500 units | Unprotected | 38.95 | 500 |
| 501–600 units | Unprotected | 40.22 | 675 |
| 601–700 units | Unprotected | 41.85 | 675 |
| Above 700 units | Unprotected | 47.20 | 675 |

**Tariff logic: this is not a normal incremental progressive slab system for every class.**

- Protected residential consumers are given the benefit of one previous slab. Implement the protected calculation progressively across the first and second bands: first 100 units × Rs.10.54, remaining units up to 200 × Rs.13.01.
- Lifeline consumers are explicitly not given a slab benefit. If consumption is in the 51–100 lifeline band, apply Rs.7.74 to the lifeline units according to the tariff's band rule; do not automatically split the first 50 at Rs.3.95 unless an updated notification explicitly says to do so.
- Unprotected residential consumers do **not** receive the protected one-slab benefit. Select the applicable total-consumption band and apply that row's rate to the billable units for the month. For example, the current schedule's 201–300 row is Rs.33.10/kWh. Do not silently calculate 100 units at Rs.22.44 plus 100 at Rs.28.91 plus 1 at Rs.33.10.
- Protected eligibility is not determined only by the current unit total. The commonly published definition uses a non-ToU domestic consumer whose monthly use does not exceed 200 units for the required preceding six-month period, subject to sanctioned-load / tariff-code conditions. Before production, verify the exact LESCO-applicable wording and effective date from the current notified schedule or consumer record. Retain at least six months' history. Do not assume an unknown history is protected.
- Lifeline status has its own eligibility requirements (including single-phase / sanctioned-load and consumption-history criteria). This research did not establish every current LESCO eligibility field from a single current primary source. Treat Lifeline as a verified tariff-code/eligibility state, not just a user-selected cheaper price band. Ask for relevant history or allow a manual override clearly marked as assumed.

**Domestic fixed-charge and minimum-charge notes from the schedule:**

- Non-ToU domestic fixed charges are based on sanctioned load (kW).
- Domestic ToU fixed charges are based on 50% of sanctioned load or actual MDI, whichever is higher.
- Where A-1 monthly fixed charges apply, the schedule says no minimum monthly customer charge applies, even if no energy is consumed.
- Where fixed charges do not apply, the A-1 minimum monthly customer charge is Rs.75 per month for single-phase connections and Rs.150 per month for three-phase connections, even if no energy is consumed.
- Do not apply both a fixed charge and the A-1 minimum charge to the same month.

**Domestic example, protected:** 150 units, 2 kW sanctioned load:

- Energy = 100 × 10.54 + 50 × 13.01 = Rs.1,704.50.
- Fixed = 2 × 300 = Rs.600.
- Pre-adjustment, pre-tax subtotal = Rs.2,304.50.

This example assumes the connection genuinely qualifies for protected status and that the full billing month is a standard monthly period.

**Domestic example, unprotected:** 201 units, 2 kW sanctioned load:

- Energy = 201 × 33.10 = Rs.6,653.10.
- Fixed = 2 × 350 = Rs.700.
- Pre-adjustment, pre-tax subtotal = Rs.7,353.10.

This example illustrates why protected/unprotected status and tariff-band rules must be modelled rather than inferred from a single per-unit rate.

### 4.2 A-1 — Domestic Time-of-Use (ToU)

For eligible residential sanctioned load 5 kW and above:

| Component | Rate |
|---|---:|
| Peak | Rs.46.85/kWh |
| Off-peak | Rs.34.53/kWh |
| Fixed charge | Rs.675/kW/month |
| Fixed-charge demand basis | 50% of sanctioned load or actual MDI, whichever is higher |

Formula:

`energy = peak_units * 46.85 + off_peak_units * 34.53`

`fixed_kW = max(0.50 * sanctioned_load_kW, actual_MDI_kW)`

`fixed_charge = fixed_kW * 675`

Validate current peak/off-peak time windows from the current applicable schedule / meter configuration. Do not hardcode a generic time window if the consumer's meter/bill gives a tariff-specific definition.

Prepaid residential tariff in the 2026 schedule is Rs.42.12/kWh with fixed charge Rs.675/kW/month. Treat prepaid as a distinct tariff configuration with its own FCA/QTA exemptions; do not also apply ordinary A-1 protected slab logic.

### 4.3 A-2 — Commercial supply

| Category | Variable rate (Rs./kWh) | Fixed charge | Fixed-charge basis |
|---|---:|---:|---|
| Sanctioned load below 5 kW | 37.44 | Rs.1,000/consumer/month | Per consumer/month |
| Sanctioned load 5 kW and above — regular | 39.76 | Rs.1,250/kW/month | 35% of sanctioned load or actual MDI, whichever is higher |
| ToU — peak | 43.82 | Rs.1,250/kW/month | 35% of sanctioned load or actual MDI, whichever is higher |
| ToU — off-peak | 35.15 | Same shared fixed charge | Do not duplicate the fixed charge for peak and off-peak |
| Prepaid commercial | 42.38 | Rs.1,250/kW/month | Verify tariff footnote / metering condition before production calculation |

For the 5 kW+ fixed-charge rule, the A-2 schedule footnote states **35%** of sanctioned load or actual MDI, whichever is higher. Do not replace it with the 25% rule used by other categories. Apply one fixed charge for the monthly bill, not one per ToU band.

Commercial example (below 5 kW): 300 units:

- Energy = 300 × 37.44 = Rs.11,232.
- Fixed = Rs.1,000.
- Pre-adjustment, pre-tax subtotal = Rs.12,232.

### 4.4 A-3 — General Services

| Category | Variable rate | Fixed charge | Fixed-charge basis |
|---|---:|---:|---|
| General services | Rs.42.48/kWh | Rs.1,000/consumer/month | Per consumer/month |
| Prepaid general services | Rs.42.48/kWh | Rs.1,000/consumer/month | Per consumer/month |

Where an A-3 tariff footnote applies fixed charges in Rs./kW/month (for any amended tariff variant), the schedule specifies 25% of sanctioned load or actual MDI, whichever is higher. The currently listed A-3 row above is a per-consumer fixed amount; do not convert it to a kW charge without a new notification.

### 4.5 B — Industrial supply

The notified 2026 schedule includes the following GoP-applicable rates:

| Category | Description | Regular rate (Rs./kWh) | ToU peak | ToU off-peak | Fixed charge |
|---|---|---:|---:|---:|---:|
| B-1 | Up to 25 kW, 400/230 V | 26.23 | 35.74 | 25.48 | Rs.1,000/consumer/month |
| B-2 | Above 25 kW to 500 kW, 400 V | 26.16 | 35.68 | 22.83 | Rs.1,250/kW/month |
| B-3 | All loads up to 5,000 kW, 11/33 kV | 27.00 | 35.68 | 23.67 | Rs.1,250/kW/month |
| B-4 | 66 kV, 132 kV and above | 26.43 | 35.68 | 23.38 | Rs.1,250/kW/month |
| B-5 | 220 kV and above | Refer to exact current Annex / SRO | 35.68 | 23.13 | Rs.1,250/kW/month where schedule specifies |
| Prepaid industrial | Prepaid tariff | 35.72 | — | — | Rs.1,250/kW/month |

For applicable industrial fixed-charge rows billed in Rs./kW/month, the tariff footnote says use **25% of sanctioned load or actual MDI, whichever is higher**. For B-1, the fixed charge is a per-consumer amount in the notified table. Confirm the B-5 non-ToU consumer-end rate and exact load/voltage eligibility from the full current notification before exposing the row as a selectable tariff.

### 4.6 C — Single Point Supply / bulk-type categories

| Category | Description | Regular rate (Rs./kWh) | Fixed charge |
|---|---|---:|---:|
| C-1 (a) | 400/230 V, sanctioned load below 5 kW | 43.39 | Rs.2,000/consumer/month |
| C-1 (b) | 400/230 V, 5 kW to 500 kW | 40.63 | Rs.1,250/kW/month |
| C-2 | 11/33 kV, up to and including 5,000 kW | 40.57 | Rs.1,250/kW/month |
| C-3 | 66 kV and above, sanctioned load above 5,000 kW | 40.77 | Rs.1,250/kW/month |

ToU GoP applicable rates in the schedule:

| Category | Peak | Off-peak |
|---|---:|---:|
| C-1 ToU | Rs.46.31/kWh | Rs.29.12/kWh |
| C-2 ToU | Rs.46.31/kWh | Rs.19.33/kWh |
| C-3 ToU | Rs.46.31/kWh | Rs.23.46/kWh |

Fixed charges where billed per kW/month are based on **25% of sanctioned load or actual MDI, whichever is higher**. Confirm the exact classification and tariff code printed on the consumer's bill; do not let the public UI infer C-1/C-2/C-3 from voltage alone.

### 4.7 D — Agriculture / SCARP

| Category | Variable rate (Rs./kWh) | Fixed charge |
|---|---:|---:|
| D-1(a) SCARP, less than 5 kW | 39.87 | None shown in this row |
| D-2(a) Agricultural tube wells | 28.90 | Rs.400/kW/month |
| D-1(b) SCARP, 5 kW and above | Peak 42.79; off-peak 34.71 | Rs.400/kW/month |
| D-2(b) Agricultural, 5 kW and above | Peak 29.54; off-peak 28.69 | Rs.400/kW/month |
| Prepaid agriculture / SCARP | 33.15/kWh in the notified schedule extraction | Rs.400/kW/month |

Under Tariff D the schedule specifies a minimum monthly charge of Rs.2,000 per consumer even when no energy is consumed. Consumers with sanctioned load below 5 kW may opt for ToU metering. Confirm whether the minimum amount supersedes or interacts with the fixed charge for the precise D tariff row in the latest applicable schedule. The calculation engine must apply the greater of the legally relevant minimum or the computed amount only when the tariff's text says to do so; it must not automatically stack both.

### 4.8 E — Temporary supply

| Category | Variable rate (Rs./kWh) | Fixed charge |
|---|---:|---:|
| E-1(a) Temporary residential | 52.89 | Rs.675/kW/month |
| E-1(b) Temporary commercial | 53.44 | Rs.8,000/consumer/month |
| E-2 Temporary industrial | 42.25 | Rs.5,000/consumer/month |

For temporary supply, verify the connection's precise sanction letter and bill tariff code. Do not calculate refundable security deposit as a recurring monthly bill component.

### 4.9 F — Seasonal industrial supply

The 2026 schedule specifies seasonal industrial supply at **123% of the relevant industrial tariff**. The consumer's selected seasonal option remains governed by the schedule's option conditions; the tariff can be changed at new connection or beginning of season and remains in force for at least one year once exercised. Apply the relevant industrial tariff category and the 123% multiplier only after verifying the current tariff text and fixed-charge treatment.

### 4.10 G / H / K / I — specialist classes

| Category | Description | GoP applicable rate | Fixed charge |
|---|---|---:|---:|
| G | Public / street lighting | Rs.42.91/kWh | Rs.8,000/consumer/month |
| H | Residential colonies attached to industrial premises | Rs.42.10/kWh | Rs.2,000/consumer/month |
| I | Railway traction | Rs.42.39/kWh | Rs.2,000/consumer/month |
| K | Special contracts (e.g., AJK / Rawat Lab) | Contract/schedule specific | Schedule specific |

K category should be handled through a specialist configuration, not guessed from a normal residential or commercial choice.

### 4.11 Electric Vehicle Charging Stations (EVCS)

EV charging has had separate policy/tariff changes. Do not assume the old or previously discussed EVCS rate (including Rs.23.57/kWh) is current without reading the current NEPRA and Government notification. Implement it as its own category only after importing the current EVCS notification and its effective period. FCA exemption for EVCS has been stated in relevant FCA decisions; QTA exemption must be read from the applicable QTA notification.

---

## 5. Monthly adjustments: FCA/FPA and QTA

These are not permanent base tariff rates. They must be stored as dated adjustment records.

### 5.1 Fuel Charges Adjustment (FCA; often printed as FPA)

FCA compensates for differences between actual fuel-related cost and the reference component. NEPRA reviews and notifies it periodically, normally monthly. A positive amount increases the bill; a negative value is a credit.

**Verified recent history / status at the 6 November 2026 research snapshot:**

| Fuel consumption month | FCA (Rs./kWh) | Bill month stated in decision/reporting | Status |
|---|---:|---|---|
| July 2026 | +2.0581 | September 2026 | Notified; historical |
| August 2026 | +1.1086 | October 2026 | Notified; historical |
| September 2026 | +2.5624 requested | November 2026 was the expected recovery cycle | **Request / hearing status, not to be treated as approved unless final NEPRA notification is found** |

The 16 October 2026 Power Division statement described the September FCA as a projection/request of about Rs.2.56/kWh. A later secondary tracker reported a NEPRA hearing on 29 October with decision pending/reserved. On the research date, the calculator must therefore not label Rs.2.5624 as a final approved rate unless the agent finds the subsequent NEPRA decision or Gazette notification.

**Important:** Do not carry the August FCA of Rs.1.1086 automatically into November. The notification identified it for October billing. Each FCA record needs a specific `effectiveBillMonth` (or effective range) in addition to the consumption month.

Exemptions stated in recent FCA notices include lifeline consumers, EV charging stations and consumers who opted for prepaid tariff. The exact category list must be taken from each individual FCA notification.

### 5.2 Quarterly Tariff Adjustment (QTA)

For the second quarter of calendar year 2026 (April–June 2026), a positive QTA of **Rs.0.5194/kWh** was notified for billing months **September, October and November 2026**. The relevant NEPRA decision is listed on the LESCO page in September 2026; secondary reporting identifies S.R.O. 1501(I)/2026 dated 7 September 2026.

The same order's stated exemptions include lifeline, incremental-consumption-package billed units and prepaid consumers. Read the notification before applying to any category. A hearing notice for the following quarter is not an approved QTA; as of 6 November 2026, the next quarter's amount must remain unset until a final decision/notification appears.

### 5.3 Adjustment implementation model

```text
adjustmentAmount = eligibleUnits * ratePerKWh
```

But `eligibleUnits` must be defined by the relevant notification. Do not assume every adjustment uses the same unit base. If the official order does not provide a usable basis in the extracted content, default to a manual/verified bill line rather than inventing it.

Each adjustment needs:

- `type`: FCA or QTA
- `ratePerKWh`: signed decimal; positive charge, negative credit
- `consumptionMonth` (for FCA) or `recoveryQuarter` (for QTA)
- `effectiveBillMonths`: explicit start/end or month list
- `eligibleCategories` and `exemptCategories`
- `eligibleUnitsBasis`: e.g. `current_bill_units`, `import_units`, or `manual`
- `status`: requested / hearing / decided / notified / expired
- `notificationNumber`, `notificationDate`, `sourceUrl`

Never combine multiple historical FCAs merely because they were issued in adjacent months. A bill month should use only the FCA notified to apply to that bill month.

---

## 6. Taxes, duties and other bill lines

### 6.1 GST / Sales Tax

The Sales Tax Act 1990 as amended through 30 June 2027 (including Finance Act 2026) shows the standard rate of **18%**. The Power Division FAQ still displays 17%, which is stale relative to the current statutory rate. Use the current law and applicable notifications, not that old FAQ figure.

For an estimate:

`GST = GST_RATE * configuredGSTTaxableBase`

Use `GST_RATE = 0.18` as the standard starting point, but make the tax base a configurable function driven by the current statutory definition and actual LESCO bill layout. The Sales Tax Act's value-of-supply definition is broader than energy charges alone and includes relevant charges, surcharges, rents, commissions, duties and taxes, while excluding sales tax itself and, as stated in the relevant definition, late payment surcharge. Verify the current exact statutory definition and any exclusions before production release.

Recommended first version:

- Show the GST base as an expandable calculation detail.
- Do not simply calculate GST on energy charges only.
- Do not add GST to income tax itself.
- Exclude GST from its own base.
- Exclude late payment surcharge from GST base where the law says so.
- Compare the result with multiple current masked LESCO bills before describing it as bill-exact.

### 6.2 Punjab Electricity Duty (ED)

The Punjab duty schedule reference states the following rates on variable/supply charges:

| Consumer type | Duty rate |
|---|---:|
| Domestic | 1.5% |
| Commercial | 1.5% |
| Industrial undertaking | 1.0% |
| Irrigation tube wells / agricultural machinery | 1.0% |
| Unmetered supply | 1.5% |

The Punjab Energy Department lists the Punjab Electricity Duty Rules 2012. Use a current Punjab Gazette / rules source to confirm the precise assessment base and any exemptions before launch. The `ioekp.gov.pk` rate page is a useful cross-check but is not a Punjab-specific LESCO source.

Suggested configurable formula:

`electricityDuty = dutyRate * dutyTaxableBase`

For a provisional consumer estimate, set `dutyTaxableBase` to the notified applicable variable/supply charges, not the fixed charge, unless current Punjab rules or the bill establish a different base. Do not include a provincial duty for a consumer category without checking its schedule/exemption.

### 6.3 Financing Cost (FC) Surcharge

Power Division guidance lists a financing cost surcharge of **Rs.0.43/kWh**, exempting lifeline domestic consumers. Because the FAQ can lag behind later notifications, keep this as a configurable rate with current-notification status. Do not assume it applies to prepaid, EVCS, or every special category without checking the current schedule.

`fcSurcharge = eligibleUnits * fcRate`

### 6.4 Advance income tax / withholding tax — Section 235

Use FBR's **Tax Year 2027** rate card (1 July 2026 through 30 June 2027, updated up to 30 June 2026). The rates shown by the current rate-card reporting are:

| Consumer type | Monthly gross bill | Section 235 advance tax |
|---|---|---|
| Domestic on ATL | Any | Nil |
| Domestic not on ATL | Below Rs.25,000 | Nil |
| Domestic not on ATL | Rs.25,000 or more | 7.5% of gross bill |
| Commercial | Up to Rs.500 | Nil |
| Commercial | Above Rs.500 up to Rs.20,000 | 10% of gross bill |
| Commercial | Above Rs.20,000 | Rs.1,950 + 12% of amount above Rs.20,000 |
| Industrial | Up to Rs.500 | Nil |
| Industrial | Above Rs.500 up to Rs.20,000 | 10% of gross bill |
| Industrial | Above Rs.20,000 | Rs.1,950 + 5% of amount above Rs.20,000 |

The domestic line is determined by ATL status (not a generic assumption that every filer/non-filer pays the same tax). For commercial and industrial categories, the section 235 table does not show a simple filer/non-filer rate split in the same way; do not automatically double rates based on filer status. Apply relevant Tenth Schedule/exception rules from current tax law.

The bill amount used for Section 235 is described in law as inclusive of sales tax and incidental charges. Implement the threshold on a configurable `grossBillForSection235` computed before adding Section 235 itself. This tax is advance income tax and its final tax treatment (minimum/adjustable) can depend on taxpayer type and other law; it is a cash amount on the electricity bill, not an energy tariff.

**Threshold edge-case:** At Rs.20,000 the 10% middle-band calculation yields Rs.2,000. Above Rs.20,000 the top-band formula begins at Rs.1,950 + 12% (commercial) or +5% (industrial) of excess. This can make the formula discontinuous. Reproduce the wording of the current statute/rate card exactly; do not “smooth” the formula without legal authority.

**Data confidence:** FBR's official website confirms a Tax Year 2027 PDF and XLSX rate card. Download and parse the official card in the implementation; verify the Section 235 row directly before production. The figures above are corroborated by current published tax-rate reporting, but the official FBR attachment fetch timed out during this research.

### 6.5 PTV fee — do not charge by default

Older Power Division FAQ text still lists Rs.35 domestic / Rs.60 commercial PTV fee. A later Power Division official statement records abolition of the Rs.35-per-bill PTV fee, and reports state discontinuation from 1 July 2025. For a 2026 LESCO estimator, set PTV fee to **zero / disabled by default**. Retain a manual line item only if an actual current bill contains it or a later notification reintroduces it.

### 6.6 Extra tax / further tax / sales tax variants

Do not automatically add old values from the Power Division FAQ for `Extra Tax`, `Further Tax`, 5% / 7.5% sales tax categories, or any unregistered-consumer surcharge. The FAQ is not a complete current 2026 legal rate card. The current Sales Tax Act contains an 18% standard rate and a 4% further-tax provision in section 3(1A), subject to statutory exceptions and notifications. Whether a particular electricity supply line is subject to further tax / a special extra-tax rate depends on the exact legal notification, customer registration status and class. Make such lines configurable and default them to zero until a current specific notification and bill evidence is verified.

### 6.7 Meter rent and service rent

Do not automatically invent recurring meter rent or service rent.

The 2025 NEPRA Consumer Service Manual states that where the consumer has paid the cost of the metering installation, meter rent is not charged. If the meter is owned by the DISCO or a special rental arrangement applies, the legal basis and amount must be checked against the current schedule / agreement. `Service rent` was not verified as a universal recurring LESCO fee in the tariff sources reviewed.

Implementation:

- `meterRent`: manual amount, default zero, display only if supplied from a bill or verified rule.
- `serviceRent`: manual amount, default zero, display only if supplied from a bill or verified rule.
- Never label a fixed monthly tariff charge as meter rent.

### 6.8 Other user-specific bill lines

Support optional, independently editable values for:

- Previous arrears / balance forward.
- Instalment amount.
- Deferred amount.
- Late-payment surcharge (LPS).
- Detection bill / assessment amount.
- Meter rent / service rent, if actually billed and supported.
- Other tax / surcharge line from an actual bill.
- Subsidy or credit.
- Bill adjustment / correction / refund.

These should default to zero or not be shown. Require a source label or user entry. Do not include them in the tariff engine's energy calculations.

### 6.9 Security deposit / new connection fees are not monthly bill lines

Security deposit, connection charges, meter installation costs, load-extension fees and application fees belong in a separate **new connection / service-cost estimator**, not the recurring bill calculator. NEPRA Consumer Service Manual Annex IV contains security-deposit schedules by connection class and area; use the current annex and connection type if a separate tool is built.

---

## 7. Bill calculation architecture

Use a pure calculation engine with no UI-specific assumptions. Inputs and tariff data should be versioned and testable.

### 7.1 Calculation steps

Recommended pipeline:

1. Validate inputs and normalize units, meter multiplier and billing days.
2. Resolve the tariff code and effective tariff version for the bill month.
3. Resolve eligibility (lifeline/protected/unprotected/ToU/prepaid/industry/etc.).
4. Compute billable energy units (import units for normal meter; separate net-metering rules for bi-directional meter).
5. Compute tariff variable energy charge.
6. Compute fixed charge, minimum charge or tariff-specific minimum bill rule.
7. Compute FCA/FPA and QTA using the bill-month schedule and category exemptions.
8. Compute FC surcharge if active and eligible.
9. Compute Punjab Electricity Duty using its current taxable base.
10. Compute GST using current law and configured GST base.
11. Compute Section 235 tax using the gross bill before withholding tax.
12. Add manual bill-specific items (arrears, instalments, corrections, meter rent, etc.).
13. Compute due-date payable total and, only if reliable, post-due-date total.
14. Round each printed bill line according to LESCO's actual bill behavior; do not round every kWh multiplication prematurely.
15. Return a component-level explanation, rate versions, sources and confidence labels.

The exact tax ordering/base must be configured from law and validated against real current LESCO bills. The above is a calculation pipeline, not a claim that every bill prints the lines in that exact order.

### 7.2 Energy charge formulas

**Non-ToU fixed unit tariff:**

`energyCharge = units * applicableRate`

For unprotected domestic, `applicableRate` is the row selected by total monthly units. For protected consumers use the notified one-previous-slab benefit logic. Lifeline logic must follow the no-slab-benefit rule.

**Protected domestic:**

```text
if units <= 100:
    energy = units * 10.54
else if units <= 200:
    energy = 100 * 10.54 + (units - 100) * 13.01
else:
    not_protected_by_current_consumption band; require classification/history
```

Do not allow a protected selection above 200 units unless the current rules explicitly provide an exception or the consumer's pro-rata billing rule preserves protection for that cycle.

**Unprotected domestic:**

```text
row = bandForTotalConsumption(units)
energy = units * row.rate
fixed = sanctionedLoadKW * row.fixedRatePerKW
```

**Commercial/industrial ToU:**

`energy = peakUnits * peakRate + offPeakUnits * offPeakRate`

Fixed charge is calculated once for the bill, not once for peak and once for off-peak.

**Fixed per consumer:**

`fixedCharge = tariff.fixedPerConsumer`

**Fixed per kW:**

`billingDemandKW = max(loadFactor * sanctionedLoadKW, actualMDIKW)`

`fixedCharge = billingDemandKW * fixedRatePerKWPerMonth`

The `loadFactor` is tariff-specific:

- A-1 non-ToU domestic: 100% of sanctioned load.
- A-1 ToU domestic: 50% of sanctioned load or MDI, whichever is higher.
- A-2 commercial 5 kW and above: 35% of sanctioned load or MDI, whichever is higher.
- A-3 / B industrial / C single-point rows with Rs./kW/month fixed charges: 25% of sanctioned load or MDI, whichever is higher, where that specific schedule footnote applies.
- Do not use one universal percentage for every tariff.

### 7.3 Pro-rata billing periods

The Consumer Service Manual explains pro-rata handling where a normal billing cycle is extended or shortened. A user can have a billing period other than 30 days. Provide optional inputs:

- `billingDays`
- `standardBillingDays` (default 30, configurable)
- `meterReadStartDate`
- `meterReadEndDate`

Do not simply multiply all charges by `billingDays / 30` without tariff-specific treatment. At a minimum, implement a manual mode with clear assumptions. A future advanced mode should reproduce the CSM pro-rata consumption thresholds and carry-forward procedure for lifeline and protected consumers.

### 7.4 Meter multiplier

Some commercial/industrial meters use a multiplying factor. If the customer enters meter readings:

`rawDelta = currentReading - previousReading`

`units = rawDelta * meterMultiplier`

Validate `currentReading >= previousReading` unless rollover is configured. The user should be able to enter already-billed units directly to avoid error. Show the multiplier in the result when used.

---

## 8. Required input model / UI fields

### 8.1 Required inputs for a typical residential estimate

- Bill month (month + year).
- Consumer category: residential A-1.
- Consumed units, or previous/current meter readings.
- Connection phase: single-phase / three-phase.
- Sanctioned load (kW).
- Lifeline / protected / unprotected eligibility; ask for history where possible.
- ATL status only for applicable Section 235 domestic withholding tax.
- Whether the meter is ToU / prepaid.

### 8.2 Inputs for commercial/industrial

- Tariff category (A-2, A-3, B1/B2/B3/B4, C1/C2/C3, etc.).
- Sanctioned load (kW).
- MDI (kW) if fixed charge depends on MDI.
- Regular / ToU / prepaid.
- Peak units and off-peak units for ToU.
- Bill month.
- STRN / sales-tax registration status only if a current notification makes it relevant to a specific tax.
- ATL status where relevant for Section 235 / tax law.

### 8.3 Advanced optional inputs

- Billing days.
- Meter multiplier.
- Import/export units (show a net-metering warning; do not treat as ordinary domestic units).
- FPA/FCA override and its bill-month reference.
- QTA override and its effective bill-month range.
- FC surcharge override.
- Electricity duty override.
- GST base override.
- Gross bill for Section 235 override.
- Manual charges/credits.
- Existing bill comparison (upload or type line items, ideally masked).

### 8.4 UX principles

- Do not expose every expert field on the first screen. Start with connection type and usage, then show only relevant fields.
- Explain “protected” and “lifeline” eligibility, including consumption history requirements.
- Show which rates are notified, provisional or manually entered.
- Provide “simple estimate” and “advanced / bill-match” modes.
- Include an “I don't know” choice for tariff code, MDI, sanctioned load and ATL. If essential fields are unknown, use a labelled assumption or provide a range instead of fake precision.
- Include a reset button.
- Keep the result itemised and expandable.
- Display the month/notification version used in the final result.
- Mobile-first layout; use Rs formatting and clearly mark PKR.

---

## 9. Result structure

Return both numeric totals and a detailed list of components. Suggested JSON:

```json
{
  "currency": "PKR",
  "billMonth": "2026-11",
  "consumerCategory": "A1_DOMESTIC_UNPROTECTED",
  "units": 250,
  "tariffVersion": "SRO-279-I-2026",
  "calculationStatus": "ESTIMATE_WITH_ASSUMPTIONS",
  "components": [
    {"code":"ENERGY","label":"Electricity charges","amount":8275.00,"sourceStatus":"NOTIFIED"},
    {"code":"FIXED","label":"Fixed charges","amount":700.00,"sourceStatus":"NOTIFIED"},
    {"code":"QTA","label":"Quarterly tariff adjustment","amount":129.85,"sourceStatus":"NOTIFIED"},
    {"code":"FCA","label":"Fuel charges adjustment","amount":null,"sourceStatus":"NOT_AVAILABLE"},
    {"code":"GST","label":"General sales tax","amount":null,"sourceStatus":"CALCULATED_WITH_CONFIGURED_BASE"},
    {"code":"WHT_235","label":"Advance income tax","amount":0,"sourceStatus":"CURRENT_LAW"}
  ],
  "subtotalBeforeTaxes": null,
  "estimatedTotal": null,
  "assumptions": [],
  "warnings": [],
  "sources": []
}
```

The numbers in this example are illustrative for the energy and fixed lines only. GST, FCA and final bill are not shown as complete because the relevant bases/rates must be resolved.

Suggested user-visible footer:

> This is an estimate based on the tariff version and monthly adjustments listed above. Your actual LESCO bill may differ due to billing dates, consumer classification, MDI, taxes, exemptions, meter multiplier, arrears, corrections, or later notifications. Use your LESCO bill as the final amount.

---

## 10. November 2026 reference configuration

This is a **research snapshot**, not an automatic future default. The AI agent should fetch final notifications before release.

| Parameter | Value | Status / note |
|---|---:|---|
| Base tariff schedule | S.R.O. 279(I)/2026 | Notified 12 Feb 2026; use consumer-end GoP column |
| QTA | +Rs.0.5194/kWh | Notified; applies Sep–Nov 2026; specified consumer exemptions |
| FCA for July 2026 consumption | +Rs.2.0581/kWh | Notified for Sep 2026 billing; historical |
| FCA for August 2026 consumption | +Rs.1.1086/kWh | Notified for Oct 2026 billing; historical |
| FCA for September 2026 consumption | +Rs.2.5624/kWh requested | Provisional request / hearing status in sources checked; **not final default** |
| FC surcharge | Rs.0.43/kWh | Official Power Division FAQ value; verify active status and category exemptions before enabling |
| GST | 18% statutory standard rate | Configure base and category applicability from current Sales Tax Act / notification |
| Punjab electricity duty | Domestic/commercial 1.5%; industrial/agri 1.0% | Verify present Punjab tax schedule and taxable base before production |
| WHT Section 235 | TY2027 rates in §6.4 | Parse current official FBR card before production |
| PTV fee | Rs.0 default | Abolished effective 1 July 2025 according to official Power Division statement |
| Meter rent / service rent | Rs.0 default / manual-only | Do not invent; use bill evidence or specific current rule |

The official NEPRA LESCO index shows decisions for July FCA and Q2 CY2026 QTA in September. Dawn reported the August FCA notification on 8 October and the September FCA request around mid-October. A 5 November hearing notice for the next QTA does not itself create a new rate. A request/hearing must never be presented as a notified rate.

---

## 11. Example calculations / regression tests

The tests below are for the tariff/energy/fixed-charge layer before monthly adjustments and taxes unless explicitly stated.

| Test ID | Scenario | Expected result |
|---|---|---|
| R-01 | Protected A-1, 100 units, 2 kW sanctioned load | Energy 100×10.54=1,054; fixed 2×200=400; pre-tax/pre-adjustment subtotal Rs.1,454 |
| R-02 | Protected A-1, 150 units, 2 kW | Energy 100×10.54 + 50×13.01 = 1,704.50; fixed 2×300=600; subtotal Rs.2,304.50 |
| R-03 | Protected A-1, 200 units, 2 kW | Energy 1,054 + 100×13.01 = 2,355; fixed 600; subtotal Rs.2,955 |
| R-04 | Unprotected A-1, 201 units, 2 kW | Band 201–300; energy 201×33.10=6,653.10; fixed 2×350=700; subtotal Rs.7,353.10 |
| R-05 | Unprotected A-1, 250 units, 2 kW | Energy 250×33.10=8,275; fixed 700; subtotal Rs.8,975 |
| R-06 | A-2 commercial below 5 kW, 300 units | Energy 300×37.44=11,232; fixed Rs.1,000; subtotal Rs.12,232 |
| R-07 | A-2 commercial >=5 kW, 300 units, 10 kW sanctioned, MDI=2 kW | Billing demand=max(35%×10=3.5,2)=3.5 kW; fixed=3.5×1,250=4,375; energy=300×39.76=11,928; subtotal Rs.16,303 |
| R-08 | A-1 ToU, 100 peak + 200 off-peak | Energy=100×46.85 + 200×34.53=11,591; fixed demand basis=max(50% sanctioned, MDI), ×675 |
| R-09 | A-3 250 units | Energy=250×42.48=10,620; fixed=1,000; subtotal=11,620 |
| R-10 | B-1 non-ToU, 250 units | Energy=250×26.23=6,557.50; fixed=1,000; subtotal=7,557.50 |
| R-11 | B-2 non-ToU, 1,000 units, load 40 kW, MDI 8 kW | Billing demand=max(25%×40=10,8)=10 kW; fixed=12,500; energy=26,160; subtotal=38,660 |
| R-12 | QTA +0.5194 on 250 eligible units | Rs.129.85 adjustment |
| R-13 | FCA -0.0102 on 250 eligible units | Rs.-2.55 credit (signed negative) |
| R-14 | No units, A-1 single-phase with no fixed charge applying | Minimum monthly customer charge Rs.75, not zero |
| R-15 | No units, A-1 three-phase with no fixed charge applying | Minimum monthly customer charge Rs.150, not zero |
| R-16 | No units, A-1 row with fixed charge applying | Do not also add the Rs.75/Rs.150 minimum; apply fixed charge per schedule |
| R-17 | Domestic ATL with bill over Rs.25,000 | Section 235 domestic tax nil under TY2027 table, subject to current statute |
| R-18 | Domestic non-ATL, gross bill Rs.25,000 | Section 235 = 7.5% × 25,000 = Rs.1,875 |
| R-19 | Commercial gross bill exactly Rs.20,000 | Section 235 = 10% × 20,000 = Rs.2,000 |
| R-20 | Commercial gross bill Rs.20,001 | Section 235 = 1,950 + 12% × 1 = Rs.1,950.12; preserve printed formula |
| R-21 | Lifeline consumer | Exclude FCA/QTA/FC surcharge only according to the actual current notification's exemption list; do not assume all bill taxes are exempt |
| R-22 | Prepaid category | Apply its own notified tariff and adjustment exemptions; never run ordinary slab logic |

Use decimal arithmetic (e.g., integer paisa or decimal library) for financial calculations. Do not use binary floating point for final bill rounding. Build explicit tests for 50/51, 100/101, 200/201, 300/301, 400/401, 500/501, 600/601, 700/701 units.

---

## 12. Data model proposal

### 12.1 Tariff table

```json
{
  "id": "A1_UNPROTECTED_201_300",
  "disco": "LESCO",
  "class": "DOMESTIC",
  "tariffCode": "A-1",
  "subCategory": "UNPROTECTED",
  "meterMode": "NON_TOU",
  "minUnits": 201,
  "maxUnits": 300,
  "energyRate": 33.10,
  "energyRateUnit": "PKR_PER_KWH",
  "fixedRate": 350,
  "fixedRateUnit": "PKR_PER_KW_MONTH",
  "fixedDemandFactor": 1.0,
  "fixedDemandMethod": "SANCTIONED_LOAD",
  "effectiveFrom": "2026-02-12",
  "effectiveTo": null,
  "notification": "SRO 279(I)/2026",
  "sourceUrl": "https://www.nepra.org.pk/tariff/Tariff/Ex-WAPDA%20DISCOS/2026/TRF-100%20XWDISCOS%20AND%20KE%20RATIONALIZATION%20OF%20TARIFF%2011-02-2026%202935-57.pdf",
  "status": "NOTIFIED"
}
```

### 12.2 Monthly adjustment table

Fields: `id`, `component`, `ratePerKWh`, `positiveOrNegative`, `consumptionMonth`, `effectiveBillMonths`, `eligibleCategories`, `exemptCategories`, `unitsBasis`, `status`, `notificationNumber`, `notificationDate`, `effectiveFrom`, `effectiveTo`, `sourceUrl`, `lastVerifiedAt`, `notes`.

### 12.3 Tax configuration table

Fields: `taxCode`, `jurisdiction`, `consumerCategories`, `rate`, `calculationMethod`, `taxableBaseExpression`, `thresholds`, `ATLRule`, `STRNRule`, `effectiveFrom`, `effectiveTo`, `sourceUrl`, `status`.

### 12.4 Bill calculation snapshot

Persist the complete rate versions used when an estimate is calculated, so that an estimate can be reproduced later even after the tariff table changes. Store the user's inputs and result only with privacy-conscious retention and no account credentials. Do not store full reference numbers or personal information unless the user explicitly needs saved history.

---

## 13. Suggested implementation architecture

### Front end

- React / Next.js or another existing application framework.
- Form state with schema validation (Zod or equivalent).
- Conditional form fields based on tariff category.
- An itemised bill panel and “how this was calculated” drawer.
- “Rate source / last checked” indicator on every dynamic component.

### Calculation engine

Create a pure module with no network, React state or browser dependency:

```ts
type Money = number; // In production use Decimal or integer paisa.

type EstimateInput = {
  billMonth: string; // YYYY-MM
  tariffCode: string;
  units?: number;
  peakUnits?: number;
  offPeakUnits?: number;
  previousMeterReading?: number;
  currentMeterReading?: number;
  meterMultiplier?: number;
  sanctionedLoadKW?: number;
  actualMDIKW?: number;
  phase?: "SINGLE" | "THREE";
  lifelineEligible?: boolean;
  protectedEligible?: boolean;
  atlStatus?: "ATL" | "NON_ATL" | "UNKNOWN";
  billingDays?: number;
  manualCharges?: Array<{ code: string; label: string; amount: Money }>;
};

function calculateBill(input: EstimateInput, rateSnapshot: RateSnapshot): EstimateResult {
  // 1. Validate input.
  // 2. Resolve tariff record by category + billing month.
  // 3. Resolve consumer eligibility.
  // 4. Calculate energy charge.
  // 5. Calculate fixed/minimum charge.
  // 6. Apply effective FCA/QTA and exemptions.
  // 7. Calculate taxes using explicit tax-base functions.
  // 8. Add user-supplied bill lines.
  // 9. Return component rows, warnings, assumptions, source metadata.
}
```

### API routes (if backend is required)

- `GET /api/tariffs?disco=LESCO&month=2026-11`
- `GET /api/adjustments?disco=LESCO&billMonth=2026-11`
- `POST /api/estimate`
- `GET /api/sources/status`
- Admin-only: `POST /api/admin/tariffs/import`, `POST /api/admin/adjustments/import`, `POST /api/admin/taxes/import`

A static-data MVP can run entirely client-side with a versioned JSON file; dynamic rates still need a controlled update process.

---

## 14. Dynamic source monitoring and rate updates

Do not scrape random calculator pages. Create a review queue that checks the following official pages:

1. NEPRA LESCO distribution page: tariff changes and LESCO-indexed FCA/QTA decisions.
2. NEPRA decisions/notifications page for XWDISCO FCA and periodic adjustments.
3. Government Gazette/SRO notification referenced by NEPRA.
4. FBR current tax rate card and Sales Tax Act amendments.
5. Punjab legislation / Finance Department gazette / Punjab Electricity Duty Rules.
6. LESCO/PITC consumer-bill line labels and bill format.

### 14.1 Update workflow

1. Fetch new notification listing.
2. Detect documents with new date, SRO number, FCA/FPA/QTA, tariff, sales tax, tax rate or duty amendment.
3. Download and retain original PDF/XLSX as a source artifact.
4. Extract tables, but visually inspect PDF table pages if OCR/text extraction is ambiguous.
5. Compare extracted data with the current active rate set.
6. Create a candidate version with an effective date, source URL, notification number, status and review notes.
7. Run all tariff and bill tests against the candidate version.
8. Require human approval for tax-base changes, category exemptions, OCR ambiguities and any rate with material impact.
9. Publish the new rate set only after the approval step.
10. Keep historic rows immutable; set `effectiveTo` rather than overwriting them.

### 14.2 Do not auto-publish on a hearing notice

A petition, requested FCA, projected QTA, public hearing notice, news leak or ministerial estimate is not an approved tariff. Store it as `REQUESTED` or `PROVISIONAL`; never use it in the official-looking main result.

### 14.3 Source parsing

- Prefer direct NEPRA/Gazette files over HTML snippets.
- Preserve source document page number and table/row label alongside each parsed rate.
- For scanned tables, use PDF page screenshots and human confirmation; do not rely only on OCR.
- Detect a table's header before reading a numeric column. In particular, distinguish `Uniform Determined Tariff` from `GoP Applicable Variable Charges`.
- Save the exact source document hash and retrieval date.

---

## 15. Privacy, security and reliability

- A public estimate does not need a LESCO reference number, CNIC, name, phone number, address or account password.
- If users upload a bill, advise them to mask name, reference number, address, QR code and barcode unless those fields are actually required.
- Do not collect or transmit utility account credentials.
- Never represent an unofficial API or scraped billing portal as an authorised LESCO integration.
- Rate updates should be auditable, versioned and reversible.
- A tariff update must not retroactively change old saved estimates.
- Add a “data not verified for selected billing month” warning when an adjustment is missing.
- Make the app usable when the rate-update source is unavailable by using the last verified rate but clearly showing its last verification date.

---

## 16. Exclusions and specialist work required

1. **Net metering / distributed generation:** imports, exports, netting, banking, buyback rates, meter direction and regulatory regime must be built separately. Do not subtract exports from imports using ordinary A-1 rates.
2. **Solar export / net billing changes:** check current NEPRA Prosumer Regulations and subsequent amendments before implementing.
3. **Demand penalties / power factor / reactive energy:** industrial bills may include specialised items beyond basic per-unit tariff.
4. **Detection bills / assessment bills:** separate legal calculation under NEPRA CSM; not ordinary usage estimate.
5. **Late payment surcharge:** do not guess the amount or formula; use a current notified rule and bill date.
6. **New connection / security deposit:** separate tool; not a monthly bill component.
7. **Load extension / reconnection / meter installation:** separate service-cost module.
8. **Government subsidy packages / incremental consumption packages:** implement only with exact current eligibility, period and notification.
9. **Special contracts / K tariff / railway traction / EVCS:** specialist configuration from the precise current notification.
10. **Tax exemptions:** must be consumer/category/registration-specific and grounded in current law; do not infer only from the word “filer”.

---

## 17. Acceptance criteria

The calculator is ready for public beta only if:

- It supports domestic protected, unprotected and lifeline rules with eligibility handling and correct fixed charges.
- It supports domestic ToU and separate peak/off-peak entries.
- It supports commercial A-2 below 5 kW and 5 kW+ with the correct separate fixed-charge rule, including the 35% demand basis where applicable.
- It supports A-3 and at least B-1/B-2 industrial tariffs or clearly labels them “coming soon”.
- It can use a selected bill month and refuses to treat a provisional monthly adjustment as notified.
- It includes current tariff source, notification number, date and rate confidence.
- It itemises energy, fixed charges, FCA, QTA, FC surcharge, duty, GST, WHT and manual items separately.
- It avoids adding discontinued PTV fee by default.
- It never auto-adds meter rent/service rent without a verified rule or user-entered actual amount.
- It handles 0 units, negative/invalid inputs, meter rollover, very large loads, ToU totals and all tariff thresholds.
- It uses exact decimal arithmetic and consistent rounding.
- It reproduces the regression tests in §11.
- It has a clear disclaimer and never claims to provide an official LESCO bill.

---

## 18. Corrections and cautions versus preliminary informal figures

This specification intentionally supersedes rough figures and assumptions that may have appeared in an earlier discussion:

- A-2 commercial 5 kW+ fixed-charge demand factor is **35%** of sanctioned load or actual MDI, whichever is higher, according to the A-2 schedule footnote. Do not apply the 25% factor used in other tariff classes.
- The 25% factor applies to the relevant A-3 / industrial / single-point categories where their own footnotes say so; it is not universal.
- A-1 domestic fixed charges were added/revised in the February 2026 tariff package. Old calculators that omit these charges are outdated.
- Do not use 17% GST from the Power Division FAQ; the current Sales Tax Act states 18% standard rate, subject to any specific exception.
- Do not add the old PTV Rs.35/Rs.60 fee by default; Power Division later recorded abolition effective 1 July 2025.
- Do not carry +Rs.1.1086 August FCA into every later bill. Its notification specified October 2026 billing. Each adjustment is bill-month-specific.
- Do not treat the +Rs.2.5624 September FCA request as approved without the final NEPRA decision.
- Meter rent is not a universal fixed monthly fee. The Consumer Service Manual states meter rent is not charged where the consumer has borne the cost of the metering installation; any other rental must have a specific legal/contract basis.
- Do not charge a generic service rent, TV fee, Neelum-Jhelum surcharge, Extra Tax or Further Tax just because an old FAQ or third-party calculator lists it. Confirm the current legal authority and category applicability.

---

## 19. Primary and secondary reference list with purpose

| Source | URL | What the agent should extract |
|---|---|---|
| NEPRA LESCO tariff index | https://nepra.org.pk/tariff/Distribution%20LESCO.php | Dated LESCO-specific tariff/FCA/QTA decisions and SRO references |
| NEPRA SRO 279 tariff decision | https://www.nepra.org.pk/tariff/Tariff/Ex-WAPDA%20DISCOS/2026/TRF-100%20XWDISCOS%20AND%20KE%20RATIONALIZATION%20OF%20TARIFF%2011-02-2026%202935-57.pdf | 2026 category schedules, unit rates, fixed charge values, load factors, special categories |
| NEPRA/Federal Government notification copy | https://nepra.org.pk/Admission%20Notices/2026/02%20Feb/Complete%20motion%20alogwith%20Annexs_260206_150050.pdf | SRO 279(I)/2026, effective notification and uniform tariff decision |
| NEPRA Consumer Service Manual 2025 | https://nepra.org.pk/Legislation/7-Manuals/2025/CONSUMER%20SERVICE%20MANUAL%20%28CSM%29%20REVISED%202025.pdf | Metering, billing days, pro-rata consumption, meter rent conditions, bill contents and service procedures |
| FBR TY2027 WHT rate card | https://www.fbr.gov.pk/withholding-taxes-rate-card/174298/174301 | Section 235 tax table and current Tax Year 2027 rules |
| Sales Tax Act updated 30 June 2027 | https://www.tipp.gov.pk/site/display/169 | Standard 18% rate, value-of-supply base, further tax and exceptions |
| FBR Sales Tax Act page | https://www.fbr.gov.pk/Categ/Sales-Tax-Act-1990/301/1000 | Latest statutory amendment files |
| Punjab Energy Department laws | https://energy.punjab.gov.pk/governing_laws_and_policies | Punjab Electricity Duty Rules 2012 and related provincial laws |
| Punjab Finance Act duty schedule (reference) | https://nasirlawsite.com/laws/pfa2007.htm | Text of Punjab Electricity Duty percentage schedule; retrieve official Gazette for final legal sign-off |
| Ministry of Energy FAQ | https://power.gov.pk/Detail/YThmNWQ5OGQtZGY5NC00NDk0LTgzN2MtZThhZTEzMTY5NTg2 | Definitions and FC surcharge explanation; contains stale GST/PTV entries—do not copy them blindly |
| Power Division official press statement | https://www.power.gov.pk/NewsDetail/ZDU4ZTNlMzUtMWVjYS00ZjRhLTk0YjMtOTYzZTFkNTM3ZDA5 | Confirms PTV fee abolition |
| PITC bill portal | https://bill.pitc.com.pk/ | Compare bill formats / real consumer bill entries |
| LESCO official portal | https://lesco.gov.pk/ | Consumer services and LESCO announcements |
| Dawn report, August FCA notification | https://www.dawn.com/news/2035673 | Cross-check +1.1086 FCA for August consumption, October billing |
| Dawn report, September FCA request | https://www.dawn.com/news/2037506 | Confirms September FCA request was a projection, not by itself an approved tariff |
| Dawn report, QTA notification | https://www.dawn.com/news/2027627 | Confirms +0.5194 QTA for Sep–Nov and category exclusions |

### 19.1 Sources to treat as non-authoritative

The following can be useful for discovering consumer questions or UI patterns, but should not supply production rates:

- Unofficial LESCO bill calculators / SEO blogs.
- Search snippets without opening the notification.
- Old government FAQs where the statutory rate has since changed.
- News reports without a linked NEPRA / SRO notification.
- Social media screenshots or unverified PDFs.

---

## 20. Final build instruction for the coding AI

Build the calculator as a **versioned rule engine**, not as a hardcoded formula that multiplies units by one rate. Keep tariff tables, monthly adjustments, tax law and user-entered bill-specific items in separate datasets. Load the February 2026 S.R.O. 279(I)/2026 tariff as the baseline version, then implement A-1 domestic first, A-2 commercial second, A-3/B industrial next, and mark specialist classes as advanced until their rules are fully validated. For each total, explain every line item, show the exact tariff/notification version and effective month, and disclose unresolved assumptions. Dynamic values must never be presented as final when they are merely requested or awaiting NEPRA notification. Use current official sources, retain historical versions, and make the calculator's estimate reproducible.

**End of specification.**
