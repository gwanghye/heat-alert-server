// 사용자 등록 API (Gist 데이터베이스 사용)
import gistDB from '../lib/gist-database.js';

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
    
    // Gist 데이터베이스에 사용자 데이터 저장
    const userData = {
      pushToken,
      settings,
      location,
      lastNotification: null,
      active: true
    };
    
    const success = await gistDB.registerUser(userId, userData);
    
    if (!success) {
      throw new Error('데이터베이스 저장 실패');
    }
    
    // 통계 정보 가져오기
    const stats = await gistDB.getStats();
    
    console.log(`사용자 등록 완료. 총 등록된 사용자 수: ${stats.totalUsers}`);
    
    res.status(200).json({ 
      success: true, 
      message: '사용자 등록 완료',
      userCount: stats.totalUsers,
      activeUsers: stats.activeUsers
    });
  } catch (error) {
    console.error('등록 오류:', error);
    res.status(500).json({ error: '서버 오류: ' + error.message });
  }
}
