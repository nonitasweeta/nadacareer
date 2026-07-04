// netlify/functions/analyze.mjs
// وسيط آمن بين المتصفح و Anthropic API — المفتاح يبقى في الخادم ولا يصل للمتصفح أبداً

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: { message: "Method not allowed" } }, { status: 405 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({ error: { message: "ANTHROPIC_API_KEY غير مضبوط في إعدادات Netlify" } }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }

  // نمرر فقط الحقول المسموحة — لا نسمح للمتصفح بالتحكم في النموذج أو الحدود
  const payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 1600, // هامش أوسع من نسخة المعاينة لتقليل احتمال البتر
    messages: body.messages,
  };
  if (body.tools) payload.tools = body.tools; // لمسار فحص LinkedIn بالرابط

  // حد حجم بسيط: 6MB على مستوى الطلب (PDF base64 ~ 4MB ملف)
  if (JSON.stringify(payload).length > 6_500_000) {
    return Response.json({ error: { message: "الطلب كبير جداً — استخدمي ملفاً أصغر من 4MB" } }, { status: 413 });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json({ error: { message: "فشل الاتصال بخدمة التحليل: " + e.message } }, { status: 502 });
  }
};

export const config = { path: "/api/analyze" };
