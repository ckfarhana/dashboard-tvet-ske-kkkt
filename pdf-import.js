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
    var out=Array(9).fill(null);
    var lines=text.split(/\n/).map(norm);
    function ninePercentages(line) {
      // Values occur in the summary row; never mistake fraction formula "(...×100%)" for PLO scores.
      if (/[×x]\s*100\s*%/i.test(line)) return null;
      var matches=Array.from(line.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g),
        function(m){return Number(m[1].replace(',','.'));});
      return matches.length===9 && matches.every(function(n){return Number.isFinite(n)&&n>=0&&n<=100;})?matches:null;
    }
    // Official CCMS Lampiran H places nine results on/just above "PURATA PLO KESELURUHAN".
    for(var i=lines.length-1;i>=0;i--){
      if(!/PURATA\s+PLO\s+KESELURUHAN/i.test(lines[i]))continue;
      for(var j of [0,-1,1,-2,2,-3,3]){
        if(i+j>=0 && i+j<lines.length){
          var p=ninePercentages(lines[i+j]);
          if(p)return p;
        }
      }
    }
    // Alternative accessible-text variants, e.g. PLO1: 85.4%.
    for(var k=0;k<lines.length;k++){
      var m=lines[k].match(/^\s*PLO\s*([1-9])\s*[:=|\-]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%?\s*$/i);
      if(m){var v=Number(m[2].replace(',','.'));if(v>=0&&v<=100)out[Number(m[1])-1]=v;}
      var solo=lines[k].match(/^\s*PLO\s*([1-9])\s*[:=|\-]?\s*$/i);
      if(solo && k+1<lines.length) {
        var val=lines[k+1].match(/^\s*(\d{1,3}(?:[.,]\d+)?)\s*%?\s*$/);
        if(val){var n=Number(val[1].replace(',','.'));if(n>=0&&n<=100)out[Number(solo[1])-1]=n;}
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
    var semesterSesi=matchLine(text,['SEMESTER\s*\/\s*SESI']);
    var semester=matchLine(text,['SEMESTER','SEM\.?']);
    var sesi=matchLine(text,['SESI\s*(?:KELUAR|TAMAT|PENGAJIAN)?','ACADEMIC\s*SESSION']);
    var combined=semesterSesi.match(/^\s*(\d+)\s*\/\s*(S[12]\d{4})\b/i);
    if(combined) {semester=combined[1]; sesi=combined[2];}
    var sessionMatch=sesi.match(/^S([12])(\d{2})(\d{2})$/i);
    if(sessionMatch) sesi='Sesi '+(sessionMatch[1]==='1'?'I':'II')+' 20'+sessionMatch[2]+'/20'+sessionMatch[3];
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
      var ploComplete=vals.length===9;
      return '<tr><td><input type="checkbox" data-select="'+i+'" '+(r.selected?'checked':'')+'></td>'+
        editable+plo+'<td style="padding:5px;" id="imp-avg-'+i+'">'+avg+'</td>'+
        '<td style="padding:5px;color:'+(existing?'#b45309':ploComplete?'#166534':'#b91c1c')+';">'+(existing?'Sudah wujud':ploComplete?'9/9 PLO ✓':vals.length+'/9 PLO — semak PDF')+'</td>'+
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
        if(typeof window.renderPLOTable==='function')window.renderPLOTable();
        if(window.students.length && typeof window.calcPLO==='function')window.calcPLO();
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
      // Read current preview checkbox values, even if user has not blurred the row.
      var selected=preview.filter(function(r){return r.selected;});
      var added=0,updated=0,missing=0,incomplete=0;
      selected.forEach(function(r){
        if(!norm(r.no)||!norm(r.nama)){missing++;return;}
        if(!Array.isArray(r.plo) || r.plo.filter(function(v){return Number.isFinite(v)&&v>=0&&v<=100;}).length!==9){incomplete++;return;}
        var existing=window.students.find(function(s){return String(s.no||'').trim().toUpperCase()===String(r.no).trim().toUpperCase();});
        function clean(s){return norm(s).replace(/[<>]/g,'');}
        var id='pdf-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
        var item={id:id,nama:clean(r.nama),no:clean(r.no),prog:clean(r.prog),kelas:clean(r.kelas),
          semester:clean(r.semester),sesi:clean(r.sesi),sesiKemasukan:clean(r.sesiKemasukan)};
        item.batch=window.makeBatchKey ? window.makeBatchKey(item.sesiKemasukan,item.sesi):item.sesiKemasukan;
        if(existing) {
          // Update in place so every tab keeps the same student ID and references.
          ['nama','prog','kelas','semester','sesi','sesiKemasukan','batch'].forEach(function(k){
            if(item[k]) existing[k]=item[k];
          });
          window.ploData[existing.id]=r.plo.slice();
          updated++;
        } else {
          window.students.push(item);
          window.ploData[id]=r.plo.slice();
          added++;
        }
      });
      window.renderStudentList();
      persist();
      if(typeof window.renderPLOTable==='function')window.renderPLOTable();
      if((added||updated) && typeof window.calcPLO==='function')window.calcPLO();
      if((added||updated) && typeof window.calcPEO==='function')window.calcPEO();
      notice(added+' pelajar baharu; '+updated+' rekod PLO dikemas kini; '+missing+' maklumat tidak lengkap; '+incomplete+' rekod PLO kurang daripada 9 (tidak disimpan).',incomplete||missing?'#b91c1c':'#166534');
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
    var originalCalcPLO=window.calcPLO;
    if(typeof originalCalcPLO==='function') {
      window.calcPLO=function(){originalCalcPLO();persist();};
    }
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