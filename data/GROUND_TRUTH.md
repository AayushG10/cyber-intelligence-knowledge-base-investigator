# GROUND_TRUTH — the answer key for this synthetic dataset

Seed: `42` · Dataset window: 2026-06-23 → 2026-07-21

This file describes every deliberately planted fraud ring. Use it to demo (which ring to click, the lead-time number) and to validate detection.

## RING01  ⭐ HERO RING

- **Ringleader:** `P001382` (highest betweenness centrality in the ring)
- **Mules:** 9 accounts sharing device `D001383` and a reused UPI handle
- **Victims:** 50, spread across 6 districts in 6 states
- **Money trail:** victim → mule → mule → ringleader (`A001382`) → cash-out (`A001383`)
- **First detectable:** `2026-06-24T07:54:18` (shared infra observable from the 3rd victim)
- **Lead-time gap:** 47 of 50 victims were defrauded *after* the ring first became detectable
- **Total defrauded:** ₹4,536,090

## RING02

- **Ringleader:** `P001447` (highest betweenness centrality in the ring)
- **Mules:** 5 accounts sharing device `D001435` and a reused UPI handle
- **Victims:** 18, spread across 3 districts in 3 states
- **Money trail:** victim → mule → mule → ringleader (`A001448`) → cash-out (`A001449`)
- **First detectable:** `2026-07-04T04:27:37` (shared infra observable from the 3rd victim)
- **Lead-time gap:** 15 of 18 victims were defrauded *after* the ring first became detectable
- **Total defrauded:** ₹896,776

## RING03

- **Ringleader:** `P001474` (highest betweenness centrality in the ring)
- **Mules:** 5 accounts sharing device `D001455` and a reused UPI handle
- **Victims:** 18, spread across 3 districts in 3 states
- **Money trail:** victim → mule → mule → ringleader (`A001476`) → cash-out (`A001477`)
- **First detectable:** `2026-06-30T08:52:49` (shared infra observable from the 3rd victim)
- **Lead-time gap:** 15 of 18 victims were defrauded *after* the ring first became detectable
- **Total defrauded:** ₹1,251,791
