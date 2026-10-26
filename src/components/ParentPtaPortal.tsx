import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "./ParentPtaPortal.css";

type Lang="en"|"fr";
type Campaign={title_en:string;title_fr:string;meeting_date:string|null;closes_at:string|null};
const words={
 en:{badge:"Parent & PTA Connect",title:"Your voice helps our school grow.",subtitle:"Share a concern, question or idea before the PTA meeting. School leadership can prepare answers and practical solutions.",concern:"Raise a concern",idea:"Suggest an improvement",question:"Ask a question",topic:"What is this about?",learning:"Teaching & learning",facilities:"Facilities & hygiene",safety:"Child safety & wellbeing",administration:"School services",pta:"PTA participation",other:"Other",message:"Your message",placeholder:"Tell us what happened or what could be improved…",contact:"Contact (optional)",privacy:"Private submissions are reviewed by authorised school leadership. Do not include unnecessary child or medical details. For immediate danger, contact the school or emergency services directly.",submit:"Send to school",sending:"Sending…",sent:"Your message was received. Keep this reference:",error:"This submission could not be saved. Try again or contact the school.",closed:"This consultation is not currently available.",loading:"Checking PTA consultation…",meet:"Meeting date",back:"Send another response"},
 fr:{badge:"Parents & APEE",title:"Votre voix fait progresser notre école.",subtitle:"Exprimez vos préoccupations, questions ou suggestions avant la réunion de l’APEE pour préparer des solutions concrètes.",concern:"Signaler une préoccupation",idea:"Proposer une amélioration",question:"Poser une question",topic:"Quel est le sujet ?",learning:"Enseignement et apprentissage",facilities:"Locaux et hygiène",safety:"Sécurité et bien-être des enfants",administration:"Services scolaires",pta:"Participation à l’APEE",other:"Autre",message:"Votre message",placeholder:"Expliquez le problème ou ce qui pourrait être amélioré…",contact:"Contact (facultatif)",privacy:"Les messages restent privés et sont examinés par les responsables autorisés. Évitez les données médicales ou personnelles inutiles. En cas de danger immédiat, contactez directement l’école ou les secours.",submit:"Envoyer à l’école",sending:"Envoi…",sent:"Votre message a été reçu. Conservez cette référence :",error:"Impossible d’enregistrer votre message. Réessayez ou contactez l’école.",closed:"Cette consultation n’est pas disponible actuellement.",loading:"Vérification de la consultation…",meet:"Date de la réunion",back:"Envoyer un autre message"}
} as const;
const topics=["learning","facilities","safety","administration","pta","other"] as const;
const siteKey=import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()||"";
type Turnstile={render:(element:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;"expired-callback":()=>void})=>string;remove:(widgetId:string)=>void};
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default function ParentPtaPortal({campaignId}:{campaignId:string}){
 const [lang,setLang]=useState<Lang>("en"),[campaign,setCampaign]=useState<Campaign|null>(null),[loading,setLoading]=useState(true),[kind,setKind]=useState<"concern"|"idea"|"question">("concern"),[topic,setTopic]=useState<(typeof topics)[number]>("learning"),[message,setMessage]=useState(""),[contact,setContact]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[reference,setReference]=useState("");
 const [captcha,setCaptcha]=useState("");
 const captchaContainer=useRef<HTMLDivElement>(null);
 const t=words[lang];
 useEffect(()=>{let current=true;(async()=>{if(!supabase||!uuidPattern.test(campaignId)){if(current)setLoading(false);return;}const {data,error}=await supabase.rpc("dreem_pta_public_campaign",{p_campaign_id:campaignId});if(current){if(!error)setCampaign((data?.[0]??null) as Campaign|null);setLoading(false);}})();return()=>{current=false;};},[campaignId]);
 useEffect(()=>{
  if(!siteKey||!captchaContainer.current)return;
  let mounted=true;let widgetId:string|undefined;
  const getTurnstile=()=> (window as Window & {turnstile?:Turnstile}).turnstile;
  function show(){if(!mounted||!captchaContainer.current||widgetId)return;const turnstile=getTurnstile();if(turnstile)widgetId=turnstile.render(captchaContainer.current,{sitekey:siteKey,callback:setCaptcha,"expired-callback":()=>setCaptcha("")});}
  if(getTurnstile())show();
  else {let script=document.querySelector<HTMLScriptElement>('script[data-dreem-turnstile]');if(!script){script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;script.dataset.dreemTurnstile="true";document.head.appendChild(script);}script.addEventListener("load",show);}
  return()=>{mounted=false;const api=getTurnstile();if(widgetId&&api)api.remove(widgetId);};
 },[]);
 async function send(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!supabase||busy||!campaign||!captcha||topic==="safety")return;setBusy(true);setError("");try{const {data,error}=await supabase.functions.invoke("pta-public-submit",{body:{campaignId,kind,topic,language:lang,message:message.trim(),contact:contact.trim()||null,turnstileToken:captcha}});if(error||typeof data?.reference!=="string")throw error||new Error("No receipt returned");setReference(data.reference);setCaptcha("");}catch{setError(t.error);}finally{setBusy(false);}}
