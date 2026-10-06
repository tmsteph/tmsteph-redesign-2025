// A fixed 24-hour clock scale keeps neighboring days directly comparable.
export function daySpan(event, date) {
  if (date < event.startDate || date > event.endDate) return null;
  if (!event.startTime || !event.endTime) return {flexible:true,left:0,width:100};
  const minutes = time => {const [hour,minute]=time.split(':').map(Number);return hour*60+minute;};
  const start = date===event.startDate ? minutes(event.startTime) : 0;
  const end = date===event.endDate ? minutes(event.endTime) : 1440;
  if (end <= start) return null;
  return {flexible:false,left:start/1440*100,width:(end-start)/1440*100};
}
