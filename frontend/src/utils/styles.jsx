export const S = {
  page: { minHeight:'100vh', background:'#F9FAFB' },
  header: { background:'white', borderBottom:'1px solid #E5E7EB', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' },
  headerInner: { maxWidth:1200, margin:'0 auto', padding:'0 20px' },
  headerRow: { display:'flex', justifyContent:'space-between', alignItems:'center', height:64 },
  navBtn: (active) => ({
    display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
    border:'none', borderRadius:6, background: active ? '#3B82F6' : 'transparent',
    color: active ? 'white' : '#6B7280', fontSize:14, fontWeight:500, cursor:'pointer'
  }),
  main: { maxWidth:1200, margin:'0 auto', padding:20 },
  card: (extra={}) => ({
    background:'white', border:'1px solid #E5E7EB', borderRadius:8, padding:20,
    boxShadow:'0 1px 3px rgba(0,0,0,0.1)', ...extra
  }),
  kpiIconWrap: (color) => ({
    width:40, height:40, borderRadius:8, background:`${color}20`,
    display:'flex', alignItems:'center', justifyContent:'center'
  }),
  pill: (color) => ({
    background:`${color}20`, color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:600
  }),
  input: { padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:14 },
  select: { padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:14 },
  tableHeadCell: { padding:12, textAlign:'left', cursor:'pointer', fontWeight:600, borderBottom:'2px solid #E5E7EB' },
  tableCell: { padding:12 },
  grid: (template) => ({ display:'grid', gridTemplateColumns:template, gap:20, marginBottom:24 }),
  footer: { background:'white', borderTop:'1px solid #E5E7EB', marginTop:40 },
  footerInner: { maxWidth:1200, margin:'0 auto', padding:'16px 20px' },
  skeleton: (w='100%', h=20) => ({ backgroundColor:'#F3F4F6', height:h, width:w, borderRadius:4, animation:'pulse 2s ease-in-out infinite' }),
};
