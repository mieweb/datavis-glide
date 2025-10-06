#!/usr/bin/env gawk -f

# SUMMARY: A program to produce DataVis language packs from TSV files.
#
# USAGE: gawk -f ./bin/make-lang-packs.awk en-US.tsv trans/[LANG].tsv ...
#   -> produces src/lang/[LANG].js ...
#
# DESCRIPTION:
#
# en-US.tsv is a TSV file containing the following columns:
#
#   1. Label used by DataVis' translation system.
#   2. The English version of the text.
#   3. Notes for translators.
#
# [LANG].tsv is a TSV file, translated for a specific language:
#
#   1. Label used by DataVis' translation system.
#   2. The translated version of the text.
#
# Blank lines and lines starting with "//" are ignored.
#
# Translation files are currently being produced by providing Ozwell with the following prompt:
#
#   Translate the following TSV content into [LANG]. The file has the following tab-separated
#   columns: (1) label - do not translate this column, (2) english text - translate this,
#   (3) notes - use this to pick an appropriate translation, if present; do not include this in the
#   output. The english text may include placeholders such as "%s" and "%d" which must also occur
#   in the corresponding place in the translated text. For output, generate a code block containing
#   TSV data with these columns: (1) label - the same as from the input, (2) the translated text.
#   Keep any blank lines and lines starting with "//" exactly as they are in the input. Here's the
#   file to translate:
#
#   [INCLUDE en-US.tsv HERE]

BEGIN {
    FS = "\t"
    PROCINFO["sorted_in"] = "@ind_str_asc"
}

BEGINFILE {
    patsplit(FILENAME, l, "[^/.]+")
    lang = l[length(l)-1]
}

FNR < 2 { next }
/^[[:space:]]*\/\// { next }
/^[[:space:]]*$/ { next }

# English file format: label | text | comment

lang == "en-US" {
    english[$1] = $2
    notes[$1] = $3
    trans["en-US"][$1] = $2
}

# Translation file format: label | translated

lang != "en-US" {
    if ($1 in english) {
        trans[lang][$1] = $2
    }
    else {
        notInEnglish[lang][$1] = $2
    }
}

END {
    for (lang in trans) {
        jsFile = "./src/lang/" lang ".js"
        print("Writing " jsFile "...")
        print("export default {") > jsFile
        for (label in english) {
            if (label in trans[lang]) {
                gsub(/'/, "\\'", trans[lang][label])
                print("  '" label "': '" trans[lang][label] "',") > jsFile
            }
            else {
                missing[lang][label] = 1
                print("  - Missing translation for: " label)
            }
        }
        print("};") > jsFile
        if (length(missing[lang]) > 0) {
            missingFile = "./trans-missing/" lang ".tsv"
            print("Label\tEnglish\tNotes") > missingFile
            for (label in missing[lang]) {
                print(label "\t" english[label] "\t" notes[label]) > missingFile
            }
        }
        if (length(notInEnglish[lang]) > 0) {
            for (label in notInEnglish[lang]) {
                print("  - Extra translation for: " label)
                print("    > " notInEnglish[lang][label])
            }
        }
    }
}
