// Decode into one fixed buffer; Uint8Array.from(string, mapper) builds an
// intermediate iterable and pressures the collector for multi-megabyte assets.
export function decodeGLBBase64(data:string){
 const binary=atob(data),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes.buffer;
}
