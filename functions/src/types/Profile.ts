export interface ProfileData {
  email: string,
  firstName: string,
  lastName: string
}

export interface Profile extends ProfileData {
  id: string
}