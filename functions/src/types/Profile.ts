export interface ProfileData {
  email: string,
  firstname: string,
  lastname: string
}

export interface Profile extends ProfileData {
  id: string
}