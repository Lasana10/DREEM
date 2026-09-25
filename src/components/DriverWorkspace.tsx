import { BusFront, Clock3, MapPinned, QrCode, UsersRound, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type WorkspaceData } from "../lib/repository";
import { prepareDriverOfflineContext, progressTransportTripResilient, replayDriverOffline } from "../lib/driverOffline";

function errorText(reason:unknown){return reason instanceof Error?reason.message:reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"?reason.message:"The journey update could not be recorded.";}

export default function DriverWorkspace({workspace,onRefresh}:{workspace:WorkspaceData;onRefresh:()=>Promise<void>}){
 const driver=workspace.transport.drivers.find(item=>item.userId===workspace.viewer.id);
 const trips=driver?workspace.transport.trips.filter(item=>item.driverId===driver.id).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate)):[];
 const activeTrips=trips.filter(item=>!["completed","cancelled"].includes(item.status));
 const [tripId,setTripId]=useState(activeTrips[0]?.id??trips[0]?.id??"");
 const [online,setOnline]=useState(typeof navigator==="undefined"?true:navigator.onLine),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const trip=trips.find(item=>item.id===tripId),route=workspace.transport.routes.find(item=>item.id===trip?.routeId);
 const assignments=useMemo(()=>trip?workspace.transport.assignments.filter(item=>item.routeId===trip.routeId&&item.status==="active"):[],[workspace.transport.assignments,trip]);
 const stops=route?.stops??[];
 const [selectedStopId,setSelectedStopId]=useState("");
 const selectedStop=stops.find(stop=>stop.id===selectedStopId)??stops[0];
 const stopLearners=selectedStop?assignments.filter(item=>trip?.direction==="outbound"?item.dropoffStopName===selectedStop.name:item.pickupStopName===selectedStop.name):assignments;

 async function record(eventType:string,studentId?:string,stopId?:string,note?:string){if(!trip)return;setBusy(true);setError("");setMessage("");try{const result=await progressTransportTripResilient({tripId:trip.id,eventType,studentId,stopId,note,idempotencyKey:"driver-trip:"+crypto.randomUUID()},workspace.viewer);if(result.queued)setMessage("Saved on this phone. DREEM will sync it automatically when connection returns.");else{setMessage("Recorded.");await onRefresh();}}catch(reason){setError(errorText(reason));}finally{setBusy(false);}}
 useEffect(()=>{let active=true;const connect=async()=>{setOnline(true);try{const result=await replayDriverOffline(workspace.viewer);if(active&&result.synced){setMessage(result.synced+" saved update"+(result.synced===1?"":"s")+" synced automatically.");await onRefresh();}if(active&&result.tampered)setError(result.tampered+" saved update failed its safety check and was not sent.");}catch(reason){if(active)setError(errorText(reason));}};const disconnect=()=>setOnline(false);if(navigator.onLine)prepareDriverOfflineContext().catch(()=>{});window.addEventListener("online",connect);window.addEventListener("offline",disconnect);return()=>{active=false;window.removeEventListener("online",connect);window.removeEventListener("offline",disconnect);};},[workspace.viewer,onRefresh]);

 if(!driver)return <div className="content role-workspace"><section className="role-hero"><div><span className="eyebrow">DREEM DRIVER</span><h2>No route assigned yet</h2><p>Transport Control will place your journey here when it is ready.</p></div></section></div>;

 return <div className="content role-workspace driver-workspace">
  <section className="role-hero">
   <div><span className="eyebrow">ACTIVE ROUTE</span><h2>{trip?.routeName??"Waiting for today’s trip"}</h2><p>{trip?trip.vehicleCode+" · "+assignments.length+" learner"+(assignments.length===1?"":"s")+" expected"+(trip.scheduledDeparture?" · "+trip.scheduledDeparture:""):"Transport Control will send your assigned trip here."}</p></div>
   <div className="role-hero-status"><span className={online?"status-pill":"status-pill attention"}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?"Connected":"Offline · saving locally"}</span></div>
  </section>

  {error?<div className="form-status error" role="alert">{error}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}

  {trips.length>1?<nav className="workspace-tabs" aria-label="Driver journeys">{trips.map(item=><button key={item.id} className={tripId===item.id?"active":""} onClick={()=>{setTripId(item.id);setSelectedStopId("");}}>{item.routeName} · {item.serviceDate}</button>)}</nav>:null}

  <div className="visual-stats">
   <article className="visual-stat green"><div className="icon"><BusFront/></div><div><span>TRIP STATUS</span><strong>{trip?.status.replaceAll("_"," ")??"Not dispatched"}</strong><small>{trip?.direction??""}</small></div></article>
   <article className="visual-stat"><div className="icon"><UsersRound/></div><div><span>LEARNERS</span><strong>{assignments.length}</strong><small>Assigned to this route</small></div></article>
   <article className="visual-stat purple"><div className="icon"><MapPinned/></div><div><span>STOPS</span><strong>{stops.length}</strong><small>Tap the current stop below</small></div></article>
   <article className="visual-stat amber"><div className="icon"><Clock3/></div><div><span>SYNC</span><strong>{online?"Live":"Offline"}</strong><small>{online?"Updates reach school":"Changes queue safely"}</small></div></article>
  </div>

  {trip?<>
   <section className="focus-card">
    <div className="panel-title"><MapPinned/><div><span>ROUTE PROGRESS</span><h3>{selectedStop?"Current stop · "+selectedStop.name:"Choose your stop"}</h3></div></div>
    <div className="stop-strip">{stops.map(stop=><button key={stop.id} className={"stop-chip "+(selectedStop?.id===stop.id?"active":"")} onClick={()=>setSelectedStopId(stop.id)}>{stop.order}. {stop.name}</button>)}</div>
    {selectedStop?<div className="gate-scan-actions"><button className="primary" disabled={busy} onClick={()=>void record("stop_arrived",undefined,selectedStop.id)}>Arrived at {selectedStop.name}</button><button disabled={busy} onClick={()=>void record("delay_reported",undefined,selectedStop.id,"Driver reported delay")}>Report delay</button></div>:null}
   </section>

   <section className="focus-card">
    <div className="panel-title"><UsersRound/><div><span>{trip.direction==="outbound"?"DROP-OFF":"BOARDING"}</span><h3>{selectedStop?selectedStop.name:"Learners on this route"} · {stopLearners.length}</h3></div><button aria-label="Scan learner credential"><QrCode size={18}/></button></div>
    <div className="learner-touch-grid">{stopLearners.map(item=><button className="learner-touch" key={item.studentId} disabled={busy} onClick={()=>void record(trip.direction==="outbound"?"student_alighted":"student_boarded",item.studentId,selectedStop?.id)}><span className="avatar">{item.studentName.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><span><strong>{item.studentName}</strong><small>{trip.direction==="outbound"?item.dropoffStopName:item.pickupStopName}</small></span><span className="status-pill info">{trip.direction==="outbound"?"Tap to drop off":"Tap to board"}</span></button>)}</div>
    {!stopLearners.length?<p>No learner is assigned to this stop.</p>:null}
   </section>

   <div className="quick-grid">
    <article className="quick-card"><BusFront/><span>START</span><h3>Begin trip</h3><p>Use when the vehicle starts the assigned journey.</p><button className="primary" disabled={busy} onClick={()=>void record("departed")}>Start / depart</button></article>
    <article className="quick-card"><Clock3/><span>EXCEPTION</span><h3>Something changed?</h3><p>Report a delay without typing a long message.</p><button disabled={busy} onClick={()=>void record("delay_reported",undefined,undefined,"Driver reported delay")}>Report delay</button></article>
    <article className="quick-card"><MapPinned/><span>FINISH</span><h3>Arrived at school</h3><p>Close the journey when the route is complete.</p><button disabled={busy} onClick={()=>void record("completed")}>Finish journey</button></article>
   </div>
  </>:<section className="panel"><p>No trip is assigned. You do not need to configure anything here.</p></section>}
 </div>;
}
