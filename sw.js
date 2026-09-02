const CACHE="mon-pointage-v8-20260903-2";
const LOCAL=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./native-v8.css"];
const PDF_CDN_HOST="cdn.jsdelivr.net";
const NATIVE_THEME="./native-v8.css?v=8.1";

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

function isNativeAppUrl(url){
  return url.searchParams.has("native");
}

async function decorateNativePage(response,url){
  if(!response||!response.ok||!isNativeAppUrl(url))return response;
  const type=(response.headers.get("content-type")||"").toLowerCase();
  if(!type.includes("text/html"))return response;

  const html=await response.text();
  if(html.includes("data-mon-pointage-native-theme"))return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});

  const injection=`\n<link data-mon-pointage-native-theme="8.1" rel="stylesheet" href="${NATIVE_THEME}">\n<script>document.documentElement.classList.add('native-v8');var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#eee5d8');<\/script>\n`;
  const decorated=html.includes("</head>")?html.replace("</head>",injection+"</head>"):injection+html;
  const headers=new Headers(response.headers);
  headers.delete("content-length");
  return new Response(decorated,{status:response.status,statusText:response.statusText,headers});
}

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
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put("./index.html",copy));
        }
        return await decorateNativePage(response,url);
      }catch{
        const cache=await caches.open(CACHE);
        const fallback=(await cache.match("./index.html"))||(await cache.match("./"));
        return await decorateNativePage(fallback,url);
      }
    })());
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
