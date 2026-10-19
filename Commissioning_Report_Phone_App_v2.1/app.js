(() => {
'use strict';
const STORAGE_KEY='commissioning-report-draft-v1';
const clone=value=>structuredClone(value);
const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const defaultLayout={
  job:[
    {id:'companyName',label:'Company name',type:'text',default:'Your Company',autocomplete:'organization'},
    {id:'reportNumber',label:'Report number',type:'text',placeholder:'CR-2026-001'},
    {id:'clientName',label:'Client / customer',type:'text',autocomplete:'organization'},
    {id:'commissionDate',label:'Commissioning date',type:'date'},
    {id:'siteName',label:'Site name',type:'text'},
    {id:'technician',label:'Technician',type:'text',autocomplete:'name'},
    {id:'siteAddress',label:'Site address',type:'textarea',rows:2,full:true,autocomplete:'street-address'},
    {id:'model',label:'Model',type:'text'},
    {id:'serialNumber',label:'Serial number',type:'text'}
  ],
  notes:[{id:'generalNotes',label:'General notes',type:'textarea',rows:5,full:true,placeholder:'Work completed, settings, deviations, outstanding points…'}],
  signoff:[
    {id:'clientContact',label:'Client contact',type:'text',autocomplete:'name'},
    {id:'clientEmail',label:'Client email',type:'email',autocomplete:'email'},
    {id:'completionRemarks',label:'Completion remarks',type:'textarea',rows:3,full:true},
    {id:'technicianSignoff',label:'Technician sign-off name',type:'text'},
    {id:'clientSignoff',label:'Client sign-off name',type:'text'}
  ]
};
const defaultChecks=[
  {id:'check_visual',label:'Visual condition and installation'},
  {id:'check_earth',label:'Protective earth / bonding'},
  {id:'check_terminals',label:'Cable terminations and torque'},
  {id:'check_labels',label:'Cable labels and identification'},
  {id:'check_protection',label:'Fuses, breakers and protection settings'},
  {id:'check_isolation',label:'Emergency stop / isolation'},
  {id:'check_settings',label:'Firmware and parameter settings'},
  {id:'check_operation',label:'Functional operation'},
  {id:'check_comms',label:'Alarms and communications'},
  {id:'check_docs',label:'Drawings and documentation updated'}
];
const defaultState=()=>({
  layout:clone(defaultLayout),checks:clone(defaultChecks),values:{companyName:'Your Company',commissionDate:today()},checkValues:{},
  measurements:[{name:'Supply voltage',value:'',unit:'V'},{name:'Earth continuity',value:'',unit:'Ω'},{name:'Insulation resistance',value:'',unit:'MΩ'}],
  tests:[{name:'Start-up / shutdown sequence',result:'Pass',notes:''},{name:'Alarm and safety interlocks',result:'Pass',notes:''},{name:'Communication / monitoring',result:'Pass',notes:''}],
  photos:[],finalStatus:'Passed'
});
let state=defaultState(),saveTimer,previewUrl,deferredInstall,editMode=false;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const safeText=(v,fallback='—')=>{const s=String(v??'').trim();return s||fallback};
const html=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast=message=>{const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2800)};
function normaliseField(field){return {id:String(field.id||`custom_${Date.now().toString(36)}`),label:String(field.label||'New field'),type:['text','email','date','number','textarea'].includes(field.type)?field.type:'text',rows:Number(field.rows)||undefined,full:Boolean(field.full||field.type==='textarea'),placeholder:String(field.placeholder||''),autocomplete:String(field.autocomplete||'')}}
function normaliseLayout(layout){const result={};for(const section of ['job','notes','signoff'])result[section]=Array.isArray(layout?.[section])?layout[section].map(normaliseField):clone(defaultLayout[section]);return result}
function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
    const saved=JSON.parse(raw),fresh=defaultState();
    state={...fresh,...saved,layout:normaliseLayout(saved.layout),values:{...fresh.values,...(saved.fields||{}),...(saved.values||{})},checks:Array.isArray(saved.checks)&&saved.checks.length?saved.checks.map((c,i)=>({id:String(c.id||`check_${i}`),label:String(c.label||'Check')})):clone(defaultChecks),measurements:saved.measurements||fresh.measurements,tests:saved.tests||fresh.tests,photos:saved.photos||[],checkValues:{...(saved.checkValues||{})}};
    if(!saved.checks){defaultChecks.forEach((c,i)=>{if(state.checkValues[i]!==undefined)state.checkValues[c.id]=state.checkValues[i]})}
    delete state.values.equipment;delete state.values.manufacturer;
  }catch(e){console.warn(e);state=defaultState()}
}
function save(immediate=false){
  clearTimeout(saveTimer);const commit=()=>{try{state.finalStatus=$('input[name="finalStatus"]:checked')?.value||state.finalStatus;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('#saveStatus').textContent=location.protocol==='file:'?'Local changes saved':'Saved on this device';updateCompletion()}catch(e){$('#saveStatus').textContent='Storage full';toast('Storage is full. Remove some photos or download the PDF.')}};
  if(immediate)commit();else saveTimer=setTimeout(commit,300)
}
function getValue(id){return state.values[id]??''}
function hasField(id){return Object.values(state.layout).some(rows=>rows.some(f=>f.id===id))}
function fieldById(id){for(const rows of Object.values(state.layout)){const field=rows.find(f=>f.id===id);if(field)return field}return null}
function updateCompletion(){const rows=state.layout.job.slice(0,8),complete=rows.filter(f=>safeText(getValue(f.id),'')!=='').length,checksDone=Object.values(state.checkValues).filter(v=>v&&v!=='Not checked').length,pct=Math.round(((complete+Math.min(checksDone,5)+Math.min(state.photos.length,2))/(Math.max(1,rows.length)+7))*100);$('#completionValue').textContent=Math.min(100,pct)+'%'}
function createFieldControl(field,section){
  const label=document.createElement('label');label.className=`field-row${field.full?' field-full':''}`;label.dataset.fieldId=field.id;label.dataset.fieldSection=section;
  const caption=document.createElement('span');caption.className='field-caption';caption.textContent=field.label;label.appendChild(caption);
  let control;if(field.type==='textarea'){control=document.createElement('textarea');control.rows=field.rows||3}else{control=document.createElement('input');control.type=field.type||'text'}
  control.id=field.id;control.dataset.field='';control.value=getValue(field.id)||field.default||'';if(field.placeholder)control.placeholder=field.placeholder;if(field.autocomplete)control.autocomplete=field.autocomplete;
  control.addEventListener('input',()=>{state.values[field.id]=control.value;save()});label.appendChild(control);
  const tools=document.createElement('span');tools.className='field-tools';tools.innerHTML='<button class="field-edit" type="button" title="Rename row" aria-label="Rename row">✎</button><button class="field-delete" type="button" title="Delete row" aria-label="Delete row">×</button>';
  tools.querySelector('.field-edit').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();renameField(section,field.id)});
  tools.querySelector('.field-delete').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();deleteField(section,field.id)});
  label.appendChild(tools);return label
}
function renderFields(section,hostSelector){const host=$(hostSelector);host.innerHTML='';state.layout[section].forEach(field=>host.appendChild(createFieldControl(field,section)))}
function renameField(section,id){const field=state.layout[section].find(f=>f.id===id);if(!field)return;const name=prompt('Change the row name:',field.label);if(name&&name.trim()){field.label=name.trim();renderFields(section,`#${section==='job'?'jobFields':section==='notes'?'notesFields':'signoffFields'}`);save(true)}}
function deleteField(section,id){const field=state.layout[section].find(f=>f.id===id);if(!field)return;if(!confirm(`Delete the “${field.label}” row from this report template?`))return;state.layout[section]=state.layout[section].filter(f=>f.id!==id);delete state.values[id];renderFields(section,`#${section==='job'?'jobFields':section==='notes'?'notesFields':'signoffFields'}`);save(true);toast('Row deleted')}
function addField(section){
  const label=prompt('Name for the new row:','New field');if(!label||!label.trim())return;
  let type=(prompt('Row type: text, date, email, number or notes','text')||'text').trim().toLowerCase();if(type==='notes')type='textarea';if(!['text','date','email','number','textarea'].includes(type))type='text';
  const field=normaliseField({id:`custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,label:label.trim(),type,rows:type==='textarea'?3:undefined,full:type==='textarea'});state.layout[section].push(field);renderFields(section,`#${section==='job'?'jobFields':section==='notes'?'notesFields':'signoffFields'}`);save(true);setTimeout(()=>document.getElementById(field.id)?.focus(),0);toast('Row added')
}
function renderChecklist(){const host=$('#checklist');host.innerHTML='';state.checks.forEach(check=>{const row=document.createElement('div');row.className=`check-row${editMode?' editing':''}`;
  if(editMode){const name=document.createElement('input');name.className='check-name';name.value=check.label;name.setAttribute('aria-label','Checklist row name');name.addEventListener('input',()=>{check.label=name.value;save()});row.appendChild(name)}else{const strong=document.createElement('strong');strong.textContent=check.label;row.appendChild(strong)}
  const select=document.createElement('select');select.setAttribute('aria-label',check.label);['Not checked','Pass','Fail','N/A'].forEach(value=>{const option=document.createElement('option');option.textContent=value;select.appendChild(option)});select.value=state.checkValues[check.id]||'Not checked';select.addEventListener('change',()=>{state.checkValues[check.id]=select.value;save()});row.appendChild(select);
  if(editMode){const remove=document.createElement('button');remove.className='remove-btn';remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Delete checklist row');remove.addEventListener('click',()=>{if(confirm(`Delete the “${check.label}” checklist row?`)){state.checks=state.checks.filter(c=>c.id!==check.id);delete state.checkValues[check.id];renderChecklist();save(true)}});row.appendChild(remove)}host.appendChild(row)})}
function renderMeasurements(){const host=$('#measurementList');host.innerHTML='';state.measurements.forEach((m,i)=>{const row=document.createElement('div');row.className='repeat-row';row.innerHTML=`<input aria-label="Measurement name" placeholder="Measurement" value="${html(m.name)}"><input aria-label="Measurement value" placeholder="Value / unit" value="${html([m.value,m.unit].filter(Boolean).join(' '))}"><button class="remove-btn" type="button" aria-label="Remove">×</button>`;const inputs=row.querySelectorAll('input');inputs[0].addEventListener('input',()=>{state.measurements[i].name=inputs[0].value;save()});inputs[1].addEventListener('input',()=>{const parts=inputs[1].value.trim().split(/\s+/);state.measurements[i].value=parts.shift()||'';state.measurements[i].unit=parts.join(' ');save()});row.querySelector('button').addEventListener('click',()=>{state.measurements.splice(i,1);renderMeasurements();save()});host.appendChild(row)})}
function renderTests(){const host=$('#testList');host.innerHTML='';state.tests.forEach((t,i)=>{const row=document.createElement('div');row.className='repeat-row test';row.innerHTML=`<input aria-label="Test name" placeholder="Functional test" value="${html(t.name)}"><select aria-label="Result"><option>Pass</option><option>Fail</option><option>N/A</option></select><input aria-label="Test notes" placeholder="Observation" value="${html(t.notes)}"><button class="remove-btn" type="button" aria-label="Remove">×</button>`;const [name,result,notes]=row.querySelectorAll('input,select');result.value=t.result||'Pass';name.addEventListener('input',()=>{state.tests[i].name=name.value;save()});result.addEventListener('change',()=>{state.tests[i].result=result.value;save()});notes.addEventListener('input',()=>{state.tests[i].notes=notes.value;save()});row.querySelector('button').addEventListener('click',()=>{state.tests.splice(i,1);renderTests();save()});host.appendChild(row)})}
function renderPhotos(){const host=$('#photoGrid');host.innerHTML='';state.photos.forEach((p,i)=>{const card=document.createElement('div');card.className='photo-card';card.innerHTML=`<img src="${p.data}" alt="Site photo ${i+1}"><button class="photo-remove" type="button" aria-label="Remove photo">×</button><input value="${html(p.caption)}" aria-label="Photo caption" placeholder="Photo ${i+1} caption">`;card.querySelector('button').addEventListener('click',()=>{state.photos.splice(i,1);renderPhotos();save()});card.querySelector('input').addEventListener('input',e=>{state.photos[i].caption=e.target.value;save()});host.appendChild(card)})}
function renderAll(){renderFields('job','#jobFields');renderFields('notes','#notesFields');renderFields('signoff','#signoffFields');renderChecklist();renderMeasurements();renderTests();renderPhotos();const radio=document.querySelector(`input[name="finalStatus"][value="${state.finalStatus}"]`);if(radio)radio.checked=true;updateCompletion()}
async function compressPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const max=1100,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);resolve({data:canvas.toDataURL('image/jpeg',.68),caption:file.name.replace(/\.[^.]+$/,''),width:w,height:h})};image.src=reader.result};reader.readAsDataURL(file)})}
async function addPhotos(fileList){const room=12-state.photos.length,files=[...fileList].slice(0,room);if(!files.length){toast(state.photos.length>=12?'Maximum 12 photos':'No photos selected');return}$('#saveStatus').textContent='Processing photos…';for(const file of files){try{state.photos.push(await compressPhoto(file));renderPhotos()}catch(e){toast(`Could not read ${file.name}`)}}save();$('#photoInput').value='';toast(`${files.length} photo${files.length===1?'':'s'} added`)}
function toggleEdit(force){editMode=typeof force==='boolean'?force:!editMode;document.body.classList.toggle('layout-editing',editMode);$('#layoutEditor').classList.toggle('hidden',!editMode);$('#layoutEditBtn').classList.toggle('active',editMode);$('#layoutEditBtn').textContent=editMode?'✓':'✎';$('#layoutEditBtn').title=editMode?'Finish editing rows':'Edit report rows';renderChecklist();if(editMode){$('#layoutEditor').scrollIntoView({behavior:'smooth',block:'center'});toast('Edit mode: rename, add or delete any report row')}else toast('Report layout saved')}
function resetLayout(){if(!confirm('Restore the default rows and checklist? Custom rows will be removed, but matching field values will be kept.'))return;state.layout=clone(defaultLayout);state.checks=clone(defaultChecks);state.checkValues={};renderAll();save(true);toast('Default rows restored')}
function resetReport(){if(!confirm('Start a new report? The current report data and photos will be cleared. Your custom rows and checklist template will be kept.'))return;const savedLayout=clone(state.layout),savedChecks=clone(state.checks),fresh=defaultState();state={...fresh,layout:savedLayout,checks:savedChecks};editMode=false;document.body.classList.remove('layout-editing');$('#layoutEditor').classList.add('hidden');$('#layoutEditBtn').classList.remove('active');$('#layoutEditBtn').textContent='✎';renderAll();save(true);toast('New report started — custom rows kept')}
function fileName(){return ['Commissioning',getValue('reportNumber')||getValue('siteName')||'Report'].join('_').replace(/[^a-z0-9_-]+/gi,'_').replace(/_+/g,'_')+'.pdf'}
function buildPdf(){
  state.finalStatus=$('input[name="finalStatus"]:checked')?.value||state.finalStatus;const doc=new TinyPDF({title:`Commissioning Report ${getValue('reportNumber')}`}),status=state.finalStatus;
  const C={navy:'#0b3142',teal:'#08a3a3',ink:'#17252d',muted:'#657780',line:'#d8e2e6',pale:'#eaf7f6',fail:'#ba3a45',warm:'#fff3df'},M=15,W=180;let y=0;
  function pageHeader(first=false){const company=hasField('companyName')?safeText(getValue('companyName'),'Company'):'Commissioning Report',report=hasField('reportNumber')?safeText(getValue('reportNumber'),'Draft'):'Draft';if(first){doc.rect(0,0,210,35,C.navy);doc.rect(0,0,6,35,C.teal);doc.text(company,15,15,12,'bold','#ffffff');doc.text('COMMISSIONING REPORT',15,24,17,'bold','#ffffff');doc.text(report,195,17,10,'bold','#ffffff','right');y=46}else{doc.rect(0,0,210,18,C.navy);doc.rect(0,0,5,18,C.teal);doc.text('COMMISSIONING REPORT',15,12,10,'bold','#ffffff');doc.text(report,195,12,8,'normal','#ffffff','right');y=27}}
  function newPage(){doc.addPage();pageHeader(false)}function ensure(h){if(y+h>278)newPage()}
  function section(title){ensure(15);doc.text(title.toUpperCase(),M,y,9,'bold',C.teal);doc.line(M,y+4,195,y+4,C.line,.35);y+=11}
  function displayValue(field){const value=getValue(field.id);return field.type==='date'?formatDate(value):value}
  function kvGrid(items){const gap=6,cw=(W-gap)/2;for(let i=0;i<items.length;i+=2){const pair=items.slice(i,i+2),heights=pair.map(([label,value])=>Math.max(18,9+doc.wrap(safeText(value),cw-8,9.2).slice(0,4).length*4.3)),h=Math.max(...heights);ensure(h+4);pair.forEach(([label,value],j)=>{const x=M+j*(cw+gap);doc.rect(x,y,cw,h,'#f7fafb',C.line,.25);doc.text(String(label).toUpperCase(),x+4,y+6,6.7,'bold',C.muted);doc.multiline(safeText(value),x+4,y+12,cw-8,9.2,4.3,'normal',C.ink)});y+=h+4}}
  function noteBox(label,value){if(!safeText(value,''))return;const lines=doc.wrap(value,W-10,9),h=Math.max(18,12+lines.length*4.3);ensure(h+4);doc.rect(M,y,W,h,'#f7fafb',C.line,.25);doc.text(String(label).toUpperCase(),M+5,y+6,6.7,'bold',C.muted);lines.forEach((line,i)=>doc.text(line,M+5,y+12+i*4.3,9,'normal',C.ink));y+=h+5}
  function table(headers,widths,rows){const hh=9,drawHeader=()=>{doc.rect(M,y,W,hh,C.navy);let x=M;headers.forEach((h,i)=>{doc.text(h.toUpperCase(),x+3,y+5.8,7,'bold','#ffffff');x+=widths[i]});y+=hh};ensure(hh+10);drawHeader();rows.forEach(row=>{const wrapped=row.map((v,i)=>doc.wrap(safeText(v),widths[i]-6,8.2)),rh=Math.max(9,...wrapped.map(a=>a.length*3.8+4));if(y+rh>278){newPage();drawHeader()}let x=M;row.forEach((v,i)=>{doc.rect(x,y,widths[i],rh,'#ffffff',C.line,.22);wrapped[i].forEach((line,k)=>doc.text(line,x+3,y+5+k*3.8,8.2,i===1&&/Fail/.test(String(v))?'bold':'normal',i===1&&/Fail/.test(String(v))?C.fail:C.ink));x+=widths[i]});y+=rh});y+=5}
  pageHeader(true);
  if(state.layout.job.length){section('Project and equipment');kvGrid(state.layout.job.map(f=>[f.label,displayValue(f)]))}
  if(state.checks.length){section('Safety and installation checks');table(['Check','Result'],[140,40],state.checks.map(c=>[c.label,state.checkValues[c.id]||'Not checked']))}
  if(state.measurements.length){section('Measurements');table(['Measurement','Recorded value'],[112,68],state.measurements.map(m=>[m.name,[m.value,m.unit].filter(Boolean).join(' ')]))}
  if(state.tests.length){section('Functional tests');table(['Test','Result','Observation'],[78,30,72],state.tests.map(t=>[t.name,t.result,t.notes]))}
  state.layout.notes.forEach(f=>{if(safeText(getValue(f.id),'')){section(f.label);noteBox(f.label,getValue(f.id))}});
  section('Completion and sign-off');const statusColor=status==='Failed'?C.fail:status==='Passed with remarks'?'#b66a00':C.teal;ensure(28);doc.rect(M,y,W,20,status==='Failed'?'#fae9eb':status==='Passed with remarks'?C.warm:C.pale,statusColor,.5);doc.text('COMMISSIONING RESULT',M+6,y+7,7,'bold',C.muted);doc.text(status,M+6,y+15,13,'bold',statusColor);y+=26;if(state.layout.signoff.length)kvGrid(state.layout.signoff.map(f=>[f.label,displayValue(f)]));
  if(state.photos.length){newPage();section('Photo evidence');state.photos.forEach((p,i)=>{const ratio=(p.width||4)/(p.height||3),maxW=180,maxH=92;let iw=maxW,ih=iw/ratio;if(ih>maxH){ih=maxH;iw=ih*ratio}const block=ih+18;ensure(block);const x=M+(W-iw)/2;doc.rect(M,y,W,block-4,'#f7fafb',C.line,.25);try{doc.addJpeg(p.data,x,y+4,iw,ih)}catch(e){doc.text('Photo could not be included',M+5,y+12,9,'normal',C.fail)}doc.text(`${i+1}. ${safeText(p.caption,'Site photo')}`,M+5,y+ih+11,8.5,'normal',C.ink);y+=block;if(i<state.photos.length-1&&y+60>278)newPage()})}
  doc.addFooters(hasField('companyName')?safeText(getValue('companyName'),''):'');return doc.output()
}
function formatDate(v){if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d)}
function downloadBlob(blob,name=fileName()){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function previewPdf(){try{const blob=buildPdf();if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);$('#pdfFrame').src=previewUrl;$('#pdfDialog').showModal()}catch(e){console.error(e);toast('Could not create the PDF. Check the report data.')}}
async function sharePdf(){const btn=$('#shareBtn');btn.disabled=true;try{const blob=buildPdf(),name=fileName(),file=new File([blob],name,{type:'application/pdf'}),shareData={title:'Commissioning report',text:`Commissioning report ${safeText(getValue('reportNumber'),'')}`.trim(),files:[file]};if(navigator.share&&(!navigator.canShare||navigator.canShare(shareData))){await navigator.share(shareData)}else{downloadBlob(blob,name);const to=encodeURIComponent(hasField('clientEmail')?getValue('clientEmail'):''),subject=encodeURIComponent(`Commissioning report ${getValue('reportNumber')}`.trim()),body=encodeURIComponent(`Hello,\n\nPlease find the commissioning report attached. The PDF has been downloaded; please attach ${name} to this email.\n\nKind regards`);location.href=`mailto:${to}?subject=${subject}&body=${body}`;toast('PDF downloaded. Attach it to the email draft.')}}catch(e){if(e.name!=='AbortError'){console.error(e);toast('Sharing was not completed. Use Preview PDF to download it.')}}finally{btn.disabled=false}}
function bind(){
  $$('input[name="finalStatus"]').forEach(el=>el.addEventListener('change',()=>{state.finalStatus=el.value;save()}));
  $('#layoutEditBtn').addEventListener('click',()=>toggleEdit());$('#doneEditingBtn').addEventListener('click',()=>toggleEdit(false));$('#resetLayoutBtn').addEventListener('click',resetLayout);$$('[data-add-section]').forEach(btn=>btn.addEventListener('click',()=>addField(btn.dataset.addSection)));
  $('#addCheckBtn').addEventListener('click',()=>{const label=prompt('Checklist row name:','New check');if(label&&label.trim()){state.checks.push({id:`check_${Date.now().toString(36)}`,label:label.trim()});renderChecklist();save(true)}});
  $('#addMeasurementBtn').addEventListener('click',()=>{state.measurements.push({name:'',value:'',unit:''});renderMeasurements();save()});$('#addTestBtn').addEventListener('click',()=>{state.tests.push({name:'',result:'Pass',notes:''});renderTests();save()});
  $('#photoInput').addEventListener('change',e=>addPhotos(e.target.files));$('#newBtn').addEventListener('click',resetReport);$('#previewBtn').addEventListener('click',previewPdf);$('#shareBtn').addEventListener('click',sharePdf);$('#shareFromPreviewBtn').addEventListener('click',sharePdf);$('#downloadBtn').addEventListener('click',()=>downloadBlob(buildPdf()));$('#closePreviewBtn').addEventListener('click',()=>$('#pdfDialog').close());
  $$('.step').forEach(btn=>btn.addEventListener('click',()=>document.getElementById(btn.dataset.target).scrollIntoView({behavior:'smooth'})));const sections=$$('.report-section'),observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)$$('.step').forEach(b=>b.classList.toggle('active',b.dataset.target===visible.target.id))},{rootMargin:'-130px 0px -55% 0px',threshold:[0,.1,.5]});sections.forEach(s=>observer.observe(s));
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});
  $('#installBtn').addEventListener('click',async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;return}$('#installDialog').showModal()});
  $('#closeInstallBtn').addEventListener('click',()=>$('#installDialog').close());$('#installDoneBtn').addEventListener('click',()=>$('#installDialog').close());
  window.addEventListener('appinstalled',()=>{deferredInstall=null;$('#installBtn').classList.add('hidden');toast('App installed')});
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(console.warn)
}
if(location.protocol==='file:'){$('#localModeNotice')?.classList.remove('hidden');$('#saveStatus').textContent='Local test mode'}
load();renderAll();bind();
window.__commissioningTest={
  setSample(photo){state.values={...state.values,companyName:'Northstar Technical Services',reportNumber:'CR-2026-204',clientName:'Acme Industries',commissionDate:'2026-10-16',siteName:'Brussels Distribution Centre',technician:'Bart Willems',siteAddress:'Avenue du Port 100, 1000 Brussels',model:'LVX-800',serialNumber:'SN-26-88421',generalNotes:'Installation inspected and commissioned in accordance with the approved drawings. Protection settings were verified.',clientContact:'Alex Martin',clientEmail:'alex@example.com',completionRemarks:'System released for normal operation.',technicianSignoff:'Bart Willems',clientSignoff:'Alex Martin'};state.checks.forEach((c,i)=>state.checkValues[c.id]=i===8?'N/A':'Pass');state.measurements=[{name:'Supply voltage L1-L2 / L2-L3 / L3-L1',value:'230 / 231 / 230',unit:'V'},{name:'Earth continuity',value:'0.18',unit:'Ω'},{name:'Insulation resistance',value:'> 200',unit:'MΩ'}];state.tests=[{name:'Start-up / shutdown sequence',result:'Pass',notes:'Sequence completed normally.'},{name:'Alarm and safety interlocks',result:'Pass',notes:'All interlocks verified.'},{name:'Communication / monitoring',result:'Pass',notes:'Remote status confirmed.'}];if(photo)state.photos=[photo];renderAll()},
  addField(section,label,type='text'){const field=normaliseField({id:`custom_test_${Date.now()}`,label,type,full:type==='textarea'});state.layout[section].push(field);renderAll();return field.id},
  deleteField(section,id){state.layout[section]=state.layout[section].filter(f=>f.id!==id);renderAll()},
  renameField(section,id,label){const f=state.layout[section].find(x=>x.id===id);if(f)f.label=label;renderAll()},buildPdf,fileName,getState:()=>clone(state)
};
})();
