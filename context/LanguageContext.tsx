'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SupportedLanguage = "en" | "sv";

type TranslationKey =
  | "app.title"
  | "nav.dashboard"
  | "nav.employees"
  | "nav.schedule"
  | "nav.aiAgent"
  | "nav.language"
  | "button.save"
  | "button.cancel"
  | "button.edit"
  | "button.newEmployee"
  | "button.newShift"
  | "button.submit"
  | "tabs.week"
  | "tabs.day"
  | "placeholder.aiPrompt"
  | "label.name"
  | "label.role"
  | "label.contractHours"
  | "label.maxWeeklyHours"
  | "label.employmentType"
  | "label.phone"
  | "label.location"
  | "label.date"
  | "label.startTime"
  | "label.endTime"
  | "label.status"
  | "label.hourlyRate"
  | "status.draft"
  | "status.published"
  | "employees.summary.total"
  | "employees.summary.fullTime"
  | "employees.summary.partTime"
  | "employees.summary.totalHours"
  | "employees.addEmployee"
  | "employees.editEmployee"
  | "employees.deleteEmployee"
  | "employees.deleteConfirm"
  | "employees.perWeek"
  | "role.service"
  | "role.shiftleader"
  | "role.rutin"
  | "employment.fullTime"
  | "employment.partTime"
  | "employment.hourly"
  | "employees.supabaseNotConfigured"
  | "schedule.prevWeek"
  | "schedule.nextWeek"
  | "schedule.publishWeek"
  | "schedule.addShift"
  | "schedule.editShift"
  | "schedule.deleteShift"
  | "schedule.deleteShiftConfirm"
  | "schedule.saveAsDraft"
  | "schedule.publishImmediately"
  | "schedule.weekSummary"
  | "schedule.totalHours"
  | "schedule.estimatedCost"
  | "schedule.emptyState"
  | "schedule.day.mon"
  | "schedule.day.tue"
  | "schedule.day.wed"
  | "schedule.day.thu"
  | "schedule.day.fri"
  | "schedule.day.sat"
  | "schedule.day.sun"
  | "label.notes";

type Translations = Record<SupportedLanguage, Record<TranslationKey, string>>;

