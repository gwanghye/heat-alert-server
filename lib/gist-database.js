// lib/gist-database.js - GitHub Gist를 데이터베이스로 사용하는 유틸리티

import fetch from 'node-fetch';

// GitHub Gist 설정
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Vercel 환경변수에서 가져옴
const GIST_ID = process.env.GIST_ID; // Vercel 환경변수에서 가져옴
const GITHUB_API_BASE = 'https://api.github.com';

class GistDatabase {
  constructor() {
    this.cache = null;
    this.lastFetch = null;
    this.cacheDuration = 5 * 60 * 1000; // 5분 캐시
  }

  // Gist에서 데이터 읽기
  async loadData() {
    try {
      // 캐시가 유효하면 캐시 반환
      if (this.cache && this.lastFetch && 
          (Date.now() - this.lastFetch) < this.cacheDuration) {
        return this.cache;
      }

      console.log('Gist에서 데이터 로딩 중...');
      
      const response = await fetch(`${GITHUB_API_BASE}/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (!response.ok) {
        throw new Error(`Gist 읽기 실패: ${response.status}`);
      }

      const gist = await response.json();
      const fileContent = gist.files['users.json']?.content;
      
      if (!fileContent) {
        console.log('users.json 파일이 없음, 빈 데이터 반환');
        return { users: {}, lastUpdate: new Date().toISOString() };
      }

      const data = JSON.parse(fileContent);
      
      // 캐시 업데이트
      this.cache = data;
      this.lastFetch = Date.now();
      
      console.log(`${Object.keys(data.users || {}).length}명의 사용자 데이터 로딩 완료`);
      return data;
      
    } catch (error) {
      console.error('Gist 데이터 로딩 오류:', error);
      
      // 캐시가 있으면 캐시 반환
      if (this.cache) {
        console.log('캐시된 데이터 사용');
        return this.cache;
      }
      
      // 캐시도 없으면 빈 데이터 반환
      return { users: {}, lastUpdate: new Date().toISOString() };
    }
  }

  // Gist에 데이터 저장
  async saveData(data) {
    try {
      console.log('Gist에 데이터 저장 중...');
      
      const updatedData = {
        ...data,
        lastUpdate: new Date().toISOString(),
        version: (data.version || 0) + 1
      };

      const response = await fetch(`${GITHUB_API_BASE}/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'users.json': {
              content: JSON.stringify(updatedData, null, 2)
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gist 저장 실패: ${response.status}`);
      }

      // 캐시 업데이트
      this.cache = updatedData;
      this.lastFetch = Date.now();
      
      console.log(`데이터 저장 완료 (버전: ${updatedData.version})`);
      return true;
      
    } catch (error) {
      console.error('Gist 데이터 저장 오류:', error);
      return false;
    }
  }

  // 사용자 등록
  async registerUser(userId, userData) {
    try {
      const data = await this.loadData();
      
      data.users = data.users || {};
      data.users[userId] = {
        ...userData,
        registeredAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      };
      
      const success = await this.saveData(data);
      return success;
      
    } catch (error) {
      console.error('사용자 등록 오류:', error);
      return false;
    }
  }

  // 사용자 설정 업데이트
  async updateUser(userId, updates) {
    try {
      const data = await this.loadData();
      
      if (!data.users || !data.users[userId]) {
        console.log('사용자를 찾을 수 없음:', userId);
        return false;
      }
      
      data.users[userId] = {
        ...data.users[userId],
        ...updates,
        lastUpdate: new Date().toISOString()
      };
      
      const success = await this.saveData(data);
      return success;
      
    } catch (error) {
      console.error('사용자 업데이트 오류:', error);
      return false;
    }
  }

  // 활성 사용자 목록 가져오기
  async getActiveUsers() {
    try {
      const data = await this.loadData();
      
      if (!data.users) {
        return [];
      }
      
      const users = Object.entries(data.users)
        .filter(([userId, user]) => user.active && user.settings?.enabled)
        .map(([userId, user]) => ({ userId, ...user }));
      
      return users;
      
    } catch (error) {
      console.error('활성 사용자 조회 오류:', error);
      return [];
    }
  }

  // 사용자 마지막 알림 시간 업데이트
  async updateLastNotification(userId, timestamp) {
    try {
      const data = await this.loadData();
      
      if (data.users && data.users[userId]) {
        data.users[userId].lastNotification = timestamp;
        data.users[userId].lastUpdate = new Date().toISOString();
        
        const success = await this.saveData(data);
        return success;
      }
      
      return false;
      
    } catch (error) {
      console.error('마지막 알림 시간 업데이트 오류:', error);
      return false;
    }
  }

  // 통계 정보
  async getStats() {
    try {
      const data = await this.loadData();
      const users = data.users || {};
      
      const totalUsers = Object.keys(users).length;
      const activeUsers = Object.values(users).filter(user => user.active).length;
      const enabledUsers = Object.values(users).filter(user => user.settings?.enabled).length;
      
      return {
        totalUsers,
        activeUsers,
        enabledUsers,
        lastUpdate: data.lastUpdate,
        version: data.version || 0
      };
      
    } catch (error) {
      console.error('통계 조회 오류:', error);
      return { totalUsers: 0, activeUsers: 0, enabledUsers: 0 };
    }
  }
}

// 싱글톤 인스턴스 생성
const gistDB = new GistDatabase();

export default gistDB;
