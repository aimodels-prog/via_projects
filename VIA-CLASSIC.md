# VIA Classic PDF

New PDF previews/downloads use `templates/salalah/master-classic.pdf`. The original
sanitized `master.pdf` remains unchanged. Existing downloaded PDFs are not altered;
generate a new preview/download to see the new design. Web dashboard styling and
saved project data are unchanged.

The design preserves the A4 page, section positions, original type sizes, field
geometry, photo frames, chart modes and multi-logo composition. VIA blue (#05538F)
section bands, pale blue (#E8F2FA) header panels and blue-grey rules replace the
source's coloured table fills and dark red gutters. Activity legend colours and
uploaded image pixels are retained. Uploaded pictures are not recoloured.

To rebuild the design asset (development only, requires PyMuPDF):

    python scripts/build_via_classic_master.py

The script checks that all static text survives. Runtime PDF generation needs no
Python. Docker already packages the templates directory.

Visual review sample using source July figures and original image crops:

    npx tsx scripts/proof-salalah.ts .data/salalah-proof-assets deliverables/via-classic-preview.pdf

The sample is a design proof, not a published or approved report. Its S-curve is the
original uploaded chart picture; other reports still generate vector graphs when
monthly data is supplied. Review real project captions, image framing and dense
text in their PDF preview before publication. Existing overflow checks remain active.
