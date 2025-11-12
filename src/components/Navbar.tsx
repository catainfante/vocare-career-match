import { useState } from "react";
import { Briefcase, Upload, Info, Settings, Menu, X, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavbarProps {
  onUploadCV?: () => void;
  onOpenOffers?: () => void;
  onToggleTheme?: () => void;
}

const Navbar = ({ onUploadCV, onOpenOffers, onToggleTheme }: NavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { icon: Database, label: "Ofertas", onClick: onOpenOffers },
    { icon: Upload, label: "Subir CV", onClick: onUploadCV },
    { icon: Info, label: "Sobre Vocare", onClick: () => {} },
    { icon: Settings, label: "Configuración", onClick: onToggleTheme },
  ];

  return (
    <nav className="w-full bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
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

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          {menuItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              onClick={item.onClick}
              className="gap-2 hover:bg-secondary transition-colors"
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Button>
          ))}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-primary-foreground" />
                  </div>
                  Menú
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 mt-6">
                {menuItems.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    onClick={() => {
                      item.onClick?.();
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start gap-3 h-12"
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
