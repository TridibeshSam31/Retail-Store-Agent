"""CLI wrapper for the same in-process prediction service used by FastAPI.

Usage:
    python ml/pipeline/prediction.py --org-id 1
    python ml/pipeline/prediction.py --org-id 1 --store-id 2 --item-id 7
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow direct execution from the backend directory.
BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.db import SessionLocal
from ml.pipeline.service import recompute_predictions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", type=int, required=True)
    parser.add_argument("--store-id", type=int)
    parser.add_argument("--item-id", type=int)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        rows = recompute_predictions(
            db,
            args.org_id,
            store_id=args.store_id,
            item_id=args.item_id,
        )
        db.commit()
        print(f"Wrote {len(rows)} prediction(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
