[CmdletBinding()]
param(
    [switch]$SkipLargeOccurrence,
    [switch]$SkipSpatial
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Download-File {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [Parameter(Mandatory)][string]$RelativePath
    )

    $destination = Join-Path $repoRoot $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    if ((Test-Path -LiteralPath $destination) -and
        (Get-Item -LiteralPath $destination).Length -gt 0) {
        Write-Host "Already present: $RelativePath"
        return
    }
    Write-Host "Downloading: $RelativePath"
    & curl.exe --fail --location --retry 4 --retry-delay 3 `
        --connect-timeout 30 --max-time 900 --output $destination $Uri
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed: $Uri"
    }
}

Download-File `
    -Uri 'https://ipt.sanbi.org.za/archive.do?r=sanpc2025' `
    -RelativePath 'data/raw/sanbi/sanpc-2026/dwca-sanpc-2026-v1.3.zip'

if (-not $SkipLargeOccurrence) {
    Download-File `
        -Uri 'https://ipt.sanbi.org.za/archive.do?r=brahms_online' `
        -RelativePath 'data/raw/sanbi/bodatsa-2026/dwca-bodatsa-v1.32.zip'
}

Download-File `
    -Uri 'https://ipt.sanbi.org.za/archive.do?r=alienplantssa2025' `
    -RelativePath 'data/raw/sanbi/alien-species-2025/dwca-alien-species-sa-2025.zip'

Download-File `
    -Uri 'https://zenodo.org/api/records/14937470/files/A_checklist_of_alien_taxa_for_South%20Africa_v20250520.xlsx/content' `
    -RelativePath 'data/raw/sanbi/alien-species-2025/A_checklist_of_alien_taxa_for_South_Africa_v20250520.xlsx'

# The companion repository's two source filenames are reversed relative to the
# variables they contain. The local names below follow the NASA data dictionary.
Download-File `
    -Uri 'https://raw.githubusercontent.com/henryf6/GCFR_Traits/main/Data_Workflow_3_Final_Polishing/Data_Outputs/Species_Traits.csv' `
    -RelativePath 'data/raw/bioscape-gcfr-2026/BioSCape_foliar_species_traits.csv'
Download-File `
    -Uri 'https://raw.githubusercontent.com/henryf6/GCFR_Traits/main/Data_Workflow_3_Final_Polishing/Data_Outputs/Leaf_Struct_Water_Traits.csv' `
    -RelativePath 'data/raw/bioscape-gcfr-2026/BioSCape_foliar_canopy_leaf_chemistry.csv'
Download-File `
    -Uri 'https://raw.githubusercontent.com/henryf6/GCFR_Traits/main/Data_Workflow_3_Final_Polishing/Data_Outputs/Canopy_Leaf_Chemistry.csv' `
    -RelativePath 'data/raw/bioscape-gcfr-2026/BioSCape_foliar_leaf_struct_water_traits.csv'
Download-File `
    -Uri 'https://raw.githubusercontent.com/henryf6/GCFR_Traits/main/Data_Workflow_3_Final_Polishing/Data_Outputs/Releve.csv' `
    -RelativePath 'data/raw/bioscape-gcfr-2026/BioSCape_foliar_releve.csv'
Download-File `
    -Uri 'https://raw.githubusercontent.com/henryf6/GCFR_Traits/main/LICENSE' `
    -RelativePath 'data/raw/bioscape-gcfr-2026/SOURCE_LICENSE.txt'

Download-File `
    -Uri 'https://www.dffe.gov.za/sites/default/files/legislations/nemba_invasivespecieslist_g43726gon1003.pdf' `
    -RelativePath 'data/raw/legal/nemba_invasivespecieslist_g43726gon1003.pdf'
Download-File `
    -Uri 'https://www.dffe.gov.za/sites/default/files/legislations/nemba_invasivespeciesregulations_g43735gon1020_1_0.pdf' `
    -RelativePath 'data/raw/legal/nemba_invasivespeciesregulations_g43735gon1020_1_0.pdf'
Download-File `
    -Uri 'https://www.dffe.gov.za/sites/default/files/legislations/nemba_alieninvasivespeciesregulationcommencement_g44182gon115_0.pdf' `
    -RelativePath 'data/raw/legal/nemba_invasivespeciesregulationcommencement_g44182gon115_0.pdf'

Push-Location $repoRoot
try {
    if (-not $SkipSpatial) {
        python data/scripts/download_western_cape_vegmap.py
    }
    python data/scripts/build_processed_data.py
}
finally {
    Pop-Location
}
