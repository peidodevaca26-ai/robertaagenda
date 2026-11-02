// Host é a autoridade da requisição recebida. nextUrl.origin pode usar o hostname
// interno do servidor quando há proxy/reverse proxy (inclusive na Vercel).
export function sameOrigin(headers: Headers): boolean {
 const origin=headers.get('origin');
 if(!origin)return false;
 try {const url=new URL(origin);return ['https:','http:'].includes(url.protocol)&&url.host===headers.get('host');}catch{return false;}
}
