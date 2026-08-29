import { supabase } from "@/integrations/supabase/client";
export async function sendLearningEmail(to:string,subject:string,html:string){const{data,error}=await supabase.functions.invoke("send-learning-email",{body:{to,subject,html}});if(error)throw error;return data as {ok?:boolean;configured?:boolean;message?:string};}
