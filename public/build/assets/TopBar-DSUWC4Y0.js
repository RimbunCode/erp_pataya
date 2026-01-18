import{r as c,j as a}from"./app-lGSIJjhp.js";import{B as f}from"./button-B2qodkg6.js";import{g as l}from"./index-duEDo-At.js";import{c as p}from"./chevron-down-CtYMBpIF.js";import"./utils-NcR-OAwm.js";import"./index-CsTqfp29.js";/**
 * @license lucide-react v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]],v=p("code",x);/**
 * @license lucide-react v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M21 7v6h-6",key:"3ptur4"}],["path",{d:"M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7",key:"1kgawr"}]],j=p("redo",g);/**
 * @license lucide-react v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M3 7v6h6",key:"1v2h90"}],["path",{d:"M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13",key:"1r6uu6"}]],k=p("undo",M),U=c.memo(function(){const e=l(),{UndoManager:m,Commands:r}=e,[,u]=c.useState(0),i=c.useMemo(()=>[{id:"core:component-outline",icon:a.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 16 16",children:a.jsx("path",{fill:"currentColor",d:"M5.012 2.659a.77.77 0 0 1-.652.871a.98.98 0 0 0-.83.83a.77.77 0 0 1-1.524-.22a2.52 2.52 0 0 1 2.135-2.134a.77.77 0 0 1 .871.653M3.53 11.623a.77.77 0 1 0-1.524.219a2.52 2.52 0 0 0 2.135 2.134a.77.77 0 0 0 .219-1.524a.98.98 0 0 1-.83-.83m9.794-.653c.42.06.713.45.652.872a2.525 2.525 0 0 1-2.134 2.134a.77.77 0 0 1-.22-1.524a.985.985 0 0 0 .83-.83a.77.77 0 0 1 .872-.652m-1.482-8.964a.77.77 0 0 0-.22 1.524a.98.98 0 0 1 .83.83a.77.77 0 1 0 1.524-.22a2.525 2.525 0 0 0-2.134-2.134M6.5 2.75A.75.75 0 0 1 7.25 2h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75m-4.5 6a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-1.5 0zm4.5 4.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75m6-4.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-1.5 0z"})})},{id:"core:open-code",icon:a.jsx(v,{})},{id:"core:undo",icon:a.jsx(k,{}),disabled:()=>!m.hasUndo()},{id:"core:redo",icon:a.jsx(j,{}),disabled:()=>!m.hasRedo()}],[]);return c.useEffect(()=>{const o="run stop",n="update",t=()=>u(d=>d+1),s=d=>{i.find(h=>h.id===d)&&t()};return e.on(o,s),e.on(n,t),()=>{e.off(o,s),e.off(n,t)}}),a.jsx("div",{className:"flex gap-3 [&_svg]:size-4!",children:i.map(({id:o,icon:n,disabled:t,options:s={}})=>a.jsx(f,{type:"button",variant:"outline",className:"h-8 px-1.5",disabled:(t==null?void 0:t())??!1,onClick:()=>{r.isActive(o)?r.stop(o):r.run(o,s)},children:n},o))})});export{U as default};
