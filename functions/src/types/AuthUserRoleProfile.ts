import {AuthUser} from "./AuthUser"
import {Role} from "./Role"
import {Profile} from "./Profile"

export interface AuthUserRoleProfile extends AuthUser, Role, Profile { }
