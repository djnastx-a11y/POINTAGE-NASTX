const CACHE="mon-pointage-v5-fix-20260819-1";
const LOCAL=["./manifest.webmanifest","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(LOCAL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET") return;
  if(url.hostname.includes("supabase.co")) return;

  if(url.origin===self.location.origin){
    const isPage = event.request.mode==="navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
    if(isPage){
      event.respondWith(
        fetch(event.request)
          .then(resp=>{
            const copy=resp.clone();
            caches.open(CACHE).then(c=>c.put("./index.html",copy));
            return resp;
          })
          .catch(()=>caches.match("./index.html"))
      );
    }else{
      event.respondWith(
        caches.match(event.request).then(cached=>
          cached || fetch(event.request).then(resp=>{
            const copy=resp.clone();
            caches.open(CACHE).then(c=>c.put(event.request,copy));
            return resp;
          })
        )
      );
    }
  }
});
