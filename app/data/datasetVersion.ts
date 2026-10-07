import stamp from "./dataset_version.generated.json" with { type: "json" };

/** Fingerprint of the FINAL.DATASET.FINAL.xlsx the catalogue was built
 * from. Written by data/scripts/sync_dataset.mjs; every saved garden
 * records it so a result can be traced to the exact dataset. */
export const DATASET_VERSION: string = stamp.version;
