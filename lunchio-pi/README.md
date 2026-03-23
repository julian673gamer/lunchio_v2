# Lunchio mit Raspberry-Pi-Datenbank

Dieses Projekt speichert die Essensanmeldungen nicht mehr in Supabase, sondern in einer lokalen SQLite-Datenbank auf dem Raspberry Pi.

## Datenfluss

- Website `/` -> sendet Anmeldung an `POST /api/register`
- Raspberry Pi -> speichert alles in die Datenbankdatei `backend/rfid_dp.pi`
- Küchenansicht `/kueche` -> liest die Anzahl und Liste aus `GET /api/kitchen`

## Datenbankname

Die lokale SQLite-Datenbankdatei heißt exakt:

`rfid_dp.pi`

## Installation auf dem Raspberry Pi

### 1. Frontend bauen

```bash
npm install
npm run build
```

### 2. Python-Backend installieren

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Danach läuft alles standardmäßig auf Port `3000`.

## Wichtige Seiten

- Benutzerseite: `http://DEINE-PI-IP:3000/`
- Küchenansicht: `http://DEINE-PI-IP:3000/kueche`

## API-Endpunkte

- `POST /api/register`
- `POST /api/unregister`
- `GET /api/registration-status?date=YYYY-MM-DD&deviceId=...`
- `GET /api/count?date=YYYY-MM-DD`
- `GET /api/kitchen?date=YYYY-MM-DD`
- `GET /api/health`

## Beispiel-Request

```json
{
  "deviceId": "tablet-kantine-01",
  "date": "2026-03-27",
  "wantsFood": true
}
```
