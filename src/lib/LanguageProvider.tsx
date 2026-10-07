import { useMemo, useState, type ReactNode } from "react";
import { LanguageContext, LANGUAGE_STORAGE_KEY, type DreemLanguage, type LanguageContextValue } from "./languageContext";

export function LanguageProvider({children}:{children:ReactNode}){
  const initial=typeof localStorage!=="undefined"&&localStorage.getItem(LANGUAGE_STORAGE_KEY)==="fr"?"fr":"en";
  const[language,setState]=useState<DreemLanguage>(initial);
  const setLanguage=(value:DreemLanguage)=>{setState(value);localStorage.setItem(LANGUAGE_STORAGE_KEY,value);document.documentElement.lang=value;};
  const value=useMemo<LanguageContextValue>(()=>({language,setLanguage,toggle:()=>setLanguage(language==="en"?"fr":"en"),text:(en,fr)=>language==="fr"?fr:en}),[language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
