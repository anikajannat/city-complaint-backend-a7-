import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { Role, ComplaintStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import SSLCommerzPayment from "sslcommerz-lts";
import { auth, roles, prisma, ok, signToken, AuthedRequest } from "./lib";

const app = express();
app.use(helmet());
app.use(cors({origin: process.env.FRONTEND_URL?.split(",") || true, credentials:true}));
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(rateLimit({windowMs:15*60*1000, limit:300}));

app.get("/", (_req,res)=>ok(res,{version:"2.0.0"},"City Complaint API is running"));
app.get("/health", (_req,res)=>ok(res,{status:"healthy",time:new Date().toISOString()}));

const router = express.Router();

router.post("/auth/register", async (req,res,next)=>{ try {
  const body=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(6),phone:z.string().optional(),address:z.string().optional()}).parse(req.body);
  if(await prisma.user.findUnique({where:{email:body.email}})) return res.status(409).json({success:false,message:"Email already exists"});
  const user=await prisma.user.create({data:{...body,password:await bcrypt.hash(body.password,12)}});
  return ok(res,{token:signToken(user),user:{id:user.id,name:user.name,email:user.email,role:user.role}},"Registered");
}catch(e){next(e)}});

router.post("/auth/login", async(req,res,next)=>{try{
  const body=z.object({email:z.string().email(),password:z.string().min(1)}).parse(req.body);
  const user=await prisma.user.findUnique({where:{email:body.email}});
  if(!user || !user.isActive || !(await bcrypt.compare(body.password,user.password))) return res.status(401).json({success:false,message:"Invalid credentials"});
  return ok(res,{token:signToken(user),user:{id:user.id,name:user.name,email:user.email,role:user.role}},"Logged in");
}catch(e){next(e)}});

router.get("/auth/me",auth,async(req:AuthedRequest,res)=> {
  const user=await prisma.user.findUnique({where:{id:req.user!.id},select:{id:true,name:true,email:true,role:true,phone:true,address:true,createdAt:true}});
  ok(res,user);
});

router.get("/categories",async(_req,res)=>ok(res,await prisma.category.findMany({where:{isActive:true},orderBy:{name:"asc"}})));
router.post("/categories",auth,roles(Role.ADMIN),async(req,res,next)=>{try{
  const body=z.object({name:z.string().min(2),description:z.string().optional()}).parse(req.body);
  ok(res,await prisma.category.create({data:body}),"Category created");
}catch(e){next(e)}});

router.get("/complaints",auth,async(req:AuthedRequest,res)=>{
  const page=Math.max(1,Number(req.query.page)||1), limit=Math.min(50,Math.max(1,Number(req.query.limit)||10));
  const status=req.query.status as ComplaintStatus|undefined;
  const search=String(req.query.search||"").trim();
  const where:any={};
  if(req.user!.role===Role.CITIZEN) where.citizenId=req.user!.id;
  if(req.user!.role===Role.STAFF) where.assignedToId=req.user!.id;
  if(status) where.status=status;
  if(search) where.OR=[{title:{contains:search,mode:"insensitive"}},{location:{contains:search,mode:"insensitive"}}];
  const [items,total]=await Promise.all([
    prisma.complaint.findMany({where,include:{category:true,citizen:{select:{id:true,name:true,email:true}},assignedTo:{select:{id:true,name:true,email:true}},feedback:true,payments:true},orderBy:{createdAt:"desc"},skip:(page-1)*limit,take:limit}),
    prisma.complaint.count({where})
  ]);
  ok(res,{items,total,page,limit,totalPages:Math.ceil(total/limit)});
});

router.get("/complaints/:id",auth,async(req:AuthedRequest,res)=>{
  const item=await prisma.complaint.findUnique({where:{id:req.params.id},include:{category:true,citizen:{select:{id:true,name:true,email:true}},assignedTo:{select:{id:true,name:true,email:true}},feedback:true,payments:true}});
  if(!item) return res.status(404).json({success:false,message:"Complaint not found"});
  if(req.user!.role===Role.CITIZEN && item.citizenId!==req.user!.id) return res.status(403).json({success:false,message:"Forbidden"});
  if(req.user!.role===Role.STAFF && item.assignedToId!==req.user!.id) return res.status(403).json({success:false,message:"Forbidden"});
  ok(res,item);
});

