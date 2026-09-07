# Market Research — Guest Risk & Check-In Compliance for STR operators

Date: 2026-09-07. Purpose: honest answer to "is this worth building?" before investing in the SaaS foundation. Sources are linked inline; pricing marked "not public" where vendors do not publish it.

## Bottom line

The generic product ("upload ID, verify, score risk") is commoditized. Airbnb verifies every guest for free, Guesty bundles screening into its Shield suite, SafeGuest launched a free Green/Yellow/Red scoring tool in June 2025, and raw identity verification is a $1.50/check commodity (Stripe Identity). The companies that make money in this category (Truvi, Safely) are insurance/guarantee businesses with a SaaS front end. A software-only entrant competes against a price the market has already reached: $0.

What is not commoditized, and what our own production data shows we actually use, is narrower:

1. Booking.com / Expedia / direct-booking stays where the operator takes the card and needs ID + card + signed authorization as **chargeback evidence**. Airbnb shifted chargeback liability to hosts on 2025-09-08, which is the one genuinely new demand signal.
2. A **per-stay compliance record** in regulated jurisdictions (Spain, Italy, Portugal, Croatia, France, Greece, Japan, UAE) and emerging ones (Puerto Rico municipal registry bill SB 238, passed Senate Nov 2025; La Quinta / LA STVR permit regimes).

Decision (owner, 2026-09-07): build the full multi-tenant SaaS foundation anyway, because it is shared with the narrow wedge, and sell the wedge first.

## Competitors

| Name | What | Pricing | Target | Integrations | Status |
|---|---|---|---|---|---|
| Autohost | AI ID verification, fraud/risk scoring, criminal checks, deposits | ~£2/property/mo + ~£2.50/booking; will not onboard < 25 units | mid-large PMs | Guesty, Hospitable, Hostaway, Lodgify | bootstrapped, seed 2023 |
| Truvi (ex Superhog / Know Your Guest) | ID + criminal screening bundled with damage guarantee up to $5M | mostly guest-paid protection fee; not public | small-mid, boutique | Guesty, Hostaway, Lodgify, Hostfully, OwnerRez | rebranded Jan 2025; £5.5M Series A |
| Chekin | online check-in, IDV, automated government guest registration, smart locks | €3.95–5.95/property/mo + per-verification add-on | EU compliance-heavy | most PMS | strongest compliance-first player |
| Enso Connect | guest experience OS incl. verification, contactless check-in, upsells | $9–16/listing/mo + 5% upsell commission | small-mid | Lodgify, most PMS, locks | active |
| Safely | name/DOB/address screening + up to $1M insurance | $5/screening or $0.50–8/night, usually guest-paid | small-mid | Guesty, Hostfully, Lodgify | active |
| Guesty Guest Screening / Shield | native ID + selfie, criminal DB (US), damage/liability | bundled in subscription | Guesty base | native | expanded 2025; main commoditization threat |
| Hostaway | no native screening; marketplace (Authenticating.com) | partner pricing | Hostaway base | 200+ partners | $365M growth round Dec 2024 |
| Hostfully | integrates Safely, Truvi, Authenticate | pass-through | small-mid | multiple | active |
| Duve | guest app: ID + payment pre-arrival, upsells | $120–200+/mo + 10% upsell fee | boutique hotel/STR | various | active |
| Operto | ID/payment validation bundled with smart access | per-unit + per-module; 3-yr TCO reportedly $50–100K | mid-large | broad | active |
| Hospitable | native verification + $5M damage protection, optional Autohost | free tier; $29–99+/mo | small-mid, direct-booking hosts | Autohost | active |
| Lodgify | check-in form + compliance registration + Chekin/Authenticate | in core plans + partner fees | small DIY | Chekin, Authenticate | active |
| Minut | noise/occupancy sensor (party prevention) | ~$130–150 hardware + ~$10–15/mo | all | broad | Airbnb subsidizes devices |
| Breezeway | ops platform; beta Guest Verification module | $19.99/unit/mo + tiered add-on | mid-large | native + broad | new entrant |
| SafeGuest (2025) | free Green/Yellow/Red guest risk scoring | free | all | Guesty, Hostfully | 100k+ verifications; "verification should be free" |
| Stripe Identity / Persona / Veriff / Onfido / Jumio | raw IDV | $1.50 (Stripe) to enterprise contracts | developers/enterprise | API | commodity floor |
| Airbnb native | mandatory gov-ID verification | free | all Airbnb | n/a | chargeback liability moved to hosts 2025-09-08 |
| Vrbo native | email/phone/payment "Verified Identity" only | free | all Vrbo | n/a | materially weaker than Airbnb |

Links: Autohost pricing https://www.autohost.ai/pricing/ · Truvi rebrand https://shorttermrentalz.com/news/truvi-rebrand-superhog-risk-management/ · Chekin pricing https://hoteltechreport.com/guest-experience/contactless-checkin/chekin · Safely https://safely.com/guest-screening/ · Guesty 2025 updates https://www.guesty.com/blog/7-guesty-updates-that-defined-2025/ · Hostaway funding https://www.businesswire.com/news/home/20241216460239/en/ · Breezeway verification https://help.breezeway.io/en/articles/12933639-guest-verification-onboarding · Stripe Identity pricing https://www.spotsaas.com/product/stripe-identity/pricing · Airbnb ID verification https://news.airbnb.com/an-update-on-identity-verification-on-airbnb/ · AirCover chargeback change https://community.hospitable.com/industry-conversations-33/airbnb-charge-back-changes-819 · SafeGuest launch https://www.globenewswire.com/news-release/2025/06/24/3104199/0/en/

