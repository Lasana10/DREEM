const TECHNICAL_PATTERN=/(postgres|supabase|relation |column |constraint|violates|sqlstate|jwt|row-level security|rls|uuid|schema|rpc|edge function|stack|trace|details:|hint:|code:)/i;
const SAFE_MESSAGES:[RegExp,string][]=[
  [/network|fetch|offline|connection/i,"DREEM could not reach the school service. Check your connection and try again."],
  [/permission|not authorized|not authorised|forbidden|policy|row-level security|rls/i,"You do not have access to complete this action. Ask the appropriate school lead if you believe this should be available to you."],
  [/duplicate|already exists|unique constraint/i,"This appears to have already been recorded. Refresh the workspace before trying again."],
  [/timeout|timed out/i,"This action took too long to complete. Nothing has been assumed saved; try again."],
  [/session|jwt|expired|authentication|auth/i,"Your session needs to be refreshed. Sign in again and retry the action."],
];

type UnknownRecord=Record<string,unknown>;

function messageFrom(reason:unknown){
  if(reason instanceof Error&&reason.message)return reason.message.trim();
  if(reason&&typeof reason==="object"&&"message" in reason&&typeof (reason as UnknownRecord).message==="string")return String((reason as UnknownRecord).message).trim();
  return "";
}

export function userFacingError(reason:unknown,fallback="This action could not be completed. Nothing has been assumed saved. Please try again."){
  const raw=messageFrom(reason);
  if(!raw)return fallback;
  const mapped=SAFE_MESSAGES.find(([pattern])=>pattern.test(raw));
  if(mapped)return mapped[1];
  if(TECHNICAL_PATTERN.test(raw)||raw.length>220)return fallback;
  return raw;
}
