"""
Management command: assign a single image to every product.

Copies  D:\\BACKUP\\...\\media\\product-image.webp
→  MEDIA_ROOT/products/<slug>/product-image.webp  for every product.

Usage:
    python manage.py product_seed_images
    python manage.py product_seed_images --source "D:/BACKUP/.../media/product-image.webp"
    python manage.py product_seed_images --dry-run
    python manage.py product_seed_images --overwrite
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.models import Product  # adjust app label if needed


DEFAULT_SOURCE = (
    r"D:\BACKUP\Complete Projects\pharmacy_management_project"
    r"\pharma_project\media\product-image.webp"
)


class Command(BaseCommand):
    help = "Assign a single placeholder image to every product in the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            dest="source",
            default=DEFAULT_SOURCE,
            help="Full path to the source image file. Default: %(default)s",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            default=False,
            help="Re-assign the image even if the product already has one.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Print what would happen without making any changes.",
        )

    def handle(self, *args, **options):
        source = Path(options["source"])
        overwrite = options["overwrite"]
        dry_run = options["dry_run"]

        # ── Validate source file ───────────────────────────────────────
        if not source.exists():
            raise CommandError(
                f"Source image not found:\n  {source}\n"
                "Pass the correct path with --source."
            )

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"{'[DRY RUN] ' if dry_run else ''}Seeding product images"
        ))
        self.stdout.write(f"  Source image : {source}")
        self.stdout.write(f"  MEDIA_ROOT   : {settings.MEDIA_ROOT}")
        self.stdout.write(f"  Overwrite    : {overwrite}\n")

        products = Product.objects.all().order_by("name")
        total = products.count()

        if total == 0:
            self.stdout.write(self.style.WARNING("No products found in the database."))
            return

        assigned = skipped = errors = 0

        for product in products:
            # Each product gets its own copy so images can be swapped individually later
            dest_rel = f"products/{product.slug}/product-image.webp"
            dest_abs = Path(settings.MEDIA_ROOT) / dest_rel

            if product.image and not overwrite:
                self.stdout.write(
                    f"  [SKIP]  {product.name!r} — already has image"
                )
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    self.style.SUCCESS(f"  [DRY RUN] {product.name!r} → {dest_rel}")
                )
                assigned += 1
                continue

            try:
                dest_abs.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, dest_abs)

                product.image = dest_rel
                product.save(update_fields=["image"])

                self.stdout.write(
                    self.style.SUCCESS(f"  [OK]  {product.name!r} → {dest_rel}")
                )
                assigned += 1

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"  [ERROR]  {product.name!r} — {exc}")
                )
                errors += 1

        # ── Summary ───────────────────────────────────────────────────
        self.stdout.write("\n" + "─" * 50)
        self.stdout.write(f"Total products : {total}")
        self.stdout.write(self.style.SUCCESS(f"Assigned       : {assigned}"))
        self.stdout.write(f"Skipped        : {skipped}")
        if errors:
            self.stdout.write(self.style.ERROR(f"Errors         : {errors}"))
        self.stdout.write("─" * 50)

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDry-run complete — no changes were saved.")
            )