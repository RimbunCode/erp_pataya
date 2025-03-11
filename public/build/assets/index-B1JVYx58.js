import{c as d}from"./createLucideIcon-BK-UZ43B.js";import{r as n}from"./app-3KCbWmyq.js";import{h as b}from"./button-BdRvgMrB.js";/**
 * @license lucide-react v0.474.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],g=d("Check",u);function p(r){const[a,e]=n.useState(void 0);return b(()=>{if(r){e({width:r.offsetWidth,height:r.offsetHeight});const c=new ResizeObserver(o=>{if(!Array.isArray(o)||!o.length)return;const f=o[0];let i,t;if("borderBoxSize"in f){const s=f.borderBoxSize,h=Array.isArray(s)?s[0]:s;i=h.inlineSize,t=h.blockSize}else i=r.offsetWidth,t=r.offsetHeight;e({width:i,height:t})});return c.observe(r,{box:"border-box"}),()=>c.unobserve(r)}else e(void 0)},[r]),a}export{g as C,p as u};