router.post("/complaints",auth,roles(Role.CITIZEN),async(req:AuthedRequest,res,next)=>{try{
  const body=z.object({title:z.string().min(5),description:z.string().min(20),location:z.string().min(3),categoryId:z.string().min(1),attachmentUrl:z.string().url().optional().or(z.literal(""))}).parse(req.body);
  ok(res,await prisma.complaint.create({data:{...body,attachmentUrl:body.attachmentUrl||null,citizenId:req.user!.id}}),"Complaint submitted");
}catch(e){next(e)}});

router.patch("/complaints/:id/assign",auth,roles(Role.ADMIN),async(req,res,next)=>{try{
  const body=z.object({staffId:z.string().min(1),serviceFee:z.coerce.number().min(0).default(0)}).parse(req.body);
  const staff=await prisma.user.findFirst({where:{id:body.staffId,role:Role.STAFF,isActive:true}});
  if(!staff) return res.status(400).json({success:false,message:"Valid staff required"});
  ok(res,await prisma.complaint.update({where:{id:req.params.id},data:{assignedToId:body.staffId,status:ComplaintStatus.ASSIGNED,serviceFee:body.serviceFee}}),"Complaint assigned");
}catch(e){next(e)}});

router.patch("/complaints/:id/status",auth,roles(Role.ADMIN,Role.STAFF),async(req:AuthedRequest,res,next)=>{try{
  const body=z.object({status:z.nativeEnum(ComplaintStatus)}).parse(req.body);
  const current=await prisma.complaint.findUnique({where:{id:req.params.id}});
  if(!current) return res.status(404).json({success:false,message:"Complaint not found"});
  if(req.user!.role===Role.STAFF && current.assignedToId!==req.user!.id) return res.status(403).json({success:false,message:"Forbidden"});
  const allowed:Record<string,ComplaintStatus[]> = {
    ASSIGNED:[ComplaintStatus.IN_PROGRESS],
    IN_PROGRESS:[ComplaintStatus.RESOLVED],
    PENDING:[ComplaintStatus.REJECTED]
  };
  if(req.user!.role===Role.STAFF && !allowed[current.status]?.includes(body.status)) return res.status(400).json({success:false,message:"Invalid status transition"});
  ok(res,await prisma.complaint.update({where:{id:req.params.id},data:{status:body.status,resolvedAt:body.status===ComplaintStatus.RESOLVED?new Date():undefined}}),"Status updated");
}catch(e){next(e)}});

router.post("/complaints/:id/feedback",auth,roles(Role.CITIZEN),async(req:AuthedRequest,res,next)=>{try{
  const body=z.object({rating:z.number().int().min(1).max(5),comment:z.string().max(500).optional()}).parse(req.body);
  const c=await prisma.complaint.findUnique({where:{id:req.params.id}});
  if(!c || c.citizenId!==req.user!.id || c.status!==ComplaintStatus.RESOLVED) return res.status(400).json({success:false,message:"Feedback allowed only on your resolved complaint"});
  ok(res,await prisma.feedback.create({data:{...body,complaintId:c.id,userId:req.user!.id}}),"Feedback submitted");
}catch(e){next(e)}});

router.get("/users",auth,roles(Role.ADMIN),async(req,res)=>{
  const role=req.query.role as Role|undefined;
  ok(res,await prisma.user.findMany({where:role?{role}:{},select:{id:true,name:true,email:true,role:true,isActive:true,createdAt:true},orderBy:{createdAt:"desc"}}));
});
router.patch("/users/:id/role",auth,roles(Role.ADMIN),async(req,res,next)=>{try{
  const body=z.object({role:z.nativeEnum(Role)}).parse(req.body);
  ok(res,await prisma.user.update({where:{id:req.params.id},data:{role:body.role}}),"Role updated");
}catch(e){next(e)}});

