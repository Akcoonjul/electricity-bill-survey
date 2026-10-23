# Hosting the survey page

Three files, about twenty minutes. At the end you have a public link that
anyone can open, and a Google Sheet whose two tabs download as
`households.csv` and `appliances.csv` with no reshaping.

| File | Goes where |
|---|---|
| `survey_public.html` | Any static host — GitHub Pages, Netlify Drop, Cloudflare Pages |
| `Code.gs` | Apps Script, attached to a new Google Sheet |
| `SETUP.md` | Stays in the repo |

---

## 1. Make the Sheet and paste the script

1. Go to <https://sheets.new> and name the spreadsheet something like
   **Household Electricity Study — responses**.
2. **Extensions → Apps Script**. Delete whatever is in `Code.gs` and paste the
   whole of this project's `Code.gs` over it.
3. Near the top, replace `CHANGE_ME_TO_A_LONG_RANDOM_STRING` with a long random
   string of your own. Generate one however you like — 30-odd random letters and
   digits is plenty. Keep it on a scratch pad; you need the identical string in
   step 3.
4. Save (the disk icon).

You do not need to create the three tabs. The script makes `Households`,
`Appliances` and `Log` the first time a submission arrives, with the right
headers and the right column formats.

## 2. Deploy it as a web app

1. **Deploy → New deployment**.
2. Click the gear next to *Select type* and choose **Web app**.
3. Set **Execute as: Me**, and **Who has access: Anyone**.
4. **Deploy**. Google asks you to authorise it the first time — it will warn
   that the app is unverified, which is normal for your own script. Choose
   *Advanced → Go to (project name)* and allow it.
5. Copy the **Web app URL**. It ends in `/exec`.

Check it works: paste that URL into a browser tab. You should see
`{"ok":true,"service":"household-electricity-study"}`.

> Every time you edit `Code.gs` afterwards you must run **Deploy → Manage
> deployments → edit (pencil) → Version: New version → Deploy**. Saving alone
> does not change what the live URL runs. This catches almost everybody once.

## 3. Configure the page

Open `survey_public.html` in a text editor. Near the top of the `<script>` at
the bottom there is a `CONFIG` block. Fill in all three:

```js
var CONFIG = {
  ENDPOINT: "https://script.google.com/macros/s/AKfy.../exec",
  TOKEN:    "the same long random string you put in Code.gs",
  CONTACT:  "your.name@umail.utm.ac.mu"
};
```

If you leave any of them, the page shows a red banner, disables the consent
boxes and refuses to submit anything — so a half-configured page cannot quietly
throw away someone's answers.

`TOKEN` is not a secret. Anyone who views the page source can read it. It is
there so a crawler that stumbles on the `/exec` URL cannot append rows. Never
reuse a password you use elsewhere.

## 4. Put the page online

Any static host works, because the page is one self-contained file — the logo
is embedded, and the only thing it loads from outside is the Google Fonts
stylesheet.

**Netlify Drop** is the fastest: go to <https://app.netlify.com/drop>, drag
`survey_public.html` onto the page, and you have a link within seconds. Rename
it to `index.html` first if you want a tidy URL.

**GitHub Pages** if you would rather it sat with the project: put the file in a
`docs/` folder on the default branch, rename it `index.html`, then
Settings → Pages → Source: deploy from branch, folder `/docs`.

Open the link on your phone before you share it. Check that the consent gate
holds, that the bill table scrolls sideways rather than squashing, and that a
test submission reaches the Sheet.

## 5. Delete your test rows

Your own test submission will have taken `H01`. Delete its rows from all three
tabs, then in the Apps Script editor open **Project Settings → Script
Properties** and set `LAST_HOUSEHOLD_N` back to `0`. Otherwise your first real
participant is `H02` and the numbering has a hole in it.

---

## Getting the data out

**Download → Comma Separated Values** on the `Households` tab gives you a file
whose columns are exactly `docs/survey/households.csv`. Same for `Appliances`.
Rename them to those two names, drop them in `docs/survey/`, and the evaluation
script reads them as they are.

The `Log` tab is operational only — a timestamp and row counts per submission,
so you can see the shape of the response rate and spot a burst of junk. It is
not an input to anything.

## When someone asks to withdraw

They quote their household code. In the Apps Script editor, open the
`withdraw()` function at the bottom of `Code.gs`, change `var code = "H00"` to
their code, press **Run**, and every row carrying it disappears from all three
tabs. The code is not reissued, so the numbering keeps a gap — which is correct,
because a reused code would silently merge two households.

---

## What to watch for

**The response you get is what people believe, not what the meter saw.** That
was true of the paper form too, and it is the quantity the study measures. It
matters more now: nobody is sitting beside the participant to notice when the
meter reading has gone into the `kWh billed` box instead of the units consumed.
Before analysis, check each row for a `billed_kwh` in the tens of thousands —
that is a meter reading, and it should be dropped rather than corrected, because
you cannot know which reading it was.

**An open link is not a sample.** Whoever shares it decides who answers, and
people with an unusually high bill are likelier to bother. Say so in the
limitations section rather than describing the households as representative.

**The sheet has no rate limit.** If you find junk rows, change `SUBMIT_TOKEN`
in `Code.gs`, redeploy a new version, and update the page — every old link
stops being able to write.
