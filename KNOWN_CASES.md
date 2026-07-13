# Known matching cases & exceptions

A running log of specific venues/papers that needed manual investigation to
get a correct JUFO badge, so that verification work doesn't get lost or
repeated. This complements `default-mappings.json` (the machine-readable
override list the extension actually reads) — this file is the *human*
record of what was tried, what worked, and what's still unresolved.

## When to add an entry

Whenever a venue shows an unexpected badge (wrong level, "JUFO ?" for a venue
that clearly should match, a false-positive match to the wrong channel) and
you dig in to figure out why — add an entry below under the right section,
even if you don't end up changing any code. A confirmed "this one just isn't
in JUFO" is as worth recording as a fix, so it isn't re-investigated later.

## Entry format

```
### <Scholar-displayed venue name>
- **Expected:** <JUFO channel name / level it should resolve to>
- **Got:** <what the extension actually showed>
- **Status:** Fixed via default-mappings.json / Fixed via heuristic / Fixed via CrossRef / Confirmed unresolved (not in JUFO) / Confirmed unresolved (needs code change)
- **Notes:** why it failed, what fixed it (if anything), date, JUFO_ID if known
```

---

## Already-handled cases (as of 2026-07-13)

These were previously fixed in code/data but never written down anywhere
outside the diff itself — listed here so they're visible in one place
instead of only as scattered inline comments.

### Custom mappings (`default-mappings.json`)
- **Asian Conference on Machine Learning** → *Proceedings of Machine Learning
  Research* (ACML is published as a PMLR volume; Scholar shows the ACML name,
  JUFO only lists the PMLR series entry)
- **IEEE/CVF Conference on Computer Vision and Pattern Recognition** →
  *IEEE Computer Society Conference on Computer Vision and Pattern
  Recognition* (JUFO still lists CVPR under its older organizing-society
  name)
- **Third International Joint Conference on Autonomous Agents and
  Multiagent Systems** → *International Conference on Autonomous Agents and
  Multiagent Systems* (Scholar shows the ordinal/edition-specific name,
  JUFO lists the series under its generic name)

### Heuristics baked into `cleanVenueName` (`content.js`) / `lookupVenueRaw` (`background.js`)
Each of these exists because a real venue name broke matching at some point;
none of the original examples were recorded outside the code comment itself.
- Trailing parenthetical abbreviations, e.g. "… (SDM)", "… (ECML)" — stripped,
  JUFO entries don't include them.
- Leading numeric ordinals ("40th Conference on …") and written-out ordinals
  ("Forty-first …") — stripped, JUFO entries use the bare series name.
- Leading "Proceedings of the" / "In" — stripped.
- "&" vs "and" — normalized both ways when matching.
- Accented characters — stripped via NFD normalization (JUFO entries are
  sometimes ASCII-only where Scholar shows the accented form, or vice versa).
- CrossRef `event.name` results often include a leading "Annual" that JUFO's
  entry omits — stripped as a fallback match.
- Leading "The" — tried both with and without, in either direction, since
  neither Scholar nor JUFO is consistent about including it.
- Colon sub-journal separator — e.g. Scholar's "The Lancet Digital Health"
  only matches JUFO's entry once reassembled as "the lancet : digital
  health"; the code tries inserting `" : "` at each word boundary as a last
  resort.

## New cases

<!-- Add entries below this line as they're found. Newest first. -->
