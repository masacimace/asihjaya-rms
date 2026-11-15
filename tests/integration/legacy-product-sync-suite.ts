import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { legacyProductImportBatches, legacyProductRows, productItems } from "@/db/schema";
import { importLegacyBatchDirectlyToInventory } from "@/features/legacy-migration/direct-import-service";
import { getLegacyMigrationBatchDetail, getLegacyMigrationOverview } from "@/features/legacy-migration/queries";
import { readLegacyStockStatus } from "@/features/legacy-migration/sync-policy";
import { parseLegacyProductWorkbook } from "@/features/legacy-migration/xlsx-parser";
import { claimProductItemsForSale } from "@/features/pos/inventory-sale-claim";
import type { AuthContext } from "@/lib/auth/session";

type Source = { barcode:string; name?:string; master?:string; masterName?:string; status?:string; price?:number; weight?:number };
const headers = ["No","Kode Produk","Kategori (*)","Kode Master Produk (*)","Nama Master Produk (*)","Nama Produk Per SKU (*)","Kadar Persen (*)","Kadar Tukaran (*)","Harga (*)","Potongan / Gram (*)","Berat / Gram (*)","Warna (*)","Foto (*)"];
function workbook(sources:Source[], withStatus=true) {
  const sheet=XLSX.utils.aoa_to_sheet([
    [...headers,...withStatus?["Status Stok Legacy"]:[]],
    ...sources.map((row,i)=>[i+1,row.barcode,"CINCIN",row.master??"CIN/01",row.masterName??"Cincin Nikah",row.name??`Cincin ${row.barcode}`,75,80,row.price??980000,25000,row.weight??2.1,"Kombinasi","https://legacy.example.test/photo.jpg",...withStatus?[row.status??"Stok Tersedia"]:[]]),
  ]);
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,sheet,"Produk");
  return parseLegacyProductWorkbook(Buffer.from(XLSX.write(book,{type:"buffer",bookType:"xlsx"})));
}
async function fixture():Promise<AuthContext> {
  const org=randomUUID(),outlet=randomUUID(),other=randomUUID(),user=randomUUID();
  await pool.query("insert into organizations(id,name,slug) values($1,'Legacy Sync Test',$2)",[org,`sync-${org}`]);
  await pool.query("insert into outlets(id,organization_id,code,name) values($1,$3,'BANTAR','Pasar Bantar Gebang'),($2,$3,'OTHER','Outlet Lain')",[outlet,other,org]);
  await pool.query("insert into users(id,organization_id,email,username,full_name) values($1,$2,$3,$4,'Import Test')",[user,org,`${user}@test.local`,user]);
  return {session:{id:randomUUID(),expiresAt:new Date(Date.now()+3600000)},organization:{id:org,name:"Legacy Sync Test",slug:`sync-${org}`,timezone:"Asia/Jakarta"},user:{id:user,email:`${user}@test.local`,username:user,fullName:"Import Test"},roles:[],permissionCodes:["migration.view","migration.import"],outlets:[{id:outlet,code:"BANTAR",name:"Pasar Bantar Gebang",isPrimary:true},{id:other,code:"OTHER",name:"Outlet Lain",isPrimary:false}]};
}
async function batch(auth:AuthContext,sources:Source[],options:{withStatus?:boolean;outletId?:string}={}) {
  const parsed=workbook(sources,options.withStatus??true);
  const batchId=randomUUID(),outletId=options.outletId??auth.outlets[0]!.id;
  await db.insert(legacyProductImportBatches).values({
    id:batchId,organizationId:auth.organization.id,outletId,uploadedBy:auth.user.id,
    fileName:"master_produk.xlsx",fileHash:createHash("sha256").update(batchId).digest("hex"),fileSizeBytes:1000,
    worksheetName:parsed.worksheetName,status:"processing",totalRows:parsed.summary.totalRows,validRows:parsed.summary.validRows,
    warningRows:parsed.summary.warningRows,invalidRows:parsed.summary.invalidRows,uniqueMasterCount:parsed.summary.uniqueMasterCount,
    duplicateBarcodeCount:parsed.summary.duplicateBarcodeCount,headers:parsed.headers,validationSummary:parsed.summary,
  });
  await db.insert(legacyProductRows).values(parsed.rows.map(row=>({
    ...row,id:randomUUID(),batchId,organizationId:auth.organization.id,outletId,
    legacyPurity:row.legacyPurity===null?null:String(row.legacyPurity),legacyExchangePurity:row.legacyExchangePurity===null?null:String(row.legacyExchangePurity),
    legacyPricePerGram:row.legacyPricePerGram===null?null:String(row.legacyPricePerGram),legacyDeductionPerGram:row.legacyDeductionPerGram===null?null:String(row.legacyDeductionPerGram),
    legacyWeightGram:row.legacyWeightGram===null?null:String(row.legacyWeightGram),
  })));
  return batchId;
}
async function sync(auth:AuthContext,sources:Source[],options:Parameters<typeof batch>[2]={}) {
  const batchId=await batch(auth,sources,options);
  return importLegacyBatchDirectlyToInventory({auth,batchId});
}
async function items(auth:AuthContext) { return db.select().from(productItems).where(eq(productItems.organizationId,auth.organization.id)); }
async function counts() {
  const {rows:[row]}=await pool.query<{items:number;sales:number;adjustments:number;opening:number;masters:number}>(`select
    (select count(*)::int from product_items) items,(select count(*)::int from sales) sales,
    (select count(*)::int from inventory_movements where movement_type='adjustment') adjustments,
    (select count(*)::int from inventory_movements where movement_type='migration_opening') opening,
    (select count(*)::int from product_masters) masters`);
  return row!;
}
const cases:Array<[string,()=>Promise<void>]> = [];
const test=(name:string,run:()=>Promise<void>)=>cases.push([name,run]);

