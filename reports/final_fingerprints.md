# Brief fingerprints - final engine run

`scripts/brief-fingerprint.ts`. Rulebook `098c8d085f61`, dataset `6c081d3d2f60`.

| when | A (Stellenbosch fynbos 6 x 4) | B (Cottage 10 x 6 clay) |
|---|---|---|
| main / pre-engine-final | 149d3d6d6c0ab957 | 35c8ce503dd257d4 |
| baseline (engine-final, Step 1) | 149d3d6d6c0ab957 | fe77335df1c88533 |

B differs from main because viewing-edge lays every option out from the
viewing edge; A views from the north, so it is unaffected.
| Step 3a, b_shade removed, OLD rulebook 098c8d085f61 | 149d3d6d6c0ab957 | fe77335df1c88533 |
| Step 2 import, rulebook 6f37affddbc2 (cover 0.90 / 1.0) | 07cd4b79d1fac576 | 766bb36011b209c6 |
| Step 3a, b_shade removed, rulebook 6f37affddbc2 | 07cd4b79d1fac576 | 766bb36011b209c6 |

Removing b_shade changes no plan: identical fingerprints on both rulebooks.
