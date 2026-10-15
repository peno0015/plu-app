const KEY='plu-listan-v1';
const $=id=>document.getElementById(id);
let articles=[];let editing=null;
try {const stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(stored))articles=stored.filter(a=>a&&typeof a.name==='string'&&typeof a.plu==='string'&&typeof a.id==='string');}catch(e){alert('Kunde inte läsa sparade artiklar.');}
const save=()=>localStorage.setItem(KEY,JSON.stringify(articles));
function render(){const query=$('search').value.trim().toLocaleLowerCase('sv');const results=articles.filter(a=>a.name.toLocaleLowerCase('sv').includes(query)||a.plu.includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'sv'));$('count').textContent=articles.length;$('shown').textContent=`${results.length} visas`;const list=$('list');list.replaceChildren();if(!results.length){const empty=document.createElement('div');empty.className='empty';const title=document.createElement('strong');title.textContent=articles.length?'Inga träffar':'Inga artiklar ännu';const detail=document.createElement('span');detail.textContent=articles.length?'Prova ett annat sökord.':'Lägg till din första artikel för att börja.';empty.append(title,detail);list.append(empty);return;}for(const article of results){const row=document.createElement('div');row.className='item';const info=document.createElement('div');info.className='item-info';const name=document.createElement('div');name.className='item-name';name.textContent=article.name;const code=document.createElement('div');code.className='item-code';code.append('PLU  ');const b=document.createElement('b');b.textContent=article.plu;code.append(b);info.append(name,code);const edit=document.createElement('button');edit.className='edit';edit.textContent='Ändra';edit.setAttribute('aria-label','Ändra '+article.name);edit.onclick=()=>openEditor(article);const del=document.createElement('button');del.className='delete';del.textContent='×';del.setAttribute('aria-label','Ta bort '+article.name);del.onclick=()=>{if(confirm(`Ta bort ${article.name}?`)){articles=articles.filter(a=>a.id!==article.id);save();render();}};row.append(info,edit,del);list.append(row);}}
function openEditor(article=null){editing=article?.id??null;$('form-title').textContent=article?'Redigera artikel':'Ny artikel';$('name').value=article?.name??'';$('plu').value=article?.plu??'';$('editor').showModal();$('name').focus();}
$('add').onclick=()=>openEditor();$('close').onclick=$('cancel').onclick=()=>$('editor').close();const searchInput=$('search');const clearSearch=$('clear-search');function updateClearSearch(){clearSearch.hidden=!searchInput.value;}searchInput.addEventListener('input',()=>{updateClearSearch();render();});clearSearch.onclick=()=>{searchInput.value='';updateClearSearch();render();searchInput.focus();};updateClearSearch();
// Dublettkontroll gäller både när artiklar skapas och redigeras.
let pendingChange=null;
const duplicateDialog=$('duplicate-dialog');
function persist(next){
  const previous=articles;
  articles=next;
  try{save();render();$('editor').close();duplicateDialog.close();pendingChange=null;}
  catch(e){articles=previous;alert('Det gick inte att spara. Kontrollera telefonens lagringsutrymme.');}
}
function applyChange(name,plu,replaceId=null){
  let next;
  if(replaceId){
    // Vid redigering tas den redigerade posten bort om ett annat PLU-objekt ersätts.
    next=articles.filter(a=>a.id!==editing || a.id===replaceId)
      .map(a=>a.id===replaceId?{...a,name,plu}:a);
  }else if(editing){
    next=articles.map(a=>a.id===editing?{...a,name,plu}:a);
  }else{
    next=[...articles,{id:crypto.randomUUID(),name,plu}];
  }
  persist(next);
}
$('form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=$('name').value.trim();
  const plu=$('plu').value.trim();
  if(!name||!/^[0-9]{1,12}$/.test(plu))return;
  const others=articles.filter(a=>a.id!==editing);
  // Förhindra exakt samma namn och PLU, oavsett stora/små bokstäver.
  const exact=others.find(a=>a.plu===plu&&a.name.toLocaleLowerCase('sv')===name.toLocaleLowerCase('sv'));
  if(exact){alert(`Artikeln ”${exact.name}” med PLU ${plu} finns redan.`);return;}
  const matches=others.filter(a=>a.plu===plu);
  if(matches.length){
    pendingChange={name,plu,matches};
    $('duplicate-description').textContent=`PLU ${plu} används redan av ${matches.map(a=>a.name).join(', ')}. Vad vill du göra?`;
    // Vid flera träffar får användaren välja vilken artikel som ska ersättas.
    const replace=$('duplicate-replace');
    replace.textContent=matches.length===1?'Uppdatera befintlig artikel':'Välj artikel att uppdatera';
    duplicateDialog.showModal();
    return;
  }
  applyChange(name,plu);
});
$('duplicate-cancel').onclick=()=>{duplicateDialog.close();pendingChange=null;};
$('duplicate-keep').onclick=()=>{
  if(!pendingChange)return;
  const {name,plu}=pendingChange;
  applyChange(name,plu);
};
$('duplicate-replace').onclick=()=>{
  if(!pendingChange)return;
  const {name,plu,matches}=pendingChange;
  let target=matches[0];
  if(matches.length>1){
    const options=matches.map((a,i)=>`${i+1}. ${a.name}`).join('\n');
    const selection=prompt(`Vilken artikel vill du uppdatera?\n${options}\n\nSkriv numret i listan:`);
    if(selection===null)return;
    const n=Number(selection);
    if(!Number.isInteger(n)||n<1||n>matches.length){alert('Välj ett giltigt nummer.');return;}
    target=matches[n-1];
  }
  applyChange(name,plu,target.id);
};
duplicateDialog.addEventListener('close',()=>{pendingChange=null;});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(articles,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='plu-artiklar.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data)||!data.every(a=>a&&typeof a.name==='string'&&a.name.trim()&&a.name.length<=80&&typeof a.plu==='string'&&/^[0-9]{1,12}$/.test(a.plu)))throw Error('Ogiltigt filformat');if(!confirm(`Importera ${data.length} artiklar? Din nuvarande lista ersätts.`))return;const previous=articles;articles=data.map(a=>({id:crypto.randomUUID(),name:a.name,plu:a.plu}));try{save();render();}catch(err){articles=previous;throw err;}}catch(err){alert('Kunde inte importera filen: '+err.message);}finally{e.target.value='';}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));render();
