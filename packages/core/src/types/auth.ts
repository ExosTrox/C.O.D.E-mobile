export interface User {
  id: string;
  username: string;
  createdAt: Date;
  totpEnabled: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  password: string;
  totpCode?: string;
  deviceName: string;
}
