import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum.js';

// Documentation-only, same reasoning as AuthTokensResponseDto — mirrors
// AuthController.getProfile's actual inline return shape.
export class MeResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role, isArray: true })
  roles!: Role[];
}
