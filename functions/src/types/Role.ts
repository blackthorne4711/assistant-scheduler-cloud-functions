export interface RoleData {
  admin:   boolean,
  trainer: boolean,
  userForAssistants: Array<string>
}

export interface Role extends RoleData {
  id: string
}