router.get("/admin/stats",auth,roles(Role.ADMIN),async(_req,res)=>{
  const [users,complaints,pending,resolved,payments,revenue]=await Promise.all([
    prisma.user.count(),prisma.complaint.count(),prisma.complaint.count({where:{status:ComplaintStatus.PENDING}}),
    prisma.complaint.count({where:{status:ComplaintStatus.RESOLVED}}),prisma.payment.count({where:{status:PaymentStatus.COMPLETED}}),
    prisma.payment.aggregate({_sum:{amount:true},where:{status:PaymentStatus.COMPLETED}})
  ]);
  ok(res,{users,complaints,pending,resolved,payments,revenue:Number(revenue._sum.amount||0)});
});

router.get("/payments",auth,async(req:AuthedRequest,res)=>{
  const where=req.user!.role===Role.CITIZEN?{userId:req.user!.id}:{};
  ok(res,await prisma.payment.findMany({where,include:{complaint:{select:{id:true,title:true}}},orderBy:{createdAt:"desc"}}));
});

router.post("/payments/sslcommerz/initiate/:complaintId",auth,roles(Role.CITIZEN),async(req:AuthedRequest,res,next)=>{try{
  const complaint=await prisma.complaint.findUnique({where:{id:req.params.complaintId},include:{citizen:true}});
  if(!complaint || complaint.citizenId!==req.user!.id) return res.status(404).json({success:false,message:"Complaint not found"});
  const amount=Number(complaint.serviceFee);
  if(amount<=0) return res.status(400).json({success:false,message:"No service fee is due"});
  const tran_id=`CITY-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  await prisma.payment.create({data:{userId:req.user!.id,complaintId:complaint.id,amount,transactionId:tran_id}});
  const base=process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
  const frontend=process.env.FRONTEND_URL || "http://localhost:3000";
  const data:any={
    total_amount:amount,currency:"BDT",tran_id,
    success_url:`${base}/api/v1/payments/sslcommerz/success`,
    fail_url:`${base}/api/v1/payments/sslcommerz/fail`,
    cancel_url:`${base}/api/v1/payments/sslcommerz/cancel`,
    ipn_url:`${base}/api/v1/payments/sslcommerz/ipn`,
    shipping_method:"NO",product_name:`Service Fee - ${complaint.title}`,product_category:"City Service",product_profile:"general",
    cus_name:complaint.citizen.name,cus_email:complaint.citizen.email,cus_add1:complaint.citizen.address||"Dhaka",cus_city:"Dhaka",cus_country:"Bangladesh",cus_phone:complaint.citizen.phone||"01700000000"
  };
  const storeId=process.env.SSLC_STORE_ID, storePassword=process.env.SSLC_STORE_PASSWORD;
  if(!storeId || !storePassword) return res.status(500).json({success:false,message:"SSLCommerz sandbox credentials are not configured"});
  const sslcz=new SSLCommerzPayment(storeId,storePassword,process.env.SSLC_IS_LIVE==="true");
  const result:any=await sslcz.init(data);
  ok(res,{gatewayUrl:result.GatewayPageURL,transactionId:tran_id});
}catch(e){next(e)}});

async function finishPayment(req:any,res:any,status:PaymentStatus,path:string){
  const tran_id=req.body?.tran_id || req.query?.tran_id;
  if(tran_id) await prisma.payment.updateMany({where:{transactionId:tran_id},data:{status,rawResponse:req.body||req.query}});
  const frontend=process.env.FRONTEND_URL || "http://localhost:3000";
  return res.redirect(`${frontend}${path}?tran_id=${encodeURIComponent(tran_id||"")}`);
}
router.post("/payments/sslcommerz/success",(req,res)=>finishPayment(req,res,PaymentStatus.COMPLETED,"/payment/success"));
router.post("/payments/sslcommerz/fail",(req,res)=>finishPayment(req,res,PaymentStatus.FAILED,"/payment/cancel"));
router.post("/payments/sslcommerz/cancel",(req,res)=>finishPayment(req,res,PaymentStatus.CANCELLED,"/payment/cancel"));
router.post("/payments/sslcommerz/ipn",async(req,res)=>{res.sendStatus(200)});

app.use("/api/v1",router);

app.use((err:any,_req:any,res:any,_next:any)=>{
  console.error(err);
  if(err?.name==="ZodError") return res.status(400).json({success:false,message:"Validation failed",errors:err.issues});
  res.status(500).json({success:false,message:err?.message||"Internal server error"});
});
export default app;
