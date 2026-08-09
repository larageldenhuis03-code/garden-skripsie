

#LIBRARYS NEEDED
# install.packages("tidyverse")
# install.packages("sf")
library(tidyverse)
library(readxl)
library(sf)

# Run this script with the working directory set to the repo root
# (garden-skripsie/), so these relative paths resolve correctly.

#BIOSCAPE DATABASES BEING IMPORTED FIRST
BioSCape_foliar_species_traits <- read.csv("data/raw/BioSCape_foliar_species_traits.csv")
BIOSCAPE_FILTERED_REGION <- read.csv("data/raw/BIOSCAPE.FILTERED.REGION.csv")

# View(BioSCape_foliar_species_traits)
# View(BIOSCAPE_FILTERED_REGION)

# ---- 0. Biome lookup (national vegetation map, point-in-polygon) -
# Runs BEFORE the species dedup below, on every occurrence row, so
# a species with occurrences spanning more than one biome gets the
# MAJORITY biome across all of its recorded points rather than
# whichever single occurrence happened to survive the dedup.
#
# Only these 9 terrestrial biomes are kept (per project scope); the
# raw BIOME_18 field also contains "Azonal Vegetation" (river/wetland/
# estuarine vegetation that cuts across biomes, not itself a biome)
# plus blank/"<Null>" records for unmapped polygons - both become NA
# rather than being forced into one of the 9.
national_vegmap <- st_read(
  "data/raw/spatial/NVM2018_AEA_V22_7_16082019_final.shp",
  quiet = TRUE
) %>%
  st_transform(4326) %>%
  st_make_valid() %>%  # source shapefile has some invalid geometry (duplicate/self-intersecting vertices) that breaks st_union without this
  select(BIOME_18) %>%
  mutate(
    biome = case_when(
      BIOME_18 == "Forests"          ~ "Forest",
      BIOME_18 == "Fynbos"           ~ "Fynbos",
      BIOME_18 == "Succulent Karoo"  ~ "Succulent Karoo",
      BIOME_18 == "Grassland"        ~ "Grassland",
      BIOME_18 == "Savanna"          ~ "Savanna",
      BIOME_18 == "Indian Ocean Coastal Belt" ~ "Indian Ocean Coastal Belt",
      BIOME_18 == "Albany Thicket"   ~ "Albany Thicket",
      BIOME_18 == "Nama-Karoo"       ~ "Nama Karoo",
      BIOME_18 == "Desert"           ~ "Desert",
      TRUE ~ NA_character_
    )
  ) %>%
  select(biome)

# ---- Dissolved biome regions, for the map UI (Phase C) -----------
# Union every polygon sharing a biome into one shape, then simplify
# so the result is small enough to inline in the app bundle (the
# raw shapefile has 48,732 polygons; this collapses to one shape per
# biome, ~9 total). Rows with no biome (Azonal Vegetation / blank)
# are dropped - they have no place on a 9-biome map.
# dTolerance is in degrees (~0.01 deg = ~1km at the equator); adjust
# if the output looks too blocky or is still too large to inline.
biome_regions <- national_vegmap %>%
  filter(!is.na(biome)) %>%
  group_by(biome) %>%
  summarise(geometry = st_union(geometry), .groups = "drop") %>%
  st_simplify(dTolerance = 0.01, preserveTopology = TRUE)

st_write(
  biome_regions,
  "data/processed/south_africa_biome_regions.geojson",
  delete_dsn = TRUE,
  quiet = TRUE
)

message(
  "Wrote ", nrow(biome_regions),
  " dissolved biome region(s) to data/processed/south_africa_biome_regions.geojson"
)

occurrence_points <- BIOSCAPE_FILTERED_REGION %>%
  mutate(.row_id = row_number()) %>%
  filter(!is.na(latitude), !is.na(longitude)) %>%
  st_as_sf(coords = c("longitude", "latitude"), crs = 4326, remove = FALSE)

occurrence_biomes <- occurrence_points %>%
  st_join(national_vegmap, join = st_intersects, left = TRUE) %>%
  st_drop_geometry() %>%
  distinct(.row_id, .keep_all = TRUE) %>%  # guard against edge points matching >1 polygon
  select(scientific_name_original, biome)

species_biome <- occurrence_biomes %>%
  filter(!is.na(biome)) %>%
  count(scientific_name_original, biome, name = "n_occurrences") %>%
  group_by(scientific_name_original) %>%
  slice_max(n_occurrences, n = 1, with_ties = FALSE) %>%
  ungroup() %>%
  select(scientific_name_original, biome, biome_occurrence_count = n_occurrences)

message(
  n_distinct(occurrence_biomes$scientific_name_original) - nrow(species_biome),
  " of ", n_distinct(occurrence_biomes$scientific_name_original),
  " species have no resolved biome (missing coordinates or outside all polygons/",
  "only in Azonal Vegetation)."
)

