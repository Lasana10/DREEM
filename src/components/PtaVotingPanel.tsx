import { useEffect,useRef,useState } from "react";
import { supabase } from "../lib/supabase";

type Proposal={id:string;title_en:string;title_fr:string;detail_en:string;detail_fr:string;support_count:number;oppose_count:number;abstain_count:number};
type TWidget={render:(el:HTMLElement,opts:{sitekey:string;callback:(token:string)=>void;"expired-callback":()=>void})=>string;remove:(id:string)=>void;reset:(id?:string)=>void};
const siteKey=import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()||"";
function getWidget(){return(window as Window & {turnstile?:TWidget}).turnstile;}
function voterIdentity():string{
 const storageKey="dreem-pta-indicative-voter";
 try{let value=localStorage.getItem(storageKey);if(!value){value=crypto.randomUUID();localStorage.setItem(storageKey,value);}return value;}catch{return crypto.randomUUID();}
}
export default function PtaVotingPanel({campaignId,lang}:{campaignId:string;lang:"en"|"fr"}){
 const [proposals,setProposals]=useState<Proposal[]>([]);
 const [token,setToken]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [selected,setSelected]=useState("");
 const widgetRef=useRef<HTMLDivElement>(null);
 const widgetId=useRef<string|undefined>(undefined);
 async function load(){
  if(!supabase)return;
  const {data,error}=await supabase.rpc("dreem_pta_public_proposals",{p_campaign_id:campaignId});
  if(error)throw error;
  setProposals((data??[]) as Proposal[]);
 }
 useEffect(()=>{void load().catch(()=>setMessage(lang==="fr"?"Sondage indisponible.":"Poll unavailable."));},[campaignId]);
 useEffect(()=>{
  if(!siteKey||!widgetRef.current)return;
  let alive=true;
  function show(){
   const widget=getWidget();if(!alive||!widget||!widgetRef.current||widgetId.current)return;
   widgetId.current=widget.render(widgetRef.current,{sitekey:siteKey,callback:setToken,"expired-callback":()=>setToken("")});
  }
  const script=document.querySelector<HTMLScriptElement>('script[data-dreem-turnstile]');
  if(getWidget())show();
  else if(script)script.addEventListener("load",show);
  else{const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.async=true;s.dataset.dreemTurnstile="true";s.addEventListener("load",show);document.head.appendChild(s);}
  return()=>{alive=false;if(widgetId.current){getWidget()?.remove(widgetId.current);widgetId.current=undefined;}};
 },[campaignId]);
 async function vote(proposalId:string,choice:"support"|"oppose"|"abstain"){
  if(!supabase||!token||busy)return;
  setBusy(true);setMessage("");
  try{
   const {data,error}=await supabase.functions.invoke("pta-public-vote",{body:{proposalId,voterId:voterIdentity(),choice,turnstileToken:token}});
   if(error||typeof data?.recorded!=="boolean")throw error||new Error("Not recorded");
   setMessage(data.recorded?(lang==="fr"?"Avis enregistré.":"Response recorded."):(lang==="fr"?"Votre appareil a déjà répondu à cette proposition.":"This device has already responded to this proposal."));
   setSelected(proposalId);await load();
  }catch{setMessage(lang==="fr"?"Votre réponse n'a pas été enregistrée.":"Your response was not recorded.");}
  finally{setBusy(false);setToken("");getWidget()?.reset(widgetId.current);}
 }
 if(!proposals.length)return null;
 return <section className="pta-panel" aria-label="PTA consultation polls">
  <h2>{lang==="fr"?"Propositions à examiner":"Proposals for consultation"}</h2>
  <p className="pta-privacy">{lang==="fr"?"Sondage consultatif, non électoral. Une réponse par proposition et par appareil; l'identité des parents n'est pas vérifiée.":"Advisory poll, not an election. One response per proposal per device; parent identities are not verified."}</p>
  {proposals.map(p=><article key={p.id} className="pta-vote-card">
   <h3>{lang==="fr"?p.title_fr:p.title_en}</h3>
   <p>{lang==="fr"?p.detail_fr:p.detail_en}</p>
   <p className="pta-privacy">{lang==="fr"?"Pour":"Support"}: {p.support_count} · {lang==="fr"?"Contre":"Oppose"}: {p.oppose_count} · {lang==="fr"?"Abstention":"Abstain"}: {p.abstain_count}</p>
   <div className="pta-kind">
    {(["support","oppose","abstain"] as const).map(choice=><button key={choice} type="button" disabled={busy||!token} onClick={()=>void vote(p.id,choice)}>{lang==="fr"?({support:"Pour",oppose:"Contre",abstain:"Abstention"}[choice]):({support:"Support",oppose:"Oppose",abstain:"Abstain"}[choice])}</button>)}
   </div>
  </article>)}
  <div ref={widgetRef} className="pta-captcha" aria-label="Verify before sending vote"/>
  {!siteKey&&<p role="alert">{lang==="fr"?"Le sondage sera disponible après activation de la sécurité.":"Poll opens after security verification is configured."}</p>}
  {message&&<p role="status">{message}{selected?"":""}</p>}
 </section>;
}
