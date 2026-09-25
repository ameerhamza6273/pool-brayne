import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from "react";

type Lang = "en" | "es";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a static UI label to the active language */
  t: (s: string) => string;
};

// Hand-written translations for the highest-traffic labels (instant, no network round trip).
// Anything not listed here still gets translated automatically -- see the auto-translate cache
// below -- this dict just avoids a flash-of-English + network call for common words.
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
  "Settings": "Configuración", "My Day": "Mi Día", "Jobs": "Trabajos",
  "Parts Used": "Piezas Usadas", "Photos": "Fotos", "Notes": "Notas", "Forms": "Formularios",
  "Save": "Guardar", "Save Changes": "Guardar Cambios", "Search": "Buscar", "Add": "Agregar",
  "Edit": "Editar", "Delete": "Eliminar", "Close": "Cerrar", "Submit": "Enviar",
  "Loading...": "Cargando...", "No results found.": "No se encontraron resultados.",
  "Vendors": "Proveedores", "Purchase Orders": "Órdenes de Compra", "Vendor Bills": "Facturas de Proveedores",
  "Library": "Biblioteca", "Manufacturers": "Fabricantes", "Directory": "Directorio",
  "Reports": "Reportes", "Form Builder": "Creador de Formularios", "Recurring": "Recurrente",
  "Tasks": "Tareas", "Dispatch": "Despacho", "Estimates / Quotes": "Presupuestos",
  "Customer Invoices": "Facturas de Clientes",
  // Auto-translate mistranslates these ambiguous-in-English words on its own (e.g. "Tech" as in
  // technician read as "technology") -- hand-pinned so the common Settings > Team labels are
  // reliably correct rather than depending on Google Translate's guess.
  "Add Tech": "Agregar Técnico", "Edit Tech": "Editar Técnico", "Role": "Rol",
  // Client QA sweep 2026-09-22: POS payment dialog auto-translated "Check" (the payment method,
  // as in a paper cheque) to "Controlar" (verb "to control/verify") and "Full" (full payment) to
  // "Lleno" (a container being full) -- same class of ambiguous-word mistranslation as above.
  "Check": "Cheque", "Full": "Completo",
  // Customers page tag filters: "VIP" (an acronym, should stay as-is) auto-translated to
  // "personaje" (unrelated -- "character/celebrity"); "Lapsed" translated literally to
  // "Transcurrido" ("elapsed [time]") instead of the CRM sense (customer gone inactive).
  "VIP": "VIP", "Lapsed": "Inactivo",
  // Campaigns tab: "Performance" (marketing sense, as in Reports) auto-translated to "Actuación"
  // (theatrical "acting/performance") instead of the business sense.
  "Performance": "Rendimiento",
  // Live QA 2026-09-25: more ambiguous short words Google got wrong -- weekday abbreviations were read
  // as verbs ("Wed" -> "Casarse" = to marry, "Sat" -> "Se sentó" = sat down), "OT" (overtime) as "Antiguo
  // Testamento", "Clock In" as "Regístrese" (sign up), "Clear" as "Claro" (light), "Lead" as "Dirigir"
  // (to lead), "Amount" as "Cantidad" (same word as Qty), "jobs" as "empleos" (employment), "TECH" as
  // "Tecnología", "Estimate" as the verb "Estimar".
  "Sun": "Dom", "Mon": "Lun", "Tue": "Mar", "Wed": "Mié", "Thu": "Jue", "Fri": "Vie", "Sat": "Sáb",
  "OT": "H. extra", "Total OT": "Total h. extra",
  "Clock In": "Marcar entrada", "Clock Out": "Marcar salida", "Approve Week": "Aprobar semana",
  "Clocked in at": "Entrada a las", "Not clocked in": "Sin marcar entrada", "On the clock": "Trabajando",
  "Clear": "Borrar", "Lead": "Prospecto", "Amount": "Importe", "jobs": "trabajos",
  "TEAM": "EQUIPO", "TECH": "TÉCNICOS", "CONTRACTORS": "CONTRATISTAS",
  "Estimate": "Presupuesto", "Estimates": "Presupuestos", "Open Estimate": "Abrir presupuesto",
  "Task": "Tarea", "Receipt notes": "Notas del recibo", "Save Notes": "Guardar notas",
  "Edit price": "Editar precio", "Receipt Disclaimer": "Aviso en el recibo",
  "Techs with jobs": "Técnicos con trabajos", "Make a Request": "Hacer una solicitud",
  "Weekly Hours": "Horas semanales", "Action": "Acción", "Approve": "Aprobar", "Deny": "Rechazar",
  "Add document": "Agregar documento", "Use file name": "Usar nombre de archivo", "Document List": "Lista de documentos",
};

const CACHE_KEY = "poolbrayne_es_translations_v1";

function loadCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best-effort only (private browsing, quota, etc.)
  }
}

async function requestTranslation(text: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    // The endpoint can return a 200 OK "Sorry, automated queries" HTML page instead of JSON when
    // rate-limited -- .json() throws on that, caught below, so a burst of requests degrades to
    // "stays English" rather than crashing.
    const data = await res.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((seg: unknown[]) => seg[0]).join("") : null;
    return translated || null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// This is an unauthenticated, unofficial endpoint -- a page that first renders in Spanish can
// trigger 30-50 unique-string lookups at once, and firing them all simultaneously is exactly the
// burst pattern that gets an IP soft-rate-limited (observed directly during development: heavy
// concurrent testing tripped "Sorry... automated queries" on this network). A small serialized
// queue with spacing between requests, plus one retry, makes real usage far less likely to hit
// that wall -- each string is still fetched only once ever, since results are cached permanently.
let queueTail: Promise<unknown> = Promise.resolve();
function fetchTranslation(text: string): Promise<string | null> {
  const job = queueTail.then(async () => {
    let result = await requestTranslation(text);
    if (!result) {
      await sleep(400);
      result = await requestTranslation(text);
    }
    await sleep(120);
    return result;
  });
  queueTail = job.catch(() => undefined);
  return job;
}

const Ctx = createContext<LangCtx | null>(null);

// Client feedback 2026-09-11: "English/Spanish translation is only working in tech notes. Needs
// to work across software." The static `dict` above only ever covered JobDetail's own labels, so
// every other page's `t("...")` call (or lack of one) just rendered English regardless of `lang`.
// Rather than hand-writing a dictionary entry for every string in every page, `t()` now falls
// back to the same free Google Translate endpoint `useTranslator` already used for the tech notes
// live-translate, caches results in localStorage (so it's instant after the first visit and
// doesn't hammer the endpoint), and re-renders once each string resolves.
const LANG_KEY = "poolbrayne_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Persist the chosen language too (not just the translation cache) -- previously this reset to
  // English on every page refresh, which undercut the client's "needs to work across software"
  // ask just as much as missing t() calls did.
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === "es" ? "es" : "en";
    } catch {
      return "en";
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // best-effort only
    }
  };
  const [cache, setCache] = useState<Record<string, string>>(() => loadCache());
  const pending = useRef<Set<string>>(new Set());
  const toggle = () => setLang(lang === "en" ? "es" : "en");

  useEffect(() => {
    saveCache(cache);
  }, [cache]);

  const t = (s: string) => {
    if (lang !== "es" || !s.trim()) return s;
    if (dict[s]) return dict[s];
    if (cache[s]) return cache[s];
    if (!pending.current.has(s)) {
      pending.current.add(s);
      fetchTranslation(s).then((translated) => {
        pending.current.delete(s);
        if (translated) setCache((prev) => ({ ...prev, [s]: translated }));
      });
    }
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>;
}

export function useLanguage() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
