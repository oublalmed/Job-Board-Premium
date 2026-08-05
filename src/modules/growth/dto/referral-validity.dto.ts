import { ApiProperty } from '@nestjs/swagger';

// Public probe used by the registration page to show "you were invited"
// without leaking who referred you.
export class ReferralValidityDto {
  @ApiProperty()
  valid!: boolean;
}
