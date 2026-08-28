import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LearnShell, SectionHeader } from "@/components/learn/LearnShell";
import { supabase } from "@/integrations/supabase/client";

type Course={id:string;title:string;slug:string;program_id:string};
type Module={id:string};
type Lesson={id:string};
type Student={id:string;email:string;full_name:string};
type Progress={user_id:string;lesson_id:string;completed:boolean};

type Row=Student & {completed:number;total:number;percent:number};

export const Route=createFileRoute("/learn/manage/course-students/$courseId")({component:CourseStudents});

function CourseStudents(){
 const {courseId}=Route.useParams();
 const [loading,setLoading]=useState(true),[course,setCourse]=useState<Course|null>(null),[rows,setRows]=useState<Row[]>([]),[error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setError("You are not signed in.");setLoading(false);return}
  const {data:profile,error:pe}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(pe||profile?.role!=="admin"){setError(pe?.message||"Only admins can view student progress.");setLoading(false);return}
  const {data:c,error:ce}=await supabase.from("courses").select("id,title,slug,program_id").eq("id",courseId).maybeSingle();
  if(ce||!c){setError(ce?.message||"Course not found.");setLoading(false);return}
  setCourse(c as Course);
  const {data:ms,error:me}=await supabase.from("course_modules").select("id").eq("course_id",courseId);
  if(me){setError(me.message);setLoading(false);return}
  const moduleIds=((ms||[]) as Module[]).map(m=>m.id);
  let lessons:Lesson[]=[];
  if(moduleIds.length){const {data:ls,error:le}=await supabase.from("course_lessons").select("id").in("module_id",moduleIds);if(le){setError(le.message);setLoading(false);return}lessons=(ls||[]) as Lesson[];}
  const {data:students,error:se}=await supabase.rpc("admin_list_students");
  if(se){setError(se.message);setLoading(false);return}
  const {data:enrolled,error:ee}=await supabase.from("program_enrollments").select("user_id").eq("program_id",c.program_id).in("status",["active","completed"]);
  if(ee){setError(ee.message);setLoading(false);return}
  const enrolledIds=new Set((enrolled||[]).map(x=>x.user_id));
  const studentList=((students||[]) as Student[]).filter(s=>enrolledIds.has(s.id));
  const {data:progress,error:pr}=lessons.length?await supabase.from("lesson_progress").select("user_id,lesson_id,completed").in("lesson_id",lessons.map(l=>l.id)).in("user_id",studentList.map(s=>s.id)): {data:[],error:null};
  if(pr){setError(pr.message);setLoading(false);return}
  const progressList=(progress||[]) as Progress[];
  const total=lessons.length;
  setRows(studentList.map(s=>{const completed=new Set(progressList.filter(p=>p.user_id===s.id&&p.completed).map(p=>p.lesson_id)).size;return {...s,completed,total,percent:total?Math.round((completed/total)*100):0};}).sort((a,b)=>b.percent-a.percent||a.full_name.localeCompare(b.full_name)));
  setLoading(false);
 }
 useEffect(()=>{void load()},[courseId]);
 const average=useMemo(()=>rows.length?Math.round(rows.reduce((sum,r)=>sum+r.percent,0)/rows.length):0,[rows]);
 if(loading)return <LearnShell><div className="learn-card p-6 text-slate-400"><Loader2 className="mr-2 inline animate-spin" size={18}/>Loading student progress...</div></LearnShell>;
 return <LearnShell>
  <div className="mb-6"><Link to="/learn/manage/courses" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/>Back to Programs & Courses</Link></div>
  <SectionHeader eyebrow="Admin · Student progress" title={course?.title||"Course"} description="See how far each enrolled student has progressed through this course." action={<Link to="/learn/manage/course-content/$courseId" params={{courseId}} className="learn-secondary-button">Manage content</Link>}/>
  {error&&<div className="learn-card mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
  <div className="mb-6 grid gap-4 md:grid-cols-3">
   <div className="learn-card p-5"><div className="flex items-center gap-3 text-slate-400"><Users size={18}/><span className="text-sm">Enrolled students</span></div><div className="mt-3 text-3xl font-bold">{rows.length}</div></div>
   <div className="learn-card p-5"><div className="flex items-center gap-3 text-slate-400"><BarChart3 size={18}/><span className="text-sm">Average completion</span></div><div className="mt-3 text-3xl font-bold">{average}%</div></div>
   <div className="learn-card p-5"><div className="flex items-center gap-3 text-slate-400"><CheckCircle2 size={18}/><span className="text-sm">Completed</span></div><div className="mt-3 text-3xl font-bold">{rows.filter(r=>r.percent===100).length}</div></div>
  </div>
  <div className="learn-card overflow-hidden">
   <div className="border-b border-white/10 p-5"><h2 className="text-lg font-bold">Student completion</h2><p className="mt-1 text-sm text-slate-500">Completion is calculated from completed lessons ÷ total lessons in this course.</p></div>
   {rows.length===0?<div className="p-8 text-center text-sm text-slate-500">No students are currently enrolled in this course's program.</div>:<div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-[.12em] text-slate-500"><th className="px-5 py-4">Student</th><th className="px-5 py-4">Lessons completed</th><th className="px-5 py-4">Completion</th><th className="px-5 py-4">Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b border-white/6 last:border-0"><td className="px-5 py-4"><div className="font-semibold text-slate-200">{row.full_name||"Unnamed student"}</div><div className="mt-1 text-xs text-slate-500">{row.email}</div></td><td className="px-5 py-4 text-slate-300">{row.completed} / {row.total}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-2 w-40 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{width:`${row.percent}%`}}/></div><span className="font-semibold">{row.percent}%</span></div></td><td className="px-5 py-4">{row.percent===100?<span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 size={15}/>Completed</span>:<span className="text-slate-400">In progress</span>}</td></tr>)}</tbody></table></div>}
  </div>
 </LearnShell>;
}
