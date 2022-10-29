export interface ActivityTypeData {
  name:                  string,
  description:           string, // Free text field
  // Availability
  availableToUsers:      boolean,       // If this should be available to users (to book themselves)
  typelessSlots:         boolean,       // If slot is without type (i.e. single slot, not an array)
}

export interface ActivityType extends ActivityTypeData {
  id: string
}

export const EMPTY_ACTIVITYTYPE = {
  id:                   "",
  name:                 "",
  description:          "",
  availableToUsers:     false,
  typelessSlots:        false,
};