## Demand evidence (what operators actually say)

- BiggerPockets guest-screening thread: an experienced PM used Safely "primarily for the insurance" and called such services "cost prohibitive especially at scale"; hosts prefer license-matches-name checks, higher rates as a filter, $300–500 deposits, and PMS built-ins. https://www.biggerpockets.com/forums/530/topics/1108419-direct-booking-guest-screening
- Truvi transparency complaint: it "will not disclose the nature of the red flag". https://www.biggerpockets.com/forums/530/topics/1286440-str-guest-verification-screening
- "99 percent of your bookings are going to come from Airbnb, VRBO, or both. They have verifications" (same thread) — screening tools matter mainly for the direct/OTA-card minority.
- Airbnb chargeback shift (Sept 8, 2025): a host on Hospitable's forum described a $9,000 chargeback dispute costing $4,000 in legal fees. This argues for **chargeback-defense documentation**, not ID verification per se. https://community.hospitable.com/industry-conversations-33/airbnb-charge-back-changes-819
- Direct bookings ~34% of STR reservations in 2025, +35% YoY; direct-booking hosts lose Airbnb's built-in verification. https://www.houfy.com/blog/direct-booking-statistics-every-str-host-needs-2026
- Our own data: 181 verifications, ~80% Booking.com/Expedia, 23 in the last 30 days. We are our own first customer.

## Regulatory tailwinds (guest-record requirements)

| Jurisdiction | Requirement | Status | Penalty |
|---|---|---|---|
| Spain (SES Hospedajes) | report every guest within 24h | mandatory since 2024-12-02 | €100–30,000 |
| Italy (CIN + Alloggiati Web) | national code per unit; police report within 24h | CIN mandatory 2025-01-01 | €800–8,000 |
| Portugal (SIBA/AIMA) | guest ID report within 3 business days | ongoing | fines |
| Croatia (eVisitor) | report within 24h | since 2016 | thousands of € |
| France | 13-digit registration number on every listing | from May 2026 | delisting |
| Greece | AMA number + monthly stay declaration; DAC7 | ongoing | tax penalties |
| Japan (Minpaku) | collect name/DOB/address/nationality/passport; retain 3 yrs | since 2018 | license revocation |
| UAE (Dubai DTCM) | register every guest with ICA + police within 24h | active | permit revocation |
| US NYC (LL18) | host registration | since Sept 2023 | listings 22,000 → ~2,300 |
| US Los Angeles / LA County | home-sharing registration; $914 county fee | ongoing | $500–2,000/day |
| Puerto Rico | municipal host registration + innkeeper ID across 78 municipios (SB 238) | Senate passed Nov 2025, House pending | TBD |

Nuance: nearly all of these require **filing a guest record**, not risk scoring. That is a cheaper, more mechanical product than fraud detection.

Links: Spain https://chekin.com/en/blog/spain-new-tourist-registration-system-ses-hospedajes/ · Italy https://yourbusinessinitaly.com/en/blog/short-term-rentals-italy-cin-code-2025 · Portugal https://www.guestready.com/blog/siba-guest-registration-sef-aima-portugal/ · Croatia https://rentl.io/en/blog/industry-related/evisitor-croatia-vacation-rental-guest-registration-guide · France https://domosno.com/france-has-179400-registered-holiday-lets-is-yours-one-of-them · Greece https://getproofsnap.com/posts/greece-short-term-rental-airbnb-regulations-2026.html · Japan https://chargeautomation.com/japan-minpaku-law-guest-id/ · UAE https://www.houst.com/blog/dubai-airbnb-dtcm-rules · NYC https://en.wikipedia.org/wiki/Local_Law_18_of_2022 · La Quinta https://www.laquintaca.gov/residents/short-term-vacation-rentals · PR SB 238 https://www.metro.pr/noticias/2025/11/17/senado-aprueba-el-marco-regulatorio-para-los-alquileres-a-corto-plazo/

## Market size (directional)

~1.68M active US STR listings (Jan 2026), supply growth slowed to ~4.6%. Vacation-rental management software market ~$2.13B (2026), ~10.6% CAGR. No reliable public count of PM companies in the 10–200-unit tier. Willingness to pay clusters at the low end: $1.50 (Stripe), £2.50/booking (Autohost), $5/screening usually guest-paid (Safely), $0 (SafeGuest). https://finance.yahoo.com/real-estate/articles/steady-demand-slower-supply-define-140000282.html

## Go-to-market reality

Distribution runs through PMS marketplaces (Hostaway 200+, Guesty 240+ partners) and VRMA (Oct 4–6, 2026, Nashville). Autohost refuses accounts under 25 units, i.e. incumbents treat small operators as unprofitable to serve directly. Hostaway's API has rate limits, no SDK, and a partner-certification gate; realistic integration lead time is 3–6 months. https://apis.io/providers/hostaway/ · https://stayfi.com/vrm-insider/2026/04/17/best-vacation-rental-conferences/

## What the owner has that a pure software founder does not

Real units in La Quinta, CA and Isla Verde, PR: jurisdictions with unautomated, under-served compliance workflows, and operator credibility to pre-sell inside PR/CA host communities. Dogfooding against real deadlines and real chargebacks.

## Recommendation

Sell the wedge first: chargeback evidence packet + compliance record for OTA-card and direct-booking operators, starting with PR and CA. Do not lead with "ID verification". Do not add paid IDV vendors until a customer asks. Re-evaluate against SafeGuest and Guesty every quarter.
