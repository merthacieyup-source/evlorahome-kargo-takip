export default async function handler(req,res){
res.setHeader("Cache-Control","no-store");const tracking=String(req.query.tracking||"").trim();if(!tracking)return res.status(400).json({ok:false,error:"Takip numarası gerekli."});
const token=process.env.KARGONOMI_TOKEN;if(!token)return res.status(500).json({ok:false,error:"Kargonomi bağlantısı yapılandırılmamış."});
const norm=v=>String(v??"").trim().toLowerCase().replace(/\s+/g,"");const wanted=norm(tracking);
const tk=["tracking_number","trackingNumber","tracking_no","trackingNo","cargo_tracking_number","cargoTrackingNumber","shipment_tracking_number","shipmentTrackingNumber","barcode","cargo_barcode","cargoBarcode","tracking_code","trackingCode"];
const sk=["status","status_name","statusName","shipment_status","shipmentStatus","cargo_status","cargoStatus","state"];
const ck=["cargo_company","cargoCompany","carrier","carrier_name","carrierName","cargo_firm","cargoFirm"];
const uk=["updated_at","updatedAt","last_update","lastUpdate","status_updated_at","statusUpdatedAt"];
const pick=(o,ks)=>{for(const k of ks)if(o&&o[k]!=null&&typeof o[k]!=="object")return o[k];return""};
const list=d=>Array.isArray(d)?d:(Array.isArray(d?.data)?d.data:(d?.shipments||d?.items||d?.results||d?.data?.shipments||d?.data?.items||[]));
try{for(let page=1;page<=20;page++){const r=await fetch(`https://app.kargonomi.com.tr/api/v1/shipments?page=${page}`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});
if(r.status===401||r.status===403)return res.status(502).json({ok:false,error:"Kargonomi API yetkilendirmesi başarısız. Tokenı kontrol edin."});if(!r.ok)return res.status(502).json({ok:false,error:`Kargonomi API hatası (${r.status}).`});
const a=list(await r.json());const f=a.find(o=>tk.some(k=>norm(o?.[k])===wanted));if(f)return res.status(200).json({ok:true,tracking:String(pick(f,tk)||tracking),status:String(pick(f,sk)||"Kargo kaydı bulundu"),carrier:String(pick(f,ck)||""),updated:String(pick(f,uk)||"")});if(!a.length||a.length<50)break}
return res.status(404).json({ok:false,error:"Bu takip numarasına ait kargo kaydı bulunamadı."})}catch(e){return res.status(500).json({ok:false,error:"Kargo servisine şu anda ulaşılamıyor."})}}