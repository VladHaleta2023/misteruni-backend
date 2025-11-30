import { Controller } from '@nestjs/common';
import { TimezoneService } from './timezone.service';

@Controller('timezone--no-spec')
export class TimezoneController {
  constructor(private readonly timezoneService: TimezoneService) {}
}
