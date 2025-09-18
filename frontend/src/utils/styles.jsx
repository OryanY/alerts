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
  input: {
    padding:'8px 12px',
    border:'1px solid #D1D5DB',
    borderRadius:6,
    fontSize:14,
    width:'100%',
    maxWidth:'100%',
    minWidth:0,
    boxSizing:'border-box'
  },
  select: { padding:'8px 12px', border:'1px solid #D1D5DB', borderRadius:6, fontSize:14 },
  tableHeadCell: { padding:12, textAlign:'left', cursor:'pointer', fontWeight:600, borderBottom:'2px solid #E5E7EB' },
  tableCell: { padding:12 },
  grid: (template) => ({ display:'grid', gridTemplateColumns:template, gap:20, marginBottom:24 }),
  footer: { background:'white', borderTop:'1px solid #E5E7EB', marginTop:40 },
  footerInner: { maxWidth:1200, margin:'0 auto', padding:'16px 20px' },
  skeleton: (w='100%', h=20) => ({ backgroundColor:'#F3F4F6', height:h, width:w, borderRadius:4, animation:'pulse 2s ease-in-out infinite' }),
  // layout
  container: { maxWidth: '1400px', margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif' },
  headerBox: { background:'#f5f5f5', padding:20, borderRadius:8, marginBottom:20, borderLeft:'4px solid #007bff' },
  title: { margin:'0 0 10px 0', color:'#333', fontSize:24 },
  subtitle: { margin:0, color:'#666', fontSize:14 },

  // tabs
  tabs: { display:'flex', marginBottom:20, borderBottom:'2px solid #e9ecef' },
  tab: { padding:'12px 24px', background:'transparent', border:'none', cursor:'pointer', fontSize:16, fontWeight:'bold', borderBottom:'3px solid transparent', transition:'all .3s ease' },
  activeTab: { color:'#007bff', borderBottomColor:'#007bff' },
  inactiveTab: { color:'#666', borderBottomColor:'transparent' },

  // buttons
  button: { background:'#007bff', color:'#fff', border:'none', padding:'10px 20px', borderRadius:4, cursor:'pointer', fontSize:14, marginRight:10, marginBottom:10 },
  buttonSecondary: { background:'#6c757d', color:'#fff', border:'none', padding:'8px 16px', borderRadius:4, cursor:'pointer', fontSize:12, marginRight:5 },
  buttonDanger: { background:'#dc3545', color:'#fff', border:'none', padding:'8px 16px', borderRadius:4, cursor:'pointer', fontSize:12, marginLeft:5 },
  buttonSuccess: { background:'#28a745', color:'#fff', border:'none', padding:'8px 16px', borderRadius:4, cursor:'pointer', fontSize:12, marginRight:5 },

  // states
  error: { background:'#f8d7da', color:'#721c24', padding:10, borderRadius:4, marginBottom:20, border:'1px solid #f5c6cb' },
  loading: { textAlign:'center', padding:40, color:'#666' },

  // cards
  card: (extra={}) => ({ border:'1px solid #ddd', borderRadius:8, padding:20, marginBottom:20, background:'#fff', boxShadow:'0 2px 4px rgba(0,0,0,0.1)', ...extra }),
  cardHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15, paddingBottom:10, borderBottom:'2px solid #e9ecef' },
  cardTitle: { fontSize:18, fontWeight:'bold', color:'#007bff' },
  cardSubtitle: { fontSize:14, color:'#666', marginTop:5 },

  // rule card header
  ruleHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:15 },
  ruleTitle: { fontSize:18, fontWeight:'bold', color:'#007bff', margin:0 },
  priorityIndicator: { display:'inline-block', padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:'bold', background:'#17a2b8', color:'#fff', marginLeft:10 },
  ruleSubtitle: { fontSize:14, color:'#666', margin:'5px 0' },
  ruleDescription: { fontSize:13, color:'#666', marginTop:5 },
  ruleStatus: { display:'flex', alignItems:'center', gap:10 },
  statusBadge: { padding:'4px 8px', borderRadius:4, fontSize:12, fontWeight:'bold' },
  enabledBadge: { background:'#d4edda', color:'#155724', border:'1px solid #c3e6cb' },
  disabledBadge: { background:'#f8d7da', color:'#721c24', border:'1px solid #f5c6cb' },

  // sections
  conditionsSection: { background:'#e7f3ff', padding:15, borderRadius:4, marginBottom:15 },
  overridesSection: { background:'#fff3cd', padding:15, borderRadius:4, marginBottom:15 },
  sectionTitle: { fontSize:14, fontWeight:'bold', marginBottom:10, color:'#495057' },
  conditionItem: { marginBottom:8, fontSize:13 },
  conditionLabel: { fontWeight:'bold', color:'#004085' },
  conditionValue: { color:'#004085', fontFamily:'monospace', background:'#fff', padding:'2px 6px', borderRadius:3, border:'1px solid #b3d9ff' },
  metaRow: { fontSize:12, color:'#666', marginTop:10 },

  // form
  form: { background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:20, marginBottom:20 },
  formGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:15, marginBottom:20 },
  formGroup: { display:'flex', flexDirection:'column' },
  formLabel: { marginBottom:5, fontWeight:'bold', color:'#495057' },
  input: { padding:10, border:'1px solid #ddd', borderRadius:4, fontSize:14 },
  select: { padding:10, border:'1px solid #ddd', borderRadius:4, fontSize:14 },
  textarea: { padding:10, border:'1px solid #ddd', borderRadius:4, fontSize:14, minHeight:100, resize:'vertical' },
  formActions: { display:'flex', gap:10, justifyContent:'flex-end' },

  // misc
  noItems: { textAlign:'center', padding:40, color:'#666', background:'#f8f9fa', borderRadius:8 },
  grid: (template) => ({ display:'grid', gridTemplateColumns: template, gap:10, marginBottom:15 }),
  kvBox: { padding:8, background:'#f8f9fa', borderRadius:4, fontSize:14 },
  kvKey: { fontWeight:'bold', color:'#495057', marginBottom:2 },
  kvVal: { color:'#6c757d' },
  tagInput: { fontSize:13, color:'#666', marginTop:5 },
};