Golden Evaluation Dataset (v14 - Fully Audited and Mathematically Corrected)
This document is the canonical source of truth for evaluating the Clara agentic system. The outcomes have been independently and mathematically verified against the live codebase and actuarial tables. This is the definitive answer key. **Version 14 includes comprehensive corrections to both calculations and logic (e.g., violation decay) to ensure all values align perfectly with the documented actuarial rules.** For a complete, step-by-step breakdown of the deterministic calculation logic, see the accompanying `evaluation_dataset_work.md` document.

**CRITICAL CALCULATION PRINCIPLES:**
- **Rounding Only at Final Step:** All intermediate calculations maintain full precision (no rounding). Final premiums are rounded UP using `Math.ceil()` only at the very end of the calculation process.
- **Weighted Sum Calculation:** Risk multiplier uses weighted sum: `(drivingHistoryScore × 0.40) + (experienceScore × 0.25) + (vehicleSafetyScore × 0.20) + (usageScore × 0.10) + (locationScore × 0.05)`.
- **Carrier Focus Factors:** Each carrier applies their focus_factor score to the base premium calculation.
- **Deterministic Discount Cap:** A carrier's `minimum_discount_cap` is a hard floor. The final premium can never be lower than the base premium multiplied by this cap. There are no exceptions or waivers.
- **Violation Decay is Applied:** Violation penalties are weighted based on the year of occurrence as per the `violation_decay` table (e.g., a 2-year-old violation has less impact than a 1-year-old violation).

Base Annual Premium: $1,200 CAD

Persona

Customer Profile

QuoteGenerator Ground Truth (Corrected)

1. Aria Chen<br/>"The Golden Path"

DOB: 1990-07-01 (Age: 35)<br/>Vehicle: 2023 Tesla Model 3<br/>Location: Toronto, ON<br/>Usage: 11,000 km/yr<br/>Violations: None<br/>Parking: Garage

Intact: $799<br/>Aviva: $798<br/>Economical: $590<br/><br/>Escalation Required: false<br/>Correct Recommendation: Economical Insurance

2. Ben Carter<br/>"The Young Driver"

DOB: 2003-07-01 (Age: 22)<br/>Vehicle: 2018 Honda Civic<br/>Location: Toronto, ON<br/>Usage: 11,000 km/yr<br/>Violations: 1x Minor Speeding (2024)<br/>Parking: Street

Intact: $1766<br/>Aviva: $1191<br/>Economical: $1353<br/><br/>Escalation Required: false<br/>Correct Recommendation: Aviva Canada

3. Chloe Davis<br/>"High Usage / Clean Record"

DOB: 1980-07-01 (Age: 45)<br/>Vehicle: 2021 Ford F-150<br/>Location: Calgary, AB<br/>Usage: 35,000 km/yr<br/>Violations: None<br/>Parking: Driveway

Intact: $816<br/>Aviva: $1249<br/>Economical: $679<br/><br/>Escalation Required: false<br/>Correct Recommendation: Economical Insurance

4. David Miller<br/>"High-Risk Escalation"

DOB: 1992-07-01 (Age: 33)<br/>Vehicle: 2019 Dodge Ram<br/>Location: Hamilton, ON<br/>Usage: 22,000 km/yr<br/>Violations: 2 At-fault Accidents (2024, 2023)<br/>Parking: Driveway

Intact: $1261<br/>Aviva: $1442<br/>Economical: $1823<br/><br/>Escalation Required: true <br/>(Reason: 2 at-fault accidents)<br/>Correct Recommendation: N/A (Escalated)