import FridayCalendar from "@/components/FridayCalendar";
import lunchioLogo from "@/assets/lunchio-logo.jpeg";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-10 px-4 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <img src={lunchioLogo} alt="Lunchio Logo" className="h-24 w-24 rounded-2xl object-cover shadow-lg" />
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold text-foreground">Lunchio</h1>
            <p className="text-base text-muted-foreground">Sag kurz Bescheid, dass du am Freitag mitisst.</p>
          </div>
        </div>

        <FridayCalendar />
      </main>
    </div>
  );
}
