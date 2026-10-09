/* Lampiran H importer for Dashboard TVET SKE KKKT.
   All PDF processing is performed locally in the browser. No file is uploaded to GitHub. */
(function () {
  'use strict';
  var files = [], preview = [];
  var STORAGE_KEY = 'kkkt_ske_lampiran_h_v1';
  var columns = ['nama','no','prog','kelas','semester','sesi','sesiKemasukan'];
  function byId(id) { return document.getElementById(id); }
  function safe(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(s) { return String(s || '').replace(/\s+/g,' ').trim(); }
  function notice(msg, color) {
    var target = byId('imp-save-msg');
    if (target) { target.textContent = msg; target.style.color = color || '#1e3a5f'; }
  }
  function setFiles(list) {
    var all = Array.from(list || []).filter(function(f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    files = all;
    if (byId('imp-file-list')) byId('imp-file-list').textContent = all.length ? all.map(function(f){return f.name;}).join(' • ') : 'Tiada fail dipilih.';
    if (byId('imp-btn-bar-top')) byId('imp-btn-bar-top').style.display = all.length ? 'flex' : 'none';
    if (byId('imp-preview-wrap')) byId('imp-preview-wrap').style.display = 'none';
    notice('');
  }
  function matchLine(text, labels) {
    var a = text.split(/\n/).map(norm).filter(Boolean);
    for (var i=0; i<a.length; i++) for (var k=0; k<labels.length; k++) {
      var r = new RegExp('^\\s*(?:' + labels[k] + ')\\s*[:：\\-]?\\s*(.*?)\\s*$','i');
      var m = a[i].match(r);
      if (m) {
        var value = norm(m[1]);
        if (value && !/^[:：\-]*$/.test(value)) return value;
        if (a[i+1]) return norm(a[i+1]);
      }
    }
    return '';
  }
  function extractPLO(text) {
    var out = Array(9).fill(null);
    var lines = text.split(/\n/).map(norm);
    for(var i=0;i<lines.length;i++) {
      // Anchored entries such as "PLO 1 78.5%" or "PLO1: 78.5".
      var m=lines[i].match(/^\s*PLO\s*([1-9])\s*[:=|\-]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%?\s*$/i);
      if(m) { var n=Number(m[2].replace(',','.')); if(n>=0 && n<=100) out[Number(m[1])-1]=n; }
      var solo=lines[i].match(/^\s*PLO\s*([1-9])\s*[:=|\-]?\s*$/i);
      if(solo && i+1<lines.length) {
        var value=lines[i+1].match(/^\s*(\d{1,3}(?:[.,]\d+)?)\s*%?\s*$/);
        if(value){ var v=Number(value[1].replace(',','.')); if(v>=0 && v<=100)out[Number(solo[1])-1]=v; }
      }
    }
    // Table variant: header PLO1 ... PLO9, followed by 9 numeric columns.
    if(out.every(function(v){return v===null;})){
      for(var k=0;k<lines.length-1;k++){
        if((lines[k].match(/PLO\s*[1-9]/ig)||[]).length>=7){
          var all=[];
          for(var j=k+1;j<Math.min(lines.length,k+4);j++){
            var nums=lines[j].match(/\b\d{1,3}(?:[.,]\d+)?\b/g)||[];
            all=all.concat(nums.map(function(v){return Number(v.replace(',','.'));}));
            if(all.length>=9)break;
          }
          if(all.length===9 && all.every(function(v){return v>=0 && v<=100;})){out=all;break;}
        }
      }
    }
    return out;
  }
  function pdfLines(items) {
    var list = items.filter(function(t){return norm(t.str);}).map(function(t){
      return {x:t.transform && t.transform[4] || 0,y:Math.round((t.transform && t.transform[5] || 0)*2)/2,s:norm(t.str)};
    });
    list.sort(function(a,b){return b.y-a.y || a.x-b.x;});
    var rows=[];
    list.forEach(function(t) {
      var last=rows[rows.length-1];
      if(!last || Math.abs(last.y-t.y)>2.5)rows.push({y:t.y,items:[t]});
      else last.items.push(t);
    });
    return rows.map(function(r) {return r.items.sort(function(a,b){return a.x-b.x;}).map(function(t){return t.s;}).join(' ');});
  }
  function parseRecord(text,filename,pages) {
    var name=matchLine(text,['NAMA\\s*(?:PELAJAR|MURID)?','STUDENT\\s*NAME']);
    var no=matchLine(text,['NO\\.?\\s*(?:PENDAFTARAN|PENDAF|MATRIK|PELAJAR)','NO\\.?\\s*ID','REGISTRATION\\s*(?:NO|NUMBER)']);
    if(!no){var id=text.match(/\bT\d{2}SKE\d{2}[A-Z]?\d{3,6}\b/i);if(id)no=id[0];}
    var kelas=matchLine(text,['KELAS','CLASS']);
    var semester=matchLine(text,['SEMESTER','SEM\\.?']);
    var sesi=matchLine(text,['SESI\\s*(?:KELUAR|TAMAT|PENGAJIAN)?','ACADEMIC\\s*SESSION']);
    var prog=matchLine(text,['PROGRAM(?:ME)?','KOD\\s*PROGRAM']);
    // A label may inadvertently match a heading; user must review each value.
    if (!name) name=filename.replace(/\.pdf$/i,'').replace(/^Lampiran\s*H\s*[-–_]\s*/i,'').replace(/[_-]/g,' ');
    if (!prog) prog='Sijil Teknologi Elektrik';
    var plos=extractPLO(text);
    var masuk=window.deriveSesiKemasukan ? window.deriveSesiKemasukan(no) : '';
    return {nama:name,no:no,prog:prog,kelas:kelas,semester:semester,sesi:sesi,sesiKemasukan:masuk,
      plo:plos,source:filename+' ('+pages+' halaman)',selected:true};
  }
  function renderPreview(){
    var box=byId('imp-preview-wrap'), tbody=byId('imp-preview-tbody');
    if(!box||!tbody)return;
    tbody.innerHTML=preview.map(function(r,i){
      var existing=(window.students||[]).some(function(s){return r.no && String(s.no).toUpperCase()===String(r.no).toUpperCase();});
      var editable=columns.map(function(k){
        var width=(k==='nama'||k==='kelas')?'150px':'95px';
        return '<td style="padding:4px;"><input aria-label="'+safe(k)+'" data-row="'+i+'" data-key="'+k+'" value="'+safe(r[k])+'" style="width:'+width+';padding:4px;border:1px solid #d1d5db;border-radius:3px;"></td>';
      }).join('');
      var plo=r.plo.map(function(v,j){return '<td style="padding:4px;"><input aria-label="PLO'+(j+1)+'" data-row="'+i+'" data-plo="'+j+'" type="number" min="0" max="100" step="0.01" value="'+(v===null?'':v)+'" style="width:63px;padding:4px;border:1px solid #d1d5db;border-radius:3px;"></td>';}).join('');
      var vals=r.plo.filter(function(v){return typeof v==='number' && Number.isFinite(v);});
      var avg=vals.length?(vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1)+'%':'—';
      return '<tr><td><input type="checkbox" data-select="'+i+'" '+(r.selected?'checked':'')+'></td>'+
        editable+plo+'<td style="padding:5px;" id="imp-avg-'+i+'">'+avg+'</td>'+
        '<td style="padding:5px;color:'+(existing?'#b45309':'#166534')+';">'+(existing?'Sudah wujud':'Semak dahulu')+'</td>'+
        '<td style="padding:5px;font-size:11px;">'+safe(r.source)+'</td></tr>';
    }).join('');
    box.style.display=preview.length?'block':'none';
    if(byId('imp-dup-notice'))byId('imp-dup-notice').textContent='Semak nama, no. pendaftaran, sesi dan 9 PLO. Rekod sedia ada dengan no. pendaftaran yang sama akan dilangkau; data yang tidak dapat dikesan boleh dibetulkan sebelum simpan.';
    notice('');
  }
  function persist(){
    try{
      var data={students:window.students||[],ploData:window.ploData||{}};
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    }catch(e){notice('Tidak dapat simpan dalam pelayar: '+e.message,'#b91c1c');}
  }
  function restore(){
    try{
      var data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(data && Array.isArray(data.students) && data.ploData && typeof data.ploData==='object'){
        data.students.forEach(function(s){ if(s && s.id && s.no && !window.students.some(function(x){return x.id===s.id;}))window.students.push(s); });
        Object.keys(data.ploData).forEach(function(k){window.ploData[k]=data.ploData[k];});
        window.renderStudentList();
      }
    }catch(e){notice('Data tempatan tidak dapat dibaca.','#b91c1c');}
  }
  var Importer={
    clearFiles:function(){files=[];preview=[];setFiles([]);if(byId('imp-file-input'))byId('imp-file-input').value='';},
    cancelPreview:function(){preview=[];if(byId('imp-preview-wrap'))byId('imp-preview-wrap').style.display='none';},
    toggleAll:function(v){preview.forEach(function(r){r.selected=!!v;});renderPreview();},
    processAll:async function(){
      if(!window.pdfjsLib){alert('PDF.js belum dimuatkan. Periksa sambungan internet.');return;}
      if(!files.length){alert('Pilih sekurang-kurangnya satu PDF dahulu.');return;}
      var btn=byId('imp-btn-process');if(btn){btn.disabled=true;btn.textContent='Sedang mengekstrak...';}
      preview=[];var errors=[];
      try{
        for(var f=0;f<files.length;f++){
          var file=files[f];
          try{
            var doc=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
            var parts=[];
            for(var p=1;p<=doc.numPages;p++){
              var pg=await doc.getPage(p);
              var text=await pg.getTextContent();
              parts.push(pdfLines(text.items).join('\n'));
            }
            var all=parts.join('\n');
            if(!norm(all))throw Error('Tiada teks boleh diekstrak. PDF imbasan memerlukan OCR.');
            preview.push(parseRecord(all,file.name,doc.numPages));
          }catch(e){errors.push(file.name+': '+e.message);}
        }
        renderPreview();
        var msg=preview.length+' fail berjaya diproses.'+(errors.length?' Gagal: '+errors.join('; '):'');
        if(byId('imp-file-list'))byId('imp-file-list').textContent=msg;
        if(errors.length)notice(msg,'#b91c1c');
      }finally{if(btn){btn.disabled=false;btn.textContent='⚙️ Ekstrak Data dari PDF';}}
    },
    saveSelected:function(){
      var selected=preview.filter(function(r){return r.selected;});
      var added=0,skipped=0,missing=0;
      selected.forEach(function(r){
        if(!norm(r.no)||!norm(r.nama)){missing++;return;}
        if(window.students.some(function(s){return String(s.no).toUpperCase()===String(r.no).toUpperCase();})){skipped++;return;}
        function clean(s){return norm(s).replace(/[<>]/g,'');}
        var id='pdf-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
        var item={id:id,nama:clean(r.nama),no:clean(r.no),prog:clean(r.prog),kelas:clean(r.kelas),
          semester:clean(r.semester),sesi:clean(r.sesi),sesiKemasukan:clean(r.sesiKemasukan)};
        item.batch=window.makeBatchKey ? window.makeBatchKey(item.sesiKemasukan,item.sesi):item.sesiKemasukan;
        window.students.push(item);
        window.ploData[id]=r.plo.map(function(v){return Number.isFinite(v)?v:null;});
        added++;
      });
      window.renderStudentList();
      persist();
      notice(added+' pelajar disimpan dalam pelayar ini; '+skipped+' rekod pendua dilangkau; '+missing+' rekod tidak lengkap.','#166534');
    }
  };
  window.Importer=Importer;
  function init(){
    var drop=byId('imp-dropzone'), input=byId('imp-file-input');
    if(drop&&input){
      drop.addEventListener('click',function(){input.click();});
      input.addEventListener('change',function(){setFiles(input.files);});
      drop.addEventListener('dragover',function(e){e.preventDefault();drop.style.background='#dbeafe';});
      drop.addEventListener('dragleave',function(){drop.style.background='#f0f6ff';});
      drop.addEventListener('drop',function(e){e.preventDefault();drop.style.background='#f0f6ff';setFiles(e.dataTransfer.files);});
    }
    var table=byId('imp-preview-tbody');
    if(table)table.addEventListener('change',function(e){
      var el=e.target,i=Number(el.dataset.row);
      if(el.dataset.select!==undefined){preview[Number(el.dataset.select)].selected=el.checked;return;}
      if(!preview[i])return;
      if(el.dataset.key)preview[i][el.dataset.key]=el.value.trim();
      if(el.dataset.plo!==undefined){
        var v=el.value.trim(),n=Number(v);
        if(v!=='' && (!Number.isFinite(n)||n<0||n>100)){alert('Nilai PLO mesti antara 0 hingga 100.');el.focus();return;}
        preview[i].plo[Number(el.dataset.plo)]=v===''?null:n;
        var vals=preview[i].plo.filter(function(v){return Number.isFinite(v);});
        byId('imp-avg-'+i).textContent=vals.length?(vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1)+'%':'—';
      }
    });
    var currentRender=window.renderStudentList;
    if(typeof currentRender==='function'){
      window.renderStudentList=function(){currentRender();persist();};
    }
    restore();
    if(byId('imp-dropzone')){
      var tip=document.createElement('p');
      tip.style.cssText='color:#854d0e;font-size:12px;margin:10px 0;';
      tip.textContent='Privasi: PDF diproses dalam pelayar sahaja. Rekod yang disahkan disimpan secara setempat pada pelayar ini (bukan dalam GitHub). Elakkan penggunaan komputer awam atau kongsi tanpa kawalan akses. PDF imbasan tanpa teks memerlukan OCR.';
      byId('imp-dropzone').parentNode.appendChild(tip);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();