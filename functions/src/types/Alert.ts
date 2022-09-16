export interface AlertData {
  date:  string, // YYYY-MM-DD
  type:  string,
  title: string,
  text:  string
}

export interface Alert extends AlertData {
  id: string
}
