
import csv
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import gdown

INPUT_FILE = Path("links.txt")
OUTPUT_DIR = Path("downloads")
LOG_FILE = Path("download_log.csv")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def get_file_id(url):
    """Extract a Google Drive file ID from common Drive URLs."""
    parsed = urlparse(url.strip())

    if parsed.netloc.lower() in {
        "drive.google.com",
        "www.drive.google.com",
    }:
        query_id = parse_qs(parsed.query).get("id")
        if query_id:
            return query_id[0]

        match = re.search(r"/file/d/([^/]+)", parsed.path)
        if match:
            return match.group(1)

    raise ValueError(f"Unrecognised Google Drive URL: {url}")


def safe_filename(name):
    """Remove characters that are invalid in Windows filenames."""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name.strip())
    return name or "unnamed"


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Cannot find {INPUT_FILE.resolve()}"
        )

    # Read the input and remove exact duplicate file IDs.
    files = []
    seen_ids = set()

    with INPUT_FILE.open("r", encoding="utf-8-sig") as f:
        for line_number, row in enumerate(f, start=1):
            row = row.strip()

            if not row:
                continue

            try:
                name, url = row.split(",", 1)
                name = safe_filename(name)
                url = url.strip()
                file_id = get_file_id(url)

                if file_id in seen_ids:
                    print(f"Skipping duplicate: {name} ({file_id})")
                    continue

                seen_ids.add(file_id)
                files.append((name, url, file_id))

            except Exception as exc:
                print(f"Invalid line {line_number}: {exc}")

    # Record the results so failures can be retried later.
    log_exists = LOG_FILE.exists()
    completed = 0
    failed = 0

    with LOG_FILE.open(
        "a", newline="", encoding="utf-8"
    ) as log:
        writer = csv.writer(log)

        if not log_exists:
            writer.writerow(["filename", "file_id", "status", "details"])

        for index, (name, url, file_id) in enumerate(files, start=1):
            output = OUTPUT_DIR / f"{name}.png"

            print(f"\n[{index}/{len(files)}] {name}")

            # Don't download a file that is already present.
            if output.exists() and output.stat().st_size > 0:
                print("Already exists; skipping.")
                writer.writerow([name, file_id, "SKIPPED", "Already exists"])
                completed += 1
                continue

            try:
                result = gdown.download(
                    url=url,
                    output=str(output),
                    quiet=False,
                )

                if result and output.exists() and output.stat().st_size > 0:
                    print(f"Downloaded: {output}")
                    writer.writerow([name, file_id, "SUCCESS", ""])
                    completed += 1
                else:
                    print("Download failed; check sharing permissions.")
                    writer.writerow([
                        name, file_id, "FAILED",
                        "No file downloaded; check URL and permissions"
                    ])
                    failed += 1

            except Exception as exc:
                print(f"Error: {exc}")
                writer.writerow([name, file_id, "FAILED", str(exc)])
                failed += 1

            # Avoid hammering Google Drive.
            time.sleep(0.5)

    print("\n========== SUMMARY ==========")
    print(f"Unique files processed: {len(files)}")
    print(f"Downloaded or already present: {completed}")
    print(f"Failed: {failed}")
    print(f"Output folder: {OUTPUT_DIR.resolve()}")
    print(f"Log file: {LOG_FILE.resolve()}")


if __name__ == "__main__":
    main()