test("old XLSX without status remains compatible; blank or conflicting status is held",async()=>{
  assert.equal(readLegacyStockStatus(workbook([{barcode:"000001"}],false).rows[0]!.rawData),"available");
  assert.equal(readLegacyStockStatus({"Status Stok Legacy":""}),"unknown");
  assert.equal(readLegacyStockStatus({Status:"Terjual","Status Stok Legacy":"Stok Tersedia"}),"unknown");
  const auth=await fixture();
  const result=await sync(auth,[{barcode:"000001",status:""},{barcode:"000002",status:"unexpected"},{barcode:"000003",status:"Stok Habis / Terjual"}]);
  assert.equal(result.deferredRowCount,2);assert.equal(result.soldItemCount,1);
  assert.equal((await items(auth))[0]!.availability,"sold");
});

test("first import follows available/sold statuses without fabricated sales or sold opening stock",async()=>{
  const auth=await fixture();
  const result=await sync(auth,[{barcode:"003037"},{barcode:"008888",status:"Stok Habis / Terjual"}]);
  assert.equal(result.importedItemCount,2);assert.equal(result.availableItemCount,1);assert.equal(result.soldItemCount,1);
  const rows=await items(auth);
  assert.equal(rows.find(row=>row.legacyId==="003037")!.availability,"available");
  assert.equal(rows.find(row=>row.legacyId==="008888")!.locationState,"customer");
  assert.deepEqual(await counts(),{items:2,sales:0,adjustments:0,opening:1,masters:1});
});

test("refreshed workbook skips previous imports, preserves identifiers, and adds new products only",async()=>{
  const auth=await fixture();
  const first=await sync(auth,[{barcode:"003037"}],{withStatus:false});
  const original=(await items(auth))[0]!;
  // Represent pre-sync versions: no sync result and legacy numeric IDs losing zeroes.
  await pool.query("update legacy_product_import_batches set validation_summary=jsonb_build_object('directImport',jsonb_build_object('importedItemCount',1)) where id=$1",[first.batchId]);
  await pool.query("update product_items set legacy_id='3037', display_name='Staff edited label' where id=$1",[original.id]);
  const next=await sync(auth,[{barcode:"003037",price:1050000},{barcode:"005555"}]);
  assert.equal(next.importedItemCount,1);assert.equal(next.existingItemCount,1);
  const rows=await items(auth);assert.equal(rows.length,2);
  const same=rows.find(row=>row.id===original.id)!;
  assert.equal(same.barcode,original.barcode);assert.equal(same.displayName,"Staff edited label");
  const retry=await importLegacyBatchDirectlyToInventory({auth,batchId:first.batchId});
  assert.equal(retry.importedItemCount,1);assert.equal((await items(auth)).length,2);
});

