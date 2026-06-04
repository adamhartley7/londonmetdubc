# Evidence store — vetted rowing-science papers → citable claims

This folder is the **single source of truth** for every scientific statement the app is
allowed to make. The analysis code may cite **only** entries that live in
[`evidence.json`](evidence.json). If a claim isn't in here, it does not appear on screen.
That is the mechanical version of the First Law (see `../CLAUDE.md`): **no entry → no claim.**

It is **empty right now** — on purpose. Nothing goes in until Adam has the real paper in
hand and has verified the exact finding. No AI-recalled citations, ever.

---

## The shape of the data

Two lists. **Papers** are the real sources (the bibliography). **Claims** are the specific,
citable findings extracted from those papers. One paper can yield several claims; every claim
points back to exactly one paper. Think of it like a clinical guideline: the *paper* is the
trial, the *claim* is the single recommendation you'd actually quote at the bedside.

```jsonc
{
  "schemaVersion": 1,
  "updated": "YYYY-MM-DD",
  "papers": [
    {
      "id": "slug-author-year",     // stable, human-readable key used by claims + citations
      "authors": "Surname A, Surname B",
      "year": 2099,
      "title": "Exact title as published",
      "source": "Journal / publisher / institution",
      "doi": "10.xxxx/xxxxx",        // or "url": "https://..."  — must be resolvable
      "access": "open-access | paywalled | personal-copy",
      "verified": true,              // Adam has READ the source and confirmed the finding
      "verifiedBy": "Adam Hartley",
      "verifiedOn": "YYYY-MM-DD",
      "notes": "How/where obtained; any provenance worth keeping"
    }
  ],
  "claims": [
    {
      "id": "slug-of-the-finding",
      "paperId": "slug-author-year", // must match a papers[].id above
      "statement": "Plain-language version of what the paper actually found.",
      "quote": "Optional verbatim sentence from the paper, for traceability.",
      "locator": "p.123 / Table 2 / Fig.3",
      "tags": ["pacing-positive"],   // controlled vocabulary below — this is the wiring
      "strength": "single-study | observational | review | consensus",
      "caveats": "Sample, level, boat class, conditions — be honest about limits."
    }
  ]
}
```

### `tags` — the controlled vocabulary (the wiring)

`tags` is the contract between a claim and the analysis. When the engine computes a metric it
emits an **observation** carrying one of these tags; it then pulls in any claim sharing that
tag. Keep to this list so the link stays mechanical (add new ones here *and* in the code
together):

| tag | the engine emits it when… |
|---|---|
| `pacing-even` | first- and second-half /500 are within ~1 s |
| `pacing-positive` | second half is >1 s/500 slower (faded) |
| `pacing-negative` | second half is >1 s/500 faster (built) |
| `start-fast` | the opening 100–200 m is well under race-average pace |
| `finish-sprint` | the closing 100–200 m is faster than the preceding settle |
| `rate-stable` | stroke-rate SD is low (metronomic) |
| `rate-variable` | stroke-rate SD is high (rate wandered) |
| `boat-run` | about metres-per-stroke / efficiency |
| `elite-template` | special: marks a claim that carries reference-curve numbers in a `data` field (see below), used to draw the "your shape vs elite" overlay |

**Optional fields.** `papers[]` may carry a `pmid`. A claim may carry a structured
`data` object when it supplies numbers the UI draws directly — e.g. the elite template:
`"data": { "segmentPctOfAvgSpeed": [103.3, 99.0, 98.3, 99.7], "basis": "..." }`. Only
add `data` from figures/tables you have verified in the source.

---

## How to add a vetted paper (Adam's checklist)

1. **Have the actual source open** — PDF, DOI page, or book. Not a memory, not a summary.
2. Add a `papers[]` entry. The `doi`/`url` **must resolve** to that exact source.
3. For each finding you want the app to be able to say, add a `claims[]` entry:
   - write `statement` in your own plain words,
   - paste the supporting `quote` and its `locator` (page/figure),
   - tag it from the vocabulary above,
   - record the `strength` and the `caveats` honestly.
4. Set `verified: true` only once **you** have read it. Set `updated` to today.
5. Commit. The analysis picks it up automatically — the matching observation gains its citation.

> If you can't honestly tick step 1, the entry doesn't go in. An empty store that says
> "no vetted source yet" is the product working correctly; a fabricated citation is the
> product failing at its one core promise.

---

## ⚠️ FICTIONAL example — format only, NOT real data

The following is **invented purely to show the shape**. `Doe & Roe 2099` does not exist;
these numbers are not real findings. It lives here in the README, never in `evidence.json`,
so it can never leak into the app. Replace the pattern with real, verified entries.

```jsonc
// DO NOT COPY THE CONTENT — ONLY THE STRUCTURE. This source is fake.
"papers": [{
  "id": "doe-2099-pacing",
  "authors": "Doe J, Roe R", "year": 2099,
  "title": "An illustrative non-existent study of 2000 m pacing",
  "source": "Journal of Made-Up Rowing Science",
  "doi": "10.0000/fake", "access": "personal-copy",
  "verified": false, "verifiedBy": "—", "verifiedOn": "—",
  "notes": "FICTIONAL placeholder used only to document the schema."
}],
"claims": [{
  "id": "fake-even-pacing-is-fastest",
  "paperId": "doe-2099-pacing",
  "statement": "(EXAMPLE, NOT REAL) Crews holding an even split posted faster 2 km times than those who went out hard.",
  "quote": "(example quote)", "locator": "p.0",
  "tags": ["pacing-even", "pacing-positive"],
  "strength": "single-study",
  "caveats": "FICTIONAL — illustrates the field layout only."
}]
```
