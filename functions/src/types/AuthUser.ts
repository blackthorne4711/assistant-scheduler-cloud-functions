export interface AuthUserData {
  uid: string,
  email: string,
  emailVerified: boolean,
  disabled: boolean
}

export interface AuthUser extends AuthUserData {
  id: string
}