test("legacy sold updates untouched opening stock once; zero-create retries remain idempotent",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"003037"}]);
  const next=await sync(auth,[{barcode:"003037",status:"Stok Habis / Terjual"}]);
  assert.equal(next.importedItemCount,0);assert.equal(next.updatedStockCount,1);assert.equal(next.existingItemCount,1);
  const retry=await importLegacyBatchDirectlyToInventory({auth,batchId:next.batchId});
  assert.equal(retry.updatedStockCount,1);
  const again=await sync(auth,[{barcode:"003037",status:"Stok Habis / Terjual"}]);
  assert.equal(again.updatedStockCount,0);assert.equal(again.existingItemCount,1);
  assert.equal((await items(auth))[0]!.availability,"sold");
  assert.equal((await counts()).adjustments,1);assert.equal((await counts()).sales,0);
});

test("RMS sold items never reactivate from an available legacy row",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"003037"}]);
  const item=(await items(auth))[0]!;
  await db.transaction(async transaction=>{
    const claimed=await claimProductItemsForSale(transaction,{organizationId:auth.organization.id,outletId:auth.outlets[0]!.id,itemIds:[item.id]});
    assert.equal(claimed.allClaimed,true);
  });
  const next=await sync(auth,[{barcode:"003037"}]);
  assert.equal(next.importedItemCount,0);assert.equal(next.existingItemCount,1);
  assert.equal(next.rowOutcomes![0]!.reason,"status_preserved");
  assert.equal((await items(auth))[0]!.availability,"sold");
});

test("all duplicate barcode rows are held; other rows finish and deferred rows can be filtered",async()=>{
  const auth=await fixture();
  const result=await sync(auth,[{barcode:"017735"},{barcode:"017735",name:"Different ring"},{barcode:"002222"}]);
  assert.equal(result.importedItemCount,1);assert.equal(result.deferredRowCount,2);
  const detail=await getLegacyMigrationBatchDetail(auth,{batchId:result.batchId,page:1,status:"deferred",search:""});
  assert.equal(detail!.rows.length,2);assert(detail!.rows.every(row=>row.syncOutcome?.reason==="duplicate_barcode"));
  const overview=await getLegacyMigrationOverview(auth);assert.equal(overview.totals.importedRows,1);assert.equal(overview.totals.cleanupRows,2);
  const held=await sync(auth,[{barcode:"017735"},{barcode:"017735",name:"Different ring"}]);
  assert.equal(held.importedItemCount,0);assert.equal(held.deferredRowCount,2);
  await importLegacyBatchDirectlyToInventory({auth,batchId:held.batchId});
  assert.equal((await items(auth)).length,1);
});

test("same barcode with another identity or multiple existing candidates never creates another item",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"003037"},{barcode:"005555"}]);
  const changed=await sync(auth,[{barcode:"003037",name:"Different product"}]);
  assert.equal(changed.rowOutcomes![0]!.reason,"different_product");
  await pool.query("update product_items set legacy_id='003037' where legacy_id='005555'");
  const ambiguous=await sync(auth,[{barcode:"003037"}]);
  assert.equal(ambiguous.rowOutcomes![0]!.reason,"multiple_matches");assert.equal((await items(auth)).length,2);
});

test("organization/outlet boundaries and permission checks are enforced",async()=>{
  const auth=await fixture(),other=await fixture();
  await sync(other,[{barcode:"003037"}]);
  const first=await sync(auth,[{barcode:"003037"}]);assert.equal(first.importedItemCount,1);
  const cross=await sync(auth,[{barcode:"003037"}],{outletId:auth.outlets[1]!.id});
  assert.equal(cross.rowOutcomes![0]!.reason,"different_outlet");
  const denied=await batch(auth,[{barcode:"009999"}],{outletId:auth.outlets[1]!.id});
  await assert.rejects(()=>importLegacyBatchDirectlyToInventory({auth:{...auth,outlets:[auth.outlets[0]!]},batchId:denied}),/akses/);
  await assert.rejects(()=>importLegacyBatchDirectlyToInventory({auth:{...auth,permissionCodes:[]},batchId:first.batchId}),/Permission/);
  assert.equal((await items(auth)).length,1);
});

test("operational movements and reserved/inactive items are protected from legacy stock changes",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"000001"},{barcode:"000002"},{barcode:"000003"}]);
  const rows=await items(auth);
  await pool.query("insert into inventory_movements(organization_id,item_id,movement_type,performed_by,reason) values($1,$2,'adjustment',$3,'Operational adjustment')",[auth.organization.id,rows.find(row=>row.legacyId==="000001")!.id,auth.user.id]);
  await pool.query("update product_items set availability='reserved' where legacy_id='000002'");
  await pool.query("update product_items set is_active=false where legacy_id='000003'");
  const result=await sync(auth,["000001","000002","000003"].map(barcode=>({barcode,status:"Stok Habis / Terjual"})));
  assert.equal(result.deferredRowCount,3);assert.equal(result.updatedStockCount,0);
  assert.equal((await items(auth)).filter(row=>row.availability==="sold").length,0);
});

