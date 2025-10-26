export class DateUtils {
    public static getMonday(date: Date, weekOffset = 0): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        d.setDate(d.getDate() + diff + 7 * weekOffset);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    public static getSunday(date: Date, weekOffset = 0): Date {
        const monday = DateUtils.getMonday(date, weekOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return sunday;
    }
}