import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const getDeviceId = () => {
  let id = localStorage.getItem("lunchio-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lunchio-id", id);
  }
  return id;
};

function getNextFridayString() {
  const today = new Date();
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
  return nextFriday.toISOString().split("T")[0];
}

export default function FridayCalendar() {
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");

  const nextFridayStr = useMemo(() => getNextFridayString(), []);
  const nextFridayLabel = useMemo(() => {
    const nextFriday = new Date(nextFridayStr);
    return nextFriday.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  }, [nextFridayStr]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [countRes, statusRes] = await Promise.all([
          fetch(`${API_URL}/count?date=${encodeURIComponent(nextFridayStr)}`),
          fetch(
            `${API_URL}/registration-status?date=${encodeURIComponent(nextFridayStr)}&deviceId=${encodeURIComponent(getDeviceId())}`,
          ),
        ]);

        if (countRes.ok) {
          const countData = await countRes.json();
          setCount(countData.count ?? 0);
        }

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setRegistered(Boolean(statusData.registered));
        }
      } catch (error) {
        console.error("Fehler beim Laden der Anmeldedaten:", error);
      }
    };

    loadData();
  }, [nextFridayStr]);

  const handleRegister = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          date: nextFridayStr,
          wantsFood: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Die Anmeldung konnte nicht gespeichert werden.");
      }

      setRegistered(true);
      setCount(data.count ?? count);
      setMessage("Deine Anmeldung wurde gespeichert.");
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      setMessage(error instanceof Error ? error.message : "Es ist ein Fehler aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/unregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          date: nextFridayStr,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Die Abmeldung konnte nicht gespeichert werden.");
      }

      setRegistered(false);
      setCount(data.count ?? count);
      setMessage("Deine Anmeldung wurde entfernt.");
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      setMessage(error instanceof Error ? error.message : "Es ist ein Fehler aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-border bg-card px-6 py-10 text-center shadow-xl">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Freitag, {nextFridayLabel}</p>
        <h2 className="text-3xl font-bold text-foreground">Ich esse mit</h2>
        <p className="text-sm text-muted-foreground">Die Anmeldung wird direkt in die Raspberry-Pi-Datenbank geschrieben.</p>
      </div>

      <div className="w-full rounded-2xl bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">Aktuell angemeldet</p>
        <p className="text-3xl font-bold text-foreground">{count ?? "-"}</p>
      </div>

      <Button size="lg" className="h-16 w-full gap-3 text-lg" onClick={handleRegister} disabled={loading || registered}>
        <UtensilsCrossed className="h-5 w-5" />
        {loading ? "Wird gespeichert..." : registered ? "Bereits angemeldet" : "Ich esse mit"}
      </Button>

      <Button
        size="lg"
        variant="outline"
        className="h-14 w-full text-base"
        onClick={handleUnregister}
        disabled={loading || !registered}
      >
        Nicht mehr mitessen
      </Button>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