test("concurrent different files containing one SKU create one physical item",async()=>{
  const auth=await fixture();const a=await batch(auth,[{barcode:"003037"}]),b=await batch(auth,[{barcode:"003037"}]);
  const results=await Promise.all([a,b].map(batchId=>importLegacyBatchDirectlyToInventory({auth,batchId})));
  assert.equal(results.reduce((n,r)=>n+r.importedItemCount,0),1);assert.equal(results.reduce((n,r)=>n+(r.existingItemCount??0),0),1);
  assert.equal((await items(auth)).length,1);
});

test("concurrent POS claim and legacy sold synchronization cannot both claim available stock",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"003037"}]);const item=(await items(auth))[0]!;
  const batchId=await batch(auth,[{barcode:"003037",status:"Stok Habis / Terjual"}]);
  const [synced,claimed]=await Promise.all([
    importLegacyBatchDirectlyToInventory({auth,batchId}),
    db.transaction(tx=>claimProductItemsForSale(tx,{organizationId:auth.organization.id,outletId:auth.outlets[0]!.id,itemIds:[item.id]})),
  ]);
  assert.equal((synced.updatedStockCount??0)+(claimed.allClaimed?1:0),1);
  assert.equal((await items(auth))[0]!.availability,"sold");assert.equal((await items(auth)).length,1);
});

test("different master names sharing a legacy code stay separate and are reused on later imports",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"000001",masterName:"Cincin Nikah"},{barcode:"000002",masterName:"Cincin Cor"}]);
  let rows=await items(auth);assert.notEqual(rows[0]!.productMasterId,rows[1]!.productMasterId);
  await sync(auth,[{barcode:"000003",masterName:"Cincin Cor"}]);
  assert.equal((await counts()).masters,2);
  rows=await items(auth);assert.equal(rows.find(row=>row.legacyId==="000002")!.productMasterId,rows.find(row=>row.legacyId==="000003")!.productMasterId);
});

test("new item insert failure rolls back status updates and every row can be retried safely",async()=>{
  const auth=await fixture();await sync(auth,[{barcode:"003037"}]);
  const batchId=await batch(auth,[{barcode:"003037",status:"Stok Habis / Terjual"},{barcode:"005555",name:"FAIL_SYNC_TEST"}]);
  await pool.query(`create function reject_sync_test() returns trigger language plpgsql as $$ begin if new.display_name='FAIL_SYNC_TEST' then raise exception 'test rollback'; end if; return new; end $$;
    create trigger reject_sync_test before insert on product_items for each row execute function reject_sync_test()`);
  try { await assert.rejects(()=>importLegacyBatchDirectlyToInventory({auth,batchId}),/gagal/); }
  finally { await pool.query("drop trigger reject_sync_test on product_items; drop function reject_sync_test()"); }
  assert.equal((await items(auth))[0]!.availability,"available");assert.equal((await counts()).adjustments,0);
  const retry=await importLegacyBatchDirectlyToInventory({auth,batchId});
  assert.equal(retry.importedItemCount,1);assert.equal(retry.updatedStockCount,1);assert.equal((await items(auth)).length,2);
});

export async function runLegacyProductSyncSuite() {
  const {rows:[database]}=await pool.query<{name:string;version:string}>("select current_database() name,current_setting('server_version_num') version");
  assert.match(database!.name,/(?:^|[_-])(test|ci)(?:$|[_-])/i);assert(Number(database!.version)>=170000&&Number(database!.version)<180000);
  try {
    for (const [name,run] of cases) {
      const {rows}=await pool.query<{tablename:string}>("select tablename from pg_tables where schemaname='public'");
      await pool.query(`truncate table ${rows.map(row=>`"public"."${row.tablename.replaceAll('"','""')}"`).join(",")} restart identity cascade`);
      await run();console.log(`PASS ${name}`);
    }
    console.log(`Legacy Product Sync Integration Suite passed: ${cases.length}/${cases.length}`);
  } finally { await pool.end(); }
}
