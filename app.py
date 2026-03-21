import os
import secrets
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from flask import Flask, abort, g, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("MTAK_DATA_DIR", ROOT_DIR))
INSTANCE_DIR = DATA_DIR / "instance"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = INSTANCE_DIR / "mtak.db"
SECRET_PATH = INSTANCE_DIR / "secret_key.txt"

DEFAULT_ADMIN_USERNAME = os.getenv("MTAK_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("MTAK_ADMIN_PASSWORD", "MTAK2026!")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def ensure_dirs() -> None:
    INSTANCE_DIR.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)


def load_secret_key() -> str:
    if SECRET_PATH.exists():
        return SECRET_PATH.read_text(encoding="utf-8").strip()
    secret = secrets.token_hex(32)
    SECRET_PATH.write_text(secret, encoding="utf-8")
    return secret


app = Flask(__name__)
ensure_dirs()
app.config["SECRET_KEY"] = os.getenv("MTAK_SECRET_KEY", load_secret_key())
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        connection = sqlite3.connect(DB_PATH)
        connection.row_factory = sqlite3.Row
        g.db = connection
    return g.db


@app.teardown_appcontext
def close_db(_exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = sqlite3.connect(DB_PATH)
    cursor = db.cursor()
    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            series TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            method TEXT NOT NULL,
            release_date TEXT NOT NULL,
            intro TEXT NOT NULL,
            image_path TEXT NOT NULL,
            is_collab INTEGER NOT NULL DEFAULT 0,
            collab_brand TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )

    admin = cursor.execute("SELECT id FROM admins WHERE id = 1").fetchone()
    if not admin:
        cursor.execute(
            """
            INSERT INTO admins (id, username, password_hash, updated_at)
            VALUES (1, ?, ?, ?)
            """,
            (
                DEFAULT_ADMIN_USERNAME,
                generate_password_hash(DEFAULT_ADMIN_PASSWORD),
                utc_now(),
            ),
        )

    db.commit()
    db.close()


def utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def require_admin():
    if not session.get("is_admin"):
        abort(401)


def row_to_product(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "series": row["series"],
        "price": row["price"],
        "quantity": row["quantity"],
        "method": row["method"],
        "releaseDate": row["release_date"],
        "intro": row["intro"],
        "image": row["image_path"],
        "isCollab": bool(row["is_collab"]),
        "collabBrand": row["collab_brand"] or "",
    }


def get_admin_record() -> sqlite3.Row:
    return get_db().execute("SELECT * FROM admins WHERE id = 1").fetchone()


def save_uploaded_file(file_storage) -> str:
    if not file_storage or not file_storage.filename:
        return ""

    extension = Path(file_storage.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        bad_request("Only jpg, jpeg, png, webp, and gif images are supported.")

    safe_name = secure_filename(Path(file_storage.filename).stem) or "product"
    filename = f"{safe_name}-{uuid.uuid4().hex[:10]}{extension}"
    target = UPLOAD_DIR / filename
    file_storage.save(target)
    return f"/uploads/{filename}"


def delete_uploaded_file(path: str) -> None:
    if not path or not path.startswith("/uploads/"):
        return
    file_path = ROOT_DIR / path.lstrip("/")
    if file_path.exists():
        file_path.unlink()


def jsonify_error(message: str) -> dict:
    return {"ok": False, "message": message}


def bad_request(message: str):
    abort(400, description=message)


def parse_bool(value: str) -> bool:
    return str(value).lower() in {"1", "true", "yes", "on"}


def is_hidden_auction(method: str) -> bool:
    normalized = str(method or "").strip().lower()
    return normalized in {"暗拍", "hidden auction"}


@app.route("/")
def home():
    return send_from_directory(ROOT_DIR, "index.html")


@app.route("/admin")
def admin_page():
    return send_from_directory(ROOT_DIR, "admin.html")


@app.route("/api/session", methods=["GET"])
def api_session():
    admin = get_admin_record()
    return jsonify(
        {
            "ok": True,
            "authenticated": bool(session.get("is_admin")),
            "username": admin["username"],
        }
    )


@app.route("/api/login", methods=["POST"])
def api_login():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    admin = get_admin_record()
    if username == admin["username"] and check_password_hash(admin["password_hash"], password):
        session["is_admin"] = True
        return jsonify({"ok": True, "message": "Login successful."})

    return jsonify(jsonify_error("Invalid username or password. Please try again.")), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/settings", methods=["GET"])
def api_settings():
    admin = get_admin_record()
    return jsonify(
        {
            "ok": True,
            "username": admin["username"],
            "series": get_option_values("series"),
            "methods": get_option_values("methods"),
        }
    )


@app.route("/api/settings/admin", methods=["PUT"])
def api_update_admin():
    require_admin()
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if not username or not password:
        return jsonify(jsonify_error("Admin username and password cannot be empty.")), 400

    db = get_db()
    db.execute(
        "UPDATE admins SET username = ?, password_hash = ?, updated_at = ? WHERE id = 1",
        (username, generate_password_hash(password), utc_now()),
    )
    db.commit()
    return jsonify({"ok": True, "message": "Admin credentials updated.", "username": username})


@app.route("/api/options/<option_type>", methods=["POST"])
def api_add_option(option_type: str):
    require_admin()
    if option_type not in {"series", "methods"}:
        abort(404)
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    if not name:
        return jsonify(jsonify_error("Name cannot be empty.")), 400

    db = get_db()
    table = "series" if option_type == "series" else "methods"
    db.execute(f"INSERT OR IGNORE INTO {table} (name) VALUES (?)", (name,))
    db.commit()
    return jsonify({"ok": True, "items": get_option_values(table)})


@app.route("/api/options/<option_type>", methods=["DELETE"])
def api_delete_option(option_type: str):
    require_admin()
    if option_type not in {"series", "methods"}:
        abort(404)
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    table = "series" if option_type == "series" else "methods"
    if name:
        db = get_db()
        db.execute(f"DELETE FROM {table} WHERE name = ?", (name,))
        db.commit()
    return jsonify({"ok": True, "items": get_option_values(table)})


def get_option_values(table: str) -> list[str]:
    rows = get_db().execute(f"SELECT name FROM {table} ORDER BY name COLLATE NOCASE").fetchall()
    return [row["name"] for row in rows]


@app.route("/api/products", methods=["GET"])
def api_products():
    rows = get_db().execute(
        """
        SELECT * FROM products
        ORDER BY release_date DESC, created_at DESC
        """
    ).fetchall()
    return jsonify({"ok": True, "products": [row_to_product(row) for row in rows]})


@app.route("/api/products", methods=["POST"])
def api_create_product():
    require_admin()
    product = validate_product_form(request.form, request.files.get("image"))
    db = get_db()
    db.execute(
        """
        INSERT INTO products (
            id, name, series, price, quantity, method, release_date, intro,
            image_path, is_collab, collab_brand, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            uuid.uuid4().hex,
            product["name"],
            product["series"],
            product["price"],
            product["quantity"],
            product["method"],
            product["release_date"],
            product["intro"],
            product["image_path"],
            1 if product["is_collab"] else 0,
            product["collab_brand"],
            utc_now(),
            utc_now(),
        ),
    )
    db.commit()
    sync_option_tables(product["series"], product["method"])
    return jsonify({"ok": True})


@app.route("/api/products/<product_id>", methods=["PUT"])
def api_update_product(product_id: str):
    require_admin()
    db = get_db()
    current = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not current:
        abort(404)

    product = validate_product_form(request.form, request.files.get("image"), current["image_path"])
    db.execute(
        """
        UPDATE products
        SET name = ?, series = ?, price = ?, quantity = ?, method = ?, release_date = ?,
            intro = ?, image_path = ?, is_collab = ?, collab_brand = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            product["name"],
            product["series"],
            product["price"],
            product["quantity"],
            product["method"],
            product["release_date"],
            product["intro"],
            product["image_path"],
            1 if product["is_collab"] else 0,
            product["collab_brand"],
            utc_now(),
            product_id,
        ),
    )
    db.commit()
    if product["new_upload"] and current["image_path"] != product["image_path"]:
        delete_uploaded_file(current["image_path"])
    sync_option_tables(product["series"], product["method"])
    return jsonify({"ok": True})