const translations: Translations = {
  en: {
    "app.title": "Skift",
    "nav.dashboard": "Dashboard",
    "nav.employees": "Employees",
    "nav.schedule": "Schedule",
    "nav.aiAgent": "AI Agent",
    "nav.language": "Language",
    "button.save": "Save",
    "button.cancel": "Cancel",
    "button.edit": "Edit",
    "button.newEmployee": "New employee",
    "button.newShift": "New shift",
    "button.submit": "Submit",
    "tabs.week": "Week",
    "tabs.day": "Day",
    "placeholder.aiPrompt": "Describe the schedule you want to generate...",
    "label.name": "Name",
    "label.role": "Role",
    "label.contractHours": "Contract hours",
    "label.maxWeeklyHours": "Max weekly hours",
    "label.employmentType": "Employment type",
    "label.phone": "Phone",
    "label.location": "Location",
    "label.date": "Date",
    "label.startTime": "Start time",
    "label.endTime": "End time",
    "label.status": "Status",
    "label.hourlyRate": "Hourly rate (SEK)",
    "status.draft": "Draft",
    "status.published": "Published",
    "employees.summary.total": "Total employees",
    "employees.summary.fullTime": "Full-time",
    "employees.summary.partTime": "Part-time",
    "employees.summary.totalHours": "Total contracted hours / week",
    "employees.addEmployee": "Add employee",
    "employees.editEmployee": "Edit employee",
    "employees.deleteEmployee": "Delete employee",
    "employees.deleteConfirm":
      "Are you sure you want to delete this employee? This action cannot be undone.",
    "employees.perWeek": "per week",
    "role.service": "Service",
    "role.shiftleader": "Shiftleader",
    "role.rutin": "Rutin",
    "employment.fullTime": "Full-time",
    "employment.partTime": "Part-time",
    "employment.hourly": "Hourly",
    "employees.supabaseNotConfigured":
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.",
    "schedule.prevWeek": "Prev",
    "schedule.nextWeek": "Next",
    "schedule.publishWeek": "Publish Week",
    "schedule.addShift": "Add shift",
    "schedule.editShift": "Edit shift",
    "schedule.deleteShift": "Delete shift",
    "schedule.deleteShiftConfirm":
      "Remove this shift? This cannot be undone.",
    "schedule.saveAsDraft": "Save as draft",
    "schedule.publishImmediately": "Publish immediately",
    "schedule.weekSummary": "Week summary",
    "schedule.totalHours": "Total hours",
    "schedule.estimatedCost": "Est. labour cost",
    "schedule.emptyState": "No shifts this week. Add shifts with + on each day.",
    "schedule.day.mon": "Mon",
    "schedule.day.tue": "Tue",
    "schedule.day.wed": "Wed",
    "schedule.day.thu": "Thu",
    "schedule.day.fri": "Fri",
    "schedule.day.sat": "Sat",
    "schedule.day.sun": "Sun",
    "label.notes": "Notes",
  },
  sv: {
    "app.title": "Skift",
    "nav.dashboard": "Översikt",
    "nav.employees": "Anställda",
    "nav.schedule": "Schema",
    "nav.aiAgent": "AI-assistent",
    "nav.language": "Språk",
    "button.save": "Spara",
    "button.cancel": "Avbryt",
    "button.edit": "Redigera",
    "button.newEmployee": "Ny anställd",
    "button.newShift": "Nytt pass",
    "button.submit": "Skicka",
    "tabs.week": "Vecka",
    "tabs.day": "Dag",
    "placeholder.aiPrompt": "Beskriv schemat du vill skapa...",
    "label.name": "Namn",
    "label.role": "Roll",
    "label.contractHours": "Kontrakttimmar",
    "label.maxWeeklyHours": "Max vecko­timmar",
    "label.employmentType": "Anställningsform",
    "label.phone": "Telefon",
    "label.location": "Plats",
    "label.date": "Datum",
    "label.startTime": "Starttid",
    "label.endTime": "Sluttid",
    "label.status": "Status",
    "label.hourlyRate": "Timlön (SEK)",
    "status.draft": "Utkast",
    "status.published": "Publicerad",
    "employees.summary.total": "Antal anställda",
    "employees.summary.fullTime": "Heltid",
    "employees.summary.partTime": "Deltid",
    "employees.summary.totalHours": "Totala avtalade timmar / vecka",
    "employees.addEmployee": "Lägg till anställd",
    "employees.editEmployee": "Redigera anställd",
    "employees.deleteEmployee": "Ta bort anställd",
    "employees.deleteConfirm":
      "Är du säker på att du vill ta bort den här anställda? Detta kan inte ångras.",
    "employees.perWeek": "per vecka",
    "role.service": "Service",
    "role.shiftleader": "Shiftledare",
    "role.rutin": "Rutin",
    "employment.fullTime": "Heltid",
    "employment.partTime": "Deltid",
    "employment.hourly": "Timanställd",
    "employees.supabaseNotConfigured":
      "Supabase är inte konfigurerad. Lägg till NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local och starta om dev-servern.",
    "schedule.prevWeek": "Föreg",
    "schedule.nextWeek": "Nästa",
    "schedule.publishWeek": "Publicera vecka",
    "schedule.addShift": "Lägg till pass",
    "schedule.editShift": "Redigera pass",
    "schedule.deleteShift": "Ta bort pass",
    "schedule.deleteShiftConfirm":
      "Ta bort detta pass? Detta kan inte ångras.",
    "schedule.saveAsDraft": "Spara som utkast",
    "schedule.publishImmediately": "Publicera direkt",
    "schedule.weekSummary": "Veckosammanfattning",
    "schedule.totalHours": "Totalt antal timmar",
    "schedule.estimatedCost": "Beräknad arbetskostnad",
    "schedule.emptyState":
      "Inga pass denna vecka. Lägg till pass med + på varje dag.",
    "schedule.day.mon": "Mån",
    "schedule.day.tue": "Tis",
    "schedule.day.wed": "Ons",
    "schedule.day.thu": "Tor",
    "schedule.day.fri": "Fre",
    "schedule.day.sat": "Lör",
    "schedule.day.sun": "Sön",
    "label.notes": "Anteckningar",
  },
};

interface LanguageContextValue {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

interface LanguageProviderProps {
  initialLang?: SupportedLanguage;
  children: ReactNode;
}

export function LanguageProvider({
  initialLang = "en",
  children,
}: LanguageProviderProps) {
  const [lang, setLangState] = useState<SupportedLanguage>(initialLang);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("scheduler_lang")
        : null;
    if (saved === "en" || saved === "sv") {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((next: SupportedLanguage) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("scheduler_lang", next);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      return translations[lang][key] ?? key;
    },
    [lang]
  );

  const value: LanguageContextValue = {
    lang,
    setLang,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
