import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool, db } from "@/db";
import { changeProductLifecycle, getProductLifecycleState } from "@/features/products/lifecycle-service";
import { getPosCatalogPage, lookupPosItemByScanValue } from "@/features/pos/queries";
import { claimProductItemsForSale } from "@/features/pos/inventory-sale-claim";
import type { AuthContext } from "@/lib/auth/session";
import { assertDisposablePostgres17, resetPublicTables, createBaseFixture, createItem } from "./legacy-barcode-pos-suite";

type Fixture = Awaited<ReturnType<typeof createBaseFixture>>;
function authFor(f:Fixture):AuthContext {
  return {session:{id:randomUUID(),expiresAt:new Date(Date.now()+3600000)},organization:{id:f.organizationId,name:"Lifecycle Test",slug:"lifecycle-test",timezone:"Asia/Jakarta"},user:{id:f.actorUserId,email:"lifecycle@test.local",username:"lifecycle",fullName:"Lifecycle Test"},roles:[],permissionCodes:["inventory.adjust","products.manage"],outlets:[{id:f.outletId,code:"A",name:"Outlet A",isPrimary:true}]};
}
async function row(id:string) { return (await pool.query("select * from product_items where id=$1",[id])).rows[0]; }
const cases:Array<[string,()=>Promise<void>]> = [];
const test=(name:string,run:()=>Promise<void>)=>cases.push([name,run]);

test("unused draft item is permanently deleted with aliases and an audit snapshot",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{availability:"draft"});
  assert.equal((await getProductLifecycleState(auth,"item",item.id)).operation,"delete");
  await changeProductLifecycle({auth,entity:"item",id:item.id,operation:"delete"});
  assert.equal(await row(item.id),undefined);
  assert.equal((await pool.query("select count(*)::int count from item_barcodes where item_id=$1",[item.id])).rows[0].count,0);
  const audit=(await pool.query("select before_data from audit_logs where entity_id=$1 and action='product_item.delete'",[item.id])).rows[0];
  assert.equal(audit.before_data.sku,item.sku);
});

test("available stock is archived and restored without changing identifiers or its stock status",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{legacyBarcode:"003037"});
  assert.equal((await getProductLifecycleState(auth,"item",item.id)).operation,"archive");
  await changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"});
  assert.equal((await row(item.id)).is_active,false);
  assert.equal((await getPosCatalogPage({organizationId:f.organizationId,outletId:f.outletId,searchQuery:"003037"})).items.length,0);
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"}),/berubah/);
  await changeProductLifecycle({auth,entity:"item",id:item.id,operation:"restore"});
  const restored=await row(item.id);assert.equal(restored.barcode,item.internalBarcode);assert.equal(restored.availability,"available");
  assert.equal((await getPosCatalogPage({organizationId:f.organizationId,outletId:f.outletId,searchQuery:"003037"})).items.length,1);
  assert.equal((await pool.query("select count(*)::int count from inventory_movements where item_id=$1 and reference_type='product_item_lifecycle'",[item.id])).rows[0].count,2);
});

test("sold products retain their sold state and history after archive/restore",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{legacyBarcode:"008888",availability:"sold",locationState:"customer"});
  await changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"});
  await changeProductLifecycle({auth,entity:"item",id:item.id,operation:"restore"});
  const restored=await row(item.id);assert.equal(restored.availability,"sold");assert.equal(restored.location_state,"customer");
  assert.equal((await lookupPosItemByScanValue({organizationId:f.organizationId,outletId:f.outletId,scanValue:"008888"})).status,"unavailable");
  assert.equal((await pool.query("select count(*)::int count from sales")).rows[0].count,0);
});

test("any stock movement prevents permanent item deletion even when still draft",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{availability:"draft"});
  await pool.query("insert into inventory_movements(organization_id,item_id,movement_type,performed_by) values($1,$2,'goods_receipt',$3)",[f.organizationId,item.id,f.actorUserId]);
  assert.equal((await getProductLifecycleState(auth,"item",item.id)).operation,"archive");
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"delete"}),/berubah/);
  assert(await row(item.id));
});

test("special stock states and active held carts block archive and restore",async()=>{
  const f=await createBaseFixture(),auth=authFor(f);
  for(const availability of ["reserved","processing","inspection","migration_hold"] as const) {
    const item=await createItem(f,{availability});
    assert((await getProductLifecycleState(auth,"item",item.id)).blockedReason);
    await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"}),/proses/);
  }
  const inTransit=await createItem(f,{locationState:"in_transit"});
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:inTransit.id,operation:"archive"}),/pengiriman/);
  const item=await createItem(f,{}),cart=randomUUID();
  await pool.query("insert into pos_held_carts(id,organization_id,outlet_id,register_id,shift_id,held_by_user_id,hold_number) values($1,$2,$3,$4,$5,$6,$7)",[cart,f.organizationId,f.outletId,f.registerId,f.shiftId,f.actorUserId,cart]);
  await pool.query("insert into pos_held_cart_items(held_cart_id,product_item_id,line_number,list_price_amount,final_price_amount,snapshot) values($1,$2,1,100,100,'{}')",[cart,item.id]);
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"}),/keranjang/);
  await pool.query("update pos_held_cart_items set is_active=false where product_item_id=$1",[item.id]);
  assert.equal((await getProductLifecycleState(auth,"item",item.id)).blockedReason,null);
});

