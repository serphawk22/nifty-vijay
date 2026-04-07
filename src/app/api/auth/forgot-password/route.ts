import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from "@/lib/mailer";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[Forgot Password] User not found for email: ${email}`);
      // Return 400 temporarily so the user knows they entered the wrong email during testing
      return NextResponse.json({ error: "No account found with that email address (Temporary Debug)" }, { status: 400 });
    }

    console.log(`[Forgot Password] User found: ${user.email}. Generating token...`);

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to DB
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    // Determine the base URL dynamically based on the incoming request to handle different local ports
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL 
        : `${protocol}://${host}`;
        
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    await sendPasswordResetEmail(user.email, resetUrl, user.name);

    return NextResponse.json({ success: true, message: "If an account exists, a reset link has been sent." });

  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while processing your request." }, { status: 500 });
  }
}
