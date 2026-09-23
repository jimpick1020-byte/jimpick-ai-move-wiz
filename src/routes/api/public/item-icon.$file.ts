import { createFileRoute } from "@tanstack/react-router";

/**
 * 생성된 품목 3D 아이콘 그림을 보여 줍니다.
 * 견적서·고객 공유 화면·이미지 견적서에서 로그인 없이 그림만 불러올 수 있게 하는 통로입니다.
 * (주소에는 추측할 수 없는 무작위 id 만 들어가고, 고객 정보는 담기지 않습니다)
 */
export const Route = createFileRoute("/api/public/item-icon/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = String(params.file || "").replace(/\.png$/i, "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("item_icons")
          .select("image_path, storage_path, status, active")
          .eq("id", id)
          .eq("status", "ready")
          .eq("active", true)
          .maybeSingle();
        const r = row as { image_path?: string | null; storage_path?: string | null } | null;
        const path = r?.image_path || r?.storage_path;
        if (!path) return new Response("Not found", { status: 404 });

        const file = await supabaseAdmin.storage.from("item-icons").download(path);
        if (file.error || !file.data) return new Response("Not found", { status: 404 });

        return new Response(await file.data.arrayBuffer(), {
          headers: {
            "Content-Type": path.endsWith(".jpg") ? "image/jpeg" : "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
