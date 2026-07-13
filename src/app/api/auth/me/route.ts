import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Resolve current session user from token
export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || ""
    const token = auth.replace("Bearer ", "")
    if (!token) return NextResponse.json({ user: null })

    const decoded = Buffer.from(token, "base64").toString("utf8")
    const [id] = decoded.split(":")
    if (!id) return NextResponse.json({ user: null })

    const account = await db.account.findUnique({
      where: { id },
      include: { insurance: true },
    })
    if (!account) return NextResponse.json({ user: null })

    return NextResponse.json({
      user: {
        id: account.id,
        email: account.email,
        mobile: account.mobile,
        role: account.role,
        name: account.name,
        city: account.city,
        state: account.state,
        specialization: account.specialization,
        bloodGroup: account.bloodGroup,
        biometricEnrolled: account.biometricEnrolled,
        addressLine: account.addressLine,
        landmark: account.landmark,
        pincode: account.pincode,
        membershipNumber: account.membershipNumber,
        bedCount: account.bedCount,
        capacityPerHour: account.capacityPerHour,
        govtIdType: account.govtIdType,
        govtIdNumber: account.govtIdNumber,
        upiId: account.upiId,
        serverLoginUser: account.serverLoginUser,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
