export interface AlertData {
  alertDate: string, // YYYY-MM-DD
  alertType: string,
  alertTitle: string,
  alertText: string
}

export interface Alert extends AlertData {
  id: string
}
