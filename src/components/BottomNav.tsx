import { BarChart3, Hexagon, LayoutGrid, Plus, Receipt } from "lucide-react";
import type { ReactNode } from "react";

export type Screen = "home" | "transactions" | "review" | "settings";

export function BottomNav({
  screen,
  pendingCount,
  onNavigate,
  onAdd,
}: {
  screen: Screen;
  pendingCount: number;
  onNavigate: (screen: Screen) => void;
  onAdd: () => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <NavButton active={screen === "transactions"} label="Movimientos" icon={<Receipt />} onClick={() => onNavigate("transactions")} />
      <NavButton active={screen === "home"} label="Resumen" icon={<BarChart3 />} onClick={() => onNavigate("home")} />
      <button className="nav-add" type="button" onClick={onAdd} aria-label="Añadir movimiento"><Plus /></button>
      <NavButton active={screen === "review"} label="Revisar" icon={<LayoutGrid />} count={pendingCount} onClick={() => onNavigate("review")} />
      <NavButton active={screen === "settings"} label="Ajustes" icon={<Hexagon />} onClick={() => onNavigate("settings")} />
    </nav>
  );
}

function NavButton({ active, label, icon, count, onClick }: { active: boolean; label: string; icon: ReactNode; count?: number; onClick: () => void }) {
  return (
    <button className="nav-button" data-active={active} type="button" onClick={onClick} aria-label={label}>
      <span className="nav-icon">{icon}{count ? <span className="nav-count">{count}</span> : null}</span>
    </button>
  );
}
