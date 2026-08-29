#!/usr/bin/env python3
"""
Generate unique per-unit QR codes for a physical product-hunt campaign.

Produces:
  1. A CSV ready to import into the `product_codes` table (or feed to a
     Supabase insert script) — campaign_id, code, store_location.
  2. A print-ready PDF sheet of QR labels for the client's printer.

Usage:
  python3 generate_product_codes.py \
      --campaign-id <uuid> \
      --count 200 \
      --prefix MRPRIZE \
      --base-url https://unlock.app/claim \
      --stores "Sandton City,Menlyn,Canal Walk"

Each code is a short random token appended to --prefix, e.g. MRPRIZE-7F3K9Q.
The QR encodes a claim deep link: <base-url>?code=<code>&campaign=<campaign-id>
so scanning goes straight into the app's claim flow.
"""

import argparse
import csv
import secrets
import string
from pathlib import Path

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ALPHABET = string.ascii_uppercase + string.digits
# Excludes visually ambiguous chars (0/O, 1/I/L) to avoid misreads if anyone
# ever has to type a code in manually as a fallback.
SAFE_ALPHABET = "".join(c for c in ALPHABET if c not in "0O1IL")


def gen_token(length: int = 6) -> str:
    return "".join(secrets.choice(SAFE_ALPHABET) for _ in range(length))


def build_codes(campaign_id: str, count: int, prefix: str, stores: list[str]) -> list[dict]:
    seen = set()
    rows = []
    while len(rows) < count:
        token = f"{prefix}-{gen_token()}"
        if token in seen:
            continue
        seen.add(token)
        store = stores[len(rows) % len(stores)] if stores else None
        rows.append({"campaign_id": campaign_id, "code": token, "store_location": store})
    return rows


def write_csv(rows: list[dict], out_path: Path) -> None:
    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["campaign_id", "code", "store_location"])
        writer.writeheader()
        writer.writerows(rows)


def make_qr_image(data: str):
    qr = qrcode.QRCode(box_size=10, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return img.get_image() if hasattr(img, "get_image") else img.convert("RGB")


def write_pdf(rows: list[dict], base_url: str, campaign_id: str, out_path: Path) -> None:
    page_w, page_h = A4
    margin = 12 * mm
    label_w = 55 * mm
    label_h = 65 * mm
    cols = int((page_w - 2 * margin) // label_w)
    rows_per_page = int((page_h - 2 * margin) // label_h)
    per_page = cols * rows_per_page

    c = canvas.Canvas(str(out_path), pagesize=A4)

    for i, row in enumerate(rows):
        pos_on_page = i % per_page
        if i > 0 and pos_on_page == 0:
            c.showPage()

        col = pos_on_page % cols
        line = pos_on_page // cols

        x = margin + col * label_w
        y = page_h - margin - (line + 1) * label_h

        claim_url = f"{base_url}?code={row['code']}&campaign={campaign_id}"
        img = make_qr_image(claim_url)

        qr_size = 40 * mm
        qr_x = x + (label_w - qr_size) / 2
        qr_y = y + label_h - qr_size - 8 * mm

        c.drawImage(ImageReader(img), qr_x, qr_y, width=qr_size, height=qr_size)

        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + label_w / 2, qr_y - 10, row["code"])

        if row.get("store_location"):
            c.setFont("Helvetica", 6)
            c.drawCentredString(x + label_w / 2, qr_y - 20, row["store_location"])

        # cut guides
        c.setDash(1, 2)
        c.setStrokeColorRGB(0.7, 0.7, 0.7)
        c.rect(x + 2, y + 2, label_w - 4, label_h - 4)

    c.save()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--campaign-id", required=True)
    ap.add_argument("--count", type=int, required=True)
    ap.add_argument("--prefix", default="UNLOCK")
    ap.add_argument("--base-url", default="https://unlock.app/claim")
    ap.add_argument("--stores", default="", help="Comma-separated store names, round-robin assigned")
    ap.add_argument("--out-dir", default="./out")
    args = ap.parse_args()

    stores = [s.strip() for s in args.stores.split(",") if s.strip()]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = build_codes(args.campaign_id, args.count, args.prefix, stores)

    csv_path = out_dir / f"{args.prefix}_product_codes.csv"
    pdf_path = out_dir / f"{args.prefix}_qr_sheet.pdf"

    write_csv(rows, csv_path)
    write_pdf(rows, args.base_url, args.campaign_id, pdf_path)

    print(f"Generated {len(rows)} unique codes")
    print(f"CSV  -> {csv_path}")
    print(f"PDF  -> {pdf_path}")
    print()
    print("To load into Supabase, run in the SQL editor or via psql:")
    print(f"  \\copy product_codes(campaign_id, code, store_location) from '{csv_path}' with csv header;")


if __name__ == "__main__":
    main()
