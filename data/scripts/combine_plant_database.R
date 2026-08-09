#LIBRARYS NEEDED
library(tidyverse)
library(readxl)

# Run this script with the working directory set to the repo root
# (garden-skripsie/), so these relative paths resolve correctly.
# Run data/scripts/build_bioscape_traits.R first - this script reads
# its output (data/processed/bioscape_care_traits.csv).

# ---- Helpers -------------------------------------------------------

# Multi-value cells (Sun, Horticultural zones) are comma/token
# separated in the source; map each token, drop unmapped/NA ones,
# de-duplicate, and store as a single ";"-joined string (CSV cells
# can't hold real arrays - the app-side loader splits on ";").
split_map_collapse <- function(x, mapper) {
  if (is.na(x) || str_trim(x) == "") return(NA_character_)
  parts <- str_split(x, ",")[[1]] %>% str_trim()
  mapped <- unique(na.omit(sapply(parts, mapper, USE.NAMES = FALSE)))
  if (length(mapped) == 0) return(NA_character_)
  paste(mapped, collapse = ";")
}

map_sun_token <- function(token) {
  case_when(
    token == "Full Sun" ~ "full",
    token == "Morning Sun (Semi Shade)" ~ "part",
    token == "Afternoon Sun (Semi Shade)" ~ "part",
    token == "Shade" ~ "sheltered",
    TRUE ~ NA_character_
  )
}

map_water <- function(x) {
  case_when(
    is.na(x) ~ NA_character_,
    x == "Low summer water" ~ "low",
    x == "Occasional summer water" ~ "moderate",
    x == "Seasonally moist" ~ "moist",
    TRUE ~ NA_character_
  )
}

# Horticultural zones -> biome. This is a coarser, lower-confidence
# path than the point-in-polygon biome in build_bioscape_traits.R -
# it infers biome from SANBI's 7-zone gardening/climate scheme rather
# than a real occurrence coordinate. Zone 4 ("Summer rainfall Karoo
# AND Highveld") bundles two different biomes (Nama Karoo, Grassland)
# with no way to tell which from the zone text alone, so it's left
# unmapped rather than guessed. Zones 6/7 don't appear in this data.
map_zone_to_biome <- function(zone_phrase) {
  case_when(
    str_starts(zone_phrase, "Zone 1") ~ "Indian Ocean Coastal Belt",
    str_starts(zone_phrase, "Zone 2") ~ "Fynbos",
    str_starts(zone_phrase, "Zone 3") ~ "Succulent Karoo",
    str_starts(zone_phrase, "Zone 5") ~ "Savanna",
    TRUE ~ NA_character_  # Zone 4 (ambiguous) and anything unrecognised
  )
}

zones_to_biomes <- function(x) {
  if (is.na(x) || str_trim(x) == "") return(NA_character_)
  parts <- str_extract_all(x, "Zone \\d[^Z]*")[[1]] %>% str_trim()
  mapped <- unique(na.omit(sapply(parts, map_zone_to_biome, USE.NAMES = FALSE)))
  if (length(mapped) == 0) return(NA_character_)
  paste(mapped, collapse = ";")
}

# "0.15-0.5 m" / "0.5 m" -> max value in cm. Uses the upper bound of
# a range as a mature-size estimate, consistent with how this project
# already treats height/spread as estimates, not exact nursery specs.
parse_max_metres_to_cm <- function(x) {
  if (is.na(x) || str_trim(x) == "") return(NA_real_)
  nums <- as.numeric(str_extract_all(x, "[0-9.]+")[[1]])
  if (length(nums) == 0) return(NA_real_)
  max(nums) * 100
}

first_common_name <- function(x) {
  if (is.na(x) || str_trim(x) == "") return(NA_character_)
  str_trim(str_split(x, ",")[[1]][1])
}

match_key <- function(x) str_to_lower(str_squish(x))

# ---- 1. Load and join the two PlantZAfrica sources ------------------
pza_traits <- read_excel("data/raw/plantzafrica_dataset.xlsx") %>%
  mutate(.key = match_key(Species))

pza_watering <- read_csv("data/raw/plantzafrica_watering_dataset.csv", show_col_types = FALSE) %>%
  mutate(.key = match_key(Species))

pza <- full_join(pza_traits, pza_watering, by = ".key", suffix = c("_traits", "_watering")) %>%
  mutate(
    scientific_name = coalesce(str_trim(Species_traits), str_trim(Species_watering)),
    common_name = map_chr(`Common names`, first_common_name),
    sun = map_chr(Sun, ~ split_map_collapse(.x, map_sun_token)),
    water = map_chr(`Watering category`, map_water),
    biome_from_zone = map_chr(`Horticultural zones`, zones_to_biomes),
    height_cm_pza = map_dbl(`Mature Height`, parse_max_metres_to_cm),
    spread_cm_pza = map_dbl(`Mature Spread/Canopy`, parse_max_metres_to_cm),
    soil_type = `Soil Type`,
    plant_type_pza = coalesce(`Plant Type`, `Plant type`),
    flowering_season_pza = `Flowering Season`,
    flower_colour = `Flower Colour`,
    ph = PH,
    gardening_skill = `Gardening Skill`,
    special_features = `Special Features`,
    photo_url = `Image URL`,
    photo_source_url = `Page URL`
  ) %>%
  select(
    .key, scientific_name, common_name, sun, water, biome_from_zone,
    height_cm_pza, spread_cm_pza, soil_type, plant_type_pza,
    flowering_season_pza, flower_colour, ph, gardening_skill,
    special_features, photo_url, photo_source_url
  )

