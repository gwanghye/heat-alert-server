// 날씨 체크 및 알림 발송 API
import fetch from 'node-fetch';

const users = new Map(); // 메모리 저장소 (실제로는 여러 인스턴스 간 공유 안됨)
const OPENWEATHER_API_KEY = '3923ad334904ee79a3ee2087a30a6843';

// KOSHA WBGT 계산 함수
function calculateKOSHAFeelsLike(temperature, humidity, windSpeed, uvIndex = 5) {
  const wetBulbTemp = temperature * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) +
                      Math.atan(temperature + humidity) - 
                      Math.atan(humidity - 1.676331) +
                      0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 
                      4.686035;
  
  const radiationEffect = uvIndex * 2;
  const globeTemp = temperature + radiationEffect - (windSpeed * 1.5);
  const wbgt = 0.7 * wetBulbTemp + 0.2 * globeTemp + 0.1 * temperature;
  
  return Math.round(wbgt * 10) / 10;
}

function getDangerLevel(feelsLike) {
  if (feelsLike < 31) return "안전";
  if (feelsLike < 33) return "관심";
  if (feelsLike < 35) return "주의";
  if (feelsLike < 38) return "경고";
  return "위험";
}

function getSafetyMessage(dangerLevel) {
  switch (dangerLevel) {
    case "안전": return "현재 온도는 안전합니다.";
    case "관심": return "온도가 상승하고 있습니다. 수분 섭취를 늘려주세요.";
    case "주의": return "온열질환 주의가 필요합니다. 휴식을 자주 취하세요.";
    case "경고": return "온열질환 위험이 높습니다. 30분마다 휴식을 취하세요.";
    case "위험": return "온열질환 위험이 매우 높습니다. 실외 작업을 중단하세요.";
    default: return "온도 정보를 확인할 수 없습니다.";
  }
}

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('날씨 체크 시작:', new Date().toISOString());
    
    // 테스트용 - 실제로는 등록된 사용자가 있어야 함
    if (users.size === 0) {
      console.log('등록된 사용자가 없습니다.');
      return res.status(200).json({ 
        success: true, 
        message: '등록된 사용자가 없습니다.',
        userCount: 0
      });
    }
    
    const now = new Date();
    const currentDay = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);
    
    console.log(`현재 시간: ${currentDay} ${currentTime}`);
    
    let notificationCount = 0;
    
    // 각 사용자에 대해 날씨 체크
    for (const [userId, user] of users.entries()) {
      try {
        // 알림 비활성화된 사용자 스킵
        if (!user.active || !user.settings.enabled) {
          continue;
        }
        
        // 작업 시간 체크
        const workDays = user.settings.workDays || ['월', '화', '수', '목', '금'];
        const workStartTime = user.settings.workStartTime || '09:00';
        const workEndTime = user.settings.workEndTime || '18:00';
        
        if (!workDays.includes(currentDay) || 
            currentTime < workStartTime || 
            currentTime > workEndTime) {
          console.log(`작업 시간 외: ${userId.substring(0, 20)}...`);
          continue;
        }
        
        // 마지막 알림 시간 체크 (1시간 간격)
        const lastNotification = user.lastNotification ? new Date(user.lastNotification) : null;
        const timeSinceLastNotification = lastNotification ? 
          (now - lastNotification) / (1000 * 60) : 999;
        
        if (timeSinceLastNotification < 60) {
          console.log(`알림 대기 중: ${userId.substring(0, 20)}... (${Math.floor(timeSinceLastNotification)}분 전)`);
          continue;
        }
        
        // 날씨 API 호출
        const lat = user.location?.latitude || 37.5665;
        const lon = user.location?.longitude || 126.9780;
        
        console.log(`날씨 API 호출: ${lat}, ${lon}`);
        
        const weatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`,
          { timeout: 10000 }
        );
        
        if (!weatherResponse.ok) {
          console.error('날씨 API 오류:', weatherResponse.status);
          continue;
        }
        
        const weatherData = await weatherResponse.json();
        const temperature = weatherData.main.temp;
        const humidity = weatherData.main.humidity;
        const windSpeed = weatherData.wind.speed;
        
        const feelsLike = calculateKOSHAFeelsLike(temperature, humidity, windSpeed);
        const dangerLevel = getDangerLevel(feelsLike);
        
        console.log(`날씨 정보: ${temperature}°C, 체감온도: ${feelsLike}°C, 위험도: ${dangerLevel}`);
        
        // 관심 이상일 때만 알림 발송 (주의에서 관심으로 변경)
        if (['관심', '주의', '경고', '위험'].includes(dangerLevel)) {
          // Expo Push API 호출
          const pushMessage = {
            to: user.pushToken,
            sound: 'default',
            title: `🚨 온열질환 ${dangerLevel} 단계`,
            body: `현재 ${temperature.toFixed(1)}°C, 체감온도 ${feelsLike}°C입니다. ${getSafetyMessage(dangerLevel)}`,
            data: { 
              dangerLevel, 
              feelsLike,
              temperature: temperature.toFixed(1),
              timestamp: now.toISOString()
            },
            priority: 'high'
          };
          
          const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pushMessage)
          });
          
          if (pushResponse.ok) {
            // 마지막 알림 시간 업데이트
            user.lastNotification = now.toISOString();
            users.set(userId, user);
            notificationCount++;
            
            console.log(`알림 발송 성공: ${userId.substring(0, 20)}... - ${dangerLevel}`);
          } else {
            console.error('푸시 알림 발송 실패:', await pushResponse.text());
          }
        } else {
          console.log(`안전 단계: ${userId.substring(0, 20)}... - ${dangerLevel}`);
        }
        
      } catch (userError) {
        console.error('사용자 처리 오류:', userError);
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: `${users.size}명 체크, ${notificationCount}개 알림 발송`,
      userCount: users.size,
      notificationCount
    });
    
  } catch (error) {
    console.error('날씨 체크 오류:', error);
    res.status(500).json({ error: '서버 오류: ' + error.message });
  }
}
