import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_URL = import.meta.env.VITE_API_URL || "/api";

type KitchenResponse = {
  success: boolean;
  date: string;
  count: number;
  serverTime: string;
  registrations: Array<{
    deviceId: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

function getNextFridayString() {
  const today = new Date();
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
  return nextFriday.toISOString().split("T")[0];
}

export default function Kitchen() {
  const [data, setData] = useState<KitchenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const date = useMemo(() => getNextFridayString(), []);

  const loadKitchenData = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/kitchen?date=${encodeURIComponent(date)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Küchendaten konnten nicht geladen werden.");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Es ist ein Fehler aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKitchenData();
    const timer = window.setInterval(loadKitchenData, 10000);
    return () => window.clearInterval(timer);
  }, [date]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <main className="container mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Küchenansicht</p>
            <h1 className="text-3xl font-bold text-foreground">Anmeldungen für {new Date(date).toLocaleDateString("de-DE")}</h1>
          </div>
          <Button onClick={loadKitchenData} disabled={loading}>
            {loading ? "Aktualisiert..." : "Neu laden"}
          </Button>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Wie viele möchten essen?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold">{data?.count ?? "-"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Letzte Server-Aktualisierung: {data?.serverTime ? new Date(data.serverTime).toLocaleString("de-DE") : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Einträge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!error && !loading && data?.registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Anmeldungen vorhanden.</p>
            ) : null}
            {data?.registrations.map((entry) => (
              <div key={`${entry.deviceId}-${entry.updatedAt}`} className="rounded-2xl border border-border px-4 py-3">
                <p className="font-medium text-foreground">Gerät: {entry.deviceId}</p>
                <p className="text-sm text-muted-foreground">
                  Eingetragen: {new Date(entry.updatedAt).toLocaleString("de-DE")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
