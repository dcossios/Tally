import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SharedOnboarding } from "@/components/SharedOnboarding";
import { SharedDashboard } from "@/components/SharedDashboard";

export function SharedScreen({
  monthDate,
  onSelectMonth,
}: {
  monthDate: Date;
  onSelectMonth: (date: Date) => void;
}) {
  const info = useQuery(api.shared.getMySpace);

  if (info === undefined) {
    return <div className="screen insights-screen"><div className="insights-empty"><p>Cargando…</p></div></div>;
  }
  if (info === null) {
    return <SharedOnboarding />;
  }
  return <SharedDashboard info={info} monthDate={monthDate} onSelectMonth={onSelectMonth} />;
}
