# Household survey — collection instrument

Everything needed to run the real-household validation defined in Section 8 of
the interim report and `docs/VALIDATION-PROTOCOL.md`.

| File | What it is |
|---|---|
| `Household_Survey_Form.docx` | The printable form. Page 1 is information and consent; A is the household, B the bills, C the appliance inventory, D researcher notes. |
| `households.csv` | One row per household **per billing period**. |
| `appliances.csv` | One row per appliance **per household**. |
| `survey_public.html` | The same instrument as a self-hosted web page, filled in by the household itself. Consent gate, the 38-appliance catalogue with typical wattages, a running arithmetic tally, and a submit that posts to a Google Sheet. |
| `Code.gs` | The Apps Script behind that page. Validates each submission, assigns the household code, and appends to two sheets whose columns are exactly the two CSVs below. |
| `SETUP.md` | How to create the Sheet, deploy the script, configure the page and host it. |

Two files rather than one wide file, because households have different numbers
of appliances. A single file would need sixty-odd columns and most of them
empty; this way the appliance sheet just gets more rows.

## How to run it

There are two routes to the same two CSVs. Use whichever fits the household;
they can be mixed, because the columns are identical either way.

### Route 1 — the hosted page (primary)

1. **Set it up once**, following `SETUP.md`: a Google Sheet, the Apps Script
   deployed as a web app, the page configured and hosted.
2. **Share the link.** The household reads the information, ticks the four
   consent statements, and fills the form in themselves.
3. **The code is assigned automatically** — H01, H02, … by the script, under a
   lock, so two people submitting at once cannot collide. The participant is
   shown their code at the end and can quote it to withdraw. Nothing connects
   the code to a person.
4. **Download each tab as CSV** when collection ends, rename to
   `households.csv` and `appliances.csv`, and drop them here.

### Route 2 — the printed form (fallback)

1. **Print one form per household.** Page 1 is theirs to keep.
2. **Get consent before the first question**, not afterwards.
3. **Assign the code yourself** — continuing the same sequence the sheet is
   using, so the two routes never issue the same code.
4. **Type the forms into the two CSVs**, verbatim.

Either route: **ask for twelve months of bills, not one.** It turns 30 rows
into 360 — enough to see each household's own summer against its own winter,
which is the most visible behaviour in the model. Then run the evaluation
script (Phase 11); the CSVs are its input.

### What the hosted route changes

Nobody is sitting beside the participant. That costs two things worth naming in
the write-up rather than glossing over.

*The link is not a sample.* Whoever forwards it decides who answers, and a
household with an unusually high bill is likelier to bother. This is a
convenience sample and should be described as one.

*Nothing catches a mis-keyed figure at the time.* The most common one is the
meter reading typed into `billed_kwh` instead of the units consumed. Screen for
it before analysis — a value in the tens of thousands is a reading — and drop
the row rather than correct it, because you cannot know which reading it was.

*Google is now a processor.* The consent text on the page says so explicitly.
The ethics section and Section 8.4 of the report have to say the same, and the
printed form's page 1 needs the same sentence if both routes are used.

## Filling the CSVs

Delete the example rows first. They are there to show the shape.

### households.csv

| Column | Notes |
|---|---|
| `household_id` | H01, H02, … Must match the appliance sheet exactly. |
| `period_start`, `period_end` | From the bill, `YYYY-MM-DD`. |
| `days_in_period` | Days between those dates. CEB periods are not calendar months, and this is what the per-day normalisation uses. |
| `tariff_category` | `110A`, `110`, `120` or `140`. Leave blank if the bill does not show it. |
| `billed_kwh` | **The ground truth for the model.** Units consumed, not the meter reading. |
| `energy_charge_rs` | Electricity alone, before other line items. Lets the tariff engine be graded without levies confusing it. |
| `other_charges_rs` | Anything the engine does not model. `0` if none. |
| `total_bill_rs` | Final amount payable. |
| `members` | People living there. |
| `daytime_occupancy` | `yes` / `no`. Not a model feature — it helps interpret outliers. |
| `has_solar`, `solar_kwp` | `no` and blank for most households. |
| `notes` | Anything that would explain an odd result: a long absence, a new appliance, guests, an estimated reading. |

One row per bill. A household with twelve bills has twelve rows, all sharing
its `household_id`.

### appliances.csv

| Column | Notes |
|---|---|
| `household_id` | Links to the household sheet. |
| `appliance_name` | **Must match the catalogue exactly** — see below. |
| `quantity` | How many of that appliance. |
| `power_watts` | The household's own figure if they read the label; otherwise the typical wattage printed on the form. |
| `hours_per_day` | Decimals are fine (`1.5`). |
| `days_per_month` | Usually 30; fewer for things like a washing machine. |

The appliance inventory is recorded **once per household**, not per bill. If a
household added an air conditioner halfway through the year, say so in `notes`
and consider using only the periods after that.

### Names must match the catalogue

`appliance_name` has to be one of the 38 entries in
`backend/seeds/seed_appliances.py`. That is why the form pre-prints them —
someone writing "aircon" or "AC unit" creates work that a tick does not.

Anything genuinely not on the list goes in the form's *Anything else* rows.
Add it to the catalogue before importing, rather than inventing a name in the
CSV, so the application and the survey stay in step.

## Two rules that matter more than the formatting

**Record what they say, not what seems right.** If a household says its fridge
is 500 W, write 500. The gap between what people report and what the meter
records is the quantity this whole project exists to correct — quietly
normalising it as you transcribe would hide the finding and inflate the
accuracy you go on to report.

**Never write down a name, address, account number or meter number.** The form
has no field for any of them, deliberately. That is the data-minimisation
commitment in Section 8.4 made structural rather than aspirational.

## Before any analysis

Split the households roughly 60/40 and set the 40% aside. Do not plot,
summarise or inspect them. All calibration happens on the 60%; the held-out set
is scored **once**, at the end, and that figure is reported whatever it says.
`VALIDATION-PROTOCOL.md` has the reasoning.