# ---- Species dedup + biome attach --------------------------------
BIOSCAPE_FILTERED_REGION <- BIOSCAPE_FILTERED_REGION[!duplicated(BIOSCAPE_FILTERED_REGION$scientific_name_original), ] %>%
  left_join(species_biome, by = "scientific_name_original")

combined_BIOSCAPE <- left_join(BIOSCAPE_FILTERED_REGION,BioSCape_foliar_species_traits, by = "scientific_name_original")
# View(combined_BIOSCAPE)


df <- combined_BIOSCAPE

# ---- 1. Taxonomic ID: drop duplicate .x/.y join columns ------
# Keep WFO as the taxonomic authority. Drop original/MG name
# columns and the duplicate .x/.y pairs.
df <- df %>%
  rename(
    scientific_name = scientific_name_WFO.x,
    scientific_name_authorship = scientific_name_authorship.x,
    family = family_WFO.x
  ) %>%
  select(
    -scientific_name_original, -scientific_name_MG,
    -family_MG.x, -family_MG.y,
    -scientific_name_WFO.y, -scientific_name_authorship.y, -family_WFO.y, -unique_ID
  )


# ---- 3. Lifecycle: keep lifecycle_POSA only -------------------
df <- df %>% select(-perennial, -annual, -monoecious, -dioecious,
                    -evergreen, -deciduous)

# ---- 4. Fire ecology -> care_instructions ---------------------
df <- df %>%
  mutate(
    care_instructions = str_trim(paste(
      ifelse(isTRUE(flower_postfire) | flower_postfire %in% TRUE, "Flowers post-fire.", ""),
      ifelse(isTRUE(resprout_postfire) | resprout_postfire %in% TRUE, "Resprouts post-fire.", ""),
      ifelse(isTRUE(serotinous) | serotinous %in% TRUE, "Serotinous (fire-triggered seed release).", "")
    )),
    care_instructions = ifelse(care_instructions == "", NA, care_instructions)
  ) %>%
  select(-flower_postfire, -resprout_postfire, -serotinous)

# ---- 5. Flowering season: drop empty _alt columns --------------
df <- df %>% select(-flower_begin_alt, -flower_end_alt)

# ---- 6. Growth form + succulence -> one growth_form column -----
# Priority order below decides which label wins if more than one
# flag is TRUE for a row. Edit the order if a different hierarchy
# makes more sense once you see real data.
df <- df %>%
  mutate(
    growth_form = case_when(
      tree           %in% TRUE ~ "tree",
      tall_shrub     %in% TRUE ~ "tall_shrub",
      mid_shrub      %in% TRUE ~ "mid_shrub",
      low_shrub      %in% TRUE ~ "low_shrub",
      liana          %in% TRUE ~ "liana",
      scrambler      %in% TRUE ~ "scrambler",
      graminoid      %in% TRUE ~ "graminoid",
      geophyte       %in% TRUE ~ "geophyte",
      herb           %in% TRUE ~ "herb",
      leaf_succulent %in% TRUE ~ "succulent_leaf",
      stem_succulent %in% TRUE ~ "succulent_stem",
      other_succulent %in% TRUE ~ "succulent_other",
      succulent      %in% TRUE ~ "succulent_general",
      TRUE ~ NA_character_
    )
  ) %>%
  select(-herb, -geophyte, -graminoid, -low_shrub, -mid_shrub, -tall_shrub,
         -tree, -scrambler, -liana, -succulent, -leaf_succulent,
         -stem_succulent, -other_succulent, -missing_growthform_class)

# ---- 7. Parasitic habit: hemiparasite + parasite -> one column --
df <- df %>%
  mutate(
    parasitic_type = case_when(
      parasite %in% TRUE      ~ "parasite",
      hemiparasite %in% TRUE  ~ "hemiparasite",
      TRUE ~ "none"
    )
  ) %>%
  select(-parasite, -hemiparasite)

# ---- 8. Leaf type: fold lvs_linear into leaf_type if not already -
# Only overwrites leaf_type when it's blank/NA and lvs_linear says
# TRUE, so it won't silently overwrite real data. Prints any rows
# where the two disagree so you can check them by hand.
conflicts <- df %>%
  filter(lvs_linear %in% TRUE, !is.na(leaf_type),
         !str_detect(str_to_lower(leaf_type), "linear"))
if (nrow(conflicts) > 0) {
  message(nrow(conflicts), " rows have lvs_linear = TRUE but leaf_type doesn't say 'linear' - check these manually.")
}

df <- df %>%
  mutate(
    leaf_type = ifelse(lvs_linear %in% TRUE & (is.na(leaf_type) | leaf_type == ""),
                       "linear", leaf_type)
  ) %>%
  select(-lvs_linear)

# ---- 9. Drop rows with majority-NA data ------------------------
# "Majority" = more than half of the kept attribute columns are NA
# for that record. unique_ID/scientific_name/family are excluded
# from the count since they're identifiers, not attributes.
na_threshold <- 0.5

