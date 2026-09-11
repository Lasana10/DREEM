import { BusFront, Clock3, MapPinned, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { progressTransportTrip, type WorkspaceData } from "../lib/repository";

function errorText(reason:unknown){return reason instanceof Error?reason.message:reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"?reason.message:"The journey update could not be recorded.";}

export default function DriverWorkspace({workspace,onRefresh}:{workspace:WorkspaceData;onRefresh:()=>Promise<void>}){
  const driver=workspace.transport.drivers.find(item=>item.userId===workspace.viewer.id);
  const trips=driver?workspace.transport.trips.filter(item=>item.driverId===driver.id).sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate)):[];
  const activeTrips=trips.filter(item=>!["completed","cancelled"].includes(item.status));
  const [tripId,setTripId]=useState(activeTrips[0]?.id??trips[0]?.id??"");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const trip=trips.find(item=>item.id===tripId);
  const route=workspace.transport.routes.find(item=>item.id===trip?.routeId);
  const learners=useMemo(()=>trip?workspace.transport.assignments.filter(item=>item.routeId===trip.routeId&&item.status==="active"):[],[workspace.transport.assignments,trip]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!trip)return;
    const data=new FormData(event.currentTarget);
    setBusy(true);setError("");setMessage("");
    try{
      await progressTransportTrip({tripId:trip.id,eventType:String(data.get("eventType")),stopId:String(data.get("stopId")||"")||undefined,studentId:String(data.get("studentId")||"")||undefined,note:String(data.get("note")||""),idempotencyKey:`driver-trip:${crypto.randomUUID()}`});
      setMessage("Journey update recorded in the school trip history.");
      await onRefresh();
    }catch(reason){setError(errorText(reason));}finally{setBusy(false);}
  }
  if(!driver)return <div className="content role-workspace"><section className="page-intro"><div><span>DREEM DRIVER</span><h2>Your driver profile is not active yet.</h2><p>A transport manager must link this account to an approved driver record before school journeys can be operated.</p></div></section></div>;
  return <div className="content role-workspace driver-workspace">
    <section className="page-intro"><div><span>DREEM DRIVER · TODAY</span><h2>Drive the assigned trip. Record what actually happens.</h2><p>You can operate trips assigned to your driver identity. Route setup, consent administration and gate release remain outside the Driver app.</p></div><div className="care-assurance"><ShieldCheck/><span><strong>{driver.name}</strong><small>Licence {driver.licenseReference} · {driver.status}</small></span></div></section>
    {error?<div className="form-status error" role="alert">{error}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}
    <div className="teacher-action-grid"><article className="role-action primary-action"><BusFront/><span>ASSIGNED JOURNEY</span><h3>{activeTrips[0]?activeTrips[0].routeName:"No open trip assigned"}</h3><p>{activeTrips[0]?`${activeTrips[0].serviceDate} · ${activeTrips[0].direction} · ${activeTrips[0].vehicleCode}`:"The transport manager must dispatch a trip before journey events can be recorded."}</p></article><article className="role-action"><UsersRound/><span>LEARNERS</span><h3>{trip?.assignedStudents??0} expected</h3><p>Only learners assigned to the selected route are available for boarding/alighting events.</p></article><article className="role-action"><Clock3/><span>STATUS</span><h3>{trip?.status.replaceAll("_"," ")??"Waiting"}</h3><p>{trip?.scheduledDeparture?`Scheduled departure ${trip.scheduledDeparture}`:"No departure time recorded"}</p></article></div>
    <section className="panel lifecycle-panel"><div className="panel-title"><MapPinned/><div><span>DRIVER JOURNEY</span><h3>Dispatch → depart → stops → learner movement → complete</h3></div></div><div className="lifecycle-rail"><span><b>1</b>Receive assigned trip</span><span><b>2</b>Depart</span><span><b>3</b>Record stop arrival / delay</span><span><b>4</b>Board / alight learner</span><span><b>5</b>Complete journey</span></div></section>
    <section className="panel"><div className="panel-title"><BusFront/><div><span>JOURNEY CONTROL</span><h3>Record the next real event</h3></div></div>
      <form className="settings-form" onSubmit={submit}><div className="form-grid"><label>Assigned trip<select value={tripId} onChange={event=>setTripId(event.target.value)} required><option value="">Choose trip</option>{trips.map(item=><option key={item.id} value={item.id}>{item.serviceDate} · {item.routeName} · {item.direction} · {item.status}</option>)}</select></label><label>Journey event<select name="eventType" defaultValue="departed"><option value="departed">Departed</option><option value="stop_arrived">Stop arrived</option><option value="delay_reported">Delay reported</option><option value="student_boarded">Learner boarded</option><option value="student_alighted">Learner alighted</option><option value="completed">Completed</option><option value="note">Operational note</option></select></label><label>Stop (when relevant)<select name="stopId"><option value="">No stop</option>{route?.stops.map(stop=><option key={stop.id} value={stop.id}>{stop.order}. {stop.name}</option>)}</select></label><label>Learner (when relevant)<select name="studentId"><option value="">No learner</option>{learners.map(item=><option key={item.studentId} value={item.studentId}>{item.studentName} · {item.pickupStopName} → {item.dropoffStopName}</option>)}</select></label></div><label>Journey note<textarea name="note" rows={3} placeholder="Delay reason, handover detail or operational evidence"/></label><button className="primary" disabled={busy||!trip} type="submit">{busy?"Recording…":"Record journey event"}</button></form>
    </section>
  </div>;
}
