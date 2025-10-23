// 이 파일은 Netlify 서버에서만 실행됩니다.
// GitHub 프로젝트의 루트에 'netlify' 폴더를 만들고,
// 그 안에 'functions' 폴더를 만든 후, 이 파일을 'callGemini.js'로 저장하세요.
// (최종 경로: /netlify/functions/callGemini.js)

exports.handler = async (event, context) => {
  // 1. 브라우저가 보낸 요청 데이터(payload)를 받습니다.
  const { apiType, originalPayload } = JSON.parse(event.body);
  
  // 2. Netlify 환경 변수에 숨겨둔 API 키를 불러옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API 키가 서버에 설정되지 않았습니다." }),
    };
  }

  // 3. 요청 유형(apiType)에 따라 올바른 Gemini API 주소를 결정합니다.
  let apiUrl;
  let model;

  switch (apiType) {
    case 'text':
      model = 'gemini-2.5-flash-preview-09-2025';
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      break;
    case 'image':
      model = 'imagen-3.0-generate-002';
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
      break;
    case 'tts':
      model = 'gemini-2.5-flash-preview-tts';
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      break;
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "알 수 없는 API 유형입니다." }),
      };
  }

  try {
    // 4. 서버(여기)에서 진짜 Gemini API로 요청을 보냅니다.
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(originalPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      throw new Error(`Gemini API 오류: ${response.statusText}`);
    }

    // 5. 성공적인 결과를 브라우저로 다시 전달합니다.
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("서버 함수 오류:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "서버에서 요청 처리 중 오류가 발생했습니다." }),
    };
  }
};
