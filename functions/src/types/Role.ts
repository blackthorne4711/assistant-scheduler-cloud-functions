export interface RoleData {
  admin: boolean,
  userForAssistants: Array<string>
}

export interface Role extends RoleData {
  id: string
}