@app.route("/api/products/<product_id>", methods=["DELETE"])
def api_delete_product(product_id: str):
    require_admin()
    db = get_db()
    current = db.execute("SELECT image_path FROM products WHERE id = ?", (product_id,)).fetchone()
    if not current:
        abort(404)
    db.execute("DELETE FROM products WHERE id = ?", (product_id,))
    db.commit()
    delete_uploaded_file(current["image_path"])
    return jsonify({"ok": True})


def sync_option_tables(series_name: str, method_name: str) -> None:
    db = get_db()
    db.execute("INSERT OR IGNORE INTO series (name) VALUES (?)", (series_name,))
    db.execute("INSERT OR IGNORE INTO methods (name) VALUES (?)", (method_name,))
    db.commit()


def validate_product_form(form, image_file, existing_image: str = "") -> dict:
    name = form.get("name", "").strip()
    series = form.get("series", "").strip()
    method = form.get("method", "").strip()
    intro = form.get("intro", "").strip()
    release_date = form.get("releaseDate", "").strip()
    collab_brand = form.get("collabBrand", "").strip()
    is_collab = parse_bool(form.get("isCollab", "false"))
    price_raw = form.get("price", "").strip()

    try:
        price = 0.0 if price_raw == "" else float(price_raw)
        quantity = int(form.get("quantity", "0"))
    except ValueError:
        bad_request("Price or quantity has an invalid format.")

    if not all([name, series, method, release_date]):
        bad_request("Please complete all required product fields.")
    if not is_hidden_auction(method) and price_raw == "":
        bad_request("Price is required unless the release method is Hidden Auction.")
    if price < 0 or quantity < 1:
        bad_request("Price or quantity is invalid.")
    if is_collab and not collab_brand:
        bad_request("A collab product requires a collab brand name.")

    image_path = save_uploaded_file(image_file) if image_file else existing_image
    if not image_path:
        bad_request("Please upload a product image.")

    return {
        "name": name,
        "series": series,
        "price": 0.0 if is_hidden_auction(method) else price,
        "quantity": quantity,
        "method": method,
        "release_date": release_date,
        "intro": intro,
        "image_path": image_path,
        "is_collab": is_collab,
        "collab_brand": collab_brand if is_collab else "",
        "new_upload": bool(image_file and image_file.filename),
    }


@app.route("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/<path:filename>")
def root_files(filename: str):
    path = ROOT_DIR / filename
    if path.is_file():
        return send_from_directory(ROOT_DIR, filename)
    abort(404)


@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(404)
@app.errorhandler(413)
def handle_error(error):
    description = getattr(error, "description", None)
    if isinstance(description, dict):
        message = description.get("message", "Request failed.")
    else:
        message = description or "Request failed."
    return jsonify({"ok": False, "message": message}), getattr(error, "code", 500)


init_db()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
