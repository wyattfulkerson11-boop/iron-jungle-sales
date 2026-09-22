# The owner conversation — before the iPad goes on the counter

One visit, maybe fifteen minutes. Five questions that have been open since the
plan was written, one expectation to set straight, and one decision only he can
make. Everything here is a question or a choice — none of it is a demo.

## 1. Set the expectation first, before anything else

Say this early, in these words or close to them:

> "This doesn't save your staff any work. They still key every line into the gym
> software, same as now. What it does is make sure the line is *there* to key,
> and that it's readable, and that you can prove it later."

This matters because if he's quietly expecting "less work at the counter," he
will grade the week against that and it will fail — fairly, against a promise
nobody actually made. The kiosk trades a legibility and loss problem for a small
amount of *new* work: a worker creates and prints a batch twice a day, and
hand-checks the typed lines.

What he should expect to notice at the end of the week:

- Every sale has a name and an item on it. No "??" lines, no guessing at
  handwriting, no line nobody can bill.
- A printed, reprintable record of what was sold and when, instead of a sheet
  that gets thrown away.
- Fewer sales that never made it onto paper at all — which is the actual pitch,
  and the one thing the week is designed to measure.

## 2. The five questions

These have been open since 2026-09-17 (PLAN §B). None of them blocked the build;
all of them change how the trial is run or read.

**Q1 — Does the keytag show the member number in readable digits?**
*Ask to see a physical tag.* The typing screen currently tells a member "It's on
the front of your card." Nobody has confirmed that's true — the eight photos on
the laptop are POS screens and the fridge, no card. If the number isn't printed
on the tag, that sentence is wrong on the one screen where a confused member
decides whether to bother, and it needs rewording to whatever the tag actually
shows. **This is the one with a code change attached, so ask it first.**

**Q2 — Do member numbers ever look different from `IJG18399`?**
Older members, comped or staff memberships, family accounts on one number. Only
matters for how strict the number check can be; the current check is loose on
purpose, which is the safe direction until he answers.

**Q3 — How fast can the desk look up a member by number?**
The POS is WebFDM and it has a Members section, so the lookup exists. The
question is whether it's five seconds or a minute, because the worker is being
asked to do it for every typed line. If it's slow, the desk check quietly stops
happening on a busy shift, and that check is the only thing standing between a
mistyped number and an unbillable sale.

**Q4 — Key in at end of day, or twice a day?** *(ask staff, not just him)*
He said "I think" end of day. Twice a day is what the RUNBOOK asks for, because
nothing is banked until it's keyed in — an iPad that dies at 4pm takes the whole
day with it if nobody pulled a batch at noon. If staff say midday is unrealistic,
that's fine, but then the trial runs with a full-day loss window and he should
hear that out loud rather than find out the hard way.

**Q5 — Roughly how many purchases a day?**
He said 7-8 sheets at ~25 lines, so ~200. That number is currently doing a lot of
work — retention, storage headroom, the whole sizing argument — and it's an
estimate. The week will answer it properly. Worth saying that the answer changes
nothing about whether it works, only how long the device can hold history.

## 3. The one thing to tell him, not ask him

**The paper sheet goes behind the counter for the trial week, not on it.** Staff
hand it over the moment the kiosk can't take a sale, and write down why. Nobody
is turned away; nobody is offered the pen first.

Say why, because it sounds harsher than it is:

> "If the pen's sitting there, everyone uses the pen — that's just habit, and
> I'd learn nothing except that your members have hands. Behind the counter, the
> week tells us whether this thing can actually carry your sales. Any time it
> can't, your staff hand over the paper, no argument."

The two things this buys, worth saying if he pushes back:

- **A result that means something.** With paper on the counter the week measures
  which one members *prefer*, and a poor number can't distinguish "too much
  friction" from "unfamiliar." Behind the counter it measures whether the system
  works, which is the question the decision actually turns on.
- **It tests the part most likely to hurt him.** The riskiest path is a member
  typing their number instead of scanning — that's the one where a wrong number
  looks completely normal on the sheet, and a hand-ticked checkbox is the only
  control. With a pen in reach, anyone whose card won't scan just writes, so that
  path barely gets used and the week ends having avoided its own weak point.

**If he says no, that's his call and it's a reasonable one** — it's his counter
and his members. It just changes what the week can conclude, and the metric in
RUNBOOK.md has to change with it: back to comparing iPad lines against paper
lines, with the caveat that a weak result won't be interpretable. Say that, then
do whatever he decides.

## 4. What he gets at the end of the week

Two things, plus the printed batches as evidence.

**An exception count.** Every time the kiosk couldn't take a sale, with a
one-line reason. The bar is agreed before the first sale — 5 or fewer a day
across days 3–5, and no single cause repeating three times in a day — and each
outcome has a decision already attached to it, so the result can't be argued
afterwards. Full table in "What to watch for during the week" in RUNBOOK.md.

**The TYPED share.** What fraction of sales came in by someone typing their
number rather than scanning. Not part of the bar, but it's the number that
decides whether this is net-positive at his counter, because every typed line is
a manual lookup for a worker.

And one thing to say plainly at the end of the visit: **the trial can fail.**
That's what it's for. A week that comes back "this doesn't work at our counter"
is a result worth having, and it's far cheaper to learn now than after the gym
has reorganised around it.
