import { describe,expect,it } from "vitest";
import { searchWorkspace, type WorkspaceSearchItem } from "./workspaceSearch";

function learner(index:number):WorkspaceSearchItem{
  const className=`Form ${index%7+1}${String.fromCharCode(65+(index%4))}`;
  const title=index===8421?"Nadia Exceptional Learner":`Learner ${index}`;
  const subtitle=`DREEM-${String(index).padStart(5,"0")} · ${className}`;
  return {id:`learner:${index}`,kind:"learner",title,subtitle,keywords:`${title} ${subtitle} student pupil onefile`.toLowerCase(),view:"learners"};
}

describe("workspace search at school scale",()=>{
  it("keeps bounded relevant results with ten thousand searchable records",()=>{
    const items=Array.from({length:10000},(_,index)=>learner(index));
    const results=searchWorkspace(items,"Nadia Exceptional",8);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("learner:8421");
  });
  it("never floods the interface when a broad term matches thousands of records",()=>{
    const items=Array.from({length:10000},(_,index)=>learner(index));
    expect(searchWorkspace(items,"learner",8)).toHaveLength(8);
  });
});
