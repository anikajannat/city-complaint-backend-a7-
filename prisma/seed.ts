import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function upsertUser(name:string,email:string,password:string,role:Role) {
  await prisma.user.upsert({
    where:{email},
    update:{name, role, isActive:true},
    create:{name,email,password:await bcrypt.hash(password,12),role}
  });
}
async function main(){
  await upsertUser("City Admin", process.env.ADMIN_EMAIL || "admin@cityservice.com", process.env.ADMIN_PASSWORD || "Admin123!", Role.ADMIN);
  await upsertUser("Service Staff", process.env.STAFF_EMAIL || "staff@cityservice.com", process.env.STAFF_PASSWORD || "Staff123!", Role.STAFF);
  await upsertUser("Demo Citizen", process.env.CITIZEN_EMAIL || "citizen@cityservice.com", process.env.CITIZEN_PASSWORD || "Citizen123!", Role.CITIZEN);
  for (const name of ["Road & Transport","Waste Management","Water Supply","Street Light","Drainage"]) {
    await prisma.category.upsert({where:{name},update:{},create:{name}});
  }
  console.log("Seed complete");
}
main().finally(()=>prisma.$disconnect());
