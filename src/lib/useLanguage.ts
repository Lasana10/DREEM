import { useContext } from "react";
import { LanguageContext, type LanguageContextValue } from "./languageContext";
const englishFallback:LanguageContextValue={language:"en",setLanguage:()=>undefined,toggle:()=>undefined,text:(en)=>en};
export function useLanguage(){
  return useContext(LanguageContext)??englishFallback;
}
