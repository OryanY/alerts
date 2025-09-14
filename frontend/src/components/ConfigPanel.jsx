import React, { useEffect, useState } from 'react';
import { S } from '../utils/styles';
import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { Settings } from '../icons';
import { LabeledNumber } from './LabeledNumber';

export const ConfigPanel = ({ clientCfg, setClientCfg, isOpen, onToggle }) => {
  const [local, setLocal] = useState(clientCfg);
  useEffect(() => setLocal(clientCfg), [clientCfg]);

  const save = () => {
    const toInt = (v, d) => Number.isFinite(+v) ? parseInt(v,10) : d;
    const next = {
      ...local,
      dayStart: toInt(local.dayStart, DEFAULT_CLIENT_CFG.dayStart),
      dayEnd: toInt(local.dayEnd, DEFAULT_CLIENT_CFG.dayEnd),
      nightStart: toInt(local.nightStart, DEFAULT_CLIENT_CFG.nightStart),
      nightEnd: toInt(local.nightEnd, DEFAULT_CLIENT_CFG.nightEnd),
      falseWakeupThreshold: toInt(local.falseWakeupThreshold, DEFAULT_CLIENT_CFG.falseWakeupThreshold),
      bands: local.bands.map(b => ({ ...b, min: toInt(b.min, 0), max: toInt(b.max, 1e9) }))
    };
    setClientCfg(next);
    localStorage.setItem('noc_client_cfg', JSON.stringify(next));
    onToggle(false);
  };

  const reset = () => {
    setClientCfg(DEFAULT_CLIENT_CFG);
    localStorage.removeItem('noc_client_cfg');
    onToggle(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:50,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16
    }}>
      <div style={{ ...S.card({ maxWidth:900, width:'100%', maxHeight:'90vh', overflowY:'auto', borderRadius:16 }) }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ padding:8, background:'#DBEAFE', borderRadius:8 }}>
              <Settings size={18} style={{ color:'#2563EB' }} />
            </div>
            <div>
              <div style={{ fontWeight:700 }}>Dashboard Configuration</div>
              <div style={{ fontSize:12, color:'#6B7280' }}>Customize thresholds and display settings</div>
            </div>
          </div>
          <button onClick={()=>onToggle(false)} style={{ padding:8, borderRadius:8, border:'1px solid #E5E7EB', background:'white', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', marginBottom:12 }}>
          <LabeledNumber label="Day Start (0–23)" value={local.dayStart} onChange={v=>setLocal(p=>({...p,dayStart:v}))}/>
          <LabeledNumber label="Day End (0–23)" value={local.dayEnd} onChange={v=>setLocal(p=>({...p,dayEnd:v}))}/>
          <LabeledNumber label="Night Start (0–23)" value={local.nightStart} onChange={v=>setLocal(p=>({...p,nightStart:v}))}/>
          <LabeledNumber label="Night End (0–23)" value={local.nightEnd} onChange={v=>setLocal(p=>({...p,nightEnd:v}))}/>
          <LabeledNumber label="False Wakeup ≤ (sec)" value={local.falseWakeupThreshold} onChange={v=>setLocal(p=>({...p,falseWakeupThreshold:v}))}/>
        </div>

        <div style={{ marginTop:4 }}>
          <strong>Duration Bands</strong>
          <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', marginTop:8 }}>
            {local.bands.map((b, idx) => (
              <div key={b.key} style={{ border:'1px solid #E5E7EB', borderRadius:6, padding:8, background:'#F9FAFB' }}>
                <div style={{ fontWeight:600, marginBottom:6, color:b.color }}>{b.label}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <LabeledNumber small label="Min" value={b.min} onChange={v=>setLocal(prev=>({...prev, bands: prev.bands.map((x,i)=>i===idx?{...x,min:v}:x)}))}/>
                  <LabeledNumber small label="Max" value={b.max} onChange={v=>setLocal(prev=>({...prev, bands: prev.bands.map((x,i)=>i===idx?{...x,max:v}:x)}))}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={reset} style={{ padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, background:'white', cursor:'pointer', fontWeight:600 }}>Reset</button>
          <button onClick={save}  style={{ padding:'8px 12px', border:'1px solid #1D4ED8', borderRadius:6, background:'#3B82F6', color:'white', cursor:'pointer', fontWeight:600 }}>Apply</button>
        </div>
      </div>
    </div>
  );
};
