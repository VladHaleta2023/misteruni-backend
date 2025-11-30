import { Injectable } from '@nestjs/common';

@Injectable()
export class TimezoneService {
    private readonly timezone: string;
    
    constructor() {
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    localToUTC(localDate: Date): Date {
        return new Date(localDate.toISOString());
    }

    utcToLocal(utcDate: Date): Date {
        return new Date(utcDate.toLocaleString('en-US', { timeZone: this.timezone }));
    }

    getStartOfTodayUTC(): Date {
        const localNow = new Date();
        const localStartOfDay = new Date(
            localNow.getFullYear(),
            localNow.getMonth(),
            localNow.getDate()
        );
        return this.localToUTC(localStartOfDay);
    }

    getEndOfTodayUTC(): Date {
        const localNow = new Date();
        const localEndOfDay = new Date(
            localNow.getFullYear(),
            localNow.getMonth(),
            localNow.getDate(),
            23, 59, 59, 999
        );
        return this.localToUTC(localEndOfDay);
    }

    getDaysDifference(fromDate: Date, toDate: Date = new Date()): number {
        const fromLocal = this.utcToLocal(fromDate);
        const toLocal = this.utcToLocal(toDate);
        
        const fromDateOnly = new Date(fromLocal.getFullYear(), fromLocal.getMonth(), fromLocal.getDate());
        const toDateOnly = new Date(toLocal.getFullYear(), toLocal.getMonth(), toLocal.getDate());
        
        const timeDiff = toDateOnly.getTime() - fromDateOnly.getTime();
        return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    }

    formatDateForTimezone(date: Date, timezone?: string): string {
        const targetTimezone = timezone || this.timezone;
        return date.toLocaleString('en-US', { timeZone: targetTimezone });
    }
}