import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Requisition from "@/models/Requisition";
import { COLLEGES } from "@/constants/colleges";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

const collegeNameById = COLLEGES.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});

export async function GET(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await connectDB();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const collegeId = searchParams.get("collegeId");

  const match = {};
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }
  if (collegeId) match.collegeId = collegeId;

  const [byStatus, byCollege, byDepartment, byCategory, totals] = await Promise.all([
    Requisition.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 }, totalCost: { $sum: "$estimatedCost" } } },
    ]),
    Requisition.aggregate([
      { $match: match },
      { $group: { _id: "$collegeId", count: { $sum: 1 }, totalCost: { $sum: "$estimatedCost" } } },
    ]),
    Requisition.aggregate([
      { $match: match },
      { $group: { _id: "$department", count: { $sum: 1 }, totalCost: { $sum: "$estimatedCost" } } },
    ]),
    Requisition.aggregate([
      { $match: match },
      { $group: { _id: "$category", count: { $sum: 1 }, totalCost: { $sum: "$estimatedCost" } } },
    ]),
    Requisition.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, totalCost: { $sum: "$estimatedCost" } } },
    ]),
  ]);

  return NextResponse.json({
    totals: totals[0] || { count: 0, totalCost: 0 },
    byStatus,
    byCollege: byCollege.map((c) => ({ ...c, name: collegeNameById[c._id] || c._id })),
    byDepartment,
    byCategory,
  });
}
