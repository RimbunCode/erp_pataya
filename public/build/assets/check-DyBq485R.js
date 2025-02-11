import{r as u}from"./app-CyEtsbiA.js";import{u as a,c as h}from"./createLucideIcon-BKGqLEZs.js";function y(e){const[d,r]=u.useState(void 0);return a(()=>{if(e){r({width:e.offsetWidth,height:e.offsetHeight});const f=new ResizeObserver(o=>{if(!Array.isArray(o)||!o.length)return;const c=o[0];let i,t;if("borderBoxSize"in c){const s=c.borderBoxSize,n=Array.isArray(s)?s[0]:s;i=n.inlineSize,t=n.blockSize}else i=e.offsetWidth,t=e.offsetHeight;r({width:i,height:t})});return f.observe(e,{box:"border-box"}),()=>f.unobserve(e)}else r(void 0)},[e]),d}/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],g=h("Check",b);export{g as C,y as u};
