export type GateIdentityMethod="school_photo"|"physical_photo_id";
export type GateReleaseSafetyInput={
 online:boolean;learnerToken:string;collectorToken:string;
 decision:"released"|"denied";identityConfirmed:boolean;
 identityMethod:GateIdentityMethod|"";reason:string;
};
export function validateGateRelease(input:GateReleaseSafetyInput):string|null{
 if(!input.learnerToken.trim())return "Scan or enter the learner credential first.";
 if(!input.reason.trim())return "Record a gate verification note.";
 if(input.decision==="denied")return null;
 if(!input.online)return "DO NOT RELEASE: the school server is unavailable. Log a denial or wait for connection.";
 if(!input.collectorToken.trim())return "DO NOT RELEASE: the collector credential is missing.";
 if(!input.identityConfirmed)return "DO NOT RELEASE: first physically compare the person at the gate with their verified identity.";
 if(input.identityMethod!=="school_photo"&&input.identityMethod!=="physical_photo_id")
  return "DO NOT RELEASE: choose which verified identity evidence you personally inspected.";
 return null;
}
