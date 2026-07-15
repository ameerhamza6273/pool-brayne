import { createContext, useContext, useState, type ReactNode } from "react";

type Lang = "en" | "es";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a static UI label to the active language */
  t: (s: string) => string;
};

const dict: Record<string, string> = {
  "Job Details": "Detalles del Trabajo", "Customer": "Cliente", "Scheduled": "Programado",
  "Assigned": "Asignado", "Address": "Dirección", "Description": "Descripción",
  "Line Items": "Artículos", "Customer Signature": "Firma del Cliente",
  "Status Timeline": "Línea de Tiempo", "Automated Notifications": "Notificaciones Automáticas",
  "Quick Actions": "Acciones Rápidas", "Booking confirmed": "Reserva confirmada",
  "Technician en route": "Técnico en camino", "Job completed": "Trabajo completado",
  "Call Customer": "Llamar al Cliente", "Text Customer": "Enviar SMS al Cliente",
  "Email Customer": "Enviar Correo al Cliente", "View Invoice": "Ver Factura",
  "Mark Complete & Generate Invoice": "Marcar Completado y Generar Factura",
  "Trip Details": "Detalles del Viaje", "Documents": "Documentos",
  "Customer Not Available": "Cliente No Disponible", "Known Issue": "Problema Conocido",
  "Private": "Privado", "Customer Portal": "Portal del Cliente",
  "Before / After Photos": "Fotos Antes / Después",
  "Model & Serial Numbers": "Modelo y Números de Serie", "Receipts": "Recibos",
  "Extra Job Info": "Información Adicional", "Update Status": "Actualizar Estado",
  "Content Categories": "Categorías de Contenido", "Job Notes": "Notas del Trabajo",
  "Reschedule": "Reprogramar", "Reschedule Job": "Reprogramar Trabajo",
  "Reschedule Type": "Tipo de Reprogramación", "New Date & Time": "Nueva Fecha y Hora",
  "Reschedule notes...": "Notas de reprogramación...", "Confirm Reschedule": "Confirmar Reprogramación",
  "Cancel": "Cancelar", "Dashboard": "Panel", "Customers": "Clientes",
  "Jobs & Dispatch": "Trabajos y Despacho", "Technician Field": "Campo Técnico",
  "Point of Sale": "Punto de Venta", "Inventory": "Inventario", "Fleet": "Flota",
  "Timesheets": "Hojas de Tiempo", "Invoicing": "Facturación", "Campaigns": "Campañas",
  "Settings": "Configuración",
};

const Ctx = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const toggle = () => setLang((p) => (p === "en" ? "es" : "en"));
  const t = (s: string) => (lang === "es" ? dict[s] || s : s);
  return <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
