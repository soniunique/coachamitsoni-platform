import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
async function hmacSha256(message:string,secret:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message));return Array.from(new Uint8Array(signature)).map(b=>b.toString(16).padStart(2,"0")).join("");}
async function ensureUser(supabase:ReturnType<typeof createClient>,email:string,fullName:string){
  const {data:userId,error:lookupError}=await supabase.rpc("get_user_id_by_email",{p_email:email});
  if(lookupError)throw new Error(lookupError.message);
  if(userId){const {data,error}=await supabase.auth.admin.getUserById(userId);if(error||!data.user)throw new Error(error?.message||"Unable to load the customer account.");return {user:data.user,created:false};}
  const {data:created,error:createError}=await supabase.auth.admin.createUser({email,password:`${crypto.randomUUID()}Aa1!${crypto.randomUUID()}`,email_confirm:true,user_metadata:{full_name:fullName}});
  if(createError)throw new Error(createError.message);
  if(!created.user)throw new Error("Unable to create the customer account.");
  return {user:created.user,created:true};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const {program_id,razorpay_order_id,razorpay_payment_id,razorpay_signature}=await req.json();
    if(!program_id||!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return json({error:"Incomplete payment response."},400);
    const supabaseUrl=Deno.env.get("SUPABASE_URL")!,razorpaySecret=Deno.env.get("RAZORPAY_KEY_SECRET"),keyId=Deno.env.get("RAZORPAY_KEY_ID");
    if(!razorpaySecret||!keyId)return json({error:"Payment service is not configured."},500);
    const supabase=createClient(supabaseUrl,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:order,error:orderError}=await supabase.from("program_orders").select("id,user_id,program_id,amount_inr,currency,status,provider_order_id,metadata").eq("provider_order_id",razorpay_order_id).eq("program_id",program_id).maybeSingle();
    if(orderError||!order)return json({error:"Payment order not found."},404);
    if(order.status==="paid"&&order.user_id)return json({success:true,enrolled:true,alreadyProcessed:true,program_id:order.program_id,account_created:false});
    const expected=await hmacSha256(`${razorpay_order_id}|${razorpay_payment_id}`,razorpaySecret);
    if(expected!==razorpay_signature)return json({error:"Payment verification failed."},400);
    const paymentResponse=await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,{headers:{Authorization:`Basic ${btoa(`${keyId}:${razorpaySecret}`)}}});
    if(!paymentResponse.ok)return json({error:"Unable to confirm payment status with Razorpay."},502);
    const payment=await paymentResponse.json();
    if(payment.order_id!==razorpay_order_id||payment.currency!=="INR"||Number(payment.amount)!==Number(order.amount_inr)*100||payment.status!=="captured")return json({error:"Payment is not in a capturable state."},400);
    const metadata=(order.metadata??{}) as Record<string,unknown>;
    const guestEmail=typeof metadata.guest_email==="string"?metadata.guest_email.trim().toLowerCase():"";
    const guestName=typeof metadata.guest_name==="string"?metadata.guest_name.trim():"Customer";
    if(!order.user_id&&!guestEmail)return json({error:"Payment order is missing customer email."},500);
    let userId=order.user_id as string|null,accountCreated=false;
    if(!userId){const ensured=await ensureUser(supabase,guestEmail,guestName);userId=ensured.user.id;accountCreated=ensured.created;await supabase.from("profiles").upsert({id:userId,full_name:guestName},{onConflict:"id"});}
    const now=new Date().toISOString();
    const {error:paidError}=await supabase.from("program_orders").update({user_id:userId,status:"paid",provider_payment_id:razorpay_payment_id,paid_at:now}).eq("id",order.id);
    if(paidError)return json({error:paidError.message},500);
    const {data:existingEnrollment,error:enrollmentLookupError}=await supabase.from("program_enrollments").select("id,status").eq("user_id",userId).eq("program_id",order.program_id).maybeSingle();
    if(enrollmentLookupError)return json({error:enrollmentLookupError.message},500);
    if(!existingEnrollment){const {error:enrollmentInsertError}=await supabase.from("program_enrollments").insert({user_id:userId,program_id:order.program_id,status:"active",enrolled_at:now});if(enrollmentInsertError)return json({error:enrollmentInsertError.message},500);}else if(existingEnrollment.status==="cancelled"){const {error:enrollmentUpdateError}=await supabase.from("program_enrollments").update({status:"active",enrolled_at:now,completed_at:null}).eq("id",existingEnrollment.id);if(enrollmentUpdateError)return json({error:enrollmentUpdateError.message},500);}
    return json({success:true,enrolled:true,program_id:order.program_id,account_created:accountCreated});
  }catch(error){console.error("verify-program-payment error",error);return json({error:error instanceof Error?error.message:"Unexpected payment verification error."},500);}
});
