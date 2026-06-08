import argparse
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"


@dataclass
class ProductRow:
    id: int
    sku: str | None
    scale_code: str | None
    name: str
    purchase_price: float
    price: float
    stock: float
    min_stock: float
    sale_unit: str
    expiry_date: str | None
    brand: str | None
    category: str | None
    is_active: int


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def env_value(key: str, env_file: dict[str, str]) -> str:
    value = os.environ.get(key) or env_file.get(key)
    if not value:
        raise RuntimeError(f"Missing required env var: {key}")
    return value


def to_decimal(value: float | int | str | None) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise RuntimeError(f"Invalid numeric value: {value!r}") from exc


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    compact = " ".join(value.split()).strip()
    return compact or None


def build_name(name: str, brand: str | None) -> str:
    clean_name = normalize_text(name) or "Producto sin nombre"
    clean_brand = normalize_text(brand)
    if not clean_brand:
        return clean_name
    suffix = f" - {clean_brand}"
    return clean_name if clean_name.endswith(suffix) else f"{clean_name}{suffix}"


def is_weight_product(sale_unit: str | None) -> bool:
    normalized = (sale_unit or "").strip().upper()
    return normalized not in {"", "UNIDAD", "UNIDADES", "UNIT", "UN"}


def map_product(row: ProductRow, business_id: str) -> dict[str, object]:
    sold_by_weight = is_weight_product(row.sale_unit)
    stock_value = Decimal(str(row.stock or 0))
    min_stock_value = Decimal(str(row.min_stock or 0))
    barcode = normalize_text(row.sku)
    scale_code = normalize_text(row.scale_code)

    mapped = {
        "business_id": business_id,
        "name": build_name(row.name, row.brand),
        "sku": None,
        "barcode": barcode,
        "scale_code": scale_code,
        "category": normalize_text(row.category),
        "price": str(to_decimal(row.price)),
        "cost": str(to_decimal(row.purchase_price)),
        "stock": 0 if sold_by_weight else int(stock_value),
        "stock_decimal": "0.000" if not sold_by_weight else f"{stock_value.quantize(Decimal('0.001'))}",
        "low_stock_threshold": 0 if sold_by_weight else int(min_stock_value),
        "low_stock_threshold_decimal": (
            "0.000" if not sold_by_weight else f"{min_stock_value.quantize(Decimal('0.001'))}"
        ),
        "sold_by_weight": sold_by_weight,
        "expires_at": normalize_text(row.expiry_date),
        "active": bool(row.is_active),
    }
    return mapped


def sqlite_products(sqlite_path: Path) -> list[ProductRow]:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            select
              id,
              sku,
              scale_code,
              name,
              purchase_price,
              price,
              stock,
              min_stock,
              sale_unit,
              expiry_date,
              brand,
              category,
              is_active
            from products
            where is_active = 1
            order by id
            """
        ).fetchall()
    finally:
        conn.close()
    return [ProductRow(**dict(row)) for row in rows]


def supabase_request(url: str, api_key: str, method: str = "GET", body: object | None = None) -> list[dict]:
    data = None
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = resp.read().decode("utf-8")
            return json.loads(payload) if payload else []
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase HTTP {exc.code}: {detail}") from exc


def fetch_existing_products(base_url: str, api_key: str, business_id: str) -> list[dict]:
    params = urllib.parse.urlencode(
        {
            "business_id": f"eq.{business_id}",
            "select": "id,name,barcode,scale_code",
            "limit": "5000",
        }
    )
    url = f"{base_url}/rest/v1/products?{params}"
    return supabase_request(url, api_key)


def existing_keys(rows: list[dict]) -> tuple[set[str], set[str], set[str]]:
    by_barcode: set[str] = set()
    by_scale_code: set[str] = set()
    by_name: set[str] = set()
    for row in rows:
        barcode = normalize_text(row.get("barcode"))
        scale_code = normalize_text(row.get("scale_code"))
        name = normalize_text(row.get("name"))
        if barcode:
            by_barcode.add(barcode)
        if scale_code:
            by_scale_code.add(scale_code.lower())
        if name:
            by_name.add(name.lower())
    return by_barcode, by_scale_code, by_name


def split_new_vs_existing(mapped_rows: list[dict], existing_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    existing_barcodes, existing_scale_codes, existing_names = existing_keys(existing_rows)
    to_insert: list[dict] = []
    skipped: list[dict] = []
    for row in mapped_rows:
        barcode = normalize_text(row.get("barcode"))
        scale_code = normalize_text(row.get("scale_code"))
        name = normalize_text(row.get("name"))
        duplicate = False
        if barcode and barcode in existing_barcodes:
            duplicate = True
        elif scale_code and scale_code.lower() in existing_scale_codes:
            duplicate = True
        elif not barcode and name and name.lower() in existing_names:
            duplicate = True
        if duplicate:
            skipped.append(row)
        else:
            to_insert.append(row)
            if barcode:
                existing_barcodes.add(barcode)
            if scale_code:
                existing_scale_codes.add(scale_code.lower())
            if name:
                existing_names.add(name.lower())
    return to_insert, skipped


def insert_products(base_url: str, api_key: str, rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    url = f"{base_url}/rest/v1/products"
    return supabase_request(url, api_key, method="POST", body=rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate active SQLite products into Supabase products.")
    parser.add_argument("--sqlite", default="pos_2026-06-04_144913.sqlite3", help="SQLite database path")
    parser.add_argument("--business-id", required=True, help="Target Supabase business_id")
    parser.add_argument("--apply", action="store_true", help="Actually insert missing products")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit of active SQLite products")
    args = parser.parse_args()

    env_file = load_env(ENV_PATH)
    supabase_url = env_value("NEXT_PUBLIC_SUPABASE_URL", env_file).rstrip("/")
    service_role_key = env_value("SUPABASE_SERVICE_ROLE_KEY", env_file)
    sqlite_path = (ROOT / args.sqlite).resolve()

    if not sqlite_path.exists():
        raise RuntimeError(f"SQLite file not found: {sqlite_path}")

    sqlite_rows = sqlite_products(sqlite_path)
    if args.limit > 0:
        sqlite_rows = sqlite_rows[: args.limit]

    mapped_rows = [map_product(row, args.business_id) for row in sqlite_rows]
    existing_rows = fetch_existing_products(supabase_url, service_role_key, args.business_id)
    to_insert, skipped = split_new_vs_existing(mapped_rows, existing_rows)

    summary = {
        "sqlite_active_rows": len(sqlite_rows),
        "already_in_supabase": len(skipped),
        "pending_insert": len(to_insert),
        "apply": args.apply,
        "sample_pending": to_insert[:5],
    }

    if args.apply:
        inserted = insert_products(supabase_url, service_role_key, to_insert)
        summary["inserted"] = len(inserted)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
