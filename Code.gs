/**
 * Household Electricity Study — submission endpoint.
 *
 * Receives one household per POST from survey_public.html and appends it to
 * two sheets whose columns are, deliberately, exactly the columns of
 * docs/survey/households.csv and docs/survey/appliances.csv. Downloading each
 * sheet as CSV therefore produces a file the evaluation script already reads,
 * with no reshaping step in between.
 *
 * Deploy: Deploy → New deployment → Web app
 *         Execute as: Me
 *         Who has access: Anyone
 * The /exec URL it gives you goes in CONFIG.ENDPOINT in the HTML page.
 */

/* ===================================================================== *
 *  CONFIG                                                               *
 * ===================================================================== */

// Must match CONFIG.TOKEN in the HTML page character for character.
// This is NOT a secret — anyone who views the page source can read it. It
// exists only so that a crawler that stumbles onto the URL cannot append
// rows. Do not reuse a password here.
var SUBMIT_TOKEN = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";

// Refuse anything larger than this, in characters. A full twelve-bill,
// thirty-eight-appliance submission is around 6 kB.
var MAX_PAYLOAD = 200000;

var HOUSEHOLD_COLS = ["household_id", "period_start", "period_end", "days_in_period",
  "tariff_category", "billed_kwh", "energy_charge_rs", "other_charges_rs",
  "total_bill_rs", "members", "daytime_occupancy", "has_solar", "solar_kwp", "notes"];

var APPLIANCE_COLS = ["household_id", "appliance_name", "quantity", "power_watts",
  "hours_per_day", "days_per_month"];

var LOG_COLS = ["submitted_at", "household_id", "bills", "appliances", "collected_on"];

var TARIFFS = ["110A", "110", "120", "140", ""];

// The 38 catalogue names from backend/seeds/seed_appliances.py. Validating
// here as well as in the page means a hand-crafted POST still cannot put a
// name into the sheet that the evaluation script would fail to resolve.
var CATALOGUE = [
  "Air Conditioner (9000 BTU)", "Air Conditioner (12000 BTU)", "Air Conditioner (18000 BTU)",
  "Ceiling Fan", "Standing Fan",
  "Refrigerator (small)", "Refrigerator (large / side-by-side)", "Chest Freezer",
  "Water Heater (electric geyser)", "Instant Shower Heater",
  "Washing Machine", "Tumble Dryer", "Clothes Iron",
  "Electric Kettle", "Microwave Oven", "Electric Oven / Cooker", "Rice Cooker",
  "Toaster", "Blender", "Dishwasher",
  'Television (LED 32")', 'Television (LED 55")', "Set-top Box / Decoder",
  "Sound System", "Gaming Console",
  "Desktop Computer", "Laptop", "Monitor", "Printer", "Wi-Fi Router",
  "LED Bulb", "Energy-saving Bulb (CFL)", "Fluorescent Tube", "Incandescent Bulb",
  "Water Pump", "Vacuum Cleaner", "Hair Dryer", "Electric Water Dispenser"
];

/* ===================================================================== *
 *  ENTRY POINTS                                                         *
 * ===================================================================== */

function doGet() {
  return json({ ok: true, service: "household-electricity-study" });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ ok: false, error: "empty" });
    if (e.postData.contents.length > MAX_PAYLOAD) return json({ ok: false, error: "too_large" });

    var body;
    try { body = JSON.parse(e.postData.contents); }
    catch (err) { return json({ ok: false, error: "malformed" }); }

    if (!body || body.token !== SUBMIT_TOKEN) return json({ ok: false, error: "unauthorised" });

    var rec = validate(body.record);
    if (rec.error) return json({ ok: false, error: rec.error });

    return json({ ok: true, household_id: append(rec.value) });
  } catch (err) {
    // Never leak a stack trace to a participant's browser.
    console.error(err);
    return json({ ok: false, error: "server_error" });
  }
}

/* ===================================================================== *
 *  VALIDATION                                                           *
 * ===================================================================== */

function nOrBlank(v, lo, hi) {
  if (v === "" || v === null || v === undefined) return "";
  var n = Number(v);
  if (!isFinite(n) || n < lo || n > hi) return null;
  return n;
}

function isDateish(v) {
  return v === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(v));
}

