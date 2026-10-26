// Layout of ORBIT, all in px of the 390x450 screen of the Bip 6, and what the rings can show.

export const W = 390
export const SIDE = 34
export const TOP_Y = 40
export const DATE_TRACK = 3 // letter spacing of the date
export const BAT_TRACK = 1
export const BAT_GAP = 9 // between battery icon and percent
export const TIME_Y = 98
export const TIME_GAP = 22
export const TIME_TRACK = 2 // space between the digits of hours and minutes
export const AMPM_GAP = 8 // AM/PM right of the minutes, 12-hour format only
export const DAY_Y = 200
export const DAY_TRACK = 10 // letter spacing of the weekday
export const WX_Y = 240
export const WX_X = 98 // weather icon; temperature and high/low follow to the right
export const RING_LINE = 6
export const RING_Y = 362 // all ring centers on one line
export const VAL_TRACK = 1

// The three rings. x = center, r = radius, set = digit pictures of the value, def = content after
// installing, size = editor area and previews (see EDIT in make_assets.py).
export const SLOTS = [
  { id: 102, x: 65, r: 52, set: 'val', size: 'ring_s', def: 'cal' },
  { id: 103, x: 195, r: 64, set: 'big', size: 'ring_b', def: 'step' },
  { id: 104, x: 325, r: 52, set: 'val', size: 'ring_s', def: 'heart' },
]

// Ring contents: their type in the watchface editor (hmUI.edit_type, or an own type) and the data type
// that opens the matching app on tap (hmUI.data_type).
export const KINDS = ['step', 'heart', 'cal', 'battery', 'distance', 'pai', 'stand', 'spo2', 'stress']
export const KIND = {
  step: { edit: 'STEP', data: 'STEP' },
  heart: { edit: 'HEART', data: 'HEART' },
  cal: { edit: 'CAL', data: 'CAL' },
  battery: { edit: 'BATTERY', data: 'BATTERY' },
  distance: { edit: 'DISTANCE', data: 'DISTANCE' },
  // own type: the system's PAI is called "PAI today", ORBIT shows the PAI of the week (goal 100)
  pai: { own: 100110, data: 'PAI_WEEKLY' },
  stand: { edit: 'STAND', data: 'STAND' },
  spo2: { edit: 'SPO2', data: 'SPO2' },
  stress: { edit: 'STRESS', data: 'STRESS' },
}
