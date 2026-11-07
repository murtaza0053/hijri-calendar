/* Applies the saved theme + light/dark mode before first paint (shared by all pages). */
(function(){var g=function(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
var th=g("theme","green"),md=g("mode","auto"),r=document.documentElement;r.setAttribute("data-theme",th);
var dk=md==="dark"||(md==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",dk);
if(!dk&&/^(rose|sky|lavender)$/.test(th)){var m=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(m)m.content="default";}})();