test("organization, outlet, permission and runtime entity checks apply to every mutation",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{outletId:f.otherOutletId});
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"}),/outlet/);
  const other=await createBaseFixture();
  await assert.rejects(()=>changeProductLifecycle({auth:authFor(other),entity:"item",id:item.id,operation:"archive"}),/ditemukan/);
  await assert.rejects(()=>changeProductLifecycle({auth:{...auth,permissionCodes:["inventory.view"]},entity:"item",id:item.id,operation:"archive"}),/izin/);
  await assert.rejects(()=>changeProductLifecycle({auth:{...auth,permissionCodes:["inventory.adjust"]},entity:"master",id:f.masterId,operation:"delete"}),/izin/);
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"invalid" as "item",id:f.masterId,operation:"delete"}),/Jenis/);
  assert.equal((await row(item.id)).is_active,true);
});

test("empty unused masters can be deleted, but masters with operational items are blocked",async()=>{
  const f=await createBaseFixture(),auth=authFor(f);
  await changeProductLifecycle({auth,entity:"master",id:f.inactiveCategoryMasterId,operation:"delete"});
  assert.equal((await pool.query("select count(*)::int count from product_masters where id=$1",[f.inactiveCategoryMasterId])).rows[0].count,0);
  const item=await createItem(f,{});
  assert((await getProductLifecycleState(auth,"master",f.masterId)).blockedReason);
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"master",id:f.masterId,operation:"archive"}),/operasional/);
  await changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"});
  await changeProductLifecycle({auth,entity:"master",id:f.masterId,operation:"archive"});
  assert.equal((await pool.query("select status from product_masters where id=$1",[f.masterId])).rows[0].status,"inactive");
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"restore"}),/master/);
  await changeProductLifecycle({auth,entity:"master",id:f.masterId,operation:"restore"});
  assert.equal((await pool.query("select status from product_masters where id=$1",[f.masterId])).rows[0].status,"active");
  assert.equal((await row(item.id)).is_active,false);
});

test("restoring an active master requires its category to remain active",async()=>{
  const f=await createBaseFixture(),auth=authFor(f);await createItem(f,{availability:"sold",locationState:"customer"});
  await changeProductLifecycle({auth,entity:"master",id:f.masterId,operation:"archive"});
  await pool.query("update product_categories set is_active=false where id=$1",[f.categoryId]);
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"master",id:f.masterId,operation:"restore"}),/kategori/);
});

test("concurrent duplicate archive requests commit one adjustment and one audit",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{});
  const results=await Promise.allSettled([1,2].map(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"})));
  assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
  assert.equal((await pool.query("select count(*)::int count from audit_logs where entity_id=$1 and action='product_item.archive'",[item.id])).rows[0].count,1);
});

test("POS checkout racing with archive never reactivates stock or loses a sale claim",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{});
  const [,claim]=await Promise.all([
    changeProductLifecycle({auth,entity:"item",id:item.id,operation:"archive"}),
    db.transaction(transaction=>claimProductItemsForSale(transaction,{organizationId:f.organizationId,outletId:f.outletId,itemIds:[item.id]})),
  ]);
  const current=await row(item.id);assert.equal(current.is_active,false);
  assert.equal(current.availability,claim.allClaimed?"sold":"available");
});

test("a stale delete confirmation cannot delete a product after it gains history",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{availability:"draft"});
  const preview=await getProductLifecycleState(auth,"item",item.id);assert.equal(preview.operation,"delete");
  await pool.query("insert into inventory_movements(organization_id,item_id,movement_type,performed_by) values($1,$2,'adjustment',$3)",[f.organizationId,item.id,f.actorUserId]);
  await assert.rejects(()=>changeProductLifecycle({auth,entity:"item",id:item.id,operation:preview.operation}),/berubah/);
});

test("import provenance is retained even after staging references have been cleaned",async()=>{
  const f=await createBaseFixture(),auth=authFor(f),item=await createItem(f,{availability:"draft"});
  await pool.query("update product_items set attributes=$2::jsonb where id=$1",[item.id,JSON.stringify({productBatchImport:{sessionId:randomUUID()}})]);
  assert.equal((await getProductLifecycleState(auth,"item",item.id)).operation,"archive");
  await pool.query("update product_masters set attributes=$2::jsonb where id=$1",[f.inactiveCategoryMasterId,JSON.stringify({productBatchImport:{sessionId:randomUUID()}})]);
  assert.equal((await getProductLifecycleState(auth,"master",f.inactiveCategoryMasterId)).operation,"archive");
});

export async function runProductLifecycleSuite() {
  await assertDisposablePostgres17();
  try {
    for(const [name,run] of cases) { await resetPublicTables();await run();console.log(`PASS ${name}`); }
    console.log(`Product Lifecycle Integration Suite passed: ${cases.length}/${cases.length}`);
  } finally {await pool.end();}
}
