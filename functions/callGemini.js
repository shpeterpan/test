// 이 파일은 Netlify 서버에서 실행되며 브라우저에 API 키를 노출하지 않고 안전하게 Gemini API를 호출합니다.
// GitHub 프로젝트의 루트에 'netlify' 폴더를 만들고, 그 안에 'functions' 폴더를 만든 후 이 파일을 저장하세요.
// 최종 경로: /netlify/functions/callGemini.js

exports.handler = async (event, context) => {
  // CORS 프리플라이트(OPTIONS) 요청 처리
  const headers = {
    'Access-Control-Allow-Origin': '*', // 필요 시 특정 도메인으로 제한 가능
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "허용되지 않는 메소드입니다. POST 요청만 지원합니다." })
    };
  }

  try {
    // 1. 브라우저가 보낸 요청 데이터(payload) 파싱
    const { apiType, originalPayload } = JSON.parse(event.body);
    
    // 2. Netlify 환경 변수에서 안전하게 API 키 로드
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Netlify 서버에 GEMINI_API_KEY 환경 변수가 설정되지 않았습니다." }),
      };
    }

    // 3. 요청 유형(apiType)에 따른 지원 모델 및 엔드포인트 세팅
    let apiUrl;
    let model;

    switch (apiType) {
      case 'text':
        // 텍스트 생성용 권장 모델
        model = 'gemini-2.5-flash-preview-09-2025';
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        break;
      case 'image':
        // 이미지 생성용 권장 모델
        model = 'imagen-4.0-generate-001';
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
        break;
      case 'tts':
        // 음성 합성용 권장 모델
        model = 'gemini-2.5-flash-preview-tts';
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "지원하지 않는 API 유형입니다. (text, image, tts 중 선택)" }),
        };
    }

    // 4. 지수적 백오프(Exponential Backoff)를 적용한 Gemini API 실제 호출 시도
    let response;
    let data;
    let delay = 1000;
    const maxRetries = 5;

    for (let i = 0; i < maxRetries; i++) {
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(originalPayload),
        });

        data = await response.json();
        if (response.ok) break; // 성공 시 루프 탈출
      } catch (err) {
        if (i === maxRetries - 1) throw err; // 마지막 시도도 실패하면 에러 던짐
      }
      
      // 실패 시 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }

    if (!response || !response.ok) {
      return {
        statusCode: response ? response.status : 500,
        headers,
        body: JSON.stringify({ 
          error: "Gemini API 호출 실패", 
          details: data 
        }),
      };
    }

    // 5. 안전하게 정제된 결과를 클라이언트 브라우저로 반환
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error("서버리스 함수 실행 오류:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "서버리스 환경에서 요청을 처리하는 중 예기치 못한 에러가 발생했습니다." }),
    };
  }
};
