# Assign each named Western Cape area (data/raw/spatial/western-cape-places-2018.geojson,
# from download_western_cape_places.py) the bioregion it belongs to, using
# the same dissolved bioregion layer (data/processed/western_cape_bioregions.geojson)
# built by build_bioscape_traits.R for the plant occurrence join.
#
# Run with the working directory at the repo root:
#   Rscript data/scripts/assign_place_bioregions.R
#
# Two different assignment strategies, chosen by how large/heterogeneous a
# place's footprint typically is:
#
# - Fine categories (Urban/Rural settlements, City of Cape Town suburbs):
#   small, usually-homogeneous footprints, so the polygon's centroid is a
#   fine, cheap stand-in for "which bioregion is this place in". If the
#   centroid lands on unclassified land (~25% of the province - mostly
#   urban or farmland, see western_cape_outline.geojson), the nearest
#   bioregion polygon is used instead and tagged "nearest" rather than
#   dropping a heavily-searched place like central Cape Town.
#
# - Broad categories (Local/District Municipalities): these can genuinely
#   span several bioregions (a district like West Coast crosses Fynbos,
#   Renosterveld and Succulent Karoo), so a single centroid point can land
#   almost anywhere, including possibly outside a concave boundary
#   altogether. These instead get the bioregion with the largest overlap
#   area, tagged "majority" - an honest "most of this area is in X", not a
#   precise match.

suppressPackageStartupMessages(library(tidyverse))
suppressPackageStartupMessages(library(sf))

places_path <- "data/raw/spatial/western-cape-places-2018.geojson"
bioregions_path <- "data/processed/western_cape_bioregions.geojson"
vegmap_path <- "data/raw/spatial/western-cape-vegetation-map-2018.geojson"
output_path <- "data/processed/western_cape_places.csv"

# A place gets EVERY biome it touches, not one. Species are filtered by
# biome (99.8% populated) rather than bioregion (23.4%), so this column is
# what drives the recommendation - see docs/NOW.md. A place on a boundary
# genuinely sits in more than one, and the user can deselect.
BOUNDARY_BUFFER_M <- 1000

FINE_CATEGORIES <- c("Urban", "Rural", "Suburb")
BROAD_CATEGORIES <- c("Municipality", "District")

places <- st_read(places_path, quiet = TRUE) %>%
  st_make_valid() %>%
  filter(!is.na(name), str_squish(name) != "")

bioregions <- st_read(bioregions_path, quiet = TRUE) %>%
  st_make_valid()

# --- Biome layer, dissolved from the source vegetation map ---------------
# The dissolved bioregion layer carries no biome, so biomes come straight
# from the vegmap's own BIOME_18 field, normalised the same way
# build_bioscape_traits.R normalises it ("Forests" -> "Forest",
# "Nama-Karoo" -> "Nama Karoo"). Azonal/blank/<Null> polygons are dropped:
# they are not one of the nine biomes the catalogue uses.
biome_layer <- st_read(vegmap_path, quiet = TRUE) %>%
  st_make_valid() %>%
  mutate(
    biome = case_when(
      str_squish(coalesce(BIOME_18, "")) == "Forests" ~ "Forest",
      str_squish(coalesce(BIOME_18, "")) == "Nama-Karoo" ~ "Nama Karoo",
      str_squish(coalesce(BIOME_18, "")) %in%
        c("Fynbos", "Succulent Karoo", "Albany Thicket", "Grassland",
          "Indian Ocean Coastal Belt", "Desert") ~ str_squish(BIOME_18),
      TRUE ~ NA_character_
    )
  ) %>%
  filter(!is.na(biome)) %>%
  select(biome) %>%
  group_by(biome) %>%
  summarise(geometry = st_union(geometry), .groups = "drop") %>%
  st_make_valid()

cat(sprintf("Dissolved %d biome shape(s) from the vegetation map\n", nrow(biome_layer)))

# Collapse a place's matched biomes into one ";"-joined cell, ordered as
# supplied (area share for broad places, containment first for fine ones).
collapse_biomes <- function(values) {
  paste(unique(values[!is.na(values)]), collapse = ";")
}

# --- Fine categories: centroid-in-polygon, nearest-bioregion fallback -----

fine_places <- places %>% filter(category %in% FINE_CATEGORIES)
fine_centroids <- st_centroid(fine_places)

fine_contains <- st_join(fine_centroids, bioregions, join = st_within) %>%
  st_drop_geometry() %>%
  select(name, category, bioregion)

fine_nearest_index <- st_nearest_feature(fine_centroids, bioregions)
fine_nearest <- tibble(
  name = fine_places$name,
  category = fine_places$category,
  bioregion_nearest = bioregions$bioregion[fine_nearest_index]
)

