#LIBRARYS NEEDED
suppressPackageStartupMessages(library(tidyverse))

# Attribute-level data quality profile of the species catalogue: one row
# per variable with measurement type, completeness and class count.
#
# Run this script with the working directory set to the repo root
# (garden-skripsie/), so these relative paths resolve correctly:
#     Rscript data/scripts/data_quality_report.R
#
# Writes data/processed/data_quality_report.csv and prints the same
# table to the console.

INPUT  <- "data/processed/plant_database_western_cape.csv"
OUTPUT <- "data/processed/data_quality_report.csv"

# Print the profile as one table instead of letting R wrap the `values`
# column into a second block below the others.
options(width = 200)

# The source CSV is written by R and by Python, so missing values arrive
# as several different sentinels. Everything is read as character so this
# script decides the type itself rather than inheriting readr's guess.
MISSING <- c("", "NA", "N/A", "NE", "null", "None", "<Null>")

df <- read_csv(INPUT, na = MISSING, col_types = cols(.default = col_character()))

# ---- Helpers -------------------------------------------------------

# Multi-value cells hold ";"- or "|"-joined tokens (CSV cells can't hold
# real arrays). Class counts for those should count distinct tokens, not
# distinct combinations: "full;part" is two classes, not a third one.
DELIMS <- ";|\\|"

is_multi <- function(x) any(str_detect(x, DELIMS), na.rm = TRUE)

atomic_tokens <- function(x) {
  x %>% na.omit() %>% str_split(DELIMS) %>% unlist() %>% str_trim() %>% discard(~ .x == "")
}

is_numeric_col <- function(x) {
  present <- na.omit(x)
  length(present) > 0 && !any(is.na(suppressWarnings(as.numeric(present))))
}

classify <- function(x) {
  present <- na.omit(x)
  n <- length(present)
  k <- n_distinct(present)
  if (n == 0) return("empty")
  if (is_numeric_col(x)) return("numeric")
  if (k == 1) return("constant")
  if (k == 2) return("binary")
  if (is_multi(x)) return("categorical (multi)")
  if (n > 50 && k / n > 0.9) return("identifier")
  if (k <= 30) return("categorical")
  "categorical (wide)"
}

# min / median / max for numerics; the most frequent classes otherwise -
# enough to eyeball whether the values are what you expect.
summarise_values <- function(x, type) {
  present <- na.omit(x)
  if (length(present) == 0) return("")
  if (type == "numeric") {
    v <- as.numeric(present)
    return(sprintf("min %s | med %s | max %s",
                   format(min(v), big.mark = ","),
                   format(median(v), big.mark = ","),
                   format(max(v), big.mark = ",")))
  }
  vals <- if (is_multi(x)) atomic_tokens(x) else as.character(present)
  top <- sort(table(vals), decreasing = TRUE)[1:min(3, n_distinct(vals))]
  paste(sprintf("%s (%d)", names(top), as.integer(top)), collapse = ", ")
}

count_classes <- function(x, type) {
  present <- na.omit(x)
  if (length(present) == 0) return(0L)
  if (type == "numeric") return(n_distinct(present))
  if (is_multi(x)) return(n_distinct(atomic_tokens(x)))
  n_distinct(present)
}

# ---- Per-variable profile ------------------------------------------

total <- nrow(df)

report <- map_dfr(names(df), function(col) {
  x <- df[[col]]
  type <- classify(x)
  present <- sum(!is.na(x))
  tibble(
    variable = col,
    type     = type,
    n        = present,
    missing  = total - present,
    complete = round(100 * present / total, 1),
    classes  = count_classes(x, type),
    values   = str_trunc(summarise_values(x, type), 52)
  )
}) %>% arrange(desc(complete))

# ---- Completeness by source ----------------------------------------

# Missingness here is structural rather than random: each record comes
# from BioSCape field records, PlantZAfrica horticultural profiles or
# both, and the two carry almost disjoint attributes. This second table
# is what makes the gaps in the first one interpretable.
by_source <- df %>%
  group_by(data_source) %>%
  summarise(
    records   = n(),
    family    = round(100 * mean(!is.na(family)), 1),
    bioregion = round(100 * mean(!is.na(bioregion)), 1),
    sun       = round(100 * mean(!is.na(sun)), 1),
    water     = round(100 * mean(!is.na(water)), 1),
    spread_cm = round(100 * mean(!is.na(spread_cm)), 1),
    height_cm = round(100 * mean(!is.na(height_cm)), 1),
    .groups   = "drop"
  ) %>%
  arrange(desc(records))

# ---- Output --------------------------------------------------------

cat("\nDATA QUALITY REPORT -", INPUT, "\n")
cat(sprintf("%d records x %d variables\n", total, ncol(df)))
cat(strrep("-", 118), "\n")
print.data.frame(as.data.frame(report), right = FALSE, row.names = FALSE)

cat("\nCOMPLETENESS BY SOURCE (% non-missing within each group)\n")
cat(strrep("-", 118), "\n")
print.data.frame(as.data.frame(by_source), right = FALSE, row.names = FALSE)

write_csv(report, OUTPUT)
cat("\nWrote", OUTPUT, "\n")
