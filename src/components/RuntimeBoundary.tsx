import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { userFacingError } from "../lib/userFacingError";

type Props={children:ReactNode};
type State={error:unknown|null};

export default class RuntimeBoundary extends Component<Props,State>{
  state:State={error:null};
  static getDerivedStateFromError(error:unknown){return {error};}
  componentDidCatch(error:unknown,info:ErrorInfo){
    console.error("DREEM runtime failure",error,info.componentStack);
  }
  render(){
    if(!this.state.error)return this.props.children;
    return <main className="runtime-failure" role="alert">
      <section>
        <AlertTriangle/>
        <span className="eyebrow">DREEM RECOVERY</span>
        <h1>This screen could not finish loading</h1>
        <p>{userFacingError(this.state.error,"DREEM hit an unexpected problem while opening this screen. Your last action has not been assumed saved.")}</p>
        <div className="card-actions">
          <button className="primary" onClick={()=>this.setState({error:null})}><RefreshCw/>Try screen again</button>
          <button onClick={()=>window.location.reload()}>Reload DREEM</button>
        </div>
      </section>
    </main>;
  }
}
