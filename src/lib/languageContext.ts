import { createContext } from "react";
export type DreemLanguage="en"|"fr";
export type LanguageContextValue={language:DreemLanguage;setLanguage:(value:DreemLanguage)=>void;toggle:()=>void;text:(en:string,fr:string)=>string};
export const LanguageContext=createContext<LanguageContextValue|null>(null);
export const LANGUAGE_STORAGE_KEY="dreem-language";
