const CACHE="mon-pointage-v8-20260903-1";
const LOCAL=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
const PDF_CDN_HOST="cdn.jsdelivr.net";

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(LOCAL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  const url=new URL(request.url);
  if(url.hostname.includes("supabase.co"))return;

  if(url.hostname===PDF_CDN_HOST){
    event.respondWith(
      caches.open(CACHE).then(async cache=>{
        const cached=await cache.match(request);
        if(cached)return cached;
        const response=await fetch(request);
        if(response.ok)cache.put(request,response.clone());
        return response;
      })
    );
    return;
  }

  if(url.origin!==self.location.origin)return;

  const isPage=request.mode==="navigate"||url.pathname.endsWith("/")||url.pathname.endsWith("/index.html");
  if(isPage){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put("./index.html",copy));
          }
          return response;
        })
        .catch(async()=>{
          const cache=await caches.open(CACHE);
          return (await cache.match("./index.html"))||(await cache.match("./"));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
      }
      return response;
    }))
  );
});
