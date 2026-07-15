import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] transition-colors"
          aria-label="Toggle language"
        >
          <Languages className="w-5 h-5 text-[#0891B2]" />
          <span className="text-xs font-bold text-[#0F172A]">{lang.toUpperCase()}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-2 py-1.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
          Language / Idioma
        </div>
        <DropdownMenuItem
          onClick={() => setLang("en")}
          className={`gap-2 ${lang === "en" ? "bg-[#0891B2]/10" : ""}`}
        >
          <span className="text-sm font-bold text-[#0F172A]">EN</span>
          <span className="text-xs text-[#64748B]">English</span>
          {lang === "en" && <span className="ml-auto w-2 h-2 rounded-full bg-[#0891B2]" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLang("es")}
          className={`gap-2 ${lang === "es" ? "bg-[#0891B2]/10" : ""}`}
        >
          <span className="text-sm font-bold text-[#0F172A]">ES</span>
          <span className="text-xs text-[#64748B]">Español</span>
          {lang === "es" && <span className="ml-auto w-2 h-2 rounded-full bg-[#0891B2]" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