fine_result <- fine_contains %>%
  left_join(fine_nearest, by = c("name", "category"), relationship = "many-to-many") %>%
  mutate(
    bioregion_source = if_else(is.na(bioregion), "nearest", "contains"),
    bioregion = if_else(is.na(bioregion), bioregion_nearest, bioregion)
  ) %>%
  select(name, category, bioregion, bioregion_source) %>%
  distinct(name, category, .keep_all = TRUE)

# --- Broad categories: majority overlap area -------------------------------

broad_places <- places %>% filter(category %in% BROAD_CATEGORIES)

broad_overlap <- st_intersection(broad_places, bioregions) %>%
  st_make_valid() %>%
  mutate(overlap_area = st_area(.)) %>%
  st_drop_geometry() %>%
  group_by(name, category, bioregion) %>%
  summarise(overlap_area = sum(overlap_area), .groups = "drop") %>%
  group_by(name, category) %>%
  slice_max(overlap_area, n = 1, with_ties = FALSE) %>%
  ungroup() %>%
  select(name, category, bioregion) %>%
  mutate(bioregion_source = "majority")

broad_matched_keys <- broad_overlap %>% distinct(name, category)
broad_unmatched <- broad_places %>% anti_join(broad_matched_keys, by = c("name", "category"))

broad_fallback <- tibble()
if (nrow(broad_unmatched) > 0) {
  broad_unmatched_centroids <- st_centroid(broad_unmatched)
  nearest_index <- st_nearest_feature(broad_unmatched_centroids, bioregions)
  broad_fallback <- tibble(
    name = broad_unmatched$name,
    category = broad_unmatched$category,
    bioregion = bioregions$bioregion[nearest_index],
    bioregion_source = "nearest"
  )
}

broad_result <- bind_rows(broad_overlap, broad_fallback)

# --- Biomes per place ---------------------------------------------------

# Fine places: the biome the centroid sits in, plus any biome whose
# polygon comes within BOUNDARY_BUFFER_M of it. A settlement on a biome
# boundary really does draw on both, and this is also what rescues the
# ~25% of the province that is unclassified (urban and farmland), where
# the centroid lands inside no polygon at all.
fine_biome_hits <- st_is_within_distance(
  fine_centroids, biome_layer, dist = BOUNDARY_BUFFER_M
)
fine_biomes <- tibble(
  name = fine_places$name,
  category = fine_places$category,
  biomes = map_chr(fine_biome_hits, ~ collapse_biomes(biome_layer$biome[.x]))
)

# Anything still empty (further than the buffer from any biome) falls back
# to the single nearest, so no place is left unfilterable.
fine_nearest_biome_index <- st_nearest_feature(fine_centroids, biome_layer)
fine_biomes <- fine_biomes %>%
  mutate(
    biomes = if_else(
      biomes == "",
      biome_layer$biome[fine_nearest_biome_index],
      biomes
    )
  )

# Broad places: every intersecting biome, ordered by how much of the area
# each covers, so the first listed is the dominant one.
broad_biomes <- st_intersection(broad_places, biome_layer) %>%
  st_make_valid() %>%
  mutate(overlap_area = as.numeric(st_area(.))) %>%
  st_drop_geometry() %>%
  group_by(name, category, biome) %>%
  summarise(overlap_area = sum(overlap_area), .groups = "drop") %>%
  arrange(name, category, desc(overlap_area)) %>%
  group_by(name, category) %>%
  summarise(biomes = collapse_biomes(biome), .groups = "drop")

place_biomes <- bind_rows(fine_biomes, broad_biomes)

# --- Combine and write -------------------------------------------------

place_bioregions <- bind_rows(fine_result, broad_result) %>%
  left_join(place_biomes, by = c("name", "category")) %>%
  mutate(biomes = coalesce(biomes, "")) %>%
  arrange(category, name)

multi <- sum(str_detect(place_bioregions$biomes, ";"))
missing <- sum(place_bioregions$biomes == "")
cat(sprintf(
  "Biomes assigned: %d place(s) span more than one biome, %d unresolved\n",
  multi, missing
))

write.csv(place_bioregions, output_path, row.names = FALSE)

cat(sprintf(
  "Wrote %d places to %s (%d direct match, %d majority-overlap, %d nearest-bioregion fallback)\n",
  nrow(place_bioregions),
  output_path,
  sum(place_bioregions$bioregion_source == "contains"),
  sum(place_bioregions$bioregion_source == "majority"),
  sum(place_bioregions$bioregion_source == "nearest")
))
