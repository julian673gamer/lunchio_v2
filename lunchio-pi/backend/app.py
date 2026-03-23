from __future__ import annotations

import os
import sqlite3
from datetime import date, datetime
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR.parent / "dist"
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(BASE_DIR / "rfid_dp.pi")))
PORT = int(os.getenv("PORT", "3000"))

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path="")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                friday_date TEXT NOT NULL,
                device_id TEXT NOT NULL,
                wants_food INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(friday_date, device_id)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_registrations_friday_date ON registrations(friday_date)"
        )
        conn.commit()


def validate_iso_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise ValueError("Ungültiges Datum. Erwartet wird YYYY-MM-DD.") from exc


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/<path:_>", methods=["OPTIONS"])
def options_handler(_: str):
    return ("", 204)


@app.route("/api/health", methods=["GET"])
def health() -> Any:
    return jsonify({"status": "ok", "database": str(DATABASE_PATH)})


@app.route("/api/register", methods=["POST"])
def register() -> Any:
    payload = request.get_json(silent=True) or {}
    device_id = str(payload.get("deviceId", "")).strip()
    raw_date = str(payload.get("date", "")).strip()
    wants_food = 1 if bool(payload.get("wantsFood", True)) else 0

    if not device_id:
        return jsonify({"success": False, "message": "deviceId fehlt."}), 400

    try:
        friday_date = validate_iso_date(raw_date)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO registrations (friday_date, device_id, wants_food)
            VALUES (?, ?, ?)
            ON CONFLICT(friday_date, device_id)
            DO UPDATE SET wants_food = excluded.wants_food, updated_at = CURRENT_TIMESTAMP
            """,
            (friday_date, device_id, wants_food),
        )
        count_row = conn.execute(
            "SELECT COUNT(*) AS count FROM registrations WHERE friday_date = ? AND wants_food = 1",
            (friday_date,),
        ).fetchone()
        conn.commit()

    return jsonify(
        {
            "success": True,
            "date": friday_date,
            "deviceId": device_id,
            "wantsFood": bool(wants_food),
            "count": int(count_row["count"]),
        }
    )


@app.route("/api/unregister", methods=["POST"])
def unregister() -> Any:
    payload = request.get_json(silent=True) or {}
    device_id = str(payload.get("deviceId", "")).strip()
    raw_date = str(payload.get("date", "")).strip()

    if not device_id:
        return jsonify({"success": False, "message": "deviceId fehlt."}), 400

    try:
        friday_date = validate_iso_date(raw_date)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    with get_db() as conn:
        conn.execute(
            "DELETE FROM registrations WHERE friday_date = ? AND device_id = ?",
            (friday_date, device_id),
        )
        count_row = conn.execute(
            "SELECT COUNT(*) AS count FROM registrations WHERE friday_date = ? AND wants_food = 1",
            (friday_date,),
        ).fetchone()
        conn.commit()

    return jsonify({"success": True, "date": friday_date, "count": int(count_row["count"])})


@app.route("/api/registration-status", methods=["GET"])
def registration_status() -> Any:
    device_id = str(request.args.get("deviceId", "")).strip()
    raw_date = str(request.args.get("date", "")).strip()

    if not device_id:
        return jsonify({"success": False, "message": "deviceId fehlt."}), 400

    try:
        friday_date = validate_iso_date(raw_date)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    with get_db() as conn:
        row = conn.execute(
            """
            SELECT wants_food
            FROM registrations
            WHERE friday_date = ? AND device_id = ?
            """,
            (friday_date, device_id),
        ).fetchone()

    return jsonify({
        "success": True,
        "date": friday_date,
        "deviceId": device_id,
        "registered": bool(row and row["wants_food"] == 1),
    })


@app.route("/api/count", methods=["GET"])
def count() -> Any:
    raw_date = str(request.args.get("date", "")).strip()

    try:
        friday_date = validate_iso_date(raw_date)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS count FROM registrations WHERE friday_date = ? AND wants_food = 1",
            (friday_date,),
        ).fetchone()

    return jsonify({"success": True, "date": friday_date, "count": int(row["count"])})


@app.route("/api/kitchen", methods=["GET"])
def kitchen() -> Any:
    raw_date = str(request.args.get("date", "")).strip()

    try:
        friday_date = validate_iso_date(raw_date)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    with get_db() as conn:
        count_row = conn.execute(
            "SELECT COUNT(*) AS count FROM registrations WHERE friday_date = ? AND wants_food = 1",
            (friday_date,),
        ).fetchone()
        registrations = conn.execute(
            """
            SELECT device_id, created_at, updated_at
            FROM registrations
            WHERE friday_date = ? AND wants_food = 1
            ORDER BY updated_at DESC, created_at DESC
            """,
            (friday_date,),
        ).fetchall()

    return jsonify(
        {
            "success": True,
            "date": friday_date,
            "count": int(count_row["count"]),
            "registrations": [
                {
                    "deviceId": row["device_id"],
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                }
                for row in registrations
            ],
            "serverTime": datetime.now().isoformat(timespec="seconds"),
        }
    )


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path: str):
    if DIST_DIR.exists():
        requested = DIST_DIR / path
        if path and requested.exists() and requested.is_file():
            return send_from_directory(DIST_DIR, path)
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify(
        {
            "message": "Frontend noch nicht gebaut. Bitte zuerst 'npm install' und 'npm run build' ausführen.",
            "dist": str(DIST_DIR),
        }
    )


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=PORT)