message(
  "PlantZAfrica combined: ", nrow(pza), " species (",
  sum(!is.na(pza$sun)), " with sun, ", sum(!is.na(pza$water)), " with water, ",
  sum(!is.na(pza$biome_from_zone)), " with a zone-derived biome)."
)

# ---- 2. Load BioScape (run build_bioscape_traits.R first) -----------
bioscape <- read_csv("data/processed/bioscape_care_traits.csv", show_col_types = FALSE) %>%
  mutate(.key = match_key(scientific_name))

# ---- 3. Full union of both sources -----------------------------------
# Every BioScape species is kept (occurrence-verified biome), and every
# PlantZAfrica species is kept too, even where there is no BioScape
# occurrence match - those get a zone-derived biome instead, tagged
# with lower confidence via biome_source below.
combined <- full_join(bioscape, pza, by = ".key", suffix = c("_bioscape", "_pza")) %>%
  mutate(
    scientific_name = coalesce(scientific_name_bioscape, scientific_name_pza),
    biome = pmap_chr(list(biome, biome_from_zone), function(occurrence_biome, zone_biome) {
      vals <- character(0)
      if (!is.na(occurrence_biome)) vals <- c(vals, occurrence_biome)
      if (!is.na(zone_biome)) vals <- c(vals, str_split(zone_biome, ";")[[1]])
      vals <- unique(vals)
      if (length(vals) == 0) NA_character_ else paste(vals, collapse = ";")
    }),
    biome_source = case_when(
      !is.na(biome_occurrence_count) & !is.na(biome_from_zone) ~ "occurrence+horticultural-zone",
      !is.na(biome_occurrence_count) ~ "occurrence",
      !is.na(biome_from_zone) ~ "horticultural-zone",
      TRUE ~ NA_character_
    ),
    height_cm = coalesce(max_height_cm, height_cm_pza),
    spread_cm = spread_cm_pza,  # BioScape has no spread/canopy field in this pipeline
    data_source = case_when(
      !is.na(scientific_name_bioscape) & !is.na(scientific_name_pza) ~ "bioscape+plantzafrica",
      !is.na(scientific_name_bioscape) ~ "bioscape",
      TRUE ~ "plantzafrica"
    )
  ) %>%
  select(
    scientific_name, common_name, family, data_source,
    biome, biome_source, biome_occurrence_count,
    growth_form, plant_type_pza,
    sun, water, soil_type,
    height_cm, spread_cm,
    flower_begin, flower_end, flowering_season_pza, flower_colour, ph,
    care_instructions, flammability, pollination, dispersal, parasitic_type,
    gardening_skill, special_features,
    photo_url, photo_source_url,
    subregion, latitude, longitude
  )

message(
  "Combined before invasive-species filter: ", nrow(combined), " species (",
  sum(combined$data_source == "bioscape"), " bioscape-only, ",
  sum(combined$data_source == "plantzafrica"), " plantzafrica-only, ",
  sum(combined$data_source == "bioscape+plantzafrica"), " matched in both)."
)

# ---- 4. Re-apply the invasive-species checklist across the FULL set -
# build_bioscape_traits.R already filtered the BioScape rows; the
# PlantZAfrica-only rows added here haven't been checked yet.
invasive_plants <- read.delim("data/raw/InvasivePlants.txt", stringsAsFactors = FALSE) %>%
  filter(kingdom == "Plantae", genus != "", specificEpithet != "") %>%
  transmute(match_name = str_to_lower(str_trim(paste(genus, specificEpithet)))) %>%
  distinct()

rows_before_invasive_filter <- nrow(combined)

combined <- combined %>%
  mutate(match_name = str_to_lower(str_trim(scientific_name))) %>%
  anti_join(invasive_plants, by = "match_name") %>%
  select(-match_name)

message(
  rows_before_invasive_filter - nrow(combined),
  " additional species removed as matches on the invasive-species checklist."
)

# A handful of source rows (e.g. a duplicated "Moraea polystachya" entry
# in the watering CSV) create a many-to-many join blip - collapse back
# to one row per species, keeping the first (arbitrary but harmless,
# since duplicate source rows are near-identical).
rows_before_dedup <- nrow(combined)
combined <- combined %>% distinct(scientific_name, .keep_all = TRUE)
if (rows_before_dedup > nrow(combined)) {
  message(rows_before_dedup - nrow(combined), " duplicate scientific_name row(s) collapsed.")
}

write.csv(combined, "data/processed/plant_database_full.csv", row.names = FALSE)

message(
  "Wrote ", nrow(combined), " species to data/processed/plant_database_full.csv (",
  sum(!is.na(combined$sun)), " with sun, ", sum(!is.na(combined$water)), " with water, ",
  sum(!is.na(combined$biome)), " with a biome)."
)
