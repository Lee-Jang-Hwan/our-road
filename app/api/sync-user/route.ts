import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Clerk 사용자를 Supabase users 테이블에 동기화하는 API
 *
 * 클라이언트에서 로그인 후 이 API를 호출하여 사용자 정보를 Supabase에 저장합니다.
 * 이미 존재하는 경우 업데이트하고, 없으면 새로 생성합니다.
 */
export async function POST(req: NextRequest) {
  try {
    // Clerk 인증 확인
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Request Body에서 사용자 정보 가져오기 (Client Side에서 전달)
    const body = await req.json();
    const { name, email, imageUrl } = body;

    // Supabase에 사용자 정보 동기화
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          clerk_id: userId, // 보안을 위해 auth()의 userId 사용
          name: name || "Unknown",
          email: email,
          image_url: imageUrl,
        },
        {
          onConflict: "clerk_id",
        },
      )
      .select()
      .single();

    if (error) {
      console.error("Supabase sync error:", error);
      return NextResponse.json(
        { error: "Failed to sync user", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (error) {
    console.error("Sync user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
