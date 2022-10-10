export interface ProfileData {
  email:     string,
  firstname: string,
  lastname:  string,
  phone:     string,
}

export interface Profile extends ProfileData {
  id: string
}

export const EMPTY_PROFILE = {
  id:        "",
  email:     "",
  firstname: "",
  lastname:  "",
  phone:     "",
};
