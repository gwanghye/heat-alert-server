// 설정 업데이트 API
const users = new Map();

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pushToken, settings, location } = req.body;
    
    console.log('설정 업데이트:', { pushToken: pushToken.substring(0, 20) + '...' });
    
    // 기존 사용자 데이터 가져오기
    const existingData = users.get(pushToken);
    
    if (!existingData) {
      // 새 사용자로 등록
      const userData = {
        pushToken,
        settings,
        location,
        lastUpdate: new Date().toISOString(),
        lastNotification: null,
        active: true
      };
      users.set(pushToken, userData);
      console.log('새 사용자 등록');
    } else {
      // 설정 업데이트
      const updatedData = {
        ...existingData,
        settings,
        location,
        lastUpdate: new Date().toISOString()
      };
      users.set(pushToken, updatedData);
      console.log('기존 사용자 설정 업데이트');
    }
    
    res.status(200).json({ 
      success: true, 
      message: '설정 업데이트 완료',
      userCount: users.size
    });
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
}
