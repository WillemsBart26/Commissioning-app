/* Lightweight PDF 1.4 writer for offline browser use. Supports WinAnsi text, vector shapes and JPEG images. */
(function(global){
  'use strict';
  const MM=72/25.4, PAGE_W=210, PAGE_H=297;
  const cp1252={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
  function ansiBytes(s){const normalized=String(s).replace(/[ΩΩ]/g,'Ohm').replace(/[μµ]/g,'u').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/→/g,'->').replace(/[Φϕφ]/g,'Ø');const out=[];for(const ch of normalized){const n=ch.codePointAt(0);if(n<=255)out.push(n);else if(cp1252[n])out.push(cp1252[n]);else out.push(63)}return new Uint8Array(out)}
  function ascii(s){return new TextEncoder().encode(s)}
  function concat(parts){let len=0;for(const p of parts)len+=p.length;const out=new Uint8Array(len);let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length}return out}
  function esc(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\r\n]+/g,' ')}
  function rgb(hex){hex=String(hex).replace('#','');if(hex.length===3)hex=hex.split('').map(x=>x+x).join('');return [parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255].map(n=>Number(n.toFixed(3)))}
  function num(n){return Number(n.toFixed(3))}
  function jpegBytes(dataUrl){const b64=dataUrl.split(',')[1];const raw=atob(b64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
  function jpegSize(bytes){let i=2;while(i<bytes.length-9){if(bytes[i]!==0xFF){i++;continue}const marker=bytes[i+1];const len=(bytes[i+2]<<8)+bytes[i+3];if(marker>=0xC0&&marker<=0xC3)return {height:(bytes[i+5]<<8)+bytes[i+6],width:(bytes[i+7]<<8)+bytes[i+8]};i+=2+len}throw new Error('Unsupported JPEG image')}
  class TinyPDF{
    constructor(meta={}){this.meta=meta;this.pages=[];this.images=[];this.current=-1;this.addPage()}
    addPage(){this.pages.push({ops:[],images:new Set()});this.current=this.pages.length-1;return this}
    usePage(i){this.current=i;return this}
    get pageCount(){return this.pages.length}
    op(s){this.pages[this.current].ops.push(s);return this}
    text(value,x,y,size=10,style='normal',color='#17252d',align='left'){
      const font=style==='bold'?'F2':'F1';let tx=x;if(align!=='left'){const width=this.textWidth(value,size);tx=align==='right'?x-width:x-width/2}
      const c=rgb(color);return this.op(`BT /${font} ${num(size)} Tf ${c.join(' ')} rg ${num(tx*MM)} ${num((PAGE_H-y)*MM)} Td (${esc(value)}) Tj ET\n`)
    }
    textWidth(value,size=10){let units=0;for(const c of String(value??''))units+=/[MW@%]/.test(c)?.85:/[ilI.,:;' ]/.test(c)?.28:.52;return units*size/MM}
    wrap(value,maxWidth,size=10){const paras=String(value??'').split(/\r?\n/),lines=[];for(const para of paras){const words=para.trim().split(/\s+/).filter(Boolean);if(!words.length){lines.push('');continue}let line='';for(const word of words){const test=line?line+' '+word:word;if(this.textWidth(test,size)<=maxWidth)line=test;else if(line){lines.push(line);line=word}else{let chunk='';for(const ch of word){if(this.textWidth(chunk+ch,size)>maxWidth){lines.push(chunk);chunk=ch}else chunk+=ch}line=chunk}}if(line)lines.push(line)}return lines}
    multiline(value,x,y,maxWidth,size=10,lineHeight=4.5,style='normal',color='#17252d'){
      const lines=this.wrap(value,maxWidth,size);lines.forEach((line,i)=>this.text(line,x,y+i*lineHeight,size,style,color));return {lines,height:Math.max(1,lines.length)*lineHeight}
    }
    line(x1,y1,x2,y2,color='#d8e2e6',width=.3){const c=rgb(color);return this.op(`${c.join(' ')} RG ${num(width*MM)} w ${num(x1*MM)} ${num((PAGE_H-y1)*MM)} m ${num(x2*MM)} ${num((PAGE_H-y2)*MM)} l S\n`)}
    rect(x,y,w,h,fill=null,stroke=null,width=.3,radius=0){let cmd='';if(fill){const c=rgb(fill);cmd+=`${c.join(' ')} rg `}if(stroke){const c=rgb(stroke);cmd+=`${c.join(' ')} RG ${num(width*MM)} w `}cmd+=`${num(x*MM)} ${num((PAGE_H-y-h)*MM)} ${num(w*MM)} ${num(h*MM)} re ${fill&&stroke?'B':fill?'f':'S'}\n`;return this.op(cmd)}
    addJpeg(dataUrl,x,y,w,h){let image=this.images.find(i=>i.dataUrl===dataUrl);if(!image){const bytes=jpegBytes(dataUrl),size=jpegSize(bytes);image={name:`Im${this.images.length+1}`,dataUrl,bytes,width:size.width,height:size.height};this.images.push(image)}this.pages[this.current].images.add(image.name);return this.op(`q ${num(w*MM)} 0 0 ${num(h*MM)} ${num(x*MM)} ${num((PAGE_H-y-h)*MM)} cm /${image.name} Do Q\n`)}
    imageSize(dataUrl){const hit=this.images.find(i=>i.dataUrl===dataUrl);if(hit)return {width:hit.width,height:hit.height};return jpegSize(jpegBytes(dataUrl))}
    /* Place a JPEG inside a box without distortion. Returns the height actually used (mm). */
    addJpegFit(dataUrl,x,y,maxW,maxH,align='center'){const s=this.imageSize(dataUrl),r=Math.min(maxW/s.width,maxH/s.height),w=s.width*r,h=s.height*r,dx=align==='center'?(maxW-w)/2:0;this.addJpeg(dataUrl,x+dx,y,w,h);return h}
    addFooters(company='',pageLabel=(i,n)=>`Page ${i} of ${n}`){
      const save=this.current;this.pages.forEach((p,i)=>{this.usePage(i);this.line(15,286,195,286,'#d8e2e6',.25);this.text(company,15,291,7.5,'normal','#657780');this.text(pageLabel(i+1,this.pages.length),195,291,7.5,'normal','#657780','right')});this.usePage(save);return this
    }
    output(){
      const imageId=new Map(),pageIds=[],contentIds=[];let next=5;for(const img of this.images)imageId.set(img.name,next++);for(let i=0;i<this.pages.length;i++){contentIds.push(next++);pageIds.push(next++)}
      const objs=new Map();objs.set(1,ascii('<< /Type /Catalog /Pages 2 0 R >>'));objs.set(2,ascii(`<< /Type /Pages /Count ${this.pages.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`));objs.set(3,ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));objs.set(4,ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
      for(const img of this.images){const dict=ascii(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);objs.set(imageId.get(img.name),concat([dict,img.bytes,ascii('\nendstream')]))}
      this.pages.forEach((page,i)=>{const stream=ansiBytes(page.ops.join(''));objs.set(contentIds[i],concat([ascii(`<< /Length ${stream.length} >>\nstream\n`),stream,ascii('endstream')]));const xobjs=[...page.images].map(n=>`/${n} ${imageId.get(n)} 0 R`).join(' ');objs.set(pageIds[i],ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_W*MM)} ${num(PAGE_H*MM)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobjs} >> >> /Contents ${contentIds[i]} 0 R >>`))});
      const maxId=Math.max(...objs.keys()),parts=[ansiBytes('%PDF-1.4\n%âãÏÓ\n')],offsets=new Array(maxId+1).fill(0);let offset=parts[0].length;for(let id=1;id<=maxId;id++){const head=ascii(`${id} 0 obj\n`),body=objs.get(id),tail=ascii('\nendobj\n');offsets[id]=offset;parts.push(head,body,tail);offset+=head.length+body.length+tail.length}const xref=offset;let table=`xref\n0 ${maxId+1}\n0000000000 65535 f \n`;for(let id=1;id<=maxId;id++)table+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';const title=esc(this.meta.title||'Commissioning Report');parts.push(ansiBytes(table+`trailer\n<< /Size ${maxId+1} /Root 1 0 R /Info << /Title (${title}) /Producer (EDP Reports) >> >>\nstartxref\n${xref}\n%%EOF\n`));return new Blob(parts,{type:'application/pdf'})
    }
  }
  global.TinyPDF=TinyPDF;
})(window);
