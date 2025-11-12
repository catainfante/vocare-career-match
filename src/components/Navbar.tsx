import { Briefcase } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="w-full bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md">
            <Briefcase className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-foreground">Vocare</h1>
            <p className="text-xs text-muted-foreground">Asistente laboral UC</p>
          </div>
          <h1 className="sm:hidden text-xl font-bold text-foreground">Vocare</h1>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
