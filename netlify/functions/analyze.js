const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async function (event) {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const query = (body.query || "").trim();

    if (!query) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ result: "Напиши проблему текстом. Не играй в молчанку." }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ result: "Ошибка: Нет GEMINI_API_KEY в настройках Netlify." }),
      };
    }

    const systemPrompt = `Ты — KHAN. Жесткая система дисциплины.
Поставь жесткий диагноз проблеме: "${query}".
Никакого сочувствия. Вскрой ложь. Ответ 2-3 предложения.
В конце: "Решение — в Пути KHAN."`;

    const url =
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      }),
    });

    const raw = await resp.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!resp.ok) {
      console.log("Gemini HTTP:", resp.status);
      console.log("Gemini raw:", raw);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ result: `Ошибка Gemini (HTTP ${resp.status}). Проверь логи Netlify.` }),
      };
    }

    if (data?.error) {
      console.log("Gemini error:", data.error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ result: "Ошибка Gemini: " + (data.error.message || "unknown") }),
      };
    }

    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gemini не вернул текст. Либо лимит, либо блокировка, либо пустой ответ.";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ result }),
    };
  } catch (e) {
    console.log("Function crash:", e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ result: "Ошибка сервера. Смотри логи Netlify." }),
    };
  }
};
