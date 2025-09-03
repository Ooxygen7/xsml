export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 从 Vercel 的环境变量中安全地获取 API 密钥
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // 获取前端发送过来的对话历史
  const { currentHistory, systemPrompt, responseSchema } = req.body;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const payload = {
    contents: currentHistory,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.9,
    },
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };

  try {
    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!googleResponse.ok) {
      const errorBody = await googleResponse.text();
      console.error('Google API Error:', errorBody);
      return res.status(googleResponse.status).json({ error: `Google API Error: ${errorBody}` });
    }

    const data = await googleResponse.json();
    
    // 将从 Google 收到的原始数据直接转发给前端
    res.status(200).json(data);

  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'Failed to fetch data from Google API' });
  }
}
