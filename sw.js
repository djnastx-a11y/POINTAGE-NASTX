const CACHE="mon-pointage-v5-2";
const LOCAL=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(LOCAL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET")return;
  if(url.hostname.includes("supabase.co"))return;
  if(url.origin===self.location.origin){
    if(event.request.mode==="navigate"){
      event.respondWith(fetch(event.request,{cache:"no-store"}).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy));return resp}).catch(()=>caches.match("./index.html")));
      return;
    }
    event.respondWith(fetch(event.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return resp}).catch(()=>caches.match(event.request)));
  }
});
self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>list[0]?list[0].focus():clients.openWindow("./")))});
