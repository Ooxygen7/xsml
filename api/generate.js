export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // --- API 密钥轮询与故障切换逻辑 ---
  
  // 1. 从 Vercel 的环境变量中安全地获取所有 API 密钥
  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter(key => key); // 过滤掉未设置的密钥

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: 'API keys not configured on server' });
  }

  // 获取前端发送过来的对话历史
  const { currentHistory, systemPrompt, responseSchema } = req.body;

  // 2. 循环尝试每一个密钥
  for (const apiKey of apiKeys) {
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

      // 3. 如果请求成功 (status 200)，则立即返回结果
      if (googleResponse.ok) {
        const data = await googleResponse.json();
        // 成功，将结果返回给前端并终止函数
        return res.status(200).json(data);
      }

      // 如果密钥失效 (例如 400, 403, 429 错误), 记录错误并继续尝试下一个密钥
      console.warn(`API key ending with "...${apiKey.slice(-4)}" failed with status ${googleResponse.status}. Trying next key.`);

    } catch (error) {
      // 如果发生网络等其他错误, 记录下来并继续尝试下一个密钥
      console.warn(`Request failed with key ending in "...${apiKey.slice(-4)}". Error: ${error.message}. Trying next key.`);
    }
  }

  // 4. 如果所有密钥都尝试失败，则返回最终的错误信息
  console.error("All API keys failed.");
  res.status(500).json({ error: 'All available API keys failed. Please check server logs and API key status.' });
}