id_cols <- c("unique_ID", "scientific_name", "scientific_name_authorship", "family",
             "biome", "biome_occurrence_count", "latitude", "longitude")
attribute_cols <- setdiff(names(df), id_cols)

df <- df %>%
  mutate(.na_share = rowSums(is.na(across(all_of(attribute_cols)))) / length(attribute_cols)) %>%
  filter(.na_share <= na_threshold) %>%
  select(-.na_share)

#10 Improving labelling

df <- df %>%
  mutate(
    flammability = case_when(
      flammability == "h" ~ "High",
      flammability == "m" ~ "Medium",
      flammability == "l" ~ "Low",
      TRUE ~ flammability
    ),
    pollination = case_when(
      pollination == "i"   ~ "Insect",
      pollination == "b"   ~ "Bee",
      pollination == "i,b" ~ "Insect/Bee",
      pollination == "w"   ~ "Wind",
      pollination == "m"   ~ "Mammal",
      pollination == "u"   ~ "Unknown",
      TRUE ~ pollination
    ), 
    dispersal = case_when(
      dispersal == "i" ~ "Insect",
      dispersal == "p" ~ "Passive",
      dispersal == "w" ~ "Wind",
      dispersal == "m" ~ "Mammal",
      dispersal == "u" ~ "Unknown",
      TRUE ~ dispersal
    )
  )

# ---- 11. Remove species on the invasive-species checklist -------
# InvasivePlants.txt is a broad invasive-species checklist that also
# includes animals, so it's filtered to kingdom == "Plantae" first.
# Matching is done on genus + specificEpithet (the structured name
# columns), not the free-text scientificName column, because that
# column often has the author citation baked in
# (e.g. "Acacia saligna (Labill.) H.L.Wendl."), which would never
# match our plain binomial scientific_name.
invasive_plants <- read.delim("data/raw/InvasivePlants.txt", stringsAsFactors = FALSE) %>%
  filter(kingdom == "Plantae", genus != "", specificEpithet != "") %>%
  transmute(match_name = str_to_lower(str_trim(paste(genus, specificEpithet)))) %>%
  distinct()

rows_before_invasive_filter <- nrow(df)

df <- df %>%
  mutate(match_name = str_to_lower(str_trim(scientific_name))) %>%
  anti_join(invasive_plants, by = "match_name") %>%
  select(-match_name)

message(
  rows_before_invasive_filter - nrow(df),
  " species removed as matches on the invasive-species checklist."
)

# ---- 12. Save cleaned dataset -----------------------------------
combined_BIOSCAPE_clean <- df

df <- combined_BIOSCAPE_clean

#CREATING A QUALITY REPORT
df <- combined_BIOSCAPE_clean

# ---- Build the base per-column summary ------------------------
col_summary <- function(x) {
  data.frame(
    type        = class(x)[1],
    n_missing   = sum(is.na(x)),
    pct_missing = round(100 * mean(is.na(x)), 1),
    n_unique    = length(unique(x[!is.na(x)]))
  )
}

quality_report <- lapply(df, col_summary) %>%
  bind_rows(.id = "column")

# ---- Add sanity-check notes for specific columns ----------------
# Anything dataset-level (duplicates, impossible values, date
# logic) gets attached as a note on the relevant column's row,
# so it all lives in the one table instead of separate printouts.
quality_report <- quality_report %>%
  mutate(
    notes = case_when(
      column == "unique_ID" ~
        paste0(sum(duplicated(df$unique_ID)), " duplicate ID(s)"),
      column == "scientific_name" ~
        paste0(sum(duplicated(df$scientific_name)), " species appear more than once"),
      column == "max_height_cm" ~
        paste0(sum(df$max_height_cm <= 0, na.rm = TRUE), " value(s) <= 0"),
      column == "flower_end" ~
        paste0(sum(df$flower_end < df$flower_begin, na.rm = TRUE),
               " row(s) where flower_end is before flower_begin"),
      TRUE ~ NA_character_
    )
  ) %>%
  arrange(desc(pct_missing))
# ---- List out the actual values for low-cardinality columns ------
# If a column only has 10 or fewer distinct values, show them all
# in a new column so you can see exactly what's in there (e.g.
# growth_form categories, lifecycle_POSA levels, etc.). Matched by
# column name so the row order from arrange() above doesn't matter.
distinct_vals <- function(x) {
  u <- unique(x[!is.na(x)])
  if (length(u) <= 10) {
    paste(sort(as.character(u)), collapse = ", ")
  } else {
    NA_character_
  }
}

distinct_lookup <- sapply(df, distinct_vals)

quality_report <- quality_report %>%
  mutate(distinct_values = distinct_lookup[column])



# ---- View it -----------------------------------------------------
print(quality_report)
# View(quality_report)   # uncomment to open it in the RStudio viewer

write.csv(combined_BIOSCAPE_clean, "data/processed/bioscape_care_traits.csv", row.names = FALSE)
