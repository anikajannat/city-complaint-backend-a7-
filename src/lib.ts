import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export const prisma = new PrismaClient();
export type AuthedRequest = Request & { user?: { id:string; role:Role; email:string } };

export function signToken(user:{id:string; role:Role; email:string}) {
  return jwt.sign(user, process.env.JWT_ACCESS_SECRET || "dev-secret", {expiresIn:"7d"});
}
export function auth(req:AuthedRequest,res:Response,next:NextFunction){
  const token = req.headers.authorization?.replace("Bearer ","");
  if(!token) return res.status(401).json({success:false,message:"Authentication required"});
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET || "dev-secret") as AuthedRequest["user"];
    next();
  } catch {
    return res.status(401).json({success:false,message:"Invalid or expired token"});
  }
}
export const roles = (...allowed:Role[]) => (req:AuthedRequest,res:Response,next:NextFunction) => {
  if(!req.user || !allowed.includes(req.user.role)) return res.status(403).json({success:false,message:"Forbidden"});
  next();
};
export const ok = (res:Response,data:any,message="Success") => res.json({success:true,message,data});
