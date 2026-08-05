import { ApiProperty } from '@nestjs/swagger';

// The referrer's own view: their share code and the conversion funnel —
// how many signed up via the link, and how many converted (verified email).
export class ReferralDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  signups!: number;

  @ApiProperty()
  conversions!: number;
}
