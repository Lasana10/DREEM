import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type DreemLanguage="en"|"fr";
type LanguageContextValue={language:DreemLanguage;setLanguage:(value:DreemLanguage)=>void;toggle:()=>void;text:(en:string,fr:string)=>string};
const KEY="dreem-language";
const LanguageContext=createContext<LanguageContextValue|null>(null);

export function LanguageProvider({children}:{children:ReactNode}){
  const initial=typeof localStorage!=="undefined"&&localStorage.getItem(KEY)==="fr"?"fr":"en";
  const[language,setState]=useState<DreemLanguage>(initial);
  const setLanguage=(value:DreemLanguage)=>{setState(value);localStorage.setItem(KEY,value);document.documentElement.lang=value;};
  const value=useMemo<LanguageContextValue>(()=>({language,setLanguage,toggle:()=>setLanguage(language==="en"?"fr":"en"),text:(en,fr)=>language==="fr"?fr:en}),[language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){
  const value=useContext(LanguageContext);
  if(!value)throw new Error("DREEM language context is unavailable.");
  return value;
}