function validate(r) {
  if (!r || typeof r !== "object") return { error: "no_record" };

  var members = nOrBlank(r.members, 1, 20);
  if (members === null || members === "") return { error: "members" };

  if (["yes", "no", ""].indexOf(String(r.daytime_occupancy || "")) < 0) return { error: "daytime" };
  if (["yes", "no"].indexOf(String(r.has_solar || "no")) < 0) return { error: "solar" };

  var kwp = nOrBlank(r.solar_kwp, 0, 100);
  if (kwp === null) return { error: "solar_kwp" };

  if (!Array.isArray(r.bills) || !r.bills.length || r.bills.length > 12) return { error: "bills" };
  var bills = [];
  for (var i = 0; i < r.bills.length; i++) {
    var b = r.bills[i] || {};
    var kwh = nOrBlank(b.billed_kwh, 1, 50000);
    if (kwh === null || kwh === "") return { error: "billed_kwh" };
    if (!isDateish(b.period_start) || !isDateish(b.period_end)) return { error: "bill_dates" };
    if (TARIFFS.indexOf(String(b.tariff_category || "")) < 0) return { error: "tariff" };
    var days = nOrBlank(b.days_in_period, 1, 99);
    var energy = nOrBlank(b.energy_charge_rs, 0, 1000000);
    var total = nOrBlank(b.total_bill_rs, 0, 1000000);
    if (days === null || energy === null || total === null) return { error: "bill_numbers" };
    bills.push({
      period_start: String(b.period_start || ""),
      period_end: String(b.period_end || ""),
      days_in_period: days,
      tariff_category: String(b.tariff_category || ""),
      billed_kwh: kwh,
      energy_charge_rs: energy,
      total_bill_rs: total
    });
  }

  if (!Array.isArray(r.appliances) || !r.appliances.length || r.appliances.length > 60) {
    return { error: "appliances" };
  }
  var appliances = [];
  for (var j = 0; j < r.appliances.length; j++) {
    var a = r.appliances[j] || {};
    var name = String(a.appliance_name || "");
    if (CATALOGUE.indexOf(name) < 0) return { error: "unknown_appliance" };
    var q = nOrBlank(a.quantity, 1, 200);
    var w = nOrBlank(a.power_watts, 1, 20000);
    var h = nOrBlank(a.hours_per_day, 0, 24);
    var d = nOrBlank(a.days_per_month, 1, 31);
    if (q === null || q === "" || w === null || w === "" ||
        h === null || d === null) return { error: "appliance_numbers" };
    appliances.push({
      appliance_name: name,
      quantity: q,
      power_watts: w,
      hours_per_day: h === "" ? 0 : h,
      days_per_month: d === "" ? 30 : d
    });
  }

  return {
    value: {
      members: members,
      daytime_occupancy: String(r.daytime_occupancy || ""),
      has_solar: String(r.has_solar || "no"),
      solar_kwp: kwp,
      collected_on: isDateish(r.collected_on) ? String(r.collected_on || "") : "",
      notes: String(r.notes || "").slice(0, 500),
      bills: bills,
      appliances: appliances
    }
  };
}

/* ===================================================================== *
 *  WRITING                                                              *
 * ===================================================================== */

function sheetFor(name, cols, textCols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(cols);
    sh.setFrozenRows(1);
    // Dates and codes must stay strings. Left to itself Sheets turns
    // "2026-01-15" into a date value and "110A" stays text but "110" becomes
    // the number 110 — both of which come back wrong in the CSV export.
    (textCols || []).forEach(function (c) {
      var idx = cols.indexOf(c) + 1;
      if (idx > 0) sh.getRange(1, idx, sh.getMaxRows(), 1).setNumberFormat("@");
    });
  }
  return sh;
}

function nextCode() {
  // Held under the same lock as the append, so two people submitting at the
  // same moment cannot be given the same code.
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty("LAST_HOUSEHOLD_N") || "0", 10);
  if (!n) {
    // First run against a sheet that already has rows in it: carry on from
    // the highest code present rather than restarting at H01.
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Households");
    if (sh && sh.getLastRow() > 1) {
      var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      ids.forEach(function (row) {
        var m = /^H(\d+)$/.exec(String(row[0]).trim());
        if (m) n = Math.max(n, parseInt(m[1], 10));
      });
    }
  }
  n += 1;
  props.setProperty("LAST_HOUSEHOLD_N", String(n));
  return "H" + (n < 10 ? "0" + n : String(n));
}

function ensureRoom(sh, needed) {
  // getRange cannot address past the sheet's last row, and a new sheet only
  // has a thousand of them. Twelve bills a household means that is reachable.
  var want = sh.getLastRow() + needed;
  if (want > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), want - sh.getMaxRows() + 100);
}

function append(rec) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var hSheet = sheetFor("Households", HOUSEHOLD_COLS,
      ["household_id", "period_start", "period_end", "tariff_category"]);
    var aSheet = sheetFor("Appliances", APPLIANCE_COLS, ["household_id"]);
    var lSheet = sheetFor("Log", LOG_COLS, ["household_id", "collected_on"]);

    var id = nextCode();

    var hRows = rec.bills.map(function (b) {
      return [id, b.period_start, b.period_end, b.days_in_period, b.tariff_category,
        b.billed_kwh, b.energy_charge_rs, "", b.total_bill_rs, rec.members,
        rec.daytime_occupancy, rec.has_solar, rec.solar_kwp, rec.notes];
    });
    ensureRoom(hSheet, hRows.length);
    hSheet.getRange(hSheet.getLastRow() + 1, 1, hRows.length, HOUSEHOLD_COLS.length)
          .setValues(hRows);

    var aRows = rec.appliances.map(function (a) {
      return [id, a.appliance_name, a.quantity, a.power_watts,
        a.hours_per_day, a.days_per_month];
    });
    ensureRoom(aSheet, aRows.length);
    aSheet.getRange(aSheet.getLastRow() + 1, 1, aRows.length, APPLIANCE_COLS.length)
          .setValues(aRows);

    lSheet.appendRow([new Date().toISOString(), id, hRows.length, aRows.length,
      rec.collected_on]);

    return id;
  } finally {
    lock.releaseLock();
  }
}

/* ===================================================================== *
 *  WITHDRAWAL                                                           *
 * ===================================================================== */

/**
 * Run by hand from the Apps Script editor when a participant asks to
 * withdraw. Edit the code, run, and every row belonging to it is removed
 * from all three sheets. The code itself is not reissued.
 */
function withdraw() {
  var code = "H00";   // <- put the participant's code here before running

  var removed = 0;
  ["Households", "Appliances", "Log"].forEach(function (name) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var col = name === "Log" ? 2 : 1;
    var values = sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (String(values[i][0]).trim() === code) { sh.deleteRow(i + 2); removed++; }
    }
  });
  console.log("Removed " + removed + " row(s) for " + code);
}

/* ===================================================================== *
 *  HELPERS                                                              *
 * ===================================================================== */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
