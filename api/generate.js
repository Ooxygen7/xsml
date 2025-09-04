export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 从 Vercel 的环境变量中安全地获取所有 API 密钥
  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter(key => key);

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: 'API keys not configured on server' });
  }

  // 获取前端发送过来的数据, 包括新的 userProfile
  const { currentHistory, systemPrompt, responseSchema, userProfile } = req.body;

  // --- 将用户个人资料动态注入到系统提示中 ---
  let fullSystemPrompt = systemPrompt;
  if (userProfile && userProfile.name) {
    const profileContext = `
      重要：请在整个故事中始终使用以下玩家角色信息来称呼和描述玩家。这是最高优先级的指令。
      - 代号：${userProfile.name}
      - 性别：${userProfile.gender}
      - 初始能力评级：${userProfile.rating}
      ---
    `;
    fullSystemPrompt = profileContext + systemPrompt;
  }

  // 循环尝试每一个密钥
  for (const apiKey of apiKeys) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
      contents: currentHistory,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.9,
      },
      // 使用包含用户信息的完整系统提示
      systemInstruction: { parts: [{ text: fullSystemPrompt }] },
    };

    try {
      const googleResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (googleResponse.ok) {
        const data = await googleResponse.json();
        return res.status(200).json(data);
      }

      console.warn(`API key ending with "...${apiKey.slice(-4)}" failed with status ${googleResponse.status}. Trying next key.`);

    } catch (error) {
      console.warn(`Request failed with key ending in "...${apiKey.slice(-4)}". Error: ${error.message}. Trying next key.`);
    }
  }

  // 如果所有密钥都尝试失败，则返回最终的错误信息
  console.error("All API keys failed.");
  res.status(500).json({ error: 'All available API keys failed. Please check server logs and API key status.' });
}