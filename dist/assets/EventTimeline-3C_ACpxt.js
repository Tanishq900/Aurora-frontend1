import{r as y,j as s}from"./index-BWRs-o60.js";import{s as d}from"./sos.service-z5TfIbel.js";import{c as l}from"./createLucideIcon-C8xEK6Q3.js";/**
 * @license lucide-react v0.303.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=l("AlertTriangle",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",key:"c3ski4"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);/**
 * @license lucide-react v0.303.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=l("Bot",[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]]);/**
 * @license lucide-react v0.303.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=l("CheckCircle2",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.303.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=l("CheckCircle",[["path",{d:"M22 11.08V12a10 10 0 1 1-5.93-9.14",key:"g774vq"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);/**
 * @license lucide-react v0.303.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=l("MapPin",[["path",{d:"M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",key:"2oe9fu"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]]);function M({events:u,sosEvent:i,sosId:t}){const[h,g]=y.useState([]),[x,p]=y.useState(!1);y.useEffect(()=>{const r=typeof t=="string"?t:(t==null?void 0:t.id)||null;r&&(p(!0),d.getSOSEventHistory(String(r)).then(e=>{g(e)}).catch(e=>{console.error("Failed to fetch SOS events:",e)}).finally(()=>{p(!1)}))},[t]);let c=[];h.length>0?c=h.map(r=>({type:r.type,timestamp:r.timestamp,data:r.meta,risk_value:r.risk_value})):u&&u.length>0?c=u:i&&(c=[{type:"sos_triggered",timestamp:i.created_at,data:{triggerType:i.trigger_type,riskScore:i.risk_score}},...i.status==="acknowledged"||i.status==="resolved"?[{type:i.status,timestamp:i.updated_at,data:{}}]:[]]);const k=r=>{switch(r){case"sos_triggered":return s.jsx(w,{className:"h-4 w-4 text-danger"});case"ai_risk":return s.jsx(N,{className:"h-4 w-4 text-aurora-cyan"});case"zone_entered":return s.jsx(S,{className:"h-4 w-4 text-aurora-emerald"});case"acknowledged":return s.jsx(b,{className:"h-4 w-4 text-warning"});case"resolved":return s.jsx(j,{className:"h-4 w-4 text-safe"});default:return s.jsx("div",{className:"h-2 w-2 rounded-full bg-border"})}},f=(r,e,o)=>{switch(r){case"sos_triggered":{const m=(e==null?void 0:e.trigger_type)||(e==null?void 0:e.triggerType),n=o??(e==null?void 0:e.riskScore)??(e==null?void 0:e.risk_value),v=n!=null;return`SOS ${m==="ai"?"Auto-Triggered":"Manually Triggered"}${v?` (Risk: ${typeof n=="number"?n.toFixed(1):n})`:""}`}case"ai_risk":return`AI Risk Level Changed${o!=null?` (Risk: ${o.toFixed(1)})`:""}`;case"zone_entered":{if(e!=null&&e.normal_zone)return"User is outside all predefined risk zones (Normal area)";const m=(e==null?void 0:e.zoneName)||(e==null?void 0:e.zone_name)||"Unknown";return`Entered ${(e==null?void 0:e.zoneType)||(e==null?void 0:e.zone_type)||((e==null?void 0:e.type)==="high"?"high-risk":"low-risk")} zone: ${m}`}case"acknowledged":return e!=null&&e.security_name?`Security Acknowledged by ${e.security_name}`:e!=null&&e.security_email?`Security Acknowledged by ${e.security_email}`:"Security Acknowledged";case"resolved":return e!=null&&e.security_name?`Security Resolved by ${e.security_name}`:e!=null&&e.security_email?`Security Resolved by ${e.security_email}`:"Security Resolved";default:return"Event"}},_=r=>{const e=new Date(r);return Number.isNaN(e.getTime())?r:e.toLocaleString()};return x?s.jsx("div",{className:"text-center py-8 text-slate-400",children:"Loading events..."}):c.length===0?s.jsx("div",{className:"text-center py-8 text-slate-400",children:"No events to display"}):s.jsx("div",{children:s.jsx("div",{className:"flex flex-col gap-6",children:c.map((r,e)=>s.jsxs("div",{className:"relative flex items-start gap-4",children:[e!==c.length-1?s.jsx("div",{className:"absolute left-4 top-8 h-[calc(100%-8px)] w-0.5 bg-border/70"}):null,s.jsx("div",{className:"relative z-10 flex items-center justify-center w-8 h-8 rounded-full border border-border/60 bg-secondary/30 backdrop-blur shadow-[0_0_18px_rgba(0,0,0,0.35)]",children:k(r.type)}),s.jsxs("div",{className:"flex-1 pt-1",children:[s.jsx("div",{className:"text-white font-medium",children:f(r.type,r.data,r.risk_value)}),s.jsx("div",{className:"text-slate-400 text-sm mt-1",children:_(r.timestamp)})]})]},e))})})}export{w as A,M as E};
