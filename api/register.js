// 사용자 등록 API
const users = new Map(); // 간단한 메모리 저장소

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
    const { pushToken, settings, location, userId } = req.body;
    
    console.log('사용자 등록:', { userId, pushToken: pushToken.substring(0, 20) + '...' });
    
    // 사용자 데이터 저장
    const userData = {
      pushToken,
      settings,
      location,
      lastUpdate: new Date().toISOString(),
      lastNotification: null,
      active: true
    };
    
    users.set(userId, userData);
    
    console.log(`총 등록된 사용자 수: ${users.size}`);
    
    res.status(200).json({ 
      success: true, 
      message: '사용자 등록 완료',
      userCount: users.size
    });
  } catch (error) {
    console.error('등록 오류:', error);
    res.status(500).json({ error: '서버 오류' });
  }
}
