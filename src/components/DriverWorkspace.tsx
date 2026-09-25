import { BusFront, Clock3, MapPinned, UsersRound, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type WorkspaceData } from "../lib/repository";
import { prepareDriverOfflineContext, progressTransportTripResilient, replayDriverOffline } from "../lib/driverOffline";

function errorText(reason:unknown){return reason instanceof Error?reason.message:reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"?reason.message:"The journey update could not be recorded.";}
function initials(name:string){return name.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();}
export default function DriverWorkspace({workspace,onRefresh}:{workspace:WorkspaceData;onRefresh:()=>Promise<void>}){
 const driver=workspace.transport.drivers.find(item=>item.userId===workspace.viewer.id);
 const trips=driver?workspace.transport.trips.filter(item=>item.driverId===driver.id).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate)):[];
 const activeTrips=trips.filter(item=>!["completed","cancelled"].includes(item.status));
 const[tripId,setTripId]=useState(activeTrips[0]?.id??trips[0]?.id??"");
 const[online,setOnline]=useState(typeof navigator==="undefined"?true:navigator.onLine),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[activeStopId,setActiveStopId]=useState("");
 const trip=trips.find(item=>item.id===tripId),route=workspace.transport.routes.find(item=>item.id===trip?.routeId);
 const assignments=useMemo(()=>trip?workspace.transport.assignments.filter(item=>item.routeId===trip.routeId&&item.status==="active"):[],[workspace.transport.assignments,trip]);
 const stops=route?.stops??[],activeStop=stops.find(s=>s.id===activeStopId)??stops[0];
 const stopLearners=assignments.filter(item=>!activeStop||item.pickupStopName===activeStop.name||item.dropoffStopName===activeStop.name);
 async function record(eventType:string,studentId?:string,stopId?:string,note?:string){if(!trip)return;setBusy(true);setError("");setMessage("");try{const result=await progressTransportTripResilient({tripId:trip.id,eventType,studentId,stopId,note,idempotencyKey:"driver-trip:"+crypto.randomUUID()},workspace.viewer);if(result.queued)setMessage("Saved on this phone. It will sync automatically.");else{setMessage("Recorded.");await onRefresh();}}catch(reason){setError(errorText(reason));}finally{setBusy(false);}}
 useEffect(()=>{if(stops.length&&!activeStopId)setActiveStopId(stops[0].id);},[stops,activeStopId]);
 useEffect(()=>{let active=true;const connect=async()=>{setOnline(true);try{const result=await replayDriverOffline(workspace.viewer);if(active&&result.synced){setMessage(result.synced+" saved update"+(result.synced===1?"":"s")+" synced.");await onRefresh();}if(active&&result.tampered)setError(result.tampered+" saved update failed its safety check.");}catch(reason){if(active)setError(errorText(reason));}};const disconnect=()=>setOnline(false);if(navigator.onLine)prepareDriverOfflineContext().catch(()=>{});window.addEventListener("online",connect);window.addEventListener("offline",disconnect);return()=>{active=false;window.removeEventListener("online",connect);window.removeEventListener("offline",disconnect);};},[workspace.viewer,onRefresh]);
 if(!driver)return <div className="content role-workspace"><section className="role-hero"><div><span className="eyebrow">DRIVER · TODAY</span><h2>No journey assigned yet</h2><p>Transport Control will send your route here. Nothing needs to be configured by the driver.</p></div></section></div>;
 return <div className="content role-workspace driver-workspace">
  <section className="role-hero"><div><span className="eyebrow">ACTIVE ROUTE</span><h2>{trip?.routeName??"Waiting for today's trip"}</h2><p>{trip?(trip.vehicleCode+" · "+assignments.length+" learners expected"+(trip.scheduledDeparture?" · "+trip.scheduledDeparture:"")):"Transport Control will assign the trip."}</p></div><div className="role-hero-status"><span className={"status-pill "+(online?"":"attention")}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?"Connected":"Offline · still usable"}</span></div></section>
  {error?<div className="form-status error" role="alert">{error}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}
  {trips.length>1?<section className="panel"><label>Journey<select value={tripId} onChange={e=>setTripId(e.target.value)}>{trips.map(item=><option key={item.id} value={item.id}>{item.serviceDate} · {item.routeName} · {item.direction}</option>)}</select></label></section>:null}
  {trip?<>
   <section className="visual-stats">
    <article className="visual-stat green"><div className="icon"><BusFront/></div><div><span>TRIP STATUS</span><strong>{trip.status.replaceAll("_"," ")}</strong><small>{trip.direction}</small></div></article>
    <article className="visual-stat"><div className="icon"><UsersRound/></div><div><span>LEARNERS</span><strong>{assignments.length}</strong><small>on this route</small></div></article>
    <article className="visual-stat amber"><div className="icon"><MapPinned/></div><div><span>STOPS</span><strong>{stops.length}</strong><small>{activeStop?.name||"No stop"}</small></div></article>
    <article className="visual-stat purple"><div className="icon"><Clock3/></div><div><span>SYNC</span><strong>{online?"Live":"Local"}</strong><small>automatic</small></div></article>
   </section>
   <section className="focus-card"><div className="panel-title"><div><span>ROUTE</span><h3>Where are you now?</h3></div><div className="gate-scan-actions"><button className="primary" disabled={busy} onClick={()=>void record("departed")}>Start / depart</button><button disabled={busy} onClick={()=>void record("delay_reported",undefined,undefined,"Driver reported delay")}>Delay</button><button disabled={busy} onClick={()=>void record("completed")}>Finish</button></div></div>
    <div className="stop-strip">{stops.map(stop=><button key={stop.id} className={"stop-chip "+(activeStop?.id===stop.id?"active":"")} onClick={()=>setActiveStopId(stop.id)}>{stop.name}</button>)}</div>
    {activeStop?<div className="role-hero" style={{marginBottom:8}}><div><span className="eyebrow">CURRENT STOP</span><h2 style={{fontSize:24}}>{activeStop.name}</h2><p>{stopLearners.length} learner{stopLearners.length===1?"":"s"} linked here</p></div><button className="primary" disabled={busy} onClick={()=>void record("stop_arrived",undefined,activeStop.id)}>Arrived here</button></div>:null}
   </section>
   <section className="focus-card" style={{marginTop:14}}><div className="panel-title"><div><span>LEARNERS AT THIS STOP</span><h3>Tap what happened</h3></div></div><div className="learner-touch-grid">{stopLearners.length?stopLearners.map(item=><article className="learner-touch" key={item.studentId}><div className="avatar">{initials(item.studentName)}</div><div><strong>{item.studentName}</strong><small>{item.pickupStopName} → {item.dropoffStopName}</small></div><div className="gate-scan-actions"><button className="primary" disabled={busy} onClick={()=>void record("student_boarded",item.studentId)}>Boarded</button><button disabled={busy} onClick={()=>void record("student_alighted",item.studentId)}>Drop off</button></div></article>):<p>No learner is linked to this stop.</p>}</div></section>
   <details className="depth-drawer"><summary>All route learners and technical details</summary><section className="panel"><div className="action-list">{assignments.map(item=><article className="action-row" key={item.studentId}><div className="action-icon"><UsersRound/></div><div><strong>{item.studentName}</strong><small>{item.pickupStopName} → {item.dropoffStopName}</small></div></article>)}</div></section></details>
  </>:<section className="panel"><p>No trip is assigned. You do not need to configure anything here.</p></section>}
 </div>;
}