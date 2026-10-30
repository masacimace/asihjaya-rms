ASIHJAYA Receipt Overlay — Media Full-Fill Patch
=================================================

Scope
-----
File changed:
src/features/sales/documents/receipt-certificate-overlay-client.css

Locked behavior
---------------
1. Product photo (preprinted_overlay only)
   - Uses the existing 25mm x 25mm .aj-thumb slot.
   - Removes the previous effective inner padding during physical overlay.
   - Image fills 100% x 100%.
   - object-fit: cover.
   - object-position: center.
   - The vendor's pre-printed dashed frame is not redrawn by the overlay.

2. QR (preprinted_overlay only)
   - Uses the existing 19mm x 19mm .aj-qr-box canvas.
   - No additional CSS padding.
   - SVG fills 100% x 100% of the canvas.
   - object-fit: contain.
   - The QR generator's intrinsic 4-module quiet zone is intentionally kept.
     Do not remove it: it improves scan reliability.

Why this patch is overlay-scoped
--------------------------------
The physical custom paper is already mass-produced. This patch treats that
paper as the fixed geometry/source of truth and aligns dynamic media to its
existing slots without changing vendor artwork.

Hardware Hub acceptance
-----------------------
Test with Hardware Hub 0.9.3. For A5 pre-printed overlay the SumatraPDF
command should resolve to:

paper=A5,noscale,color,simplex,ignore-pdf-print-settings

If an outlet is still on 0.9.2 / A5 fit, photo and QR can still look smaller or
shifted even with this CSS patch.

Suggested physical test
-----------------------
1. Use the same transaction/sample image as the previous print.
2. Print on one existing custom A5 sheet using local Hardware Hub 0.9.3.
3. Verify the product image reaches the vendor photo frame on all four sides.
4. Verify the QR canvas aligns to the vendor QR frame.
5. Scan QR from normal receipt-reading distance.
6. Only after this, calibrate global X/Y offsets if the whole overlay is shifted.
