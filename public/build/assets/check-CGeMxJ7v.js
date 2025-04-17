import{r as h}from"./app-B01TtgHm.js";import{f as n}from"./button-EPhCPE8Y.js";import{c as b}from"./createLucideIcon-A5yLEs3N.js";function g(r){const[d,e]=h.useState(void 0);return n(()=>{if(r){e({width:r.offsetWidth,height:r.offsetHeight});const f=new ResizeObserver(o=>{if(!Array.isArray(o)||!o.length)return;const c=o[0];let i,t;if("borderBoxSize"in c){const s=c.borderBoxSize,a=Array.isArray(s)?s[0]:s;i=a.inlineSize,t=a.blockSize}else i=r.offsetWidth,t=r.offsetHeight;e({width:i,height:t})});return f.observe(r,{box:"border-box"}),()=>f.unobserve(r)}else e(void 0)},[r]),d}/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],p=b("Check",u);export{p as C,g as u};
