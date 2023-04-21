#!/usr/bin/env gawk

# This program uses information about DataVis' supported translation items,
# plus a dump of translations in various languages, to produce language packs
# for all languages specified.
#
#   1. Convert all translations in lang/en-US.js into a TSV file, call this file en.tsv.
#   2. Fetch all translations using a system report, download in TSV format, call this file trans.tsv.
#
#   > select lang_code, context, value, trans
#   > from common_label_translate
#   > into outfile 'trans.tsv'
#   >   columns terminated by '\t'
#   >   lines terminated by '\n'
#
#   $ gawk ./bin/make-lang-packs.awk en.tsv trans.tsv

BEGIN {
    FS = "\t"
    PROCINFO["sorted_in"] = "@ind_str_asc"
}

BEGINFILE {
    patsplit(FILENAME, l, "[^/.]+")
    lang = l[length(l)-1]
}

/^[[:space:]]*\/\// { next }
/^[[:space:]]*$/ { next }

# English file format: label | text

lang == "en" {
    english[$1] = $2
    trans["en"][$1] = $2
}

# Translation file format: language | label | english | translated

lang != "en" && $2 in english {
    trans[$1][$2] = $4
}

END {
    for (lang in trans) {
        fh = "./src/lang/" lang ".js"
        print("Writing " fh "...")
        print("export default {") > fh
        for (label in english) {
            if (label in trans[lang]) {
                print("  '" label "': '" trans[lang][label] "',") > fh
            }
        }
        print("};") > fh
    }
}
