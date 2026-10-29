const DEMO_KEY = 'dcb31709b452b1cf9dc26972add0fda6'; // Solo pruebas; sustituir por clave personal para distribuir.
export const DESMOS_API_URL = 'https://www.desmos.com/api/v1.12/calculator.js?apiKey='+encodeURIComponent(localStorage.getItem('gmr:desmos:key')||DEMO_KEY)+'&lang=es';
let loading;
export function loadDesmos({timeout=15000}={}) {
 if(window.Desmos?.GraphingCalculator&&!window.Desmos.__gmrOfflineShim)return Promise.resolve(window.Desmos);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=DESMOS_API_URL;script.async=true;
  let done=false;
  const timer=setTimeout(()=>fail(new Error('Tiempo agotado al cargar Desmos')),timeout);
  function fail(err){if(done)return;done=true;clearTimeout(timer);script.remove();loading=null;reject(err)}
  script.onerror=()=>fail(new Error('No se pudo conectar con la API de Desmos'));
  script.onload=()=>{if(done)return;clearTimeout(timer);
    if(!window.Desmos?.GraphingCalculator||window.Desmos.__gmrOfflineShim)return fail(new Error('No se inicializó Desmos'));
    done=true;resolve(window.Desmos);
  };
  document.head.append(script);
 });
 return loading;
}
