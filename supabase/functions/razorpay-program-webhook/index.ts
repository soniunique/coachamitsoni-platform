import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendProgramPaymentConfirmation } from "../_shared/send-program-payment-email.ts";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, x-razorpay-signature, x-razorpay-event-id","Access-Control-Allow-Methods":"POST, OPTIONS"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
async function hmacSha256(message:string,secret:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message));return Array.from(new Uint8Array(signature)).map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function randomPassword(){return `${crypto.randomUUID()}Aa1!`;}
async function findUserByEmail(supabase:ReturnType<typeof createClient>,email:string){const {data,error}=await supabase.auth.admin.listUsers({page:1,perPage:1000});if(error)throw new Error(error.message);const normalizedEmail=email.trim().toLowerCase();return data.users.find(user=>user.email?.trim().toLowerCase()===normalizedEmail)??null;}
async function ensureUser(supabase:ReturnType<typeof createClient>,email:string,fullName:string){const existing=await findUserByEmail(supabase,email);if(existing)return {user:existing,created:false};const {data:created,error:createError}=await supabase.auth.admin.createUser({email,password:randomPassword(),email_confirm:true,user_metadata:{full_name:fullName}});if(createError){const retry=await findUserByEmail(supabase,email);if(retry)return {user:retry,created:false};throw new Error(createError.message);}return {user:created.user,created:true};}

