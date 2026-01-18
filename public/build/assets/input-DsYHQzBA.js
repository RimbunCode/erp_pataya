import{r as e,j as l}from"./app-lGSIJjhp.js";import{c as u}from"./utils-NcR-OAwm.js";import{d as p}from"./button-B2qodkg6.js";const c=p(`
    flex w-full h-8
    rounded-md
    border border-input
    bg-muted
    px-3 py-2
    text-base md:text-sm
    text-foreground
    placeholder:text-muted-foreground/80
    text-ellipsis
    shadow-xs shadow-black/5
    ring-offset-background
    transition-[color,box-shadow,border,background-color]

    file:border-0 file:bg-transparent
    file:text-sm file:font-medium file:text-foreground

    focus-visible:outline-none
    focus-visible:ring-1
    focus-visible:ring-ring
    focus-visible:ring-offset-1
    focus-visible:border-ring

    disabled:cursor-not-allowed disabled:opacity-60

    [&[readonly]]:bg-muted/80
    [&[readonly]]:cursor-not-allowed

    aria-invalid:border-destructive/60
    aria-invalid:ring-destructive/10
    dark:aria-invalid:border-destructive
    dark:aria-invalid:ring-destructive/20
  `,{variants:{variant:{lg:"h-10 px-4 text-sm rounded-md file:pe-4 file:me-4",md:"h-9 px-3 text-sm rounded-md file:pe-3 file:me-3",sm:"h-8 px-2.5 text-xs rounded-md file:pe-2.5 file:me-2.5"}},defaultVariants:{variant:"sm"}}),g=p(`
    flex items-center
    bg-muted
    border border-input
    rounded-md
    shadow-xs shadow-black/5
    gap-1.5
    transition-[color,box-shadow,border,background-color]
    has-[:focus-visible]:ring-ring/30
    has-[:focus-visible]:border-ring
    has-[:focus-visible]:outline-none
    has-[:focus-visible]:ring-[3px]

    [&_[data-slot=input]]:ring-0!
    [&_[data-slot=input]]:outline-none!
    [&_[data-slot=input]]:border-0!
    [&_[data-slot=input]]:bg-transparent
    [&_[data-slot=input]]:p-0
    [&_[data-slot=input]]:m-0
    [&_[data-slot=input]]:shadow-none
    [&_[data-slot=input]]:h-auto
    [&_[data-slot=input]]:w-full
    [&_[data-slot=input]]:flex
    [&_[data-slot=input]]:text-foreground
    [&_[data-slot=input]]:placeholder:text-muted-foreground

    [&_[data-slot=input]]:disabled:cursor-not-allowed
    [&_[data-slot=input]]:disabled:opacity-50

    [&_svg]:text-muted-foreground
    [&_svg]:shrink-0


    has-[[aria-invalid=true]]:border-destructive/60
    has-[[aria-invalid=true]]:ring-destructive/10
    dark:has-[[aria-invalid=true]]:border-destructive
    dark:has-[[aria-invalid=true]]:ring-destructive/20
  `,{variants:{variant:{sm:"gap-1.25 [&_svg:not([class*=size-])]:size-3.5",md:"gap-1.5 [&_svg:not([class*=size-])]:size-4",lg:"gap-1.5 [&_svg:not([class*=size-])]:size-4"}},defaultVariants:{variant:"sm"}}),w=e.forwardRef(function({className:r,type:a,variant:f,value:b,onValueChange:i,onChange:s,isFocused:d=!1,...m},v){const n=e.useRef(null);return e.useImperativeHandle(v,()=>({focus:()=>{var t;return(t=n.current)==null?void 0:t.focus()}})),e.useEffect(()=>{var t;d&&((t=n.current)==null||t.focus())},[d]),l.jsx("input",{"data-slot":"input",type:a,className:u(c({variant:f}),r),onChange:t=>{i==null||i(t.target.value),s==null||s(t)},value:b,...m})});function k({className:o,variant:r,...a}){return l.jsx("div",{"data-slot":"input-wrapper",className:u(c({variant:r}),g({variant:r}),o),...a})}export{w as I,k as a};
