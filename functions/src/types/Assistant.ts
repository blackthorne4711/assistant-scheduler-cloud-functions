export interface AssistantData {
  firstname: string,
  lastname:  string,
  fullname:  string, // Concatenation of firstname + " " + lastname for easy of use
  phone:     string,
  type:      string
}

export interface Assistant extends AssistantData {
  id: string
}

export const EMPTY_ASSISTANT = {
  id:        "",
  firstname: "",
  lastname:  "",
  fullname:  "",
  phone:     "",
  type:      "",
};
