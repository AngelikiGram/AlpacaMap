import { useRef } from 'react';


import { FileText, Trash2, Upload } from 'lucide-react';


import { DOC_SECTIONS } from "../../config.jsx";

export const DocumentsPanel=({tripData,setTripData})=>{
  const fileRefs=useRef({});
  return(
    <div>
      <p className="panel-hint">Upload tickets, reservations, and confirmations by category.</p>
      {DOC_SECTIONS.map(sec=>(
        <div key={sec.key} className="doc-section">
          <div className="doc-section-header"><span>{sec.icon} {sec.label}</span><span className="tag" style={{fontSize:'0.65rem'}}>{tripData.documents[sec.key].length} file{tripData.documents[sec.key].length!==1?'s':''}</span></div>
          {tripData.documents[sec.key].map(f=>(
            <div key={f.id} className="file-card">
              <FileText size={15} color="var(--accent-secondary)"/>
              <div style={{flex:1}}><div style={{fontSize:'0.8rem',fontWeight:'500'}}>{f.name}</div><div style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>{f.size}</div></div>
              <button className="btn-icon" onClick={()=>setTripData(prev=>({...prev,documents:{...prev.documents,[sec.key]:prev.documents[sec.key].filter(fi=>fi.id!==f.id)}}))}><Trash2 size={12} color="var(--danger)"/></button>
            </div>
          ))}
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" ref={el=>fileRefs.current[sec.key]=el} style={{display:'none'}} onChange={e=>{const items=Array.from(e.target.files).map(f=>({id:Date.now()+Math.random(),name:f.name,size:`${(f.size/1024).toFixed(1)} KB`}));setTripData(prev=>({...prev,documents:{...prev.documents,[sec.key]:[...prev.documents[sec.key],...items]}}));e.target.value='';}}/>
          <button className="upload-btn" onClick={()=>fileRefs.current[sec.key]?.click()}><Upload size={12}/> Upload {sec.label}</button>
        </div>
      ))}
    </div>
  );
};