async function syncRefund(supabase:ReturnType<typeof createClient>,order:{id:string;user_id:string|null;program_id:string;amount_inr:number;currency:string;status:string;provider_payment_id:string|null},refundEntity:any,eventType:string){
  const refundId=typeof refundEntity?.id==="string"?refundEntity.id:"";
  const paymentId=typeof refundEntity?.payment_id==="string"?refundEntity.payment_id:"";
  const amount=Number(refundEntity?.amount);
  if(!refundId||paymentId!==order.provider_payment_id||!Number.isFinite(amount)||amount<=0||refundEntity?.currency&&refundEntity.currency!==order.currency){throw new Error("Refund payload did not match the stored payment order.");}
  const status=eventType==="refund.processed"?"processed":eventType==="refund.failed"?"failed":refundEntity?.status==="processed"?"processed":refundEntity?.status==="failed"?"failed":"pending";
  const {data:enrollment}=order.user_id?await supabase.from("program_enrollments").select("id,status").eq("user_id",order.user_id).eq("program_id",order.program_id).maybeSingle():{data:null};
  const {error:upsertError}=await supabase.from("program_refunds").upsert({program_order_id:order.id,enrollment_id:enrollment?.id??null,razorpay_payment_id:paymentId,razorpay_refund_id:refundId,amount_inr:Math.round(amount/100),currency:order.currency||"INR",status,speed_requested:refundEntity?.speed_requested??null,speed_processed:refundEntity?.speed_processed??null,processed_at:status==="processed"?new Date().toISOString():null,failure_reason:status==="failed"?(refundEntity?.error_description??refundEntity?.error_reason??"Refund failed"):null},{onConflict:"razorpay_refund_id"});
  if(upsertError)throw new Error(upsertError.message);
  const {data:refunds,error:sumError}=await supabase.from("program_refunds").select("amount_inr,status").eq("program_order_id",order.id);if(sumError)throw new Error(sumError.message);
  const processed= (refunds??[]).filter(r=>r.status==="processed").reduce((sum,r)=>sum+Number(r.amount_inr||0),0);
  const pending=(refunds??[]).filter(r=>r.status==="pending").reduce((sum,r)=>sum+Number(r.amount_inr||0),0);
  const fullyRefunded=processed>=Number(order.amount_inr);
  const refundPending=!fullyRefunded&&processed+pending>=Number(order.amount_inr);
  if(fullyRefunded){await supabase.from("program_orders").update({status:"refunded"}).eq("id",order.id);if(enrollment?.id)await supabase.from("program_enrollments").update({status:"refunded"}).eq("id",enrollment.id);}
  else if(refundPending){await supabase.from("program_orders").update({status:"refund_pending"}).eq("id",order.id).in("status",["paid","refund_pending"]);if(enrollment?.id)await supabase.from("program_enrollments").update({status:"refund_pending"}).eq("id",enrollment.id).in("status",["active","completed","refund_pending"]);}
  else if(eventType==="refund.failed"&&pending===0){await supabase.from("program_orders").update({status:"paid"}).eq("id",order.id).in("status",["paid","refund_pending"]);if(enrollment?.id)await supabase.from("program_enrollments").update({status:"active"}).eq("id",enrollment.id).eq("status","refund_pending");}
  return {refundId,status,processed,refundPending,fullyRefunded};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const webhookSecret=Deno.env.get("RAZORPAY_WEBHOOK_SECRET");if(!webhookSecret)return json({error:"Webhook service is not configured."},500);
  const signature=req.headers.get("X-Razorpay-Signature");const eventId=req.headers.get("X-Razorpay-Event-Id");if(!signature||!eventId)return json({error:"Missing Razorpay webhook signature or event id."},400);
  const rawBody=await req.text();if(await hmacSha256(rawBody,webhookSecret)!==signature)return json({error:"Invalid webhook signature."},401);
  try{
    const payload=JSON.parse(rawBody);const eventType=typeof payload?.event==="string"?payload.event:"";const orderEntity=payload?.payload?.order?.entity;const paymentEntity=payload?.payload?.payment?.entity;const refundEntity=payload?.payload?.refund?.entity;const providerOrderId=orderEntity?.id??paymentEntity?.order_id??null;
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {error:eventInsertError}=await supabase.from("razorpay_webhook_events").insert({event_id:eventId,event_type:eventType||"unknown",provider_order_id:providerOrderId});
    if(eventInsertError&&eventInsertError.code!=="23505"){console.error("webhook event insert error",eventInsertError);return json({error:"Unable to record webhook event."},500);}
    if(eventInsertError?.code==="23505"){const {data:existingEvent}=await supabase.from("razorpay_webhook_events").select("status").eq("event_id",eventId).maybeSingle();if(existingEvent?.status==="processed")return json({received:true,duplicate:true});}
    const {data:order,error:orderError}=await supabase.from("program_orders").select("id,user_id,program_id,amount_inr,currency,status,provider_order_id,provider_payment_id,metadata").eq("provider","razorpay").eq("provider_order_id",providerOrderId??"").maybeSingle();
    if(orderError){await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:orderError.message}).eq("event_id",eventId);return json({error:"Unable to locate payment order."},500);}
    if(!order){await supabase.from("razorpay_webhook_events").update({status:"ignored",processed_at:new Date().toISOString()}).eq("event_id",eventId);return json({received:true,ignored:true});}
    if(eventType==="refund.created"||eventType==="refund.processed"||eventType==="refund.failed"){
      const result=await syncRefund(supabase,order,refundEntity,eventType);
      await supabase.from("razorpay_webhook_events").update({status:"processed",processed_at:new Date().toISOString(),error_message:null}).eq("event_id",eventId);
      return json({received:true,processed:true,refund_id:result.refundId,refund_status:result.status});
    }
    if(eventType==="payment.failed"){
      await supabase.from("program_orders").update({status:"failed"}).eq("id",order.id).in("status",["created","failed"]);
      await supabase.from("razorpay_webhook_events").update({status:"processed",processed_at:new Date().toISOString()}).eq("event_id",eventId);return json({received:true,processed:true});
    }
    if(eventType!=="order.paid"&&eventType!=="payment.captured"){
      await supabase.from("razorpay_webhook_events").update({status:"ignored",processed_at:new Date().toISOString()}).eq("event_id",eventId);return json({received:true,ignored:true});
    }
    const paymentId=paymentEntity?.id;const paymentOrderId=paymentEntity?.order_id;const paymentAmount=Number(paymentEntity?.amount);const paymentCurrency=paymentEntity?.currency;const paymentStatus=paymentEntity?.status;
    if(!paymentId||paymentOrderId!==order.provider_order_id||paymentCurrency!=="INR"||paymentAmount!==Number(order.amount_inr)*100||(paymentStatus!=="captured"&&paymentStatus!==undefined)){await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:"Payment payload did not match the stored order."}).eq("event_id",eventId);return json({error:"Payment payload did not match the stored order."},400);}
    const metadata=(order.metadata??{}) as Record<string,unknown>;const guestEmail=typeof metadata.guest_email==="string"?metadata.guest_email.trim().toLowerCase():"";const guestName=typeof metadata.guest_name==="string"?metadata.guest_name.trim():"Customer";let userId=order.user_id as string|null;
    if(!userId){if(!guestEmail)throw new Error("Payment order is missing customer email.");const ensured=await ensureUser(supabase,guestEmail,guestName);userId=ensured.user.id;const {error:profileError}=await supabase.from("profiles").upsert({id:userId,full_name:guestName},{onConflict:"id"});if(profileError)throw new Error(profileError.message);}
    const now=new Date().toISOString();const {error:paidError}=await supabase.from("program_orders").update({user_id:userId,status:"paid",provider_payment_id:paymentId,paid_at:now}).eq("id",order.id).neq("status","refunded");if(paidError){await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:paidError.message}).eq("event_id",eventId);return json({error:"Unable to mark payment as paid."},500);}
    const {data:existingEnrollment,error:enrollmentLookupError}=await supabase.from("program_enrollments").select("id,status").eq("user_id",userId).eq("program_id",order.program_id).maybeSingle();if(enrollmentLookupError){await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:enrollmentLookupError.message}).eq("event_id",eventId);return json({error:"Unable to check program enrollment."},500);}
    if(!existingEnrollment){const {error:enrollmentInsertError}=await supabase.from("program_enrollments").insert({user_id:userId,program_id:order.program_id,status:"active",enrolled_at:now});if(enrollmentInsertError){await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:enrollmentInsertError.message}).eq("event_id",eventId);return json({error:"Payment recorded, but enrollment could not be created yet."},500);}}
    else if(existingEnrollment.status==="cancelled"||existingEnrollment.status==="refunded"){const {error:enrollmentUpdateError}=await supabase.from("program_enrollments").update({status:"active",enrolled_at:now,completed_at:null}).eq("id",existingEnrollment.id);if(enrollmentUpdateError){await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:enrollmentUpdateError.message}).eq("event_id",eventId);return json({error:"Payment recorded, but enrollment could not be restored yet."},500);}}
    const {data:program}=await supabase.from("programs").select("title").eq("id",order.program_id).maybeSingle();const emailResult=await sendProgramPaymentConfirmation(supabase,order,program?.title??"your program",paymentId);
    if(!emailResult.sent&&!emailResult.alreadySent){const message="Payment and enrollment were completed, but the confirmation email could not be sent yet.";await supabase.from("razorpay_webhook_events").update({status:"failed",error_message:emailResult.error??message}).eq("event_id",eventId);return json({error:message},500);}
    await supabase.from("razorpay_webhook_events").update({status:"processed",processed_at:now,error_message:null}).eq("event_id",eventId);return json({received:true,processed:true,program_id:order.program_id,email_sent:true});
  }catch(error){console.error("razorpay-program-webhook error",error);return json({error:error instanceof Error?error.message:"Unexpected webhook error."},500);}